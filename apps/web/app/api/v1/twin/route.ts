import { createClient } from '@/lib/supabase/server';
import { getTwin } from '@modules/twin';
import { Unauthorized, NotFound, InternalError } from '@/lib/api-error';

export async function GET() {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();

  try {
    const twin = await getTwin(supabase, user.id);
    if (!twin) return NotFound();
    return Response.json(twin);
  } catch {
    return InternalError();
  }
}
