export type Basis = 'grounded' | 'inferred' | 'stated';

export interface Confidence {
  value: number;
  basis: Basis;
}

export interface GapItem {
  skill: string;
  have: boolean;
  confidence: Confidence;
}

export type JourneyStep =
  | 'questions_answered'
  | 'current_position'
  | 'desired_position'
  | 'gap_analysis'
  | 'first_action'
  | 'blueprint_generated'
  | 'signals_created';

export interface JourneyEntry {
  step: JourneyStep;
  at: string;
  ref?: { type: 'blueprint' | 'signal' | 'none'; id?: string | null; href?: string | null } | null;
}

export interface ActivationInput {
  currentRole?: string | null;
  desiredRole: string;
  weeklyHours?: number | null;
}

// direction deliberately excludes 'step_down' — see ADR-011 amendment (2026-07-24):
// a demotion is never a user-facing "explore where this leads" suggestion.
export interface AdjacentRoleSuggestion {
  roleKey: string;
  direction: 'lateral' | 'step_up';
}

export interface ActivationResult {
  sessionId: string;
  currentPosition?: { role: string; topSkills: string[] };
  desiredPosition: { role: string; onetCode: string | null };
  gap: GapItem[];
  firstAction: string;
  completed: boolean;
  adjacentRoles?: AdjacentRoleSuggestion[];
}

export interface ActivationSession {
  id: string;
  currentRole: string | null;
  desiredRole: string | null;
  onetCode: string | null;
  gap: GapItem[];
  firstAction: string | null;
  journey: JourneyEntry[];
  completedAt: string | null;
  createdAt: string;
}

export interface ActivationSessionList {
  data: ActivationSession[];
  activeGoalSessionId: string | null;
  page: { nextCursor: null; hasMore: false; limit: number };
}

export interface PromoteResult {
  sessionId: string;
  signalsCreated: number;
  firstSignalId: string;
  accepted: true;
}
