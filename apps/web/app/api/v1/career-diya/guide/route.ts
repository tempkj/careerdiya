import { createClient } from '@/lib/supabase/server';
import { getGuide, isGuideIntent, CAREER_DIYA_GUIDE_PROMPT_VERSION } from '@modules/careerdiya';
import { Unauthorized, UnprocessableEntity, InternalError } from '@/lib/api-error';

// ADR-CAREERDIY-0016: this endpoint guides, it never issues a personalised career
// verdict. Enforced structurally (CareerDiyaGuideOutput has no field for a single named
// career or a fit score) and by the getGuide()/containsVerdictLanguage() screen — this
// route itself is a thin, unopinionated pass-through of whatever getGuide returns.
export async function POST(request: Request) {
  const { supabase, user } = await createClient();
  if (!user) return Unauthorized();

  let body: { streamOrRole?: string; intent?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return UnprocessableEntity('Invalid JSON body.');
  }

  const streamOrRole = body.streamOrRole?.trim();
  if (!streamOrRole) return UnprocessableEntity('streamOrRole is required.');
  if (!isGuideIntent(body.intent)) return UnprocessableEntity('intent must be one of the closed guide intents.');

  try {
    const guide = await getGuide(supabase, streamOrRole, body.intent);
    return Response.json({
      territories: guide.territories,
      promptVersion: CAREER_DIYA_GUIDE_PROMPT_VERSION,
    });
  } catch (err) {
    // Never a fake 200 — an empty/invalid/verdict-shaped/failed guide is a real failure.
    // The client catches this and renders a static, LLM-free fallback message plus the
    // non-removable disclaimer — it must never see a broken page.
    console.error(JSON.stringify({ event: 'guide_fell_back', ts: new Date().toISOString() }));
    return InternalError();
  }
}
