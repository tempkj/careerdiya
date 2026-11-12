/**
 * Access toggles for Career Diya and CareerAsana.
 *
 * Both default to the production behaviour (login and premium access required).
 * Set them to "false" to open features up for a demo or beta without changing any
 * feature logic: the same code paths run, the gates simply let everyone through.
 *
 *   CAREERDIYA_REQUIRE_LOGIN=false
 *     Visitors who are not signed in get an anonymous Supabase session automatically,
 *     so every signed-in feature (results, profile, dashboard, vault, CareerAsana)
 *     works unchanged and Row Level Security still scopes data to that visitor.
 *     Requires "Anonymous sign-ins" to be enabled in Supabase Auth settings; if it is
 *     not, the site falls back to the normal sign-in flow.
 *
 *   CAREERDIYA_REQUIRE_PREMIUM=false
 *     Skips the CareerAsana entitlement check. The older
 *     CAREERASANA_ACCESS_MODE=preview setting still works and means the same thing.
 */
export function isLoginRequired(env: Record<string, string | undefined> = process.env): boolean {
  return env.CAREERDIYA_REQUIRE_LOGIN !== 'false';
}

export function isPremiumRequired(env: Record<string, string | undefined> = process.env): boolean {
  if (env.CAREERDIYA_REQUIRE_PREMIUM === 'false') return false;
  if (env.CAREERASANA_ACCESS_MODE === 'preview') return false;
  return true;
}
