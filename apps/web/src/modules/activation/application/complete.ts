import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivationSession, JourneyEntry } from '../domain/types';
import { rowToSession } from './_mapper';

export class ConflictError extends Error {
  readonly status = 409 as const;
}

export async function completeActivation(
  client: SupabaseClient,
  userId: string,
  sessionId: string,
  acceptedFirstAction: boolean,
  idempotencyKey: string | null,
): Promise<ActivationSession> {
  if (idempotencyKey) {
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
    const { data: hit } = await (client as any)
      .schema('core')
      .from('idempotency_key')
      .select('response_body')
      .eq('user_id', userId)
      .eq('key_hash', keyHash)
      .eq('endpoint', '/activation/complete')
      .maybeSingle();
    if (hit?.response_body) return hit.response_body as ActivationSession;
  }

  // Fetch session — RLS scopes to owner
  const { data: session, error: fetchErr } = await (client as any)
    .schema('core')
    .from('activation_session')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (fetchErr || !session) throw new Error('Session not found');
  if (session['completed_at']) throw new ConflictError('Session already completed');

  // Save-only: set completed_at. Signal flush is a separate action (POST /activation/{id}/promote).
  const now = new Date().toISOString();
  const updatedJourney: JourneyEntry[] = [...((session['journey'] as JourneyEntry[]) ?? [])];

  const { data: updated, error: updateErr } = await (client as any)
    .schema('core')
    .from('activation_session')
    .update({ completed_at: now, journey: updatedJourney })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (updateErr || !updated) throw new Error(`Failed to complete session: ${updateErr?.message}`);

  const result = rowToSession(updated as Record<string, unknown>);

  if (idempotencyKey) {
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
    await (client as any)
      .schema('core')
      .from('idempotency_key')
      .upsert(
        {
          user_id: userId,
          key_hash: keyHash,
          endpoint: '/activation/complete',
          response_status: 200,
          response_body: result,
        },
        { onConflict: 'user_id,key_hash,endpoint' },
      );
  }

  return result;
}
