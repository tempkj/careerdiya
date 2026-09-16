import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { getActivationSession } from '@modules/activation';
import { createSubstrateStore } from '@modules/knowledge';
import { Unauthorized, NotFound, UnprocessableEntity, InternalError, Forbidden } from '@/lib/api-error';

export async function GET(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId?.trim()) return UnprocessableEntity('sessionId is required.');

  let session;
  try {
    session = await getActivationSession(supabase, sessionId.trim());
  } catch (err) {
    if (err instanceof Error && err.message === 'Session not found') return NotFound();
    return InternalError();
  }

  if (!session.desiredRole) return UnprocessableEntity('Session has no desired role set.');

  try {
    const substrateStore = createSubstrateStore(supabase);
    // Pure projection of the existing substrate payload — no SubstratePayloadV1 extension
    // needed. (Distinct from ADR-013 §2's still-open "gate-phrasing storage" question, which
    // is about AI-generated per-role QUESTION PHRASING, a different not-yet-built feature;
    // this endpoint only ever reads payload.skills, already part of the schema.) On a cache
    // miss for an unseeded role, this call generates on demand (LiveSubstrateGenerator) and
    // persists the result — same lazy-fill side effect as /activation/start and
    // /blueprint/identify's own substrate fetches, ~15-20s on first touch for a novel role.
    const toSubstrate = await substrateStore.get(session.desiredRole);
    const skills = toSubstrate.payload.skills.map((skill) => ({
      name: skill.name,
      ...(skill.canonical_name ? { canonical_name: skill.canonical_name } : {}),
    }));

    return Response.json({ skills });
  } catch (err) {
    console.error('[blueprint/substrate-skills] unhandled error', err);
    return InternalError();
  }
}
