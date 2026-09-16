import type { Proficiency } from '@modules/knowledge';
import type {
  DerivedPath,
  DraftTask,
  PathStrategy,
  ProbabilityBand,
  Basis,
  CalendarRange,
} from '../domain/types';
import { computePathTotals } from './pathTotals';

type Criticality = 'required' | 'preferred' | 'differentiating';

// ── Effort lookup (hours) — per resolved depth ──────────────────────────────
const EFFORT_HOURS: Record<Proficiency, number> = {
  awareness: 10,
  working: 20,
  expert: 40,
};
const CREDIBILITY_TASK_HOURS = 20;
const PORTFOLIO_TASK_HOURS = 40;
const PORTFOLIO_LEVEL_THRESHOLD = 0.85;

// ── Per-strategy cosmetic templates (ADR-012 §1.2 language) — unchanged ─────
// This is the ONLY place strategy names attach meaning now; the packaging
// itself (computePathAtLevel) knows nothing about "fastest"/"optimal"/"longest".
const STRATEGY_TEMPLATES: Record<
  Exclude<PathStrategy, 'custom'>,
  { probabilityBand: ProbabilityBand; landing: (toRoleKey: string) => string }
> = {
  fastest: {
    probabilityBand: 'medium',
    landing: (toRoleKey) => `Land a ${toRoleKey} role focused on the required core, moving fast.`,
  },
  optimal: {
    probabilityBand: 'medium_high',
    landing: (toRoleKey) => `Land a well-rounded ${toRoleKey} role, balancing speed and depth.`,
  },
  longest: {
    probabilityBand: 'high',
    landing: (toRoleKey) => `Land a ${toRoleKey} role with full target-depth mastery and a portfolio to prove it.`,
  },
};

// Three named samples of the continuous level function (ADR-013). Tuning
// knobs, not fixed truth — validated against real substrate output; adjust
// if two samples ever collapse onto each other for a given gap shape.
const SAMPLE_LEVELS: Record<Exclude<PathStrategy, 'custom'>, number> = {
  fastest: 0.3,
  optimal: 0.6,
  longest: 1.0,
};
const SAMPLE_STRATEGIES: Exclude<PathStrategy, 'custom'>[] = ['fastest', 'optimal', 'longest'];

// ── Depth-at-level (ADR-013 — replaces the old three inconsistent per-strategy rules) ──

const PROFICIENCY_ORDER: Record<Proficiency, number> = { awareness: 0, working: 1, expert: 2 };
const ORDER_TO_PROFICIENCY: Proficiency[] = ['awareness', 'working', 'expert'];

// Step thresholds per criticality: the level at which each proficiency
// ceiling is reached. Tuning knobs — chosen so the three named sample levels
// (0.3/0.6/1.0) land on genuinely different ceilings per criticality; a
// smooth continuous ramp was tried first and rejected because round()
// collapsed preferred's ceiling to 'working' at both 0.3 and 0.6.
const CEILING_STEPS: Record<Criticality, { at: number; ceiling: Proficiency }[]> = {
  required: [
    { at: 0, ceiling: 'working' },   // never below working, even at level 0 (old fastest's cap)
    { at: 0.5, ceiling: 'expert' },
  ],
  preferred: [
    { at: 0, ceiling: 'awareness' },
    { at: 0.5, ceiling: 'working' },
    { at: 0.85, ceiling: 'expert' },
  ],
  differentiating: [
    { at: 0, ceiling: 'awareness' },
    { at: 0.85, ceiling: 'expert' },
  ],
};

function levelCeiling(level: number, criticality: Criticality): Proficiency {
  const steps = CEILING_STEPS[criticality];
  let ceiling = steps[0]!.ceiling;
  for (const step of steps) {
    if (level >= step.at) ceiling = step.ceiling;
  }
  return ceiling;
}

// Membership is never touched here — this only ever returns a proficiency,
// never an omission. min(target, ceiling) also guarantees level 1.0 (every
// ceiling reaches 'expert' by then) always yields the task's own target,
// uncapped.
function depthForTask(task: DraftTask, level: number): Proficiency {
  const ceilingOrdinal = PROFICIENCY_ORDER[levelCeiling(level, task.criticality as Criticality)];
  const targetOrdinal = PROFICIENCY_ORDER[task.targetProficiency as Proficiency];
  return ORDER_TO_PROFICIENCY[Math.min(targetOrdinal, ceilingOrdinal)]!;
}

