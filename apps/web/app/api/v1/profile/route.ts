import { createClient } from '@/lib/supabase/server';
import { getProfile, updateProfile, PreconditionError } from '@modules/identity';
import { Unauthorized, PreconditionFailed, UnprocessableEntity, InternalError } from '@/lib/api-error';

export async function GET() {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  try {
    const { profile, etag } = await getProfile(supabase);
    return Response.json(profile, { headers: { ETag: etag } });
  } catch { return InternalError(); }
}
export async function PATCH(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  let patch: { displayName?: string; region?: string; locale?: string };
  try { patch = (await request.json()) as typeof patch; } catch { return UnprocessableEntity('Invalid JSON body.'); }
  const allowedKeys = new Set(['displayName', 'region', 'locale']);
  if (Object.keys(patch ?? {}).filter((k) => allowedKeys.has(k)).length === 0)
    return UnprocessableEntity('At least one of displayName, region, locale is required.');
  try {
    const { profile, etag } = await updateProfile(supabase, patch, request.headers.get('If-Match'));
    return Response.json(profile, { headers: { ETag: etag } });
  } catch (err) {
    if (err instanceof PreconditionError) return PreconditionFailed();
    return InternalError();
  }
}
