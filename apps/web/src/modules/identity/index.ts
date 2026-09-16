// Public surface of the 'identity' module. Other modules import ONLY from here (invariant A1).
export type {
  UserProfile,
  ProfileUpdate,
  ConsentPurpose,
  ConsentRecord,
  ConsentStateResult,
  Me,
  OnboardingState,
} from './domain/types';

export { getMe } from './application/me';
export { getProfile, updateProfile, PreconditionError } from './application/profile';
export { getConsent, setConsent, hasConsent } from './application/consent';

export { hasCareerAsanaAccess, CAREERASANA_PRODUCT } from './application/access';
