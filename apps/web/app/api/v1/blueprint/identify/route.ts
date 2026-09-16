import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { getActivationSession } from '@modules/activation';
import { createSubstrateStore, computeTransition, normalizeRoleKey } from '@modules/knowledge';
import { createTaskIdentifier, type GateAnswers } from '@modules/blueprint';
import { Unauthorized, NotFound, UnprocessableEntity, InternalError, Forbidden } from '@/lib/api-error';

export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  let body: { sessionId?: string; weeklyHours?: number; gateAnswers?: GateAnswers };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  if (!body.sessionId?.trim()) return UnprocessableEntity('sessionId is required.');
  // gateAnswers itself is required (contract v1.7.0), but its contents are entirely optional —
  // ADR-013 sub-slice 3: the relevant-experience input (checkedSkills + relevantExperienceText)
  // is skippable, so an empty {} is a valid, complete gateAnswers value.
  if (!body.gateAnswers) return UnprocessableEntity('gateAnswers is required.');

  let session;
  try {
    session = await getActivationSession(supabase, body.sessionId.trim());
  } catch (err) {
    if (err instanceof Error && err.message === 'Session not found') return NotFound();
    return InternalError();
  }

  if (!session.desiredRole) return UnprocessableEntity('Session has no desired role set.');

  try {
    const substrateStore = createSubstrateStore(supabase);
    const [toSubstrate, fromSubstrate] = await Promise.all([
      substrateStore.get(session.desiredRole),
      session.currentRole ? substrateStore.get(session.currentRole) : Promise.resolve(null),
    ]);

    // No current role on the session -> nothing to diff against. Same honest
    // empty-skills stand-in as /blueprint/derive used before this slice.
    const fromPayload = fromSubstrate?.payload ?? {
      skills: [],
      market: { demand_signal: 'moderate' as const, demand_basis: 'no current role supplied' },
    };

    const delta = computeTransition(fromPayload, toSubstrate.payload, {
      fromRoleKey: session.currentRole ? normalizeRoleKey(session.currentRole) : 'none',
      toRoleKey: normalizeRoleKey(session.desiredRole),
    });

    const identifier = createTaskIdentifier(supabase);
    const { tasks, assessment } = await identifier.identify(delta, body.gateAnswers, toSubstrate.basis);

    return Response.json({ toRoleKey: delta.toRoleKey, tasks, assessment });
  } catch (err) {
    console.error('[blueprint/identify] unhandled error', err);
    return InternalError();
  }
}
