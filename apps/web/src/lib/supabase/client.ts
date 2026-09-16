import { createBrowserClient } from '@supabase/ssr';

// Browser client (anon key). RLS scopes every query to the authed user.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
