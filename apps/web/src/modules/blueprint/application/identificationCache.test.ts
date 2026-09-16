import { describe, it, expect, vi } from 'vitest';
import type { TransitionDelta } from '@modules/knowledge';
import {
  computeCacheKeyHash,
  validateAndRepairIdentification,
  validateAndRepairAssessment,
  flattenAssessment,
  IdentificationCacheStore,
  TASK_IDENTIFICATION_PROMPT_VERSION,
  type CounsellorAssessment,
} from './identificationCache';
// Minimal Supabase client stub — same pattern as substrate.test.ts / promote.test.ts
function makeClient(overrides: Partial<Record<string, unknown>> = {}) {
  const base: Record<string, unknown> = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  return base as unknown;
}

function makeDelta(overrides: Partial<TransitionDelta> = {}): TransitionDelta {
  return {
    fromRoleKey: 'software engineer',
    toRoleKey: 'product manager',
    transferable: [],
    upskill: [
      {
        name: 'stakeholder management',
        proficiency: 'working',
        criticality: 'required',
        basis: 'inferred',
        currentProficiency: 'awareness',
      },
    ],
    netNew: [{ name: 'product strategy', proficiency: 'expert', criticality: 'required', basis: 'inferred' }],
    retained: [],
    difficulty: 'moderate',
    computedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── computeCacheKeyHash ──────────────────────────────────────────────────────────

describe('computeCacheKeyHash', () => {
  it('is deterministic for identical inputs', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', ['stakeholder management']);
    const b = computeCacheKeyHash('v1', 'from', 'to', ['stakeholder management']);
    expect(a).toBe(b);
  });

  it('produces a 64-char lowercase hex sha256 digest', () => {
    const hash = computeCacheKeyHash('v1', 'from', 'to', ['stakeholder management']);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when prompt_version changes', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', ['stakeholder management']);
    const b = computeCacheKeyHash('v2', 'from', 'to', ['stakeholder management']);
    expect(a).not.toBe(b);
  });

  it('changes when roles change', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', ['stakeholder management']);
    const b = computeCacheKeyHash('v1', 'other-from', 'to', ['stakeholder management']);
    expect(a).not.toBe(b);
  });

  // ── checkedSkills canonicalization (the caching win) ─────────────────────────────

  it('is independent of check order — same set, different order, same key', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', ['skill a', 'skill b']);
    const b = computeCacheKeyHash('v1', 'from', 'to', ['skill b', 'skill a']);
    expect(a).toBe(b);
  });

  it('is independent of duplicate entries and whitespace/case', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', ['Skill A', 'skill a', '  skill a  ']);
    const b = computeCacheKeyHash('v1', 'from', 'to', ['skill a']);
    expect(a).toBe(b);
  });

  it('changes when the checked skill SET changes', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', ['skill a']);
    const b = computeCacheKeyHash('v1', 'from', 'to', ['skill a', 'skill b']);
    expect(a).not.toBe(b);
  });

  it('empty checkedSkills and no free text is its own stable key (the skip case)', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', []);
    const b = computeCacheKeyHash('v1', 'from', 'to', []);
    expect(a).toBe(b);
  });

  // ── free-text elaboration (opt-in cost) ───────────────────────────────────────────

  it('an absent relevantExperienceText and an empty/whitespace one hash identically', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', ['skill a']);
    const b = computeCacheKeyHash('v1', 'from', 'to', ['skill a'], '');
    const c = computeCacheKeyHash('v1', 'from', 'to', ['skill a'], '   ');
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('a present relevantExperienceText changes the key even with identical checkedSkills', () => {
    const a = computeCacheKeyHash('v1', 'from', 'to', ['skill a']);
    const b = computeCacheKeyHash('v1', 'from', 'to', ['skill a'], 'also did X at my last job');
    expect(a).not.toBe(b);
  });

  // Regression test for the false-attribution bug (identify()'s original manifestation): two
  // different free-text narratives that would previously bucket to the SAME ExperienceBucket
  // ('some') must produce DIFFERENT cache keys, so one can never be served the other's
  // cached assessment.
  it('changes when relevantExperienceText changes, even within the same old bucket', () => {
    const a = computeCacheKeyHash('v1', 'software engineer', 'product manager', [], 'worked as scrum master');
    const b = computeCacheKeyHash('v1', 'software engineer', 'product manager', [], 'made project summary report');
    expect(a).not.toBe(b);
  });
});

// ── IdentificationCacheStore ────────────────────────────────────────────────────

