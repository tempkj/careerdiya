import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { derivePathsFromTasks } from '@modules/blueprint';
import type { DraftTask } from '@modules/blueprint';
import { Unauthorized, UnprocessableEntity, InternalError, Forbidden } from '@/lib/api-error';

export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  let body: { tasks?: DraftTask[]; toRoleKey?: string; weeklyHours?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  if (!body.tasks?.length) return UnprocessableEntity('tasks is required and must be non-empty.');
  if (!body.toRoleKey?.trim()) return UnprocessableEntity('toRoleKey is required.');

  try {
    const paths = derivePathsFromTasks(body.tasks, body.toRoleKey.trim(), body.weeklyHours ?? null);
    return Response.json({ paths });
  } catch (err) {
    console.error('[blueprint/derive] unhandled error', err);
    return InternalError();
  }
}
