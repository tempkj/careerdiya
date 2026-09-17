import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DIRECTION_CANONICAL_SLUG_WORDS, DIRECTION_IDS, DIRECTION_LABELS, isDirectionId, type DirectionId } from '../domain/directions';
import type { BoundedAnswers, CareerDiyaEnrichment, CourseRecommendation } from '../domain/types';

// v2: system prompt now explicitly forbids arguing for a direction other than the fixed
// one (the off-topic-direction screen below). Bump this to invalidate the entire cache on
// a prompt change — mirrors TASK_IDENTIFICATION_PROMPT_VERSION / GAP_ANALYSIS_PROMPT_VERSION.
export const CAREER_DIYA_ENRICHMENT_PROMPT_VERSION = 'career-diya-enrichment/v2';

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

// ── Off-topic-direction screen ─────────────────────────────────────────────────────
//
// The direction FIELD is already impossible to override by construction (no such field
// exists on CareerDiyaEnrichment). This screen closes the other channel: the model can
// still write prose that argues for a different direction while leaving the field alone
// ("your direction is Software Engineering... here's why you should pivot to HR").
// That's the same confidently-wrong failure the deterministic eligibility gate exists to
// prevent, just arriving through text instead of a field — so it is treated as a
// validation failure, not a display concern.
//
// Match terms per direction are DERIVED, not hand-authored: DIRECTION_LABELS (already the
// enrichment prompt's own vocabulary) plus DIRECTION_CANONICAL_SLUG_WORDS (the Career
// Library category phrasing career-mapping.js's DIRECTION_ID_ALIASES resolves to — a
// second, differently-phrased name for the same direction) plus any ALL-CAPS segment of
// the label (mechanically pulled out — 'HR' from 'People, Education & HR', 'UX' from
// 'Design, UX & Creative Technology'). Deliberately NOT every comma-separated word in a
// label (e.g. NOT 'Research', 'Care', 'Service', 'Business', 'Policy' in isolation) —
// those are common English words that appear constantly in perfectly on-topic advice for
// an unrelated direction, and word-level matching on them would false-positive on nearly
// every response.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function allCapsSegments(label: string): string[] {
  return label
    .split(/[,&]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s === s.toUpperCase() && /[A-Z]/.test(s))
    .map((s) => s.toLowerCase());
}

function matchTermsForDirection(id: DirectionId): string[] {
  const label = DIRECTION_LABELS[id].toLowerCase();
  return [label, DIRECTION_CANONICAL_SLUG_WORDS[id], ...allCapsSegments(DIRECTION_LABELS[id])];
}

// Returns the OTHER direction id referenced in the text, or null if the text stays on
// the chosen direction. Screens advice + every course recommendation field — a course
// titled "HR Fundamentals" is just as much an off-topic pivot as a sentence about it.
export function findOtherDirectionReference(enrichment: CareerDiyaEnrichment, chosenDirectionId: DirectionId): DirectionId | null {
  const haystack = [
    enrichment.advice,
    ...enrichment.courseRecommendations.flatMap((c) => [c.title, c.provider, c.type]),
  ]
    .join(' ')
    .toLowerCase();

  for (const id of DIRECTION_IDS) {
    if (id === chosenDirectionId) continue;
    for (const term of matchTermsForDirection(id)) {
      if (!term || term.length < 2) continue;
      if (new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(haystack)) return id;
    }
  }
  return null;
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