// ── Venture task as a function of level ─────────────────────────────────────
// The ONE thing that varies by presence/weight rather than depth — it's
// system-added, not a confirmed user task, so scaling it with level is
// legitimate in a way that would not be legitimate for a real task.

function ventureForLevel(level: number, toRoleKey: string, basis: Basis, requiredIds: string[]): DraftTask {
  const isPortfolio = level >= PORTFOLIO_LEVEL_THRESHOLD;
  return {
    id: 'venture',
    libraryTaskId: null,
    title: isPortfolio
      ? `Build a portfolio project demonstrating full ${toRoleKey} readiness`
      : `Ship a small, visible project proving your ${toRoleKey} readiness`,
    description: isPortfolio
      ? 'Portfolio task — a thorough project covering the complete target-depth skill set above.'
      : 'Credibility slot — a quick, public artifact demonstrating the required-core skills above.',
    evolveCategory: 'venture',
    dependencies: requiredIds,
    effortHours: isPortfolio ? PORTFOLIO_TASK_HOURS : CREDIBILITY_TASK_HOURS,
    basis,
    criticality: null,
    targetProficiency: null,
    skillName: null,
    taskType: null,
  };
}

// ── Package a confirmed, membership-fixed task list at a given level ───────

export interface LeveledPath {
  tasks: DraftTask[];
  effortTotalHours: number;
  calendarRange: CalendarRange;
  intensityHoursPerWeek: number;
}

export function computePathAtLevel(
  tasks: DraftTask[],
  level: number,
  toRoleKey: string,
  basis: Basis,
  weeklyHours: number | null,
): LeveledPath {
  const effectiveWeeklyHours = weeklyHours ?? 10;

  // Membership invariant: map, never filter — every input task appears in
  // the output at every level, only its depth/title/effort change.
  const leveledSkillTasks = tasks.map((task) => {
    const depth = depthForTask(task, level);
    return {
      ...task,
      title: `Build ${depth}-level ${task.skillName}`,
      effortHours: EFFORT_HOURS[depth],
    };
  });

  const requiredIds = tasks.filter((t) => t.criticality === 'required').map((t) => t.id);
  const venture = ventureForLevel(level, toRoleKey, basis, requiredIds);

  const allTasks = [...leveledSkillTasks, venture];
  const { effortTotalHours, calendarRange } = computePathTotals(allTasks, effectiveWeeklyHours);

  return { tasks: allTasks, effortTotalHours, calendarRange, intensityHoursPerWeek: effectiveWeeklyHours };
}

// Overall path basis, derived from the confirmed tasks themselves — grounded
// only if every skill task is grounded; any inferred task makes the whole
// path honestly inferred. No longer an external input (ADR-013 sub-slice 2):
// task identification, not path packaging, is where basis actually comes from.
function overallBasis(tasks: DraftTask[]): Basis {
  return tasks.every((t) => t.basis === 'grounded') ? 'grounded' : 'inferred';
}

// ── Public entrypoint — samples the continuous function at 3 named levels ──
// Takes an already-identified, user-confirmed task list (ADR-013 sub-slice 2)
// instead of a TransitionDelta — task identification moved upstream to
// TaskIdentifier / POST /blueprint/identify. This function only packages.

export function derivePathsFromTasks(
  tasks: DraftTask[],
  toRoleKey: string,
  weeklyHours: number | null,
): DerivedPath[] {
  const basis = overallBasis(tasks);

  return SAMPLE_STRATEGIES.map((strategy) => {
    const level = SAMPLE_LEVELS[strategy];
    const leveled = computePathAtLevel(tasks, level, toRoleKey, basis, weeklyHours);
    const template = STRATEGY_TEMPLATES[strategy];
    return {
      strategy,
      tasks: leveled.tasks,
      probabilityBand: template.probabilityBand,
      basis,
      landingDefinition: template.landing(toRoleKey),
      effortTotalHours: leveled.effortTotalHours,
      calendarRange: leveled.calendarRange,
      intensityHoursPerWeek: leveled.intensityHoursPerWeek,
    };
  });
}
