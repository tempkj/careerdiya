import type { SupabaseClient } from '@supabase/supabase-js';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { AI_MODE, AI_MODEL, getAnthropicClient } from '@/lib/ai';
import { DIRECTION_IDS, DIRECTION_LABELS, type DirectionId } from '../domain/directions';
import type { BoundedAnswers, CareerDiyaEnrichment } from '../domain/types';
import {
  CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
  computeEnrichmentCacheKeyHash,
  extractShadowDirection,
  findOtherDirectionReference,
  normalizeRoleText,
  validateAndRepairEnrichment,
  CareerDiyaLlmCacheStore,
} from './enrichmentCache';

// ADR-CAREERDIY-0015: measurement only, default off. Persisting the shadow pick is gated
// separately from asking for it (see callEnrichmentModel) so toggling this never changes
// the prompt, and therefore never changes the cache key.
const SHADOW_DIRECTION_ENABLED = process.env.CAREER_DIYA_SHADOW_DIRECTION === '1';

// The browser gives up on this whole request after 8s (decision-engine.js's
// fetchBoundedEnrichment AbortController) and silently falls back to the deterministic
// render either way. Without a matching server-side timeout, an abandoned client request
// doesn't stop the in-flight model call — it keeps running (and spending) unobserved,
// and "timeout" was never a distinguishable outcome from any other failure. This enforces
// the same budget server-side and makes it one.
const ENRICHMENT_TIMEOUT_MS = 8000;

class EnrichmentTimeoutError extends Error {
  constructor() {
    super(`callEnrichmentModel: timed out after ${ENRICHMENT_TIMEOUT_MS}ms`);
    this.name = 'EnrichmentTimeoutError';
  }
}

// Distinguishes "we got a response but couldn't use it" (missing text block, unparseable
// JSON, or a shape that fails validateAndRepairEnrichment) from a raw API/network
// failure — thrown at each of those three sites so getEnrichment's classification below
// is exact, not a guess based on error message text.
class EnrichmentInvalidOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnrichmentInvalidOutputError';
  }
}

// The direction FIELD can't leak (no such field on CareerDiyaEnrichment) — this is the
// prose channel: the model wrote advice/course text arguing for a direction other than
// the one it was told is fixed. Same confidently-wrong failure the deterministic
// eligibility gate exists to prevent; treated as a validation failure so it goes through
// the same regenerate-once-then-fail path as any other invalid output.
class EnrichmentOffTopicDirectionError extends Error {
  constructor(public readonly referencedDirectionId: DirectionId) {
    super(`callEnrichmentModel: enrichment prose references '${referencedDirectionId}' instead of the fixed direction`);
    this.name = 'EnrichmentOffTopicDirectionError';
  }
}

// One structured, greppable line per terminal outcome — this is the entire hit-rate/
// failure-mix signal until this repo has real metrics infra (packages/observability is
// still an empty stub). event is always one of the values below; never invent a new one
// inline, so a log query for "event":"llm_x" stays exhaustive.
type EnrichmentEvent = 'llm_cache_hit' | 'llm_success' | 'llm_timeout' | 'llm_invalid' | 'llm_offtopic_direction' | 'llm_error';

function logEnrichmentEvent(event: EnrichmentEvent, fields: Record<string, unknown>): void {
  const line = JSON.stringify({ event, ts: new Date().toISOString(), ...fields });
  if (event === 'llm_cache_hit' || event === 'llm_success') console.log(line);
  else console.error(line);
}

// Deterministic, $0, no network — same role for the deterministic-floor rationale as
// mockActivationAI (activation/application/start.ts): dev/test default, keyed on the
// already-chosen direction rather than free-text role parsing since the direction is
// already fixed by the time this runs.
export function mockEnrichment(directionId: DirectionId): CareerDiyaEnrichment {
  const label = DIRECTION_LABELS[directionId];
  return {
    advice: `Start by exploring ${label} through one small, concrete step this week — a short project, a practitioner conversation, or a focused course module. Use what you learn to test whether the direction still feels right before committing further.`,
    courseRecommendations: [
      { title: `Introduction to ${label}`, provider: 'Coursera', type: 'course' },
      { title: `${label} fundamentals`, provider: 'Skill Diya', type: 'course' },
    ],
  };
}

