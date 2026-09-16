export type Basis = 'grounded' | 'inferred';
export type EvolveCategory = 'engage' | 'visualize' | 'organize' | 'learn' | 'venture' | 'elevate';
export type PathStrategy = 'fastest' | 'longest' | 'optimal' | 'custom';

export type ProbabilityBand = 'medium' | 'medium_high' | 'high';

export interface CalendarRange {
  minWeeks: number;
  maxWeeks: number;
}

// Ephemeral — never persisted. What the generator produces before the user picks one.
export interface DerivedPath {
  strategy: PathStrategy;
  tasks: DraftTask[];
  // Categorical, not a computed score — deliberately not a numeric probability
  // (false-precision rejected; sort by band ordinal if ranking is ever needed).
  probabilityBand: ProbabilityBand;
  basis: Basis;
  landingDefinition: string;
  effortTotalHours: number;
  calendarRange: CalendarRange;
  intensityHoursPerWeek: number;
}

// A task inside a DerivedPath, before promotion — not yet a DB row.
export interface DraftTask {
  id: string;                     // local id, unique within one DerivedPath — NOT a DB id.
                                   // Lets dependencies reference siblings before promotion;
                                   // promote.ts remaps these to real uuids.
  libraryTaskId: string | null;   // null if AI-articulated, no library match
  title: string;
  description: string | null;
  evolveCategory: EvolveCategory;
  dependencies: string[];         // references other DraftTask ids within the same path
  effortHours: number;            // numeric, for path-level aggregation (effortTotalHours).
                                   // BlueprintTask (persisted) keeps effortEstimate as text —
                                   // promote.ts formats effortHours -> text at snapshot time.
  basis: Basis;

  // ── ADR-013 (task identification as a live-AI reasoning layer) ────────────
  // Present for skill-derived tasks (from the confirmed task list); null for
  // system-added tasks (the venture task) which have no substrate skill
  // behind them. Domain layer stays import-free (no cross-module type import
  // for the Proficiency/criticality unions — inlined here instead).
  criticality: 'required' | 'preferred' | 'differentiating' | null;
  targetProficiency: 'awareness' | 'working' | 'expert' | null;
  skillName: string | null;       // raw skill name — title is depth-qualified per level, not fixed at creation
  taskType: 'compound' | 'solo_study' | 'cant_practice_alone' | 'near_free' | 'evidence' | null;  // unused this slice
}

export interface BlueprintTask {
  id: string;
  blueprintId: string;
  libraryTaskId: string | null;
  title: string;
  description: string | null;
  evolveCategory: EvolveCategory;
  dependencies: string[];
  sequenceOrder: number;
  effortEstimate: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'skipped' | null;
  basis: Basis;
}

// Mirrors packages/db/schemas/readiness.schema.json (ADR-005 hosting relationship).
// The `readiness` module is not yet built (its index.ts is a scaffold, `export {};`) —
// once it exposes its own domain types, this should be replaced by an import from
// there rather than redefined here (invariant A1: public surface only).
export interface ReadinessSnapshot {
  careerReadiness: number;
  dimensions: {
    clarity: number;
    capability: number;
    execution: number;
    opportunity: number;
  };
  specVersion: string;
}

export interface StoredBlueprint {
  id: string;
  userId: string;
  sessionId: string;
  version: number;
  status: 'active' | 'superseded';
  pathStrategy: PathStrategy;
  basis: Basis;
  tasks: BlueprintTask[];
  readiness: ReadinessSnapshot | null;
  generatedAt: string;
  generatedByModel: string | null;
  promptVersion: string | null;
  promotedAt: string;
}

// User edits applied to a DerivedPath before promotion (ADR-012 §1.3: reorder,
// override soft deps, add/remove tasks). All fields reference DraftTask ids.
export interface BlueprintEdits {
  taskOrder?: string[];                            // desired order; unlisted ids keep original relative order, appended after
  removedTaskIds?: string[];
  dependencyOverrides?: Record<string, string[]>;  // DraftTask id -> overridden dependency DraftTask ids
  addedTasks?: DraftTask[];                         // user-invented tasks — no substrate grounding
}

export interface TaskLibraryEntry {
  id: string;
  title: string;
  description: string | null;
  evolveCategory: EvolveCategory;
  typicalEffortEstimate: string | null;
  defaultDependencies: string[];
  basis: Basis;
  source: 'mock' | 'curated' | 'ai_generated';
}
