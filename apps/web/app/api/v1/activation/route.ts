import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { listActivationSessions } from '@modules/activation';
import { Unauthorized, InternalError, Forbidden } from '@/lib/api-error';

export async function GET(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10)) : 50;

  try {
    const result = await listActivationSessions(supabase, { limit });
    return Response.json(result);
  } catch {
    return InternalError();
  }
}
