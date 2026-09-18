/* engine_version write-fix regression test.
 *
 * Root cause: core.career_diya_exploration.engine_version is NOT NULL (live schema — the
 * tracked migration only knows about the nullable recommendation_matrix_version column,
 * which is drift; see the commit message for the DB inspection). saveExploration's insert
 * payload only ever populated recommendation_matrix_version, so every completed-exploration
 * INSERT failed with 23502 (null value in column "engine_version"). Fix: the insert now
 * writes engine_version (the one NOT NULL column that exists) with the same version-stamp
 * value; the read select uses the same column name.
 *
 * Runs under Node against the REAL shipped profile-auth.js (loaded via vm, like
 * career.state-leak-fix.test.js) with a fake Supabase client that enforces the live
 * NOT NULL constraint itself, so this fails the same way a real insert would if the
 * fix regresses.
 *
 * Run: node apps/web/public/assets/profile-auth.engine-version-fix.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const failures = [];
const assert = (name, condition, details) => {
  if (!condition) failures.push({ name, details });
  console.log((condition ? '✅ ' : '❌ ') + name, details === undefined ? '' : JSON.stringify(details));
};

function loadProfileAuth(sandbox) {
  const src = fs.readFileSync(path.join(__dirname, 'profile-auth.js'), 'utf8');
  const ctx = vm.createContext(sandbox);
  vm.runInContext(src, ctx, { filename: 'profile-auth.js' });
  return ctx.window.CareerDiyaProfileAuth;
}

(async () => {
  const insertedRows = [];
  // Fake Supabase client enforcing the live schema's NOT NULL constraint on engine_version,
  // so a regression to the pre-fix payload reproduces the same 23502-shaped failure here.
  function makeFakeSupabaseClient() {
    const chain = {
      _payload: null,
      insert(payload) {
        chain._payload = payload;
        if (payload.engine_version === null || payload.engine_version === undefined) {
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({
                    data: null,
                    error: { code: '23502', message: 'null value in column "engine_version" violates not-null constraint' },
                  });
                },
              };
            },
          };
        }
        const row = { id: 'exploration-1', completed_at: payload.completed_at, ...payload };
        insertedRows.push(row);
        return {
          select() {
            return { single() { return Promise.resolve({ data: row, error: null }); } };
          },
        };
      },
      select(cols) {
        chain._selectCols = cols;
        return chain;
      },
      eq() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      maybeSingle() {
        const row = insertedRows[insertedRows.length - 1] || null;
        return Promise.resolve({ data: row, error: null });
      },
    };
    const schemaObj = { from() { return chain; } };
    return {
      auth: { getSession() { return Promise.resolve({ data: { session: { user: { id: 'test-user' } } }, error: null }); } },
      schema() { return schemaObj; },
    };
  }

  // getSavedExploration gates on isAuthenticated(), which reads this key — stateful so a
  // seeded session survives across calls (real localStorage semantics, not a stub).
  const localStorageBacking = {};
  const sandbox = {
    window: { CAREER_DIYA_SUPABASE: { url: 'https://example.supabase.co', anonKey: 'anon-key' } },
    localStorage: {
      getItem: (k) => (k in localStorageBacking ? localStorageBacking[k] : null),
      setItem: (k, v) => { localStorageBacking[k] = v; },
      removeItem: (k) => { delete localStorageBacking[k]; },
    },
    console,
  };
  localStorageBacking['careerdiya_auth_session'] = JSON.stringify({ access_token: 'tok', user: { id: 'test-user' } });
  sandbox.window.supabase = { createClient() { return makeFakeSupabaseClient(); } };
  const auth = loadProfileAuth(sandbox);

  // ── The exact reported failure: a completed exploration INSERT must succeed ─────────
  const result = { recommendationMatrixVersion: '1.3-target-role-anchor', currentRole: null, targetRole: 'Software Engineer' };
  const saved = await auth.saveExploration({ audience: 'professional', answers: { q1: 'a' }, result });

  assert('saveExploration: insert succeeds (no 23502)', !!saved && saved.id === 'exploration-1', saved);
  assert('saveExploration: payload writes engine_version, not the drifted recommendation_matrix_version',
    insertedRows[0] && insertedRows[0].engine_version === '1.3-target-role-anchor' && insertedRows[0].recommendation_matrix_version === undefined,
    insertedRows[0]);

  // ── Row is readable back with the version stamp intact ──────────────────────────────
  const persisted = await auth.getSavedExploration();
  assert('getSavedExploration: round-trips the saved row', !!persisted && persisted.audience === 'professional', persisted);
  assert('getSavedExploration: select list reads engine_version (not recommendation_matrix_version)',
    typeof persisted.engine_version === 'string' && persisted.engine_version === '1.3-target-role-anchor', persisted);

  const passed = failures.length === 0;
  console.log(passed ? 'ENGINE-VERSION-WRITE-FIX: ALL PASS' : 'ENGINE-VERSION-WRITE-FIX: FAILURES', failures);
  process.exitCode = passed ? 0 : 1;
})();
