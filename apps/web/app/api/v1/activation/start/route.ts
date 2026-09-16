import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { startActivation } from '@modules/activation';
import { createSubstrateStore } from '@modules/knowledge';
import { Unauthorized, UnprocessableEntity, InternalError, Forbidden } from '@/lib/api-error';

export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  if (!(await hasCareerAsanaAccess(supabase, user.id))) return Forbidden();

  let body: { currentRole?: string; desiredRole?: string; weeklyHours?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  if (!body.desiredRole?.trim()) {
    return UnprocessableEntity('desiredRole is required.');
  }

  try {
    const substrateStore = createSubstrateStore(supabase);
    const result = await startActivation(
      supabase,
      user.id,
      {
        currentRole: body.currentRole ?? null,
        desiredRole: body.desiredRole.trim(),
        weeklyHours: body.weeklyHours ?? null,
      },
      request.headers.get('Idempotency-Key'),
      substrateStore,
    );
    return Response.json(result);
  } catch (err) {
    console.error('[activation/start] unhandled error', err);

    // Keep production responses generic, but make local integration failures
    // actionable. This is especially useful while wiring Career Diya → CareerAsana,
    // because otherwise every substrate/RLS/session failure looks identical in the UI.
    if (process.env.NODE_ENV !== 'production') {
      return Response.json(
        {
          error: {
            code: 'internal_error',
            message: err instanceof Error ? err.message : String(err),
          },
        },
        { status: 500 },
      );
    }

    return InternalError();
  }
}
