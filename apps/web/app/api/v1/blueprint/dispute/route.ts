import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { evaluateDispute } from '@modules/blueprint';
import type { DraftTask } from '@modules/blueprint';
import { Unauthorized, UnprocessableEntity, InternalError, Forbidden } from '@/lib/api-error';

export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  let body: { task?: DraftTask; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  if (!body.task) return UnprocessableEntity('task is required.');
  if (!body.reason?.trim()) return UnprocessableEntity('reason is required.');

  try {
    return Response.json(evaluateDispute(body.task, body.reason.trim()));
  } catch (err) {
    console.error('[blueprint/dispute] unhandled error', err);
    return InternalError();
  }
}
