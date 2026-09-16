// Public surface of the 'knowledge' module. Other modules import ONLY from here (invariant A1).
export type {
  SubstrateSkill,
  SubstrateMarket,
  SubstrateAdjacentRole,
  SubstratePayloadV1,
  RoleSubstrate,
  GeneratedSubstrate,
  SubstrateGenerator,
} from './domain/types';
export {
  normalizeRoleKey,
  MockSubstrateGenerator,
  LiveSubstrateGenerator,
  SubstrateStore,
  createSubstrateStore,
} from './application/substrate';
export { validateAndRepairSubstrate } from './application/substrateValidation';
export { computeTransition } from './application/transition';
export type { UpskillSkill, TransitionDelta, Proficiency } from './domain/types';
