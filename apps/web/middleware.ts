import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isLoginRequired } from '@/lib/access-mode';

// Routes that require no authentication
const PUBLIC_PATHS = new Set(['/api/v1/health', '/api/v1/auth/session']);

// Pages that redirect to /login when there is no user. When the login toggle is off
// (CAREERDIYA_REQUIRE_LOGIN=false) a visitor reaching one of these, or a protected API
// route, without a session gets an anonymous session instead, so the page runs unchanged.
const SIGNED_IN_PAGES = ['/activate', '/blueprint'];

function needsSession(pathname: string): boolean {
  if (pathname.startsWith('/api/v1/')) return !PUBLIC_PATHS.has(pathname);
  return SIGNED_IN_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
          // Write cookies to the request too, and rebuild the response from it, so a
          // session created here (refreshed, or anonymous) is visible to the page or
          // route handler in this same request.
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { pathname } = request.nextUrl;
  const authHeader = request.headers.get('authorization') ?? '';
  const hasBearer = authHeader.toLowerCase().startsWith('bearer ');

  if (!isLoginRequired() && needsSession(pathname) && !hasBearer) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        // Anonymous sign-ins are disabled in Supabase: fall back to normal behaviour.
        console.warn('[access] anonymous sign-in unavailable:', error.message);
      }
    }
  }

  if (!pathname.startsWith('/api/v1/') || PUBLIC_PATHS.has(pathname)) {
    // Non-API or public: refresh session cookies and pass through.
    await supabase.auth.getUser();
    return response;
  }

  // Protected API route: accept cookie session or Bearer token.
  let user = null;

  if (hasBearer) {
    const token = authHeader.slice(7).trim();
    const { data, error } = await supabase.auth.getUser(token);
    if (!error) user = data.user;
  }

  if (!user) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user) {
    return Response.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 },
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
