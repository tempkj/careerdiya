import type { SupabaseClient } from '@supabase/supabase-js';
import type { Signal, DerivedTwin, TwinContext, TwinFact } from '../domain/types';
import { deriveTwin } from './derive';
import { explainPath } from './fold';

export async function getTwin(
  client: SupabaseClient,
  userId: string,
): Promise<TwinContext | null> {
  // If any signals are unapplied, recompute before reading.
  const { count } = await (client as any)
    .schema('core')
    .from('twin_signal')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('applied', false);

  if (((count as number | null) ?? 0) > 0) {
    await deriveTwin(client, userId);
  }

  const { data, error } = await (client as any)
    .schema('core')
    .from('twin')
    .select('twin, version, updated_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return {
    ...(data['twin'] as DerivedTwin),
    version: data['version'] as number,
    updatedAt: data['updated_at'] as string,
  };
}

function buildExcerpt(payload: Record<string, unknown>): string {
  const fact = payload['fact'] as string | undefined;
  if (fact === 'desired_role' || fact === 'current_role') return String(payload['role'] ?? '');
  if (fact === 'gap_item') {
    const skill = String(payload['skill'] ?? '');
    return `${skill}: ${payload['have'] ? 'has' : 'lacks'}`;
  }
  return JSON.stringify(payload).slice(0, 200);
}

export interface TwinFactExplanation {
  path: string;
  fact: TwinFact;
  signal?: { source: string; occurredAt: string; excerpt: string };
}

export async function explainTwinFact(
  client: SupabaseClient,
  userId: string,
  path: string,
): Promise<TwinFactExplanation | null> {
  const twin = await getTwin(client, userId);
  if (!twin) return null;

  const fact = explainPath(twin, path);
  if (!fact) return null;

  const { data: row } = await (client as any)
    .schema('core')
    .from('twin_signal')
    .select('source, occurred_at, payload')
    .eq('id', fact.source)
    .eq('user_id', userId)
    .maybeSingle();

  const signal = row
    ? {
        source: row['source'] as string,
        occurredAt: row['occurred_at'] as string,
        excerpt: buildExcerpt(row['payload'] as Record<string, unknown>),
      }
    : undefined;

  return { path, fact, signal };
}

export interface SignalListPage {
  data: Pick<Signal, 'id' | 'source' | 'significance' | 'applied' | 'occurredAt'>[];
  page: { nextCursor: null; hasMore: false; limit: number };
}

export async function listSignals(
  client: SupabaseClient,
  userId: string,
  opts: { limit?: number; significance?: string },
): Promise<SignalListPage> {
  const limit = Math.min(opts.limit ?? 50, 100);

  let query = (client as any)
    .schema('core')
    .from('twin_signal')
    .select('id, source, significance, applied, occurred_at')
    .eq('user_id', userId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (opts.significance) query = query.eq('significance', opts.significance);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list signals: ${error.message}`);

  return {
    data: (data ?? []).map((row: Record<string, unknown>) => ({
      id: row['id'] as string,
      source: row['source'] as Signal['source'],
      significance: row['significance'] as Signal['significance'],
      applied: row['applied'] as boolean,
      occurredAt: row['occurred_at'] as string,
    })),
    page: { nextCursor: null, hasMore: false, limit },
  };
}
