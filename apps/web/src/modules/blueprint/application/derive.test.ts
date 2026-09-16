import { describe, it, expect } from 'vitest';
import { derivePathsFromTasks } from './derive';
import { MockTaskIdentifier } from './taskIdentifier';
import type { TransitionDelta } from '@modules/knowledge';

// Hand-built delta (not derived via computeTransition) so every bucket —
// required/preferred/differentiating, netNew/upskill, three target depths —
// is present and controlled. transferable + retained must never produce a
// task in any output. Under the ADR-013 membership-invariant model, EVERY
// candidate below appears in all three sampled paths — only depth varies.
const DELTA: TransitionDelta = {
  fromRoleKey: 'software engineer',
  toRoleKey: 'product manager',
  transferable: [
    { name: 'communication', proficiency: 'working', criticality: 'required', basis: 'inferred' },
  ],
  upskill: [
    {
      name: 'data analysis',
      proficiency: 'expert',
      criticality: 'required',
      basis: 'inferred',
      currentProficiency: 'awareness',
    },
  ],
  netNew: [
    { name: 'product strategy', proficiency: 'expert', criticality: 'required', basis: 'inferred' },
    { name: 'stakeholder management', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    { name: 'user research', proficiency: 'awareness', criticality: 'preferred', basis: 'inferred' },
    { name: 'presentation skills', proficiency: 'working', criticality: 'preferred', basis: 'inferred' },
    { name: 'financial modeling', proficiency: 'expert', criticality: 'differentiating', basis: 'inferred' },
  ],
  retained: [
    { name: 'system design', proficiency: 'working', criticality: 'preferred', basis: 'inferred' },
  ],
  difficulty: 'moderate',
  computedAt: '2026-07-08T00:00:00Z',
};

const GATE_ANSWERS = { timeline: '3 months', relevantExperience: 'none specified' };

const SKILL_NAMES = [
  'data analysis',
  'product strategy',
  'stakeholder management',
  'user research',
  'presentation skills',
  'financial modeling',
];

const PROFICIENCY_ORDER: Record<string, number> = { awareness: 0, working: 1, expert: 2 };

async function derive(weeklyHours: number | null = 20, basis: 'grounded' | 'inferred' = 'inferred') {
  const identifier = new MockTaskIdentifier();
  const { tasks: confirmedTasks } = await identifier.identify(DELTA, GATE_ANSWERS, basis);
  const [fastest, optimal, longest] = derivePathsFromTasks(confirmedTasks, DELTA.toRoleKey, weeklyHours);
  return { fastest: fastest!, optimal: optimal!, longest: longest!, confirmedTasks };
}

function skillTask(path: Awaited<ReturnType<typeof derive>>['fastest'], name: string) {
  return path.tasks.find((t) => t.skillName === name);
}

function depthOf(task: { title: string }): number {
  const match = task.title.match(/Build (awareness|working|expert)-level/);
  return PROFICIENCY_ORDER[match![1]!]!;
}

describe('MockTaskIdentifier — task identification (ADR-013 §3)', () => {
  it('selects the union of every candidate skill — no criticality filter', async () => {
    const { confirmedTasks } = await derive();
    expect(confirmedTasks.map((t) => t.skillName).sort()).toEqual([...SKILL_NAMES].sort());
  });

  it('transferable and retained skills never become confirmed tasks', async () => {
    const { confirmedTasks } = await derive();
    const names = confirmedTasks.map((t) => t.skillName);
    expect(names).not.toContain('communication');
    expect(names).not.toContain('system design');
  });

  it('assigns taskType to every confirmed task (mock heuristic — differentiating gets evidence, else solo_study)', async () => {
    const { confirmedTasks } = await derive();
    for (const task of confirmedTasks) {
      expect(task.taskType).not.toBeNull();
      if (task.criticality === 'differentiating') expect(task.taskType).toBe('evidence');
      else expect(task.taskType).toBe('solo_study');
    }
  });

  it('required tasks are dependency-free; others depend on the whole required set', async () => {
    const { confirmedTasks } = await derive();
    const requiredIds = confirmedTasks.filter((t) => t.criticality === 'required').map((t) => t.id);
    for (const task of confirmedTasks) {
      if (task.criticality === 'required') expect(task.dependencies).toEqual([]);
      else expect(task.dependencies.sort()).toEqual([...requiredIds].sort());
    }
  });
});

describe('derivePathsFromTasks — membership invariance (ADR-013 model-(b) correction)', () => {
  it('every confirmed skill appears in all three sampled paths — nothing is dropped by level', async () => {
    const { fastest, optimal, longest } = await derive();
    for (const path of [fastest, optimal, longest]) {
      const names = path.tasks.map((t) => t.skillName).filter((n): n is string => n !== null);
      expect(names.sort()).toEqual([...SKILL_NAMES].sort());
    }
  });

  it('task count is IDENTICAL across all three levels (selection no longer varies by strategy)', async () => {
    const { fastest, optimal, longest } = await derive();
    expect(fastest.tasks.length).toBe(SKILL_NAMES.length + 1); // + venture
    expect(optimal.tasks.length).toBe(fastest.tasks.length);
    expect(longest.tasks.length).toBe(fastest.tasks.length);
  });
});

describe('derivePathsFromTasks — depth monotonicity and target-hit at level 1.0', () => {
  it('every skill task is non-decreasing in depth: fastest <= optimal <= longest', async () => {
    const { fastest, optimal, longest } = await derive();
    for (const name of SKILL_NAMES) {
      const f = depthOf(skillTask(fastest, name)!);
      const o = depthOf(skillTask(optimal, name)!);
      const l = depthOf(skillTask(longest, name)!);
      expect(f).toBeLessThanOrEqual(o);
      expect(o).toBeLessThanOrEqual(l);
    }
  });

  it('at level 1.0 (longest), every task reaches its own full targetProficiency, uncapped', async () => {
    const { longest } = await derive();
    expect(depthOf(skillTask(longest, 'data analysis')!)).toBe(PROFICIENCY_ORDER['expert']);
    expect(depthOf(skillTask(longest, 'product strategy')!)).toBe(PROFICIENCY_ORDER['expert']);
    expect(depthOf(skillTask(longest, 'stakeholder management')!)).toBe(PROFICIENCY_ORDER['working']);
    expect(depthOf(skillTask(longest, 'user research')!)).toBe(PROFICIENCY_ORDER['awareness']);
    expect(depthOf(skillTask(longest, 'presentation skills')!)).toBe(PROFICIENCY_ORDER['working']);
    expect(depthOf(skillTask(longest, 'financial modeling')!)).toBe(PROFICIENCY_ORDER['expert']);
  });

  it('required floor: even at the lowest sample level, required tasks never go below working', async () => {
    const { fastest } = await derive();
    expect(depthOf(skillTask(fastest, 'data analysis')!)).toBeGreaterThanOrEqual(PROFICIENCY_ORDER['working']!);
    expect(depthOf(skillTask(fastest, 'product strategy')!)).toBeGreaterThanOrEqual(PROFICIENCY_ORDER['working']!);
    expect(depthOf(skillTask(fastest, 'stakeholder management')!)).toBeGreaterThanOrEqual(PROFICIENCY_ORDER['working']!);
  });
});

describe('derivePathsFromTasks — distinctness (the near-collapse this refactor fixed)', () => {
  it('at least one task differs in depth between fastest and optimal (not accidentally collapsed)', async () => {
    const { fastest, optimal } = await derive();
    const changed = SKILL_NAMES.some(
      (name) => depthOf(skillTask(fastest, name)!) !== depthOf(skillTask(optimal, name)!),
    );
    expect(changed).toBe(true);
  });

  it('at least one task differs in depth between optimal and longest', async () => {
    const { optimal, longest } = await derive();
    const changed = SKILL_NAMES.some(
      (name) => depthOf(skillTask(optimal, name)!) !== depthOf(skillTask(longest, name)!),
    );
    expect(changed).toBe(true);
  });

  it('required and preferred tasks drive fastest-vs-optimal distinctness (verified concretely)', async () => {
    const { fastest, optimal } = await derive();
    expect(depthOf(skillTask(fastest, 'product strategy')!)).toBe(PROFICIENCY_ORDER['working']);
    expect(depthOf(skillTask(optimal, 'product strategy')!)).toBe(PROFICIENCY_ORDER['expert']);
    expect(depthOf(skillTask(fastest, 'presentation skills')!)).toBe(PROFICIENCY_ORDER['awareness']);
    expect(depthOf(skillTask(optimal, 'presentation skills')!)).toBe(PROFICIENCY_ORDER['working']);
  });
});

describe('derivePathsFromTasks — venture task scales with level, not presence', () => {
  it('venture task present at every level (membership-invariant — it is always added, just reframed)', async () => {
    const { fastest, optimal, longest } = await derive();
    for (const path of [fastest, optimal, longest]) {
      expect(path.tasks.filter((t) => t.evolveCategory === 'venture')).toHaveLength(1);
    }
  });

  it('fastest and optimal get the lightweight credibility framing (20h); longest gets the portfolio framing (40h)', async () => {
    const { fastest, optimal, longest } = await derive();
    const ventureOf = (p: typeof fastest) => p.tasks.find((t) => t.evolveCategory === 'venture')!;
    expect(ventureOf(fastest).effortHours).toBe(20);
    expect(ventureOf(optimal).effortHours).toBe(20);
    expect(ventureOf(longest).effortHours).toBe(40);
    expect(ventureOf(fastest).title).toMatch(/small, visible project/);
    expect(ventureOf(longest).title).toMatch(/portfolio project/);
  });
});

describe('derivePathsFromTasks — dependency heuristic (structural, computed once, level-independent)', () => {
  it('required-skill tasks are dependency-free at every level', async () => {
    const { fastest, optimal, longest } = await derive();
    for (const path of [fastest, optimal, longest]) {
      for (const name of ['data analysis', 'product strategy', 'stakeholder management']) {
        expect(skillTask(path, name)!.dependencies).toEqual([]);
      }
    }
  });

  it('preferred/differentiating tasks and the venture task softly depend on the whole required set', async () => {
    const { longest } = await derive();
    const requiredIds = ['data analysis', 'product strategy', 'stakeholder management'].map(
      (name) => skillTask(longest, name)!.id,
    );
    const userResearch = skillTask(longest, 'user research')!;
    const financialModeling = skillTask(longest, 'financial modeling')!;
    const venture = longest.tasks.find((t) => t.evolveCategory === 'venture')!;

    expect(userResearch.dependencies.sort()).toEqual([...requiredIds].sort());
    expect(financialModeling.dependencies.sort()).toEqual([...requiredIds].sort());
    expect(venture.dependencies.sort()).toEqual([...requiredIds].sort());
  });
});

describe('derivePathsFromTasks — effort and calendar arithmetic', () => {
  it('effortTotalHours is monotonically non-decreasing: fastest <= optimal <= longest', async () => {
    const { fastest, optimal, longest } = await derive();
    expect(fastest.effortTotalHours).toBeLessThanOrEqual(optimal.effortTotalHours);
    expect(optimal.effortTotalHours).toBeLessThanOrEqual(longest.effortTotalHours);
  });

  it('effortTotalHours sums exactly on this fixture (fastest=110, optimal=160, longest=210)', async () => {
    // Fixture-specific, not a general guarantee — verified by hand against the
    // CEILING_STEPS table; documents the real numbers for this gap shape.
    // longest: skill tasks 40+40+20+10+20+40=170, + portfolio venture 40 = 210.
    const { fastest, optimal, longest } = await derive();
    expect(fastest.effortTotalHours).toBe(110);
    expect(optimal.effortTotalHours).toBe(160);
    expect(longest.effortTotalHours).toBe(210);
  });

  it('weeklyHours null defaults to 10 and drives intensityHoursPerWeek', async () => {
    const { fastest } = await derive(null);
    expect(fastest.intensityHoursPerWeek).toBe(10);
  });

  it('calendarRange = ceil(total/weeklyHours * 0.8) .. ceil(total/weeklyHours * 1.5)', async () => {
    const { fastest } = await derive(20); // 110h / 20h/wk = 5.5 weeks base
    expect(fastest.calendarRange.minWeeks).toBe(Math.ceil(5.5 * 0.8)); // 5
    expect(fastest.calendarRange.maxWeeks).toBe(Math.ceil(5.5 * 1.5)); // 9
  });
});

describe('derivePathsFromTasks — templates and basis', () => {
  it('probabilityBand matches ADR-012 §1.2 per strategy', async () => {
    const { fastest, optimal, longest } = await derive();
    expect(fastest.probabilityBand).toBe('medium');
    expect(optimal.probabilityBand).toBe('medium_high');
    expect(longest.probabilityBand).toBe('high');
  });

  it('landingDefinition references the target role for every strategy', async () => {
    const { fastest, optimal, longest } = await derive();
    for (const path of [fastest, optimal, longest]) {
      expect(path.landingDefinition).toContain('product manager');
    }
  });

  it('basis is derived from the confirmed tasks (ADR-013 sub-slice 2 — no longer an external input)', async () => {
    const grounded = await derive(20, 'grounded');
    expect(grounded.fastest.basis).toBe('grounded');
    for (const task of grounded.fastest.tasks) expect(task.basis).toBe('grounded');

    const inferred = await derive(20, 'inferred');
    expect(inferred.fastest.basis).toBe('inferred');
  });
});
