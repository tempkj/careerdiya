import type { SupabaseClient } from '@supabase/supabase-js';

export const CAREERASANA_PRODUCT = 'careerasana';

export async function hasCareerAsanaAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  if (process.env.CAREERASANA_ACCESS_MODE === 'preview') return true;

  const { data, error } = await (supabase as any)
    .schema('core')
    .from('product_access')
    .select('id,starts_at,ends_at')
    .eq('user_id', userId)
    .eq('product', CAREERASANA_PRODUCT)
    .eq('status', 'active')
    .lte('starts_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[product-access] lookup failed', error);
    return false;
  }

  if (!data) return false;
  return !data.ends_at || new Date(data.ends_at).getTime() > Date.now();
}