// Raw model call + JSON parse only — no field defaulting/coercion. That's
// validateAndRepairEnrichment's job (enrichmentCache.ts), same split as
// LiveTaskIdentifier's callTaskIdentificationModel / validateAndRepairAssessment.
async function callEnrichmentModel(
  role: string,
  answers: BoundedAnswers,
  chosenDirectionId: DirectionId,
): Promise<unknown> {
  const directionLabel = DIRECTION_LABELS[chosenDirectionId];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENRICHMENT_TIMEOUT_MS);

  let msg;
  try {
    msg = await getAnthropicClient().messages.create(
      {
        model: AI_MODEL,
        max_tokens: 400,
        system:
          "You are a career-exploration assistant for a free, low-stakes tool. A separate " +
          'deterministic system has already chosen the career direction below from a fixed ' +
          'list — you do not choose or change it. Your only job is to write brief, concrete ' +
          "advice and course-type recommendations for advancing toward that direction, " +
          "grounded in the user's answers. Never suggest, recommend, or argue for a " +
          'different career direction in the advice or course recommendations, even if the ' +
          "answers seem to point elsewhere — that is not yours to raise here; the model's " +
          'own independent view belongs only in the separate shadowDirection field, never ' +
          'in the advice text or course recommendations. Never state a specific percentage ' +
          'or measured confidence — this is an exploration signal, not a validated ' +
          'assessment. Return ONLY valid JSON — no prose, no markdown fences.',
        messages: [
          {
            role: 'user',
            content: `Chosen direction (fixed — do not change it): ${directionLabel}
Current/most-recent role: ${role}
Answers: stage=${answers.stage}, intent=${answers.intent}, work=${answers.work}, environment=${answers.environment}, priority=${answers.priority}, learning=${answers.learning}, commitment=${answers.commitment}

Return exactly this JSON shape:
{
  "advice": "2-3 sentences of concrete, encouraging next-step advice for exploring ${directionLabel}, grounded in the answers above. No fabricated percentages or confidence scores.",
  "courseRecommendations": [
    { "title": "course or resource name", "provider": "any real provider, not limited to one platform", "type": "course|certification|project|reading" }
  ],
  "shadowDirection": "the single direction id you would independently pick given the same inputs, ignoring the fixed direction above — must be exactly one of: ${DIRECTION_IDS.join(', ')}"
}

Rules:
- courseRecommendations: 2-4 items, directly relevant to ${directionLabel}
- advice: at most 3 sentences
- shadowDirection: lowercase, exactly one id from the list, no other text`,
          },
        ],
      },
      { signal: controller.signal },
    );
  } catch (err) {
    if (controller.signal.aborted) throw new EnrichmentTimeoutError();
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // A missing text block must fail loudly — silently defaulting to '{}' would let a
  // degenerate response look like a real, if unimpressive, enrichment. Matches
  // callGapAnalysisModel / callTaskIdentificationModel.
  const textBlock = msg.content.find((block): block is TextBlock => block.type === 'text');
  if (!textBlock) {
    throw new EnrichmentInvalidOutputError('callEnrichmentModel: model response had no text content block');
  }
  const raw = textBlock.text;
  const jsonText = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  try {
    return JSON.parse(jsonText) as unknown;
  } catch (err) {
    throw new EnrichmentInvalidOutputError(
      `callEnrichmentModel: failed to parse model response as JSON — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// One full attempt: call the model, validate its shape, then screen the validated prose
// for a reference to a direction other than the fixed one. Throws
// EnrichmentOffTopicDirectionError for the screen specifically, so the caller can retry
// just that case — every other failure (timeout, invalid shape, network) is not retried,
// unchanged from before this fix.
async function generateAndScreenOnce(
  role: string,
  answers: BoundedAnswers,
  chosenDirectionId: DirectionId,
): Promise<{ validated: CareerDiyaEnrichment; rawOutput: unknown }> {
  const rawOutput = await callEnrichmentModel(role, answers, chosenDirectionId);

  let validated: CareerDiyaEnrichment;
  try {
    validated = validateAndRepairEnrichment(rawOutput);
  } catch (err) {
    throw new EnrichmentInvalidOutputError(err instanceof Error ? err.message : String(err));
  }

  const offTopicDirection = findOtherDirectionReference(validated, chosenDirectionId);
  if (offTopicDirection) {
    throw new EnrichmentOffTopicDirectionError(offTopicDirection);
  }

  return { validated, rawOutput };
}

// Orchestrates mock vs. live, and for live: cache-first, model-on-miss, validate, screen,
// write-through — the cache check happens BEFORE the model call, so a hit never spends a
// token (mirrors getGapAnalysis in activation/application/start.ts). A prose reference to
// another direction gets exactly one regeneration attempt (generateAndScreenOnce); any
// other failure (network, timeout, missing text block, invalid/degenerate JSON), or a
// second off-topic hit, throws rather than returning a fake success — the caller (the
// route handler) turns that into a clean error response, and the browser falls back to
// the pure-deterministic render (never contradictory prose, never a broken page). Never
// silently swallowed — every terminal outcome (including this one) is also logged via
// logEnrichmentEvent below, which is the only hit-rate/failure-mix visibility this
// feature has (packages/observability is still an empty stub).
export async function getEnrichment(
  client: SupabaseClient,
  role: string,
  answers: BoundedAnswers,
  chosenDirectionId: DirectionId,
): Promise<CareerDiyaEnrichment> {
  if (AI_MODE === 'mock' || !process.env.ANTHROPIC_API_KEY) {
    return mockEnrichment(chosenDirectionId);
  }

  const roleNormalized = normalizeRoleText(role);
  const logFields = { model: AI_MODEL, roleNormalized, directionId: chosenDirectionId };

  const keyHash = computeEnrichmentCacheKeyHash(
    CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
    AI_MODEL,
    role,
    answers,
    chosenDirectionId,
  );

  const cache = new CareerDiyaLlmCacheStore(client);
  const cached = await cache.get(keyHash);
  if (cached) {
    logEnrichmentEvent('llm_cache_hit', logFields);
    return cached;
  }

  try {
    let generated: { validated: CareerDiyaEnrichment; rawOutput: unknown };
    try {
      generated = await generateAndScreenOnce(role, answers, chosenDirectionId);
    } catch (err) {
      if (!(err instanceof EnrichmentOffTopicDirectionError)) throw err;
      logEnrichmentEvent('llm_offtopic_direction', { ...logFields, attempt: 1, referencedDirectionId: err.referencedDirectionId });
      generated = await generateAndScreenOnce(role, answers, chosenDirectionId); // one retry; any failure here (including off-topic again) propagates to the outer catch
    }

    const { validated, rawOutput } = generated;
    const shadowLlmDirection = SHADOW_DIRECTION_ENABLED ? extractShadowDirection(rawOutput) : null;

    await cache.put({
      keyHash,
      promptVersion: CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
      model: AI_MODEL,
      roleNormalized,
      directionId: chosenDirectionId,
      output: validated,
      shadowLlmDirection,
    });

    logEnrichmentEvent('llm_success', logFields);
    return validated;
  } catch (err) {
    const event: EnrichmentEvent =
      err instanceof EnrichmentTimeoutError
        ? 'llm_timeout'
        : err instanceof EnrichmentOffTopicDirectionError
          ? 'llm_offtopic_direction'
          : err instanceof EnrichmentInvalidOutputError
            ? 'llm_invalid'
            : 'llm_error';
    const extra =
      err instanceof EnrichmentOffTopicDirectionError
        ? { attempt: 2, referencedDirectionId: err.referencedDirectionId }
        : { message: err instanceof Error ? err.message : String(err) };
    logEnrichmentEvent(event, { ...logFields, ...extra });
    throw err;
  }
}