describe('IdentificationCacheStore', () => {
  it('returns null on cache miss', async () => {
    const store = new IdentificationCacheStore(makeClient() as never);
    const result = await store.get('a'.repeat(64));
    expect(result).toBeNull();
  });

  it('returns the stored assessment on cache hit', async () => {
    const assessment: CounsellorAssessment = {
      framing: 'framing text',
      taskGroups: [{ title: 'g1', rationale: 'r1', tasks: [] }],
      throughLine: 'through line text',
    };
    const client = makeClient({
      maybeSingle: vi.fn().mockResolvedValue({ data: { output: assessment } }),
    });
    const store = new IdentificationCacheStore(client as never);
    const result = await store.get('a'.repeat(64));
    expect(result).toEqual(assessment);
  });

  it('does not throw when the write fails (non-fatal)', async () => {
    const client = makeClient({
      upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
    });
    const store = new IdentificationCacheStore(client as never);
    await expect(
      store.put({
        keyHash: 'a'.repeat(64),
        promptVersion: TASK_IDENTIFICATION_PROMPT_VERSION,
        fromRoleKey: 'from',
        toRoleKey: 'to',
        gateBucket: { timeline: 'unspecified', relevantExperience: 'some' },
        assessment: { framing: '', taskGroups: [], throughLine: '' },
      }),
    ).resolves.toBeUndefined();
  });
});

// ── validateAndRepairIdentification ─────────────────────────────────────────────

describe('validateAndRepairIdentification', () => {
  it('throws if rawOutput is not an array', () => {
    expect(() => validateAndRepairIdentification({ not: 'an array' }, makeDelta(), 'inferred')).toThrow();
  });

  it('throws if no tasks survive validation', () => {
    expect(() => validateAndRepairIdentification([{ skillName: 'nonexistent skill' }], makeDelta(), 'inferred')).toThrow();
  });

  it('drops tasks whose skillName has no matching input skill', () => {
    const raw = [
      { skillName: 'product strategy', taskType: 'evidence' },
      { skillName: 'made up skill', taskType: 'evidence' },
    ];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result).toHaveLength(1);
    expect(result[0]!.skillName).toBe('product strategy');
  });

  it('matches skillName case-insensitively and trims', () => {
    const raw = [{ skillName: '  Product STRATEGY  ' }];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result).toHaveLength(1);
    expect(result[0]!.skillName).toBe('product strategy');
  });

  it('overwrites criticality, targetProficiency, and basis from ground truth, not model output', () => {
    const raw = [
      {
        skillName: 'product strategy',
        criticality: 'preferred', // wrong — real skill is 'required'
        targetProficiency: 'awareness', // wrong — real skill is 'expert'
        basis: 'grounded', // wrong — caller basis is 'inferred'
      },
    ];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.criticality).toBe('required');
    expect(result[0]!.targetProficiency).toBe('expert');
    expect(result[0]!.basis).toBe('inferred');
  });

  it('derives id from the matched skill name, ignoring any model-supplied id', () => {
    const raw = [{ skillName: 'product strategy', id: 'attacker-controlled-id; DROP TABLE x' }];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.id).toBe('product-strategy');
  });

  it('downgrades near_free to solo_study when the skill is netNew (no overlap signal)', () => {
    const raw = [{ skillName: 'product strategy', taskType: 'near_free' }]; // netNew in makeDelta()
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.taskType).toBe('solo_study');
  });

  it('allows near_free to stand when the skill is upskill (real overlap signal)', () => {
    const raw = [{ skillName: 'stakeholder management', taskType: 'near_free' }]; // upskill in makeDelta()
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.taskType).toBe('near_free');
  });

  it('coerces an invalid taskType to null', () => {
    const raw = [{ skillName: 'product strategy', taskType: 'made_up_type' }];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.taskType).toBeNull();
  });

  it('coerces an invalid evolveCategory to learn', () => {
    const raw = [{ skillName: 'product strategy', evolveCategory: 'not-a-real-category' }];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.evolveCategory).toBe('learn');
  });

  it('coerces a negative or non-numeric effortHours to 0', () => {
    const raw = [
      { skillName: 'product strategy', effortHours: -50 },
      { skillName: 'stakeholder management', effortHours: 'lots' },
    ];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.effortHours).toBe(0);
    expect(result[1]!.effortHours).toBe(0);
  });

  it('truncates an oversized title and description', () => {
    const raw = [
      {
        skillName: 'product strategy',
        title: 'x'.repeat(500),
        description: 'y'.repeat(2000),
      },
    ];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.title.length).toBeLessThanOrEqual(200);
    expect(result[0]!.description?.length).toBeLessThanOrEqual(1000);
  });

  it('always sets libraryTaskId to null regardless of model output', () => {
    const raw = [{ skillName: 'product strategy', libraryTaskId: 'lib-123' }];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.libraryTaskId).toBeNull();
  });

  it('drops dependency edges that reference a task not in the final validated set', () => {
    const raw = [
      { skillName: 'product strategy', dependencies: ['stakeholder-management', 'ghost-task-id'] },
      { skillName: 'stakeholder management', dependencies: [] },
    ];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    const productStrategy = result.find((t) => t.skillName === 'product strategy')!;
    expect(productStrategy.dependencies).toEqual(['stakeholder-management']);
  });

  it('drops a self-referencing dependency edge', () => {
    const raw = [{ skillName: 'product strategy', dependencies: ['product-strategy'] }];
    const result = validateAndRepairIdentification(raw, makeDelta(), 'inferred');
    expect(result[0]!.dependencies).toEqual([]);
  });
});

// ── validateAndRepairAssessment ─────────────────────────────────────────────────

