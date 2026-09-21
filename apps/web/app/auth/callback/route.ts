import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// PKCE code exchange — Supabase redirects here after email confirmation or OAuth.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next') ?? '/';
  // Only allow same-origin relative paths. The callback receives a user-controlled
  // query string, so never turn an absolute/external URL into a redirect target.
  const next =
    requestedNext.startsWith('/') &&
    !requestedNext.startsWith('//') &&
    !requestedNext.includes('\\')
      ? requestedNext
      : '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) =>
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      },
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
