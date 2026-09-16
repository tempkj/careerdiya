import { createClient } from '@/lib/supabase/server';
import { getEnrichment, isDirectionId, CAREER_DIYA_ENRICHMENT_PROMPT_VERSION } from '@modules/careerdiya';
import type { BoundedAnswers } from '@modules/careerdiya';
import { Unauthorized, UnprocessableEntity, InternalError } from '@/lib/api-error';

const REQUIRED_ANSWER_KEYS: (keyof BoundedAnswers)[] = [
  'stage',
  'intent',
  'work',
  'environment',
  'priority',
  'learning',
  'commitment',
];

function isBoundedAnswers(value: unknown): value is BoundedAnswers {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return REQUIRED_ANSWER_KEYS.every((key) => typeof row[key] === 'string' && row[key].trim().length > 0);
}

// ADR-CAREERDIY-0015: this endpoint enriches an already-chosen direction with prose — it
// never chooses or overrides the direction itself. That guarantee is enforced by
// construction: the response below only ever echoes back `chosenDirectionId` from the
// request body, and CareerDiyaEnrichment (getEnrichment's return type) has no `direction`
// field for a model response to smuggle one through.
export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();

  let body: { role?: string; answers?: unknown; chosenDirectionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  const role = body.role?.trim();
  if (!role) return UnprocessableEntity('role is required.');
  if (!isBoundedAnswers(body.answers)) {
    return UnprocessableEntity(`answers must include all of: ${REQUIRED_ANSWER_KEYS.join(', ')}.`);
  }
  if (!isDirectionId(body.chosenDirectionId)) {
    return UnprocessableEntity('chosenDirectionId must be one of the closed direction ids.');
  }

  try {
    const enrichment = await getEnrichment(supabase, role, body.answers, body.chosenDirectionId);
    return Response.json({
      direction: body.chosenDirectionId,
      advice: enrichment.advice,
      courseRecommendations: enrichment.courseRecommendations,
      promptVersion: CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
    });
  } catch (err) {
    // Never a fake 200 — an empty/invalid/failed enrichment is a real failure. The
    // browser catches this and falls back to the pure-deterministic render; it must
    // never see a broken page.
    console.error('[career-diya/recommend] enrichment failed', err);
    return InternalError();
  }
}
