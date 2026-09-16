import { createClient } from '@/lib/supabase/server';

interface SessionRequest {
  grantType: 'password' | 'refresh_token';
  email?: string;
  password?: string;
  refreshToken?: string;
}

// POST /api/v1/auth/session — exchange credentials or refresh token for a session.
// Public: no auth required. Supabase sets httpOnly cookies on success.
export async function POST(request: Request) {
  let body: SessionRequest;
  try {
    body = (await request.json()) as SessionRequest;
  } catch {
    return Response.json(
      { error: { code: 'bad_request', message: 'Invalid JSON body.' } },
      { status: 400 },
    );
  }

  // This is a public route, so createClient() returns user=null; we only need the client.
  const { supabase } = await createClient();

  if (body.grantType === 'password') {
    if (!body.email || !body.password) {
      return Response.json(
        { error: { code: 'bad_request', message: 'email and password required for password grant.' } },
        { status: 400 },
      );
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error || !data.session) {
      return Response.json(
        { error: { code: 'unauthorized', message: error?.message ?? 'Invalid credentials.' } },
        { status: 401 },
      );
    }
    return Response.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: 'bearer' as const,
      expiresIn: data.session.expires_in,
    });
  }

  if (body.grantType === 'refresh_token') {
    if (!body.refreshToken) {
      return Response.json(
        { error: { code: 'bad_request', message: 'refreshToken required for refresh_token grant.' } },
        { status: 400 },
      );
    }
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: body.refreshToken,
    });
    if (error || !data.session) {
      return Response.json(
        { error: { code: 'unauthorized', message: error?.message ?? 'Session refresh failed.' } },
        { status: 401 },
      );
    }
    return Response.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: 'bearer' as const,
      expiresIn: data.session.expires_in,
    });
  }

  return Response.json(
    { error: { code: 'bad_request', message: 'grantType must be password or refresh_token.' } },
    { status: 400 },
  );
}
