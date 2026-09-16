import type { SupabaseClient } from '@supabase/supabase-js';
import { insertSignal, deriveTwin } from '@modules/twin';
import type { GapItem, PromoteResult } from '../domain/types';

export class PreconditionError extends Error {
  readonly status = 409 as const;
}

export async function promoteExploration(
  client: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<PromoteResult> {
  const { data: session, error: fetchErr } = await (client as any)
    .schema('core')
    .from('activation_session')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (fetchErr || !session) throw new Error('Session not found');

  // Must be saved (completedAt set) before promotion — ADR-010.
  if (!session['completed_at']) {
    throw new PreconditionError('Save the exploration before setting it as your goal.');
  }

  // Flush facts as signals with sourceRef=sessionId for provenance trace.
  const firstSignal = await insertSignal(client, userId, {
    source: 'system',
    significance: 'major',
    payload: {
      fact: 'desired_role',
      role: session['desired_role'],
      onetCode: session['onet_code'] ?? null,
      sessionId,
      origin: 'activation',
    },
    sourceRef: sessionId,
  });

  let signalsCreated = 1;

  if (session['current_role']) {
    await insertSignal(client, userId, {
      source: 'system',
      significance: 'major',
      payload: {
        fact: 'current_role',
        role: session['current_role'],
        sessionId,
        origin: 'activation',
      },
      sourceRef: sessionId,
    });
    signalsCreated++;
  }

  const gap = (session['gap'] ?? []) as GapItem[];
  for (const item of gap) {
    await insertSignal(client, userId, {
      source: 'system',
      significance: 'minor',
      payload: {
        fact: 'gap_item',
        skill: item.skill,
        have: item.have,
        confidence: item.confidence,
        sessionId,
        origin: 'activation',
      },
      sourceRef: sessionId,
    });
    signalsCreated++;
  }

  await deriveTwin(client, userId);

  return {
    sessionId,
    signalsCreated,
    firstSignalId: firstSignal.id,
    accepted: true,
  };
}