function makeRawAssessment(overrides: Record<string, unknown> = {}) {
  return {
    framing: 'This transition leverages your engineering background.',
    taskGroups: [
      {
        title: 'Build product sense',
        rationale: 'These compound into one case study.',
        tasks: [{ skillName: 'product strategy', taskType: 'evidence' }],
      },
      {
        title: 'Stakeholder leverage',
        rationale: 'Your technical fluency transfers directly here.',
        tasks: [{ skillName: 'stakeholder management', taskType: 'near_free' }],
      },
    ],
    throughLine: 'Together these prove you can operate as a PM.',
    ...overrides,
  };
}

describe('validateAndRepairAssessment', () => {
  it('throws if raw is not an object with a taskGroups array', () => {
    expect(() => validateAndRepairAssessment({ framing: 'x' }, makeDelta(), 'inferred')).toThrow();
    expect(() => validateAndRepairAssessment('not an object', makeDelta(), 'inferred')).toThrow();
  });

  it('throws if no tasks survive validation in any group', () => {
    const raw = makeRawAssessment({
      taskGroups: [{ title: 'g', rationale: 'r', tasks: [{ skillName: 'nonexistent skill' }] }],
    });
    expect(() => validateAndRepairAssessment(raw, makeDelta(), 'inferred')).toThrow();
  });

  it('preserves framing, group structure, and throughLine', () => {
    const result = validateAndRepairAssessment(makeRawAssessment(), makeDelta(), 'inferred');
    expect(result.framing).toBe('This transition leverages your engineering background.');
    expect(result.throughLine).toBe('Together these prove you can operate as a PM.');
    expect(result.taskGroups).toHaveLength(2);
    expect(result.taskGroups[0]!.title).toBe('Build product sense');
    expect(result.taskGroups[0]!.rationale).toBe('These compound into one case study.');
  });

  it('re-buckets validated tasks into their original group', () => {
    const result = validateAndRepairAssessment(makeRawAssessment(), makeDelta(), 'inferred');
    expect(result.taskGroups[0]!.tasks.map((t) => t.skillName)).toEqual(['product strategy']);
    expect(result.taskGroups[1]!.tasks.map((t) => t.skillName)).toEqual(['stakeholder management']);
  });

  it('applies the same per-task validation rules as validateAndRepairIdentification (e.g. near-free downgrade)', () => {
    const raw = makeRawAssessment({
      taskGroups: [
        { title: 'g', rationale: 'r', tasks: [{ skillName: 'product strategy', taskType: 'near_free' }] }, // netNew
      ],
    });
    const result = validateAndRepairAssessment(raw, makeDelta(), 'inferred');
    expect(result.taskGroups[0]!.tasks[0]!.taskType).toBe('solo_study');
  });

  it('drops a group entirely if every one of its tasks fails validation', () => {
    const raw = makeRawAssessment({
      taskGroups: [
        { title: 'good', rationale: 'r', tasks: [{ skillName: 'product strategy' }] },
        { title: 'all-invalid', rationale: 'r', tasks: [{ skillName: 'made up skill' }] },
      ],
    });
    const result = validateAndRepairAssessment(raw, makeDelta(), 'inferred');
    expect(result.taskGroups).toHaveLength(1);
    expect(result.taskGroups[0]!.title).toBe('good');
  });

  it('resolves cross-group dependency references (by skillName) correctly', () => {
    const raw = makeRawAssessment({
      taskGroups: [
        {
          title: 'g1',
          rationale: 'r',
          tasks: [{ skillName: 'product strategy', dependencies: ['stakeholder management'] }],
        },
        { title: 'g2', rationale: 'r', tasks: [{ skillName: 'stakeholder management' }] },
      ],
    });
    const result = validateAndRepairAssessment(raw, makeDelta(), 'inferred');
    expect(result.taskGroups[0]!.tasks[0]!.dependencies).toEqual(['stakeholder-management']);
  });

  it('bounds framing, group title, and rationale to safe defaults when malformed', () => {
    const raw = makeRawAssessment({ framing: 12345, taskGroups: [{ title: null, rationale: {}, tasks: [{ skillName: 'product strategy' }] }] });
    const result = validateAndRepairAssessment(raw, makeDelta(), 'inferred');
    expect(result.framing).toBe('');
    expect(result.taskGroups[0]!.title).toBe('');
    expect(result.taskGroups[0]!.rationale).toBe('');
  });
});

// ── flattenAssessment ────────────────────────────────────────────────────────────

describe('flattenAssessment', () => {
  it('flattens all groups into one array, preserving task content', () => {
    const validated = validateAndRepairAssessment(makeRawAssessment(), makeDelta(), 'inferred');
    const flat = flattenAssessment(validated);
    expect(flat).toHaveLength(2);
    expect(flat.map((t) => t.skillName).sort()).toEqual(['product strategy', 'stakeholder management'].sort());
  });

  it('is idempotent — flattening the same assessment twice yields identical output (hit vs miss parity)', () => {
    const validated = validateAndRepairAssessment(makeRawAssessment(), makeDelta(), 'inferred');
    expect(flattenAssessment(validated)).toEqual(flattenAssessment(validated));
  });
});
