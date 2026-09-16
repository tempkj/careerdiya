import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentPurpose, ConsentRecord, ConsentStateResult } from '../domain/types';

export async function getConsent(client: SupabaseClient): Promise<ConsentStateResult> {
  const { data, error } = await (client as any)
    .schema('core')
    .from('consent')
    .select('purpose, state, occurred_at, policy_version')
    .order('occurred_at', { ascending: false });

  if (error) throw new Error('Failed to fetch consent');

  // Deduplicate: keep only the latest record per purpose
  const seen = new Set<string>();
  const purposes: ConsentRecord[] = ((data ?? []) as Record<string, string>[])
    .filter((r) => {
      if (seen.has(r['purpose']!)) return false;
      seen.add(r['purpose']!);
      return true;
    })
    .map((r) => ({
      purpose: r['purpose'] as ConsentPurpose,
      state: r['state'] as 'granted' | 'revoked',
      occurredAt: r['occurred_at']!,
      policyVersion: r['policy_version']!,
    }));

  return { purposes };
}

export async function setConsent(
  client: SupabaseClient,
  userId: string,
  update: { purpose: ConsentPurpose; state: 'granted' | 'revoked'; policyVersion: string },
  idempotencyKey: string | null,
): Promise<ConsentStateResult> {
  if (idempotencyKey) {
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');

    const { data: existing } = await (client as any)
      .schema('core')
      .from('idempotency_key')
      .select('response_body')
      .eq('user_id', userId)
      .eq('key_hash', keyHash)
      .eq('endpoint', '/profile/consent')
      .maybeSingle();

    if (existing) {
      if (existing.response_body) return existing.response_body as ConsentStateResult;
      return getConsent(client);
    }

    await (client as any)
      .schema('core')
      .from('idempotency_key')
      .insert({ user_id: userId, key_hash: keyHash, endpoint: '/profile/consent' });
  }

  const { error } = await (client as any)
    .schema('core')
    .from('consent')
    .insert({
      user_id: userId,
      purpose: update.purpose,
      state: update.state,
      policy_version: update.policyVersion,
    });

  if (error) throw new Error('Failed to set consent');

  const result = await getConsent(client);

  if (idempotencyKey) {
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex');
    await (client as any)
      .schema('core')
      .from('idempotency_key')
      .update({ response_status: 200, response_body: result })
      .eq('user_id', userId)
      .eq('key_hash', keyHash)
      .eq('endpoint', '/profile/consent');
  }

  return result;
}

export async function hasConsent(
  client: SupabaseClient,
  purpose: ConsentPurpose,
): Promise<boolean> {
  const state = await getConsent(client);
  const record = state.purposes.find((p) => p.purpose === purpose);
  return record?.state === 'granted';
}
