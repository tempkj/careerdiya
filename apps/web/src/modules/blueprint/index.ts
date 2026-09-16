// Public surface of the 'blueprint' module. Other modules import ONLY from here (invariant A1).
// Internals stay private to this folder.
export type {
  Basis,
  EvolveCategory,
  PathStrategy,
  ProbabilityBand,
  CalendarRange,
  DerivedPath,
  DraftTask,
  BlueprintTask,
  BlueprintEdits,
  StoredBlueprint,
  TaskLibraryEntry,
  ReadinessSnapshot,
} from './domain/types';
export { derivePathsFromTasks, computePathAtLevel } from './application/derive';
export type { LeveledPath } from './application/derive';
export {
  MockTaskIdentifier,
  LiveTaskIdentifier,
  createTaskIdentifier,
  callTaskIdentificationModel,
} from './application/taskIdentifier';
export type { TaskIdentifier, GateAnswers, TaskIdentificationResult } from './application/taskIdentifier';
export { bucketGateProfile } from './application/gateBucketing';
export type { GateBucket, TimelineBucket, ExperienceBucket } from './application/gateBucketing';
export {
  TASK_IDENTIFICATION_PROMPT_VERSION,
  computeCacheKeyHash,
  validateAndRepairIdentification,
  validateAndRepairAssessment,
  flattenAssessment,
  IdentificationCacheStore,
} from './application/identificationCache';
export type { CounsellorAssessment, CounsellorTaskGroup } from './application/identificationCache';
export { evaluateDispute } from './application/dispute';
export type { DisputeResult } from './application/dispute';
export { promoteBlueprint } from './application/promote';
