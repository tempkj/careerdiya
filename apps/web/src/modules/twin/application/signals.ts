import type { SupabaseClient } from '@supabase/supabase-js';
import type { Signal, SignalInput } from '../domain/types';

export async function insertSignal(
  client: SupabaseClient,
  userId: string,
  input: SignalInput,
): Promise<Signal> {
  const { data, error } = await (client as any)
    .schema('core')
    .from('twin_signal')
    .insert({
      user_id: userId,
      source: input.source,
      significance: input.significance,
      payload: input.payload,
      source_ref: input.sourceRef ?? null,
    })
    .select('id, user_id, source, significance, payload, applied, occurred_at')
    .single();

  if (error || !data) throw new Error(`Failed to insert signal: ${error?.message}`);

  return {
    id: data.id as string,
    userId: data.user_id as string,
    source: data.source as Signal['source'],
    significance: data.significance as Signal['significance'],
    payload: data.payload as Record<string, unknown>,
    applied: data.applied as boolean,
    occurredAt: data.occurred_at as string,
  };
}
