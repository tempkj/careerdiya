/* Fix B (state-contamination) regression tests.
 * Load assets/supabase-config.js (or any stub that sets a valid window.CAREER_DIYA_SUPABASE
 * before profile-auth.js runs — real pages already do this via their own script order),
 * then profile-auth.js, then decision-engine.js, then run this file. It is async
 * (setCurrentRole talks to the Supabase client), so it writes its result to
 * window.CAREER_DIYA_STATE_LEAK_FIX_TESTS once the returned promise settles — check that,
 * not a synchronous return value. This file installs its own window.supabase.createClient
 * mock (safe to do after profile-auth.js has already loaded — that lookup happens lazily,
 * unlike CAREER_DIYA_SUPABASE which profile-auth.js captures once at load time).
 *
 * Covers: the global 'careerdiya_current_role' localStorage key is gone (no reader, no
 * writer, anywhere); setCurrentRole refuses to persist a role for any non-professional
 * audience, before ever touching the Supabase client; the CareerAsana handoff never
 * sources a role from anywhere but its own argument; a normal professional GROW
 * exploration still threads its own role correctly (no regression); saveProfile
 * (profile.html's separate "Current Role" field) also refuses to write current_role_title/
 * current_role_other for a non-professional account, without dropping the rest of the save.
 *
 * The read-side fix (career.html's CareerAsana handoff buttons) is NOT covered here — see
 * career.state-leak-fix.test.js, which needs a different (Node/vm-based) harness because
 * career.html's inline script has auto-running logic this simpler harness doesn't stub.
 */
(async function () {
  const failures = [];
  const assert = (name, condition, details) => {
    if (!condition) failures.push({ name, details });
    console.log((condition ? '✅ ' : '❌ ') + name, details || '');
  };

  // ── Fake Supabase client — enough of the chain setCurrentRole actually calls ────────
  let createClientCalls = 0;
  const recordedUpserts = [];
  function makeFakeSupabaseClient() {
    const chain = {
      upsert(payload) { recordedUpserts.push(payload); return chain; },
      select() { return chain; },
      single() { return Promise.resolve({ data: recordedUpserts[recordedUpserts.length - 1], error: null }); },
    };
    const schemaObj = { from() { return chain; } };
    return {
      auth: { getSession() { return Promise.resolve({ data: { session: { user: { id: 'test-user' } } }, error: null }); } },
      schema() { return schemaObj; },
    };
  }
  // window.supabase is read lazily by getSupabaseClient() on each call until it caches a
  // client, so installing the mock here (after profile-auth.js has already loaded) still
  // takes effect. window.CAREER_DIYA_SUPABASE is NOT — profile-auth.js captures it once
  // at load time — so it must already be valid before profile-auth.js runs (see header).
  window.supabase = { createClient() { createClientCalls++; return makeFakeSupabaseClient(); } };

  const auth = window.CareerDiyaProfileAuth;

  // ── 1. Student flow: setCurrentRole is never called with effect; DB is never written ──

  {
    const before = recordedUpserts.length;
    const result = await auth.setCurrentRole('Software Engineer', { audience: 'student' });
    assert('student: setCurrentRole no-ops (resolves to null)', result === null);
    assert('student: setCurrentRole never reaches the Supabase client at all (audience gate runs first)', createClientCalls === 0);
    assert('student: no upsert was recorded', recordedUpserts.length === before);
  }

  {
    const before = recordedUpserts.length;
    const result = await auth.setCurrentRole('Chief Priest', { audience: 'parent' });
    assert('parent: setCurrentRole also no-ops', result === null);
    assert('parent: no upsert was recorded', recordedUpserts.length === before);
  }

  // ── 2 & 5. Professional with a captured role: writes exactly that role (regression) ──

  {
    const result = await auth.setCurrentRole('Software Developer', { audience: 'professional', isOther: false });
    assert('professional: setCurrentRole DOES reach the Supabase client', createClientCalls > 0);
    const last = recordedUpserts[recordedUpserts.length - 1];
    assert('professional: writes exactly the role passed, in current_role_title (not current_role_other)',
      last.current_role_title === 'Software Developer' && last.current_role_other === null, last);
  }

  // ── 2 continued: a subsequent student exploration in the same browser does not carry ──
  // the professional role into its own result computation.

  {
    // Simulate the leak scenario directly: even if the global key somehow still held a
    // stale value (e.g. a leftover from before this fix, or a concurrent tab), the
    // student's own currentRole argument is null, and resolveEffectiveCurrentRole trusts
    // ONLY that argument — there is no code path left that would read the stale value.
    localStorage.setItem('careerdiya_current_role', 'Software Engineer'); // simulated leftover/concurrent-tab state
    const effective = resolveEffectiveCurrentRole(null);
    assert('student render: resolveEffectiveCurrentRole ignores a stale global key entirely, even when one is present',
      effective === null, effective);
  }

  // ── 3. CareerAsana handoff for a non-professional exploration: no currentRole from the global key ──

  {
    // Same simulated leftover as above still in localStorage.
    const handoffRole = auth.resolveHandoffCurrentRole(null);
    assert('CareerAsana handoff: resolveHandoffCurrentRole ignores the stale global key, resolves to null',
      handoffRole === null, handoffRole);
  }

  // ── 4. Regression: a normal professional GROW exploration still threads its own role ──

  {
    const effective = resolveEffectiveCurrentRole('Senior Software Engineer');
    assert('professional render: resolveEffectiveCurrentRole still returns the argument when it is set',
      effective === 'Senior Software Engineer');
    const handoffRole = auth.resolveHandoffCurrentRole('Senior Software Engineer');
    assert('CareerAsana handoff: resolveHandoffCurrentRole still passes through a real, caller-supplied role',
      handoffRole === 'Senior Software Engineer');
  }

  localStorage.removeItem('careerdiya_current_role'); // clean up the simulated leftover

  // ── Round 2: saveProfile (profile.html) — the second, separate write path ───────────
  // Found after the first fix shipped: profile.html's "Current Role" field is shown and
  // editable regardless of account audience, and saveProfile() wrote it unconditionally —
  // a completely separate code path from setCurrentRole/renderResults, untouched by the
  // first round of this fix. Same principle, applied here too.

  {
    const before = recordedUpserts.length;
    const result = await auth.saveProfile({ display_name: 'Test Student', audience: 'student', current_role_title: 'Software Engineer' });
    assert('saveProfile: a student account still saves successfully (only current_role_* is dropped, not the whole save)',
      result && result.display_name === 'Test Student');
    assert('saveProfile: student account never gets current_role_title written, even when submitted',
      recordedUpserts[recordedUpserts.length - 1].current_role_title === null &&
      recordedUpserts[recordedUpserts.length - 1].current_role_other === null,
      recordedUpserts[recordedUpserts.length - 1]);
    assert('saveProfile: an upsert did happen (for the other fields) — this is a field-level drop, not a silent no-op of the whole call',
      recordedUpserts.length === before + 1);
  }

  {
    const result = await auth.saveProfile({ display_name: 'Test Pro', audience: 'professional', current_role_title: 'Software Developer' });
    assert('saveProfile: a professional account writes current_role_title exactly as submitted (regression)',
      result && result.current_role_title === 'Software Developer');
  }

  const passed = failures.length === 0;
  console.log(passed ? 'FIX-B-STATE-LEAK: ALL PASS' : 'FIX-B-STATE-LEAK: FAILURES', failures);
  window.CAREER_DIYA_STATE_LEAK_FIX_TESTS = { passed, failures };
  return passed;
})();
