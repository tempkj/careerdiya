import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { promoteExploration, PreconditionError } from '@modules/activation';
import { Unauthorized, NotFound, InternalError, Forbidden } from '@/lib/api-error';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  const { sessionId } = await params;

  try {
    const result = await promoteExploration(supabase, user.id, sessionId);
    return Response.json(result);
  } catch (err) {
    if (err instanceof PreconditionError)
      return Response.json(
        { error: { code: 'conflict', message: err.message } },
        { status: 409 },
      );
    if (err instanceof Error && err.message === 'Session not found') return NotFound();
    return InternalError();
  }
}
