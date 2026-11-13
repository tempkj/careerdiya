import { describe, expect, it } from 'vitest';
import { isLoginRequired, isPremiumRequired } from './access-mode';

describe('access toggles', () => {
  it('require login and premium by default', () => {
    expect(isLoginRequired({})).toBe(true);
    expect(isPremiumRequired({})).toBe(true);
  });

  it('only "false" turns the login requirement off', () => {
    expect(isLoginRequired({ CAREERDIYA_REQUIRE_LOGIN: 'false' })).toBe(false);
    expect(isLoginRequired({ CAREERDIYA_REQUIRE_LOGIN: 'true' })).toBe(true);
    expect(isLoginRequired({ CAREERDIYA_REQUIRE_LOGIN: 'no' })).toBe(true);
  });

  it('premium is off with the new toggle or the legacy preview mode', () => {
    expect(isPremiumRequired({ CAREERDIYA_REQUIRE_PREMIUM: 'false' })).toBe(false);
    expect(isPremiumRequired({ CAREERASANA_ACCESS_MODE: 'preview' })).toBe(false);
    expect(isPremiumRequired({ CAREERASANA_ACCESS_MODE: 'paid' })).toBe(true);
  });
});
