import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivationSession, ActivationSessionList } from '../domain/types';
import { rowToSession } from './_mapper';

export async function getActivationSession(
  client: SupabaseClient,
  sessionId: string,
): Promise<ActivationSession> {
  const { data, error } = await (client as any)
    .schema('core')
    .from('activation_session')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) throw new Error('Session not found');
  return rowToSession(data as Record<string, unknown>);
}

export async function getLatestActivation(client: SupabaseClient): Promise<ActivationSession> {
  const { data, error } = await (client as any)
    .schema('core')
    .from('activation_session')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) throw new Error('No activation session found');
  return rowToSession(data as Record<string, unknown>);
}

export async function listActivationSessions(
  client: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<ActivationSessionList> {
  const limit = Math.min(opts.limit ?? 50, 100);

  const { data, error } = await (client as any)
    .schema('core')
    .from('activation_session')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);

  const sessions: ActivationSession[] = (data ?? []).map((row: Record<string, unknown>) =>
    rowToSession(row),
  );

  // Resolve active goal: twin.aspiration.targetRole.source → twin_signal.source_ref → sessionId.
  // Direct DB reads — no deriveTwin triggered.
  let activeGoalSessionId: string | null = null;

  const { data: twinRow } = await (client as any)
    .schema('core')
    .from('twin')
    .select('twin')
    .maybeSingle();

  const twinData = twinRow?.['twin'] as Record<string, unknown> | null | undefined;
  const aspiration = twinData?.['aspiration'] as Record<string, unknown> | undefined;
  const targetRole = aspiration?.['targetRole'] as Record<string, unknown> | undefined;
  const signalId = (targetRole?.['source'] as string | undefined) ?? null;

  if (signalId) {
    const { data: sigRow } = await (client as any)
      .schema('core')
      .from('twin_signal')
      .select('source_ref')
      .eq('id', signalId)
      .maybeSingle();

    activeGoalSessionId = (sigRow?.source_ref as string | null) ?? null;
  }

  return {
    data: sessions,
    activeGoalSessionId,
    page: { nextCursor: null, hasMore: false, limit },
  };
}
