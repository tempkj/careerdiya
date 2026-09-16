import { createClient } from '@/lib/supabase/server';
import { getMe } from '@modules/identity';
import { Unauthorized, InternalError } from '@/lib/api-error';

export async function GET() {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  try {
    return Response.json(await getMe(supabase, user.id));
  } catch {
    return InternalError();
  }
}
