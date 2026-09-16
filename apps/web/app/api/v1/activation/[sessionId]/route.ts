import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { getActivationSession } from '@modules/activation';
import { Unauthorized, NotFound, InternalError, Forbidden } from '@/lib/api-error';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  const { sessionId } = await params;

  try {
    return Response.json(await getActivationSession(supabase, sessionId));
  } catch (err) {
    if (err instanceof Error && err.message === 'Session not found') return NotFound();
    return InternalError();
  }
}
