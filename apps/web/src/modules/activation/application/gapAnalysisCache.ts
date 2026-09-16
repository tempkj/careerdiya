import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIActivationResult } from './start';

// Bump this to invalidate the entire cache on a prompt change — mirrors
// TASK_IDENTIFICATION_PROMPT_VERSION (identificationCache.ts).
export const GAP_ANALYSIS_PROMPT_VERSION = 'gap-analysis/v2-role-authoritative';

export function computeGapAnalysisCacheKeyHash(
  promptVersion: string,
  fromRoleKey: string,
  toRoleKey: string,
): string {
  const raw = `${promptVersion}|${fromRoleKey}|${toRoleKey}`;
  return createHash('sha256').update(raw).digest('hex');
}

// ── Validation — the gate between model output and a cache write ──────────────────
//
// This cache is shared and authenticated-writable: any user's cache-miss request writes
// a row every future matching user reads. Every field below is bounded or enum-coerced —
// never passed through from raw model output untouched. Mirrors
// validateAndRepairIdentification's stance (identificationCache.ts).

const CONFIDENCE_BASES = new Set<'stated' | 'inferred' | 'grounded'>(['stated', 'inferred', 'grounded']);
const SKILL_MAX_LEN = 200;
const ACTION_MAX_LEN = 300;
const MAX_GAP_ITEMS = 8;
const MAX_TOP_SKILLS = 6;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// Throws (does not cache a degenerate result) if nothing usable survives — this is the
// exact failure mode Bug 1 hid silently; the cache must never enshrine an empty result
// as if it were real, ever-after-served output.
export function validateAndRepairGapAnalysis(raw: unknown, fallbackRole: string, authoritativeRole = fallbackRole): AIActivationResult {
  const root = asRecord(raw);
  if (!root) throw new Error('validateAndRepairGapAnalysis: expected a JSON object');

  const desiredPositionRaw = asRecord(root['desiredPosition']);
  const onetCode = typeof desiredPositionRaw?.['onetCode'] === 'string' ? (desiredPositionRaw['onetCode'] as string) : null;
  // The selected destination is authoritative. Never allow the model to normalize
  // a Career Diya destination into a different role (e.g. Renewable Energy Engineering
  // becoming Software Engineer). The fallback is retained for callers/tests that do not
  // supply a separate authoritative role.
  const role = authoritativeRole.trim() || (
    typeof desiredPositionRaw?.['role'] === 'string' && (desiredPositionRaw['role'] as string).trim()
      ? (desiredPositionRaw['role'] as string).trim()
      : fallbackRole
  );

  const currentTopSkills = Array.isArray(root['currentTopSkills'])
    ? (root['currentTopSkills'] as unknown[])
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim().slice(0, SKILL_MAX_LEN))
        .slice(0, MAX_TOP_SKILLS)
    : [];

  const rawGap = Array.isArray(root['gap']) ? (root['gap'] as unknown[]) : [];
  const gap = rawGap
    .map((item) => {
      const row = asRecord(item);
      const skill = typeof row?.['skill'] === 'string' ? (row['skill'] as string).trim() : '';
      if (!skill) return null; // no skill name — drop

      const conf = asRecord(row?.['confidence']);
      const value =
        typeof conf?.['value'] === 'number' && Number.isFinite(conf['value'])
          ? Math.min(1, Math.max(0, conf['value'] as number))
          : 0.5;
      const basis =
        typeof conf?.['basis'] === 'string' && CONFIDENCE_BASES.has(conf['basis'] as 'stated' | 'inferred' | 'grounded')
          ? (conf['basis'] as 'stated' | 'inferred' | 'grounded')
          : 'inferred';

      return {
        skill: skill.slice(0, SKILL_MAX_LEN),
        have: row?.['have'] === true,
        confidence: { value, basis },
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .slice(0, MAX_GAP_ITEMS);

  const firstAction =
    typeof root['firstAction'] === 'string' && (root['firstAction'] as string).trim()
      ? (root['firstAction'] as string).trim().slice(0, ACTION_MAX_LEN)
      : '';

  // A result with no gap items and no first action is exactly the degenerate shape Bug 1
  // produced — refuse to cache it rather than enshrining an empty result forever.
  if (gap.length === 0 && !firstAction) {
    throw new Error('validateAndRepairGapAnalysis: no usable content in model output');
  }

  return { desiredPosition: { role, onetCode }, currentTopSkills, gap, firstAction };
}

// ── Cache store — DB-first, mirrors IdentificationCacheStore's shape ───────────────

export class GapAnalysisCacheStore {
  constructor(private readonly client: SupabaseClient) {}

  async get(keyHash: string): Promise<AIActivationResult | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.client as any)
      .schema('knowledge')
      .from('gap_analysis_cache')
      .select('output')
      .eq('key_hash', keyHash)
      .maybeSingle();

    return data ? (data['output'] as AIActivationResult) : null;
  }

  async put(params: {
    keyHash: string;
    promptVersion: string;
    fromRoleKey: string;
    toRoleKey: string;
    output: AIActivationResult;
  }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.client as any)
      .schema('knowledge')
      .from('gap_analysis_cache')
      .upsert(
        {
          key_hash: params.keyHash,
          prompt_version: params.promptVersion,
          from_role_key: params.fromRoleKey,
          to_role_key: params.toRoleKey,
          output: params.output,
        },
        { onConflict: 'key_hash', ignoreDuplicates: true },
      );

    // A write failure here (including the expected concurrent-miss race, which
    // ignoreDuplicates already turns into a no-op) must never fail the request — the
    // caller already has valid, freshly-generated output to return regardless.
    if (error) {
      console.error('[gap-analysis-cache] write failed (non-fatal)', error);
    }
  }
}
