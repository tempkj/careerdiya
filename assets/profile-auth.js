/* Career Diya profile/auth + persistence helpers. */
(function () {
  const cfg = window.CAREER_DIYA_SUPABASE || {};
  let supabaseClient = null;

  function assertConfig() {
    if (!cfg.url || !cfg.anonKey || cfg.anonKey.includes('REPLACE')) {
      throw new Error('Supabase profile authentication is not configured.');
    }
  }

  function getSupabaseClient() {
    assertConfig();
    if (supabaseClient) return supabaseClient;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Career Diya authentication is unavailable. Please refresh and try again.');
    }
    supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return supabaseClient;
  }

  function rememberSession(session) {
    if (session) localStorage.setItem('careerdiya_auth_session', JSON.stringify(session));
    return session;
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem('careerdiya_auth_session') || 'null'); }
    catch (_) { localStorage.removeItem('careerdiya_auth_session'); return null; }
  }

  function isAuthenticated() {
    const s = getSession();
    return !!(s && s.access_token);
  }

  async function refreshLocalSession() {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data && data.session) rememberSession(data.session); else localStorage.removeItem('careerdiya_auth_session');
    return data && data.session ? data.session : null;
  }

  async function signUp({ name, email, password, audience }) {
    const client = getSupabaseClient();
    const returnTo = `${window.location.origin}/auth.html?return=explore&confirmed=1`;
    localStorage.setItem('careerdiya_post_auth_return', 'explore');
    const { data, error } = await client.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: returnTo,
        data: { display_name: name, audience: audience || null, product: 'careerdiya' }
      }
    });
    if (error) throw error;
    if (data && data.session) {
      rememberSession(data.session);
      await ensureProfile({ display_name: name, audience });
      return { authenticated: true, confirmed: true, user: data.user || null };
    }
    return { authenticated: false, confirmed: false, user: data && data.user ? data.user : null };
  }

  async function signIn({ email, password }) {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data || !data.session) throw new Error('Sign-in completed without an active session. Please try again.');
    rememberSession(data.session);
    await ensureProfile({});
    return { authenticated: true, confirmed: true, user: data.user || null };
  }

  async function signInWithProvider(provider) {
    const client = getSupabaseClient();
    localStorage.setItem('careerdiya_post_auth_return', new URLSearchParams(window.location.search).get('return') || 'explore');
    const params = new URLSearchParams(window.location.search);
    params.set('oauth', '1');
    const redirectTo = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const options = { redirectTo };
    if (provider === 'azure') options.scopes = 'email';
    const { error } = await client.auth.signInWithOAuth({ provider, options });
    if (error) throw error;
    return { started: true };
  }

  async function handleOAuthReturn() {
    const client = getSupabaseClient();
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';
    const hasAuthReturn = params.has('code') || params.has('oauth') || /access_token|refresh_token|type=signup|type=recovery/i.test(hash);
    if (params.has('code')) {
      try {
        const { data, error } = await client.auth.exchangeCodeForSession(params.get('code'));
        if (error && !String(error.message || '').toLowerCase().includes('already')) throw error;
        if (data && data.session) rememberSession(data.session);
      } catch (_) {}
    }
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data && data.session) rememberSession(data.session);
    if (hasAuthReturn) {
      const clean = new URL(window.location.href);
      ['code','oauth','state','error','error_code','error_description'].forEach(k => clean.searchParams.delete(k));
      clean.hash = '';
      window.history.replaceState({}, document.title, clean.toString());
    }
    return data && data.session ? { authenticated: true, user: data.session.user || null, session: data.session } : null;
  }

  async function ensureProfile(values = {}) {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData && sessionData.session;
    if (!session || !session.user) return null;
    const user = session.user;
    const meta = user.user_metadata || {};
    const payload = {
      user_id: user.id,
      display_name: values.display_name ?? meta.display_name ?? meta.full_name ?? meta.name ?? '',
      avatar_url: values.avatar_url ?? meta.avatar_url ?? meta.picture ?? null,
      audience: values.audience ?? meta.audience ?? null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client.from('career_profiles').upsert(payload, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return data;
  }

  async function setAudience(audience) {
    const allowed = new Set(['parent','student','professional']);
    const value = String(audience || '').toLowerCase();
    if (!allowed.has(value)) throw new Error('Invalid audience.');
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user) return null;
    const { data, error } = await client.from('career_profiles')
      .upsert({ user_id: user.id, audience: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select().single();
    if (error) throw error;
    try {
      const { data: updated } = await client.auth.updateUser({ data: { audience: value } });
      const session = await client.auth.getSession();
      if (session && session.data && session.data.session) {
        const current = session.data.session;
        if (updated && updated.user) current.user = updated.user;
        rememberSession(current);
      }
    } catch (_) {}
    try {
      const local = JSON.parse(localStorage.getItem('careerdiya_profile_details') || 'null') || {};
      local.audience = value;
      localStorage.setItem('careerdiya_profile_details', JSON.stringify(local));
    } catch (_) {}
    return data;
  }

  async function getProfile() {
    if (!isAuthenticated()) return null;
    const client = getSupabaseClient();
    await ensureProfile({});
    const { data, error } = await client.from('career_profiles').select('*').maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function saveProfile(values) {
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user) throw new Error('You need to be signed in to save your profile.');
    const payload = {
      user_id: user.id,
      display_name: values.display_name || '',
      avatar_url: values.avatar_url || null,
      country: values.country || null,
      country_other: values.country_other || null,
      education_level: values.education_level || null,
      institution: values.institution || null,
      field_of_study: values.field_of_study || null,
      graduation_year: values.graduation_year || null,
      current_role_title: values.current_role_title || values.current_role || null,
      current_role_other: values.current_role_other || null,
      industry: values.industry || null,
      industry_other: values.industry_other || null,
      experience_years: values.experience_years || null,
      career_interests: values.career_interests || [],
      career_goals: values.career_goals || null,
      career_interests_other: values.career_interests_other || null,
      career_goals_other: values.career_goals_other || null,
      strengths: values.strengths || null,
      strengths_other: values.strengths_other || null,
      weaknesses: values.weaknesses || null,
      weaknesses_other: values.weaknesses_other || null,
      learning_preferences: values.learning_preferences || null,
      learning_preferences_other: values.learning_preferences_other || null,
      audience: values.audience || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await client.from('career_profiles').upsert(payload, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    try {
      const { data: updated } = await client.auth.updateUser({ data: { display_name: payload.display_name, avatar_url: payload.avatar_url || null } });
      const session = await client.auth.getSession();
      if (session && session.data && session.data.session) {
        const current = session.data.session;
        if (updated && updated.user) current.user = updated.user;
        rememberSession(current);
      }
    } catch (_) {}
    localStorage.setItem('careerdiya_profile_details', JSON.stringify(data));
    return data;
  }


  async function getEducationRecords() {
    if (!isAuthenticated()) return [];
    const client = getSupabaseClient();
    const { data, error } = await client.from('career_profile_education')
      .select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function getExperienceRecords() {
    if (!isAuthenticated()) return [];
    const client = getSupabaseClient();
    const { data, error } = await client.from('career_profile_experience')
      .select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function saveBackground({ education = [], experience = [] } = {}) {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user) throw new Error('You need to be signed in to save your profile.');

    const cleanEducation = education.map((row, index) => ({
      profile_id: user.id,
      education_level: row.education_level || '',
      education_level_other: row.education_level === 'Other' ? (row.education_level_other || null) : null,
      field_of_study: row.field_of_study || '',
      field_of_study_other: row.field_of_study === 'Other' ? (row.field_of_study_other || null) : null,
      institution: row.institution || null,
      graduation_year: row.graduation_year || null,
      is_current: !!row.is_current,
      sort_order: index,
      updated_at: new Date().toISOString()
    })).filter(row => row.education_level && row.field_of_study);

    const cleanExperience = experience.map((row, index) => ({
      profile_id: user.id,
      domain: row.domain || '',
      domain_other: row.domain === 'Other' ? (row.domain_other || null) : null,
      exposure_type: row.exposure_type || '',
      exposure_level: row.exposure_level || '',
      role_family: row.role_family || null,
      role_family_other: row.role_family === 'Other' ? (row.role_family_other || null) : null,
      years_bucket: row.years_bucket || null,
      sort_order: index,
      updated_at: new Date().toISOString()
    })).filter(row => row.domain && row.exposure_type && row.exposure_level);

    const { error: educationDeleteError } = await client.from('career_profile_education').delete().eq('profile_id', user.id);
    if (educationDeleteError) throw educationDeleteError;
    if (cleanEducation.length) {
      const { error } = await client.from('career_profile_education').insert(cleanEducation);
      if (error) throw error;
    }

    const { error: experienceDeleteError } = await client.from('career_profile_experience').delete().eq('profile_id', user.id);
    if (experienceDeleteError) throw experienceDeleteError;
    if (cleanExperience.length) {
      const { error } = await client.from('career_profile_experience').insert(cleanExperience);
      if (error) throw error;
    }

    return { education: cleanEducation, experience: cleanExperience };
  }

  /* Multi-exploration history (career_explorations, id-PK, many-per-user).
   * A completed exploration is immutable: only `pinned` may ever change
   * after insert (enforced by a database trigger, not just by convention).
   * `save_exploration_snapshot` is idempotent by id, so promoting the same
   * anonymous snapshot twice (e.g. a retried promotion) never duplicates it.
   */
  async function saveNewExploration({ id, audience, answers, result, engine_version, completed_at, legacy = false }) {
    if (!id || !audience || !answers || !engine_version) throw new Error('A complete exploration snapshot (id, audience, answers, engine_version) is required to save it.');
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData && sessionData.session;
    if (!session || !session.user) throw new Error('You need to be signed in to save this exploration.');
    const { data, error } = await client.rpc('save_exploration_snapshot', {
      p_id: id,
      p_audience: audience,
      p_answers: answers,
      p_result: result ?? null,
      p_engine_version: engine_version,
      p_completed_at: completed_at || new Date().toISOString(),
      p_legacy: !!legacy
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function listExplorations() {
    if (!isAuthenticated()) return [];
    const client = getSupabaseClient();
    const { data, error } = await client.from('career_explorations').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function getExploration(id) {
    if (!id || !isAuthenticated()) return null;
    const client = getSupabaseClient();
    const { data, error } = await client.from('career_explorations').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function setExplorationPinned(id, pinned) {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('set_exploration_pinned', { p_id: id, p_pinned: !!pinned });
    if (error) throw error;
    return data;
  }

  // Compatibility view over the exploration history for callers that only
  // ever cared about "the latest saved exploration" (dashboard summary,
  // paths.html, Skill Diya context). Not used for exploration-view routing.
  async function getSavedExploration() {
    const list = await listExplorations();
    return list.length ? list[0] : null;
  }

  let promotionInFlight = false;
  const PENDING_EXPLORATION_KEY = 'careerdiya_pending_exploration';

  // Promotes the anonymous pending exploration snapshot (if any) to a real
  // row owned by the now-authenticated user, exactly as captured at
  // completion time — no recomputation. Idempotent (safe to call more than
  // once, including from multiple auth-state notifications): the pending
  // snapshot is only cleared after the database confirms the row exists.
  async function promotePendingExploration() {
    if (promotionInFlight) return { promoted: false, error: 'already_in_progress' };
    const raw = localStorage.getItem(PENDING_EXPLORATION_KEY);
    if (!raw) return { promoted: false, error: null };
    let pending;
    try { pending = JSON.parse(raw); } catch (_) { return { promoted: false, error: 'corrupt_snapshot' }; }
    if (!pending || !pending.exploration_id || !pending.audience || !pending.answers || !pending.engine_version) {
      return { promoted: false, error: 'incomplete_snapshot' };
    }
    if (!isAuthenticated()) return { promoted: false, error: 'not_authenticated' };
    promotionInFlight = true;
    try {
      const saved = await saveNewExploration({
        id: pending.exploration_id,
        audience: pending.audience,
        answers: pending.answers,
        result: pending.result ?? null,
        engine_version: pending.engine_version,
        completed_at: pending.completed_at
      });
      localStorage.removeItem(PENDING_EXPLORATION_KEY);
      return { promoted: true, exploration: saved };
    } catch (err) {
      // Leave the pending snapshot untouched so promotion can be retried later.
      return { promoted: false, error: (err && err.message) || 'promotion_failed' };
    } finally {
      promotionInFlight = false;
    }
  }

  // Wires the real Supabase auth-state lifecycle so promotion happens as
  // soon as a session is actually established (sign-in, sign-up with an
  // immediate session, or an OAuth round trip) rather than only on the one
  // page that happened to call handleOAuthReturn().
  function registerAuthListener() {
    try {
      const client = getSupabaseClient();
      if (client.__careerdiyaAuthListenerRegistered) return;
      client.__careerdiyaAuthListenerRegistered = true;
      client.auth.onAuthStateChange((event, session) => {
        if (session) rememberSession(session); else if (event === 'SIGNED_OUT') localStorage.removeItem('careerdiya_auth_session');
        if (event === 'SIGNED_IN') promotePendingExploration().catch(() => {});
      });
    } catch (_) {
      // Supabase config/library not ready on this page load; nothing to wire yet.
    }
  }

  async function signOut() {
    try { await getSupabaseClient().auth.signOut(); }
    finally {
      localStorage.removeItem('careerdiya_auth_session');
      localStorage.removeItem('careerdiya_post_auth_return');
    }
  }

  window.CareerDiyaProfileAuth = { signUp, signIn, signInWithProvider, handleOAuthReturn, refreshLocalSession, ensureProfile, getProfile, saveProfile, getEducationRecords, getExperienceRecords, saveBackground, saveNewExploration, listExplorations, getExploration, setExplorationPinned, getSavedExploration, promotePendingExploration, setAudience, signOut, getSession, isAuthenticated };

  registerAuthListener();
})();
