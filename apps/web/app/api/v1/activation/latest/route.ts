import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { getLatestActivation } from '@modules/activation';
import { Unauthorized, NotFound, InternalError, Forbidden } from '@/lib/api-error';

export async function GET() {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  try {
    return Response.json(await getLatestActivation(supabase));
  } catch (err) {
    if (err instanceof Error && err.message === 'No activation session found') return NotFound();
    return InternalError();
  }
}
