export type OnboardingState = 'registered' | 'activated';

export type ConsentPurpose = 'processing' | 'ai_personalization' | 'marketing' | 'research';

export interface ConsentRecord {
  purpose: ConsentPurpose;
  state: 'granted' | 'revoked';
  occurredAt: string;
  policyVersion: string;
}

export interface ConsentStateResult {
  purposes: ConsentRecord[];
}

export interface UserProfile {
  userId: string;
  displayName: string | null;
  region: string;
  locale: string;
  onboardingState: OnboardingState;
}

export interface ProfileUpdate {
  displayName?: string;
  region?: string;
  locale?: string;
}

export interface Me {
  userId: string;
  onboardingState: OnboardingState;
  region?: string;
  locale?: string;
}
