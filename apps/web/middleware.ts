import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require no authentication
const PUBLIC_PATHS = new Set(['/api/v1/health', '/api/v1/auth/session']);

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) =>
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }),
      },
    },
  );

  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/v1/') || PUBLIC_PATHS.has(pathname)) {
    // Non-API or public: refresh session cookies and pass through.
    await supabase.auth.getUser();
    return response;
  }

  // Protected API route: accept cookie session or Bearer token.
  const authHeader = request.headers.get('authorization') ?? '';
  let user = null;

  if (authHeader.toLowerCase().startsWith('bearer ')) {
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
