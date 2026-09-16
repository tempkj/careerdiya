import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DIRECTION_IDS, isDirectionId, type DirectionId } from '../domain/directions';
import type { BoundedAnswers, CareerDiyaEnrichment, CourseRecommendation } from '../domain/types';

// Bump this to invalidate the entire cache on a prompt change — mirrors
// TASK_IDENTIFICATION_PROMPT_VERSION / GAP_ANALYSIS_PROMPT_VERSION.
export const CAREER_DIYA_ENRICHMENT_PROMPT_VERSION = 'career-diya-enrichment/v1';

// ── Key hashing ──────────────────────────────────────────────────────────────────

// Mirrors decision-data.js's normalizeRoleText exactly (kept in sync by hand — both are
// small, stable, and changing one without the other only affects cache-hit rate, never
// correctness, since this key is never compared against the client's).
export function normalizeRoleText(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[.,]+$/, '');
}

function canonicalizeAnswers(answers: BoundedAnswers): string {
  return (Object.keys(answers) as (keyof BoundedAnswers)[])
    .sort()
    .map((key) => `${key}=${String(answers[key] ?? '').trim().toLowerCase()}`)
    .join('&');
}

export function computeEnrichmentCacheKeyHash(
  promptVersion: string,
  model: string,
  role: string,
  answers: BoundedAnswers,
  chosenDirectionId: DirectionId,
): string {
  const raw = `${promptVersion}|${model}|${normalizeRoleText(role)}|${canonicalizeAnswers(answers)}|${chosenDirectionId}`;
  return createHash('sha256').update(raw).digest('hex');
}

// ── Validation — the gate between model output and a cache write ──────────────────
//
// This cache is shared and authenticated-writable: any user's cache-miss request writes a
// row every future matching user reads. Every field is bounded/enum-coerced — never passed
// through from raw model output untouched. Mirrors validateAndRepairGapAnalysis /
// validateAndRepairIdentification's stance.

const ADVICE_MAX_LEN = 600;
const COURSE_TITLE_MAX_LEN = 120;
const COURSE_PROVIDER_MAX_LEN = 80;
const COURSE_TYPE_MAX_LEN = 40;
const MAX_COURSE_RECOMMENDATIONS = 4;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function boundedString(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

// Throws (does not cache a degenerate result) if nothing usable survives — same stance as
// validateAndRepairGapAnalysis: the cache must never enshrine an empty result as if it
// were real, ever-after-served output. The caller (application/enrichment.ts) treats a
// throw here identically to a model/network failure — fall back to the pure-deterministic
// render, never a broken page.
export function validateAndRepairEnrichment(raw: unknown): CareerDiyaEnrichment {
  const root = asRecord(raw);
  if (!root) throw new Error('validateAndRepairEnrichment: expected a JSON object');

  const advice = boundedString(root['advice'], ADVICE_MAX_LEN);

  const rawCourses = Array.isArray(root['courseRecommendations']) ? (root['courseRecommendations'] as unknown[]) : [];
  const courseRecommendations: CourseRecommendation[] = rawCourses
    .map(asRecord)
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      title: boundedString(row['title'], COURSE_TITLE_MAX_LEN),
      provider: boundedString(row['provider'], COURSE_PROVIDER_MAX_LEN),
      type: boundedString(row['type'], COURSE_TYPE_MAX_LEN),
    }))
    .filter((c) => c.title.length > 0)
    .slice(0, MAX_COURSE_RECOMMENDATIONS);

  if (!advice && courseRecommendations.length === 0) {
    throw new Error('validateAndRepairEnrichment: no usable advice or course recommendations survived validation');
  }

  return { advice, courseRecommendations };
}

// Measurement-only extraction (ADR-CAREERDIY-0015). Never throws — an absent or invalid
// shadow pick just means no measurement data for this row, not a failed enrichment.
export function extractShadowDirection(raw: unknown): DirectionId | null {
  const root = asRecord(raw);
  const value = root?.['shadowDirection'];
  return isDirectionId(value) ? value : null;
}

export { DIRECTION_IDS };

// ── Cache store — mirrors IdentificationCacheStore's shape ─────────────────────────

export class CareerDiyaLlmCacheStore {
  constructor(private readonly client: SupabaseClient) {}

  async get(keyHash: string): Promise<CareerDiyaEnrichment | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.client as any)
      .schema('knowledge')
      .from('career_diya_llm_cache')
      .select('output')
      .eq('key_hash', keyHash)
      .maybeSingle();

    return data ? (data['output'] as CareerDiyaEnrichment) : null;
  }

  async put(params: {
    keyHash: string;
    promptVersion: string;
    model: string;
    roleNormalized: string;
    directionId: DirectionId;
    output: CareerDiyaEnrichment;
    shadowLlmDirection: DirectionId | null;
  }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.client as any)
      .schema('knowledge')
      .from('career_diya_llm_cache')
      .upsert(
        {
          key_hash: params.keyHash,
          prompt_version: params.promptVersion,
          model: params.model,
          role_normalized: params.roleNormalized,
          direction_id: params.directionId,
          output: params.output,
          shadow_llm_direction: params.shadowLlmDirection,
        },
        { onConflict: 'key_hash', ignoreDuplicates: true },
      );

    // A write failure here (including the expected concurrent-miss race, which
    // ignoreDuplicates already turns into a no-op) must never fail the request — the
    // caller already has valid, freshly-generated output to return regardless.
    if (error) {
      console.error('[career-diya-llm-cache] write failed (non-fatal)', error);
    }
  }
}
