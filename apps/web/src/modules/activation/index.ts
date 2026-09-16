// Public surface of the 'activation' module. Other modules import ONLY from here (invariant A1).
export type {
  ActivationInput,
  ActivationResult,
  ActivationSession,
  ActivationSessionList,
  PromoteResult,
  GapItem,
  Confidence,
  Basis,
  JourneyEntry,
  JourneyStep,
  AdjacentRoleSuggestion,
} from './domain/types';

export { startActivation } from './application/start';
export { completeActivation, ConflictError } from './application/complete';
export { getActivationSession, getLatestActivation, listActivationSessions } from './application/get';
export { promoteExploration, PreconditionError } from './application/promote';
