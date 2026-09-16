import type { SupabaseClient } from '@supabase/supabase-js';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { AI_MODE, AI_MODEL, getAnthropicClient } from '@/lib/ai';
import { DIRECTION_IDS, DIRECTION_LABELS, type DirectionId } from '../domain/directions';
import type { BoundedAnswers, CareerDiyaEnrichment } from '../domain/types';
import {
  CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
  computeEnrichmentCacheKeyHash,
  extractShadowDirection,
  normalizeRoleText,
  validateAndRepairEnrichment,
  CareerDiyaLlmCacheStore,
} from './enrichmentCache';

// ADR-CAREERDIY-0015: measurement only, default off. Persisting the shadow pick is gated
// separately from asking for it (see callEnrichmentModel) so toggling this never changes
// the prompt, and therefore never changes the cache key.
const SHADOW_DIRECTION_ENABLED = process.env.CAREER_DIYA_SHADOW_DIRECTION === '1';

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

  const msg = await getAnthropicClient().messages.create({
    model: AI_MODEL,
    max_tokens: 400,
    system:
      "You are a career-exploration assistant for a free, low-stakes tool. A separate " +
      'deterministic system has already chosen the career direction below from a fixed ' +
      'list — you do not choose or change it. Your only job is to write brief, concrete ' +
      "advice and course-type recommendations for that direction, grounded in the user's " +
      'answers. Never state a specific percentage or measured confidence — this is an ' +
      'exploration signal, not a validated assessment. Return ONLY valid JSON — no prose, ' +
      'no markdown fences.',
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
  });

  // A missing text block must fail loudly — silently defaulting to '{}' would let a
  // degenerate response look like a real, if unimpressive, enrichment. Matches
  // callGapAnalysisModel / callTaskIdentificationModel.
  const textBlock = msg.content.find((block): block is TextBlock => block.type === 'text');
  if (!textBlock) {
    throw new Error('callEnrichmentModel: model response had no text content block');
  }
  const raw = textBlock.text;
  const jsonText = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  return JSON.parse(jsonText) as unknown;
}

// Orchestrates mock vs. live, and for live: cache-first, model-on-miss, validate,
// write-through — the cache check happens BEFORE the model call, so a hit never spends a
// token (mirrors getGapAnalysis in activation/application/start.ts). Throws on any
// failure (network, missing text block, invalid/degenerate JSON) rather than returning a
// fake success — the caller (the route handler) turns that into a clean error response,
// and the browser falls back to the pure-deterministic render. Never silently swallowed.
export async function getEnrichment(
  client: SupabaseClient,
  role: string,
  answers: BoundedAnswers,
  chosenDirectionId: DirectionId,
): Promise<CareerDiyaEnrichment> {
  if (AI_MODE === 'mock' || !process.env.ANTHROPIC_API_KEY) {
    return mockEnrichment(chosenDirectionId);
  }

  const keyHash = computeEnrichmentCacheKeyHash(
    CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
    AI_MODEL,
    role,
    answers,
    chosenDirectionId,
  );

  const cache = new CareerDiyaLlmCacheStore(client);
  const cached = await cache.get(keyHash);
  if (cached) return cached;

  const rawOutput = await callEnrichmentModel(role, answers, chosenDirectionId);
  const validated = validateAndRepairEnrichment(rawOutput);
  const shadowLlmDirection = SHADOW_DIRECTION_ENABLED ? extractShadowDirection(rawOutput) : null;

  await cache.put({
    keyHash,
    promptVersion: CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
    model: AI_MODEL,
    roleNormalized: normalizeRoleText(role),
    directionId: chosenDirectionId,
    output: validated,
    shadowLlmDirection,
  });

  return validated;
}
