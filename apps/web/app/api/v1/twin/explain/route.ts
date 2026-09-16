import { createClient } from '@/lib/supabase/server';
import { explainTwinFact } from '@modules/twin';
import { Unauthorized, NotFound, UnprocessableEntity, InternalError } from '@/lib/api-error';

export async function GET(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();

  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path) return UnprocessableEntity('path query parameter is required.');

  try {
    const explanation = await explainTwinFact(supabase, user.id, path);
    if (!explanation) return NotFound();
    return Response.json(explanation);
  } catch {
    return InternalError();
  }
}
