import { createClient } from '@/lib/supabase/server';
import { getConsent, setConsent } from '@modules/identity';
import { Unauthorized, UnprocessableEntity, InternalError } from '@/lib/api-error';
import type { ConsentPurpose } from '@modules/identity';

const VALID_PURPOSES: ConsentPurpose[] = [
  'processing',
  'ai_personalization',
  'marketing',
  'research',
];

export async function GET() {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();
  try {
    return Response.json(await getConsent(supabase));
  } catch {
    return InternalError();
  }
}

export async function PUT(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();

  let body: { purpose?: string; state?: string; policyVersion?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  if (!body.purpose || !(VALID_PURPOSES as string[]).includes(body.purpose)) {
    return UnprocessableEntity(`purpose must be one of: ${VALID_PURPOSES.join(', ')}.`);
  }
  if (!body.state || !['granted', 'revoked'].includes(body.state)) {
    return UnprocessableEntity('state must be granted or revoked.');
  }
  if (!body.policyVersion) {
    return UnprocessableEntity('policyVersion is required.');
  }

  try {
    const result = await setConsent(
      supabase,
      user.id,
      {
        purpose: body.purpose as ConsentPurpose,
        state: body.state as 'granted' | 'revoked',
        policyVersion: body.policyVersion,
      },
      request.headers.get('Idempotency-Key'),
    );
    return Response.json(result);
  } catch {
    return InternalError();
  }
}
