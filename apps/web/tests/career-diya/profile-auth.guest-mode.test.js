/* Login-toggle (guest mode) regression tests for profile-auth.js.
 * Run with: node apps/web/tests/career-diya/profile-auth.guest-mode.test.js
 *
 * Covers: with requireLogin true (the default) nothing changes — no anonymous sign-in, no
 * reload; with requireLogin false a visitor without a session gets one anonymous session,
 * the page reloads once, and isAuthenticated()/isGuestSession() report it; a failed
 * anonymous sign-in (feature disabled in Supabase) does not reload or loop; and
 * refreshLocalSession() falls back to a guest session for pages that check it async.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const failures = [];
const assert = (name, condition, details) => {
  if (!condition) failures.push({ name, details });
  console.log((condition ? '✅ ' : '❌ ') + name, details === undefined ? '' : JSON.stringify(details));
};

function storage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function setup({ requireLogin, anonError = null, existingSession = null }) {
  const calls = { anon: 0, reload: 0 };
  const guestSession = {
    access_token: 'guest-access',
    refresh_token: 'guest-refresh',
    user: { id: 'guest-1', is_anonymous: true },
  };
  let current = existingSession;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: current }, error: null }),
      setSession: async () => ({ data: { session: null }, error: null }),
      signInAnonymously: async () => {
        calls.anon += 1;
        if (anonError) return { data: { session: null }, error: new Error(anonError) };
        current = guestSession;
        return { data: { session: guestSession }, error: null };
      },
    },
  };
  const window = {
    CAREER_DIYA_SUPABASE: {
      url: 'https://example.supabase.co',
      anonKey: 'sb_publishable_test',
      ...(requireLogin === undefined ? {} : { requireLogin }),
    },
    supabase: { createClient: () => client },
    location: { reload: () => { calls.reload += 1; }, origin: 'https://www.careerdiya.com', search: '', pathname: '/' },
  };
  const sandbox = {
    window,
    localStorage: storage(),
    sessionStorage: storage(),
    console: { warn: () => {}, error: () => {}, log: () => {} },
    URLSearchParams,
  };
  if (existingSession) sandbox.localStorage.setItem('careerdiya_auth_session', JSON.stringify(existingSession));
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'assets', 'profile-auth.js'), 'utf8');
  vm.runInContext(src, vm.createContext(sandbox), { filename: 'profile-auth.js' });
  return { auth: window.CareerDiyaProfileAuth, calls, sandbox };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

(async () => {
  {
    const { auth, calls } = setup({ requireLogin: undefined });
    await settle();
    assert('default config (no requireLogin key): login required', auth.isLoginRequired() === true);
    assert('default config: no anonymous sign-in, no reload', calls.anon === 0 && calls.reload === 0, calls);
    assert('default config: visitor is not authenticated', auth.isAuthenticated() === false);
  }
  {
    const { auth, calls } = setup({ requireLogin: true });
    await settle();
    const session = await auth.refreshLocalSession();
    assert('requireLogin true: refreshLocalSession returns null without a session', session === null);
    assert('requireLogin true: never signs in anonymously', calls.anon === 0, calls);
  }
  {
    const { auth, calls } = setup({ requireLogin: false });
    await settle();
    assert('guest mode: one anonymous sign-in on first load', calls.anon === 1, calls);
    assert('guest mode: page reloads once so sync checks see the session', calls.reload === 1, calls);
    assert('guest mode: visitor is now authenticated', auth.isAuthenticated() === true);
    assert('guest mode: session is flagged as a guest session', auth.isGuestSession() === true);
  }
  {
    const signedIn = { access_token: 'user-access', refresh_token: 'user-refresh', user: { id: 'u1', is_anonymous: false } };
    const { auth, calls } = setup({ requireLogin: false, existingSession: signedIn });
    await settle();
    assert('guest mode with a real account: no anonymous sign-in, no reload', calls.anon === 0 && calls.reload === 0, calls);
    assert('guest mode with a real account: not a guest session', auth.isGuestSession() === false);
  }
  {
    const { auth, calls, sandbox } = setup({ requireLogin: false, anonError: 'Anonymous sign-ins are disabled' });
    await settle();
    assert('anonymous sign-in disabled: no reload', calls.reload === 0, calls);
    assert('anonymous sign-in disabled: attempt recorded to prevent a reload loop',
      sandbox.sessionStorage.getItem('careerdiya_guest_attempted') === '1');
    const session = await auth.refreshLocalSession();
    assert('anonymous sign-in disabled: refreshLocalSession falls back to null (normal sign-in flow)', session === null);
  }
  {
    const { auth, calls, sandbox } = setup({ requireLogin: false });
    sandbox.sessionStorage.setItem('careerdiya_guest_attempted', '1');
    await settle();
    sandbox.localStorage.removeItem('careerdiya_auth_session');
    const before = calls.anon;
    const session = await auth.refreshLocalSession();
    assert('guest mode: refreshLocalSession returns a guest session for async page checks',
      !!(session && session.user && session.user.is_anonymous), { before, after: calls.anon });
  }

  if (failures.length) {
    console.log(`PROFILE-AUTH-GUEST-MODE: ${failures.length} FAILED`);
    process.exitCode = 1;
  } else {
    console.log('PROFILE-AUTH-GUEST-MODE: ALL PASS');
  }
})();
