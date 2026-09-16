import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { completeActivation, ConflictError } from '@modules/activation';
import { Unauthorized, UnprocessableEntity, NotFound, Conflict, InternalError, Forbidden } from '@/lib/api-error';

export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  let body: { sessionId?: string; acceptedFirstAction?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  if (!body.sessionId) return UnprocessableEntity('sessionId is required.');

  try {
    const session = await completeActivation(
      supabase,
      user.id,
      body.sessionId,
      body.acceptedFirstAction ?? false,
      request.headers.get('Idempotency-Key'),
    );
    return Response.json(session, {
      headers: { Location: `/activation/${session.id}` },
    });
  } catch (err) {
    if (err instanceof ConflictError) return Conflict();
    if (err instanceof Error && err.message === 'Session not found') return NotFound();
    return InternalError();
  }
}
