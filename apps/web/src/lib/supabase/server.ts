import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cookie-based SSR client. Never use the service-role key in a request path —
// that bypasses RLS (handbook §3). Service-role is for workers only.
async function createSsrClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) =>
        toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
}

// Returns an authenticated Supabase client + the resolved user, handling both
// cookie sessions (browser) and Authorization: Bearer tokens (API / mobile clients).
//
// For Bearer tokens, a non-SSR client is created with the JWT in global headers so
// that all PostgREST queries carry the right token for RLS enforcement.
export async function createClient() {
  const headerStore = await headers();
  const authHeader = headerStore.get('authorization') ?? headerStore.get('Authorization') ?? '';

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    // Validate the JWT against the Auth server before trusting it.
    const probe = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await probe.auth.getUser(token);
    if (!error && data.user) {
      const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      return { supabase, user: data.user };
    }
  }

  // Fall back to cookie session (browser / middleware-refreshed sessions).
  const supabase = await createSsrClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
}
