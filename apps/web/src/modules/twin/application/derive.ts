import type { SupabaseClient } from '@supabase/supabase-js';
import type { Signal, DerivedTwin } from '../domain/types';
import { foldSignals } from './fold';

async function fetchAllSignals(client: SupabaseClient, userId: string): Promise<Signal[]> {
  const { data, error } = await (client as any)
    .schema('core')
    .from('twin_signal')
    .select('id, user_id, source, significance, payload, applied, occurred_at')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch signals: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row['id'] as string,
    userId: row['user_id'] as string,
    source: row['source'] as Signal['source'],
    significance: row['significance'] as Signal['significance'],
    payload: row['payload'] as Record<string, unknown>,
    applied: row['applied'] as boolean,
    occurredAt: row['occurred_at'] as string,
  }));
}

// Derives the Twin from the full signal log and writes it back to core.twin.
// Always recomputes from scratch (guarantees re-derivability by construction).
// Marks all pending signals as applied; the trigger handles the readiness cascade.
export async function deriveTwin(client: SupabaseClient, userId: string): Promise<DerivedTwin> {
  const signals = await fetchAllSignals(client, userId);
  const { derived, unmappedSignalIds } = foldSignals(signals);

  if (unmappedSignalIds.length > 0) {
    console.warn(
      `[twin/derive] ${unmappedSignalIds.length} signal(s) accepted but unmapped ` +
        `(missing or unknown payload.fact): ${unmappedSignalIds.join(', ')}`,
    );
  }

  // Read current version to increment (no concurrent writers per user in v1).
  const { data: current } = await (client as any)
    .schema('core')
    .from('twin')
    .select('version')
    .eq('user_id', userId)
    .maybeSingle();

  const nextVersion = ((current?.['version'] as number) ?? 0) + 1;

  const { error: upsertErr } = await (client as any)
    .schema('core')
    .from('twin')
    .upsert(
      { user_id: userId, twin: derived, schema_version: 'twin/v1', version: nextVersion },
      { onConflict: 'user_id' },
    );

  if (upsertErr) throw new Error(`Failed to write twin: ${upsertErr.message}`);

  // Mark all unapplied signals as applied. The DB trigger fires per row that
  // transitions false→true and enqueues a readiness job (Epic 5 concern).
  const { error: applyErr } = await (client as any)
    .schema('core')
    .from('twin_signal')
    .update({ applied: true })
    .eq('user_id', userId)
    .eq('applied', false);

  if (applyErr) throw new Error(`Failed to mark signals applied: ${applyErr.message}`);

  return derived;
}
