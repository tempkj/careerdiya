import type { SupabaseClient } from '@supabase/supabase-js';
import type { Me } from '../domain/types';

export async function getMe(client: SupabaseClient, userId: string): Promise<Me> {
  const { data: profile, error } = await (client as any)
    .schema('core')
    .from('profile')
    .select('region, locale, onboarding_state')
    .single();

  if (error || !profile) throw new Error('Profile not found');

  return {
    userId,
    onboardingState: profile.onboarding_state as Me['onboardingState'],
    region: profile.region as string,
    locale: profile.locale as string,
  };
}
