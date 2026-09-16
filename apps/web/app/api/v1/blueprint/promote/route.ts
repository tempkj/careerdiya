import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { promoteBlueprint, type DerivedPath } from '@modules/blueprint';
import { Unauthorized, UnprocessableEntity, InternalError, Forbidden } from '@/lib/api-error';

export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  let body: { sessionId?: string; path?: DerivedPath };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  if (!body.sessionId?.trim()) return UnprocessableEntity('sessionId is required.');
  if (!body.path) return UnprocessableEntity('path is required.');

  try {
    // RLS scopes the session_id FK to the caller's own rows — a foreign or
    // invalid session surfaces as a DB error here, not a special-cased check.
    const result = await promoteBlueprint(supabase, user.id, body.sessionId.trim(), body.path);
    return Response.json(result);
  } catch (err) {
    console.error('[blueprint/promote] unhandled error', err);
    return InternalError();
  }
}
