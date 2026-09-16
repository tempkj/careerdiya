import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransitionDelta, SubstrateSkill } from '@modules/knowledge';
import type { Basis, DraftTask, EvolveCategory } from '../domain/types';
import type { GateBucket } from './gateBucketing';
import { slugify } from './slugify';

// Bump this to invalidate the entire cache on a prompt change — iterating on the prompt
// re-runs live under identical conditions instead of silently reading stale output.
export const TASK_IDENTIFICATION_PROMPT_VERSION = 'task-identification/v1';

// ── Key hashing ──────────────────────────────────────────────────────────────────

function normalizeExperienceText(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Deterministic regardless of check order or duplicate entries — sort AFTER normalizing and
// deduping, not before, so 'SQL' and 'sql' collapse to one canonical entry.
function canonicalizeCheckedSkills(checkedSkills: string[]): string {
  const normalized = checkedSkills.map(normalizeExperienceText).filter((s) => s.length > 0);
  return [...new Set(normalized)].sort().join(',');
}

// History, for anyone reading this cold: this key used to hash a bucketed relevantExperience
// value ('none'|'some'|'substantial'), which caused a real false-attribution bug — two
// genuinely different free-text narratives ("worked as scrum master" vs. "made a project
// summary report") landed in the same bucket, so one user's cached assessment (mentioning
// their Scrum Master background) was served to a different user. Fixed short-term by hashing
// the raw free text instead (correctness over cache-hit-rate). This is the structural fix
// (ADR-013 sub-slice 3, planning/Backlog.md's relevant-experience input redesign): the input
// itself is now a substrate-derived checklist + optional free-text elaboration, and the key
// mirrors that shape —
//   - checkedSkills alone -> keyed on the canonical SORTED skill set. Bounded (2^N per role),
//     shareable across any user who checks the same boxes -> this is the caching win restored.
//   - relevantExperienceText present -> its normalized-text hash is appended, same
//     correctness-over-cache-hit-rate tradeoff as before, but now opt-in (most users are
//     checkbox-only) rather than the default for every request.
export function computeCacheKeyHash(
  promptVersion: string,
  fromRoleKey: string,
  toRoleKey: string,
  checkedSkills: string[],
  relevantExperienceText?: string,
): string {
  const skillsPart = canonicalizeCheckedSkills(checkedSkills);
  const textPart = relevantExperienceText?.trim()
    ? createHash('sha256').update(normalizeExperienceText(relevantExperienceText)).digest('hex')
    : '';
  const raw = `${promptVersion}|${fromRoleKey}|${toRoleKey}|${skillsPart}|${textPart}`;
  return createHash('sha256').update(raw).digest('hex');
}

// ── Validation — the gate between model output and a cache write ──────────────────
//
// This cache is shared and authenticated-writable: any user's cache-miss request writes
// a row every future matching user reads. Every field below is either overwritten from
// ground truth we already hold (skillName-matched substrate skill), enum-coerced to a
// safe default, or bounded — never passed through from raw model output untouched. A
// prompt-injected or malformed model response can drop tasks or degrade fields to safe
// defaults; it cannot inject ungrounded skills, fabricated criticality/proficiency, or
// dangling dependency edges into the shared cache.

const VALID_TASK_TYPES = new Set<NonNullable<DraftTask['taskType']>>([
  'compound',
  'solo_study',
  'cant_practice_alone',
  'near_free',
  'evidence',
]);
const VALID_EVOLVE_CATEGORIES = new Set<EvolveCategory>([
  'engage',
  'visualize',
  'organize',
  'learn',
  'venture',
  'elevate',
]);

const TITLE_MAX_LEN = 200;
const DESCRIPTION_MAX_LEN = 1000;

function normalizeSkillNameForMatch(name: string): string {
  return name.trim().toLowerCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asRecord(value: unknown): Record<string, any> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function boundedString(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

export function validateAndRepairIdentification(
  rawOutput: unknown,
  delta: TransitionDelta,
  basis: Basis,
): DraftTask[] {
  if (!Array.isArray(rawOutput)) {
    throw new Error('validateAndRepairIdentification: expected an array of tasks');
  }

  const candidates: SubstrateSkill[] = [...delta.netNew, ...delta.upskill];
  const netNewNames = new Set(delta.netNew.map((s) => normalizeSkillNameForMatch(s.name)));
  const bySkillName = new Map(candidates.map((s) => [normalizeSkillNameForMatch(s.name), s]));

  const repaired: DraftTask[] = [];

  for (const raw of rawOutput) {
    const row = asRecord(raw);
    const rawSkillName = row && typeof row['skillName'] === 'string' ? (row['skillName'] as string) : null;
    if (!rawSkillName) continue; // no skillName to ground against — drop

    const matched = bySkillName.get(normalizeSkillNameForMatch(rawSkillName));
    if (!matched) continue; // doesn't map to a real input skill — drop (validate-hard)

    const id = slugify(matched.name);

    const rawTaskType = row?.['taskType'];
    let taskType: DraftTask['taskType'] =
      typeof rawTaskType === 'string' && VALID_TASK_TYPES.has(rawTaskType as NonNullable<DraftTask['taskType']>)
        ? (rawTaskType as DraftTask['taskType'])
        : null;
    // near-free grounded: only plausible when there's an actual from-role<->target overlap
    // signal (skill already held at some level = delta.upskill). netNew = zero overlap,
    // so a near-free claim there has no leverage to stand on — downgrade it.
    if (taskType === 'near_free' && netNewNames.has(normalizeSkillNameForMatch(matched.name))) {
      taskType = 'solo_study';
    }

    const rawEvolveCategory = row?.['evolveCategory'];
    const evolveCategory: EvolveCategory =
      typeof rawEvolveCategory === 'string' && VALID_EVOLVE_CATEGORIES.has(rawEvolveCategory as EvolveCategory)
        ? (rawEvolveCategory as EvolveCategory)
        : 'learn';

    const rawEffortHours = row?.['effortHours'];
    const effortHours =
      typeof rawEffortHours === 'number' && Number.isFinite(rawEffortHours) && rawEffortHours >= 0
        ? rawEffortHours
        : 0;

    const rawTitle = row?.['title'];
    const title = (typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : matched.name).slice(
      0,
      TITLE_MAX_LEN,
    );

    const rawDescription = row?.['description'];
    const description =
      typeof rawDescription === 'string' && rawDescription.trim()
        ? rawDescription.trim().slice(0, DESCRIPTION_MAX_LEN)
        : null;

    const rawDependencies = row?.['dependencies'];
    const dependencies = Array.isArray(rawDependencies) ? rawDependencies.filter((d) => typeof d === 'string') : [];

    repaired.push({
      id,
      libraryTaskId: null, // no task-library integration this slice (matches MockTaskIdentifier)
      title,
      description,
      evolveCategory,
      dependencies, // resolved against the final id set in a second pass below
      effortHours,
      basis, // always the caller's ground truth, never trusted from model output
      criticality: matched.criticality, // always overwritten from the matched input skill
      targetProficiency: matched.proficiency, // always overwritten from the matched input skill
      skillName: matched.name,
      taskType,
    });
  }

  // Second pass: drop dependency edges that don't reference a task in the final set —
  // no dangling/injected edges from a manipulated response.
  const validIds = new Set(repaired.map((t) => t.id));
  const withCleanDeps = repaired.map((t) => ({
    ...t,
    dependencies: [...new Set(t.dependencies.filter((d) => validIds.has(d) && d !== t.id))],
  }));

  if (withCleanDeps.length === 0) {
    throw new Error('validateAndRepairIdentification: no tasks survived validation');
  }

  return withCleanDeps;
}

// ── Counsellor assessment — the source-of-truth shape, DraftTask[] is a derivation ──
//
// The model's actual output is prose-plus-tasks (framing, grouped/rationalized tasks,
// throughLine) — the counsellor structure is what's expensive to produce and what gets
// evaluated for quality. The flat DraftTask[] the engine consumes is a lossy projection
// of it (drops grouping/rationale/framing/throughLine). So the cache stores the
// assessment, validated at write time, not the flat projection — a cache hit and a
// fresh miss both flatten the same validated shape via flattenAssessment, guaranteeing
// identical DraftTask[] output either way.

export interface CounsellorTaskGroup {
  title: string;
  rationale: string;
  tasks: DraftTask[];
}

export interface CounsellorAssessment {
  framing: string;
  taskGroups: CounsellorTaskGroup[];
  throughLine: string;
}

// Validates a raw { framing, taskGroups: [{ title, rationale, tasks }], throughLine }
// response. Reuses validateAndRepairIdentification (untouched, already tested) as the
// single source of truth for per-task validation — runs it ONCE across every task from
// every group concatenated, so cross-group dependency references still resolve
// correctly (a task in one group can legitimately depend on a task named in another).
// Validated tasks are then re-bucketed into their original group by matching the
// validator's output skillName back against a lookup built from the raw input — this
// avoids threading a group tag through validateAndRepairIdentification's typed
// DraftTask construction, which only ever emits known DraftTask fields.
export function validateAndRepairAssessment(
  raw: unknown,
  delta: TransitionDelta,
  basis: Basis,
): CounsellorAssessment {
  const root = asRecord(raw);
  if (!root || !Array.isArray(root['taskGroups'])) {
    throw new Error('validateAndRepairAssessment: expected an object with a taskGroups array');
  }

  const rawGroups = root['taskGroups'] as unknown[];

  // skillName -> originating group index, built from the RAW (pre-validation) tasks.
  // Last write wins if a skill appears in two groups — the prompt instructs against
  // this, but if it happens anyway, one canonical placement is a reasonable
  // simplification (the task still survives validation either way).
  const skillNameToGroupIndex = new Map<string, number>();
  const allRawTasks: unknown[] = [];
  rawGroups.forEach((group, groupIndex) => {
    const groupRecord = asRecord(group);
    const tasks = groupRecord && Array.isArray(groupRecord['tasks']) ? (groupRecord['tasks'] as unknown[]) : [];
    for (const task of tasks) {
      const taskRecord = asRecord(task);
      const rawSkillName = taskRecord && typeof taskRecord['skillName'] === 'string' ? taskRecord['skillName'] : null;
      if (rawSkillName) skillNameToGroupIndex.set(normalizeSkillNameForMatch(rawSkillName), groupIndex);

      // The model expresses dependencies as skillName references (its only shared
      // vocabulary with the task list) — validateAndRepairIdentification's dangling-
      // edge cleanup expects them already in the slugify(skillName) id format it
      // assigns to every task's own id. Convert here, once, before flattening — a
      // genuine cross-reference (matching a real task) then resolves correctly; a
      // bogus one still gets dropped by the existing cleanup pass unchanged.
      const rawDependencies = taskRecord?.['dependencies'];
      const taskForValidation =
        taskRecord && Array.isArray(rawDependencies)
          ? { ...taskRecord, dependencies: rawDependencies.filter((d) => typeof d === 'string').map((d) => slugify(d)) }
          : task;

      allRawTasks.push(taskForValidation);
    }
  });

  const flatValidated = validateAndRepairIdentification(allRawTasks, delta, basis);

  const bucketed: DraftTask[][] = rawGroups.map(() => []);
  for (const task of flatValidated) {
    const groupIndex = skillNameToGroupIndex.get(normalizeSkillNameForMatch(task.skillName ?? '')) ?? 0;
    bucketed[groupIndex]!.push(task);
  }

  const taskGroups: CounsellorTaskGroup[] = rawGroups
    .map((group, groupIndex) => {
      const groupRecord = asRecord(group);
      return {
        title: boundedString(groupRecord?.['title'], TITLE_MAX_LEN),
        rationale: boundedString(groupRecord?.['rationale'], DESCRIPTION_MAX_LEN),
        tasks: bucketed[groupIndex]!,
      };
    })
    // Drop groups that lost every task to validation — an empty group with rationale
    // text but no tasks is misleading, not useful, downstream.
    .filter((group) => group.tasks.length > 0);

  if (taskGroups.length === 0) {
    throw new Error('validateAndRepairAssessment: no tasks survived validation in any group');
  }

  return {
    framing: boundedString(root['framing'], DESCRIPTION_MAX_LEN),
    taskGroups,
    throughLine: boundedString(root['throughLine'], DESCRIPTION_MAX_LEN),
  };
}

// The one flatten operation, used identically on both the cache-hit and fresh-miss
// paths — guarantees a hit and a miss return the same DraftTask[] for the same
// validated assessment, by construction (same function, same input shape).
export function flattenAssessment(assessment: CounsellorAssessment): DraftTask[] {
  return assessment.taskGroups.flatMap((group) => group.tasks);
}

// ── Cache store — DB-first, mirrors SubstrateStore's shape ─────────────────────────

export class IdentificationCacheStore {
  constructor(private readonly client: SupabaseClient) {}

  async get(keyHash: string): Promise<CounsellorAssessment | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.client as any)
      .schema('knowledge')
      .from('identification_cache')
      .select('output')
      .eq('key_hash', keyHash)
      .maybeSingle();

    return data ? (data['output'] as CounsellorAssessment) : null;
  }

  async put(params: {
    keyHash: string;
    promptVersion: string;
    fromRoleKey: string;
    toRoleKey: string;
    gateBucket: GateBucket;
    assessment: CounsellorAssessment;
  }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (this.client as any)
      .schema('knowledge')
      .from('identification_cache')
      .upsert(
        {
          key_hash: params.keyHash,
          prompt_version: params.promptVersion,
          from_role_key: params.fromRoleKey,
          to_role_key: params.toRoleKey,
          gate_bucket: params.gateBucket,
          output: params.assessment,
        },
        { onConflict: 'key_hash', ignoreDuplicates: true },
      );

    // A write failure here (including the expected concurrent-miss race, which
    // ignoreDuplicates already turns into a no-op) must never fail the request — the
    // caller already has valid, freshly-generated output to return regardless.
    if (error) {
      console.error('[identification-cache] write failed (non-fatal)', error);
    }
  }
}
