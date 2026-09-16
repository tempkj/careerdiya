import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile, ProfileUpdate } from '../domain/types';

function etag(updatedAt: string): string {
  return `"${createHash('sha256').update(updatedAt).digest('hex').slice(0, 16)}"`;
}

async function fetchProfile(
  client: SupabaseClient,
): Promise<{ row: Record<string, unknown>; profile: UserProfile; etag: string }> {
  const { data, error } = await (client as any)
    .schema('core')
    .from('profile')
    .select('user_id, display_name, region, locale, onboarding_state, updated_at')
    .single();

  if (error || !data) throw new Error('Profile not found');

  const row = data as Record<string, unknown>;
  return {
    row,
    profile: {
      userId: row['user_id'] as string,
      displayName: (row['display_name'] as string | null) ?? null,
      region: row['region'] as string,
      locale: row['locale'] as string,
      onboardingState: row['onboarding_state'] as UserProfile['onboardingState'],
    },
    etag: etag(row['updated_at'] as string),
  };
}

export async function getProfile(
  client: SupabaseClient,
): Promise<{ profile: UserProfile; etag: string }> {
  const { profile, etag: e } = await fetchProfile(client);
  return { profile, etag: e };
}

export class PreconditionError extends Error {
  readonly status = 412;
}

export async function updateProfile(
  client: SupabaseClient,
  patch: ProfileUpdate,
  ifMatch: string | null,
): Promise<{ profile: UserProfile; etag: string }> {
  const current = await fetchProfile(client);

  if (ifMatch !== null && ifMatch !== current.etag) throw new PreconditionError();

  const updates: Record<string, unknown> = {};
  if (patch.displayName !== undefined) updates['display_name'] = patch.displayName;
  if (patch.region !== undefined) updates['region'] = patch.region;
  if (patch.locale !== undefined) updates['locale'] = patch.locale;

  if (Object.keys(updates).length === 0) {
    return { profile: current.profile, etag: current.etag };
  }

  const { data, error } = await (client as any)
    .schema('core')
    .from('profile')
    .update(updates)
    .eq('user_id', current.profile.userId)
    .select('user_id, display_name, region, locale, onboarding_state, updated_at')
    .single();

  if (error || !data) throw new Error('Update failed');

  const row = data as Record<string, unknown>;
  return {
    profile: {
      userId: row['user_id'] as string,
      displayName: (row['display_name'] as string | null) ?? null,
      region: row['region'] as string,
      locale: row['locale'] as string,
      onboardingState: row['onboarding_state'] as UserProfile['onboardingState'],
    },
    etag: etag(row['updated_at'] as string),
  };
}
