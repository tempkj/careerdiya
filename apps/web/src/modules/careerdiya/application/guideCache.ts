import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CareerDiyaGuideOutput, GuideIntent } from '../domain/types';
import { normalizeRoleText } from './enrichmentCache';

// Bump this to invalidate the entire cache on a prompt change — mirrors
// CAREER_DIYA_ENRICHMENT_PROMPT_VERSION (enrichmentCache.ts).
export const CAREER_DIYA_GUIDE_PROMPT_VERSION = 'career-diya-guide/v1';

export { normalizeRoleText };

export function computeGuideCacheKeyHash(promptVersion: string, model: string, streamOrRole: string, intent: GuideIntent): string {
  const raw = `${promptVersion}|${model}|${normalizeRoleText(streamOrRole)}|${intent}`;
  return createHash('sha256').update(raw).digest('hex');
}

// ── Validation — the gate between model output and a cache write ──────────────────

const TERRITORY_MAX_LEN = 160;
const MAX_TERRITORIES = 4;
const MIN_TERRITORIES = 2;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function boundedString(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

// Throws (does not cache a degenerate result) if fewer than MIN_TERRITORIES usable
// entries survive — same stance as validateAndRepairEnrichment: never cache an empty or
// near-empty result as if it were a real guide.
export function validateAndRepairGuideOutput(raw: unknown): CareerDiyaGuideOutput {
  const root = asRecord(raw);
  if (!root) throw new Error('validateAndRepairGuideOutput: expected a JSON object');

  const rawTerritories = Array.isArray(root['territories']) ? (root['territories'] as unknown[]) : [];
  const territories = rawTerritories
    .map((t) => boundedString(t, TERRITORY_MAX_LEN))
    .filter((t) => t.length > 0)
    .slice(0, MAX_TERRITORIES);

  if (territories.length < MIN_TERRITORIES) {
    throw new Error(
      `validateAndRepairGuideOutput: expected at least ${MIN_TERRITORIES} usable territories, got ${territories.length}`,
    );
  }

  return { territories };
}

// ── Verdict-language screen — the actual "guides, never a verdict" guarantee ────────
//
// The output TYPE already has no field for a single named career or a fit/confidence
// score (CareerDiyaGuideOutput has only `territories: string[]`) — this screens the text
// itself for verdict-shaped phrasing the model might still write despite the prompt
// constraint. Heuristic, not exhaustive — same defense-in-depth posture as
// enrichmentCache.ts's findOtherDirectionReference, not a claim of catching every
// possible phrasing.
const VERDICT_PATTERNS: RegExp[] = [
  /\byou (should|must|will) (definitely\s+)?(become|be|pursue)\b/i,
  /\byour (best fit|ideal career|perfect match|true calling|dream job) is\b/i,
  /\bi (recommend|suggest) (that\s+)?you\b/i,
  /\bthis is (definitely|clearly|certainly) your\b/i,
  /\byou are (best suited|meant|destined) to be\b/i,
  /\byour path is\b/i,
];

export function containsVerdictLanguage(output: CareerDiyaGuideOutput): boolean {
  const haystack = output.territories.join(' ');
  return VERDICT_PATTERNS.some((pattern) => pattern.test(haystack));
}

// ── Cache store — mirrors CareerDiyaLlmCacheStore's shape ──────────────────────────

export class CareerDiyaGuideCacheStore {
  constructor(private readonly client: SupabaseClient) {}

  async get(keyHash: string): Promise<CareerDiyaGuideOutput | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.client as any)
      .schema('knowledge')
      .from('career_diya_guide_cache')
      .select('output')
      .eq('key_hash', keyHash)
      .maybeSingle();

    return data ? (data['output'] as CareerDiyaGuideOutput) : null;
  }

  async put(params: {
    keyHash: string;
    promptVersion: string;
    model: string;
    streamOrRole: string;
    intent: GuideIntent;
    output: CareerDiyaGuideOutput;
  }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.client as any)
      .schema('knowledge')
      .from('career_diya_guide_cache')
      .upsert(
        {
          key_hash: params.keyHash,
          prompt_version: params.promptVersion,
          model: params.model,
          stream_or_role: normalizeRoleText(params.streamOrRole),
          intent: params.intent,
          output: params.output,
        },
        { onConflict: 'key_hash', ignoreDuplicates: true },
      );

    // A write failure here (including the expected concurrent-miss race, which
    // ignoreDuplicates already turns into a no-op) must never fail the request — the
    // caller already has valid, freshly-generated output to return regardless.
    if (error) {
      console.error('[career-diya-guide-cache] write failed (non-fatal)', error);
    }
  }
}
