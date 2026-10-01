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

  function coreTable(name) {
    return getSupabaseClient().schema('core').from(name);
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
    const { data: existing, error: existingError } = await coreTable('profile')
      .select('*').eq('user_id', user.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return existing;
    const payload = {
      user_id: user.id,
      display_name: values.display_name ?? meta.display_name ?? meta.full_name ?? meta.name ?? '',
      avatar_url: values.avatar_url ?? meta.avatar_url ?? meta.picture ?? null,
      audience: values.audience ?? meta.audience ?? 'professional',
      updated_at: new Date().toISOString()
    };
    const { data, error } = await coreTable('profile').upsert(payload, { onConflict: 'user_id' }).select().single();
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
    const { data, error } = await coreTable('profile')
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

  async function saveExplorationDefaults({ audience, answers = {}, currentRole = null } = {}) {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user) throw new Error('You need to be signed in to save exploration defaults.');
    const allowed = new Set(['parent','student','professional']);
    const safeAudience = allowed.has(String(audience || '').toLowerCase()) ? String(audience).toLowerCase() : null;
    if (!safeAudience) throw new Error('Invalid exploration audience.');

    const existing = await coreTable('profile').select('*').eq('user_id', user.id).maybeSingle();
    if (existing.error) throw existing.error;
    const existingProfile = existing.data || {};

    // The first completed free exploration establishes the reusable baseline.
    // Later feature-specific changes are local overrides and never replace this baseline.
    if (existingProfile.exploration_default_context && Object.keys(existingProfile.exploration_default_context).length) {
      return existingProfile;
    }

    const goalMap = {
      choice: 'Choose my first career direction',
      learning: 'Build specialist expertise',
      growth: 'Grow in my current career',
      switch: 'Switch careers',
      stuck: 'Choose my first career direction'
    };
    const learningMap = {
      project: 'Hands-on projects',
      structured: 'Instructor-led',
      mentor: 'Mentor support',
      self: 'Self-paced'
    };
    const payload = {
      audience: safeAudience,
      answers: { ...answers },
      current_role: currentRole || null,
      saved_at: new Date().toISOString(),
      source: 'first_free_exploration'
    };

    const profilePatch = {
      user_id: user.id,
      audience: safeAudience,
      exploration_default_context: payload,
      updated_at: new Date().toISOString()
    };

    if (safeAudience === 'professional' && currentRole) {
      profilePatch.current_role_title = currentRole;
      profilePatch.current_role_other = null;
    }
    if (answers.intent && goalMap[answers.intent] && !existingProfile.career_goals) {
      profilePatch.career_goals = goalMap[answers.intent];
    }
    if (answers.work && !existingProfile.exploration_work_preference) {
      profilePatch.exploration_work_preference = answers.work;
    }
    if (answers.environment && !existingProfile.exploration_environment) {
      profilePatch.exploration_environment = answers.environment;
    }
    if (answers.priority && !existingProfile.exploration_priority) {
      profilePatch.exploration_priority = answers.priority;
    }
    if (answers.learning && !existingProfile.learning_preferences) {
      profilePatch.learning_preferences = learningMap[answers.learning] || answers.learning;
    }
    if (safeAudience === 'professional' && answers.stage && !existingProfile.experience_years) {
      profilePatch.experience_years = ({early:'Less than 1 year',mid:'3–5 years',senior:'11–15 years'})[answers.stage] || null;
    }
    if (safeAudience === 'student' && answers.stage === 'late_school' && !existingProfile.education_level) {
      profilePatch.education_level = 'School';
    }
    if (safeAudience === 'student' && answers.stage === 'college' && !existingProfile.education_level) {
      profilePatch.education_level = 'Undergraduate';
    }

    const { data, error } = await coreTable('profile')
      .upsert(profilePatch, { onConflict: 'user_id' })
      .select().single();
    if (error) throw error;
    try { localStorage.setItem('careerdiya_exploration_defaults', JSON.stringify(payload)); } catch (_) {}
    return data;
  }
  async function getExplorationDefaults() {
    if (!isAuthenticated()) return null;
    const profile = await getProfile();
    const value = profile && profile.exploration_default_context;
    return value && typeof value === 'object' ? value : null;
  }

  async function getProfile() {
    if (!isAuthenticated()) return null;
    const client = getSupabaseClient();
    const { data, error } = await coreTable('profile').select('*').maybeSingle();
    if (error) throw error;
    if (data) return data;
    return await ensureProfile({});
  }

  // ADR-CAREERDIY-0015: isOther distinguishes a bounded dropdown pick from free-typed
  // "Other" text — current_role_title/current_role_other are kept mutually exclusive so
  // a later switch between the two doesn't leave a stale value in the other column.
  //
  // Fix B (state-contamination): `audience` is a required backstop, not an optional
  // hint. Only a professional exploration ever legitimately has a current role to
  // persist — a parent/student render must never write current_role_title/other, even
  // if some future caller passed a non-null role for one (e.g. via a re-introduced
  // fallback). This guard runs BEFORE touching the Supabase client at all, so a
  // misdirected call for a non-professional audience is a clean no-op, not a partial
  // write or a thrown error that a caller's .catch() would just swallow.
  async function setCurrentRole(currentRole = null, { isOther = false, audience = null } = {}) {
    if (audience !== 'professional') return null;
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user) throw new Error('You need to be signed in to save your current role.');
    const value = currentRole && String(currentRole).trim() ? String(currentRole).trim() : null;
    const { data, error } = await coreTable('profile')
      .upsert({
        user_id: user.id,
        current_role_title: isOther ? null : value,
        current_role_other: isOther ? value : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select().single();
    if (error) throw error;
    try {
      const local = JSON.parse(localStorage.getItem('careerdiya_profile_details') || 'null') || {};
      local.current_role_title = isOther ? null : value;
      local.current_role_other = isOther ? value : null;
      localStorage.setItem('careerdiya_profile_details', JSON.stringify(local));
    } catch (_) {}
    return data;
  }

  async function saveProfile(values) {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user) throw new Error('You need to be signed in to save your profile.');
    const meta = user.user_metadata || {};
    const { data: existing, error: existingError } = await coreTable('profile')
      .select('audience').eq('user_id', user.id).maybeSingle();
    if (existingError) throw existingError;
    const audience = String(values.audience || existing?.audience || meta.audience || 'professional').toLowerCase();
    // Fix (state-contamination, second write path): profile.html's "Current Role" field
    // is shown and editable regardless of account audience — this was never touched by
    // the earlier setCurrentRole() gate (renderResults.js), because it's a completely
    // separate save path. Same principle applied here: current_role_title/current_role_other
    // persist only for a professional account. A student/parent submitting the form still
    // saves every OTHER field normally; only these two are dropped.
    const isProfessional = audience === 'professional';
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
      current_role_title: isProfessional ? (values.current_role_title || values.current_role || null) : null,
      current_role_other: isProfessional ? (values.current_role_other || null) : null,
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
      exploration_work_preference: values.exploration_work_preference || null,
      exploration_environment: values.exploration_environment || null,
      exploration_priority: values.exploration_priority || null,
      audience,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await coreTable('profile').upsert(payload, { onConflict: 'user_id' }).select().single();
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
    const { data, error } = await coreTable('career_diya_profile_education')
      .select('*').order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function getExperienceRecords() {
    if (!isAuthenticated()) return [];
    const client = getSupabaseClient();
    const { data, error } = await coreTable('career_diya_profile_experience')
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

    const { error: educationDeleteError } = await coreTable('career_diya_profile_education').delete().eq('profile_id', user.id);
    if (educationDeleteError) throw educationDeleteError;
    if (cleanEducation.length) {
      const { error } = await coreTable('career_diya_profile_education').insert(cleanEducation);
      if (error) throw error;
    }

    const { error: experienceDeleteError } = await coreTable('career_diya_profile_experience').delete().eq('profile_id', user.id);
    if (experienceDeleteError) throw experienceDeleteError;
    if (cleanExperience.length) {
      const { error } = await coreTable('career_diya_profile_experience').insert(cleanExperience);
      if (error) throw error;
    }

    return { education: cleanEducation, experience: cleanExperience };
  }

  async function saveExploration({ audience, answers, result }) {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData && sessionData.session;
    if (!session || !session.user) throw new Error('You need to be signed in to save this exploration.');
    const payload = {
      user_id: session.user.id,
      audience,
      answers,
      result,
      // engine_version is the NOT NULL version-stamp column on core.career_diya_exploration.
      // recommendation_matrix_version (nullable) was a drifted second name for the same
      // FREE_ENGINE_CONFIG.version concept and is no longer written — engine_version is
      // now the single source of truth for read and write.
      engine_version: result && result.recommendationMatrixVersion ? result.recommendationMatrixVersion : null,
      completed_at: new Date().toISOString()
    };
    const { data, error } = await coreTable('career_diya_exploration').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function getSavedExploration() {
    if (!isAuthenticated()) return null;
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData && sessionData.session;
    if (!session || !session.user) return null;
    const { data, error } = await coreTable('career_diya_exploration')
      .select('id,user_id,audience,answers,result,engine_version,completed_at')
      .eq('user_id', session.user.id)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  // Fix B (state-contamination) — pure, directly testable, exported below for tests.
  // Trusts ONLY the argument the calling page passed; no fallback to any shared storage.
  function resolveHandoffCurrentRole(currentRole) {
    return (currentRole || '').trim() || null;
  }

  async function openCareerAsana({ desiredRole, currentRole = null, careerId = null } = {}) {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data && data.session;
    // Fix B (state-contamination): no global-localStorage-key fallback. The CareerAsana
    // handoff must never carry a currentRole the calling page's own exploration didn't
    // produce — callers pass profile.current_role_title (now write-gated to professional
    // explorations only, see setCurrentRole) or nothing at all; this function trusts only
    // that argument.
    const effectiveCurrentRole = resolveHandoffCurrentRole(currentRole);
    const next = `/activate?source=careerdiya&desiredRole=${encodeURIComponent(desiredRole || '')}&currentRole=${encodeURIComponent(effectiveCurrentRole || '')}&careerId=${encodeURIComponent(careerId || '')}`;

    if (!session || !session.access_token || !session.refresh_token) {
      // There is no authenticated Career Diya session to hand off. Preserve the
      // exact transition so an existing CareerAsana account can sign in and continue.
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }

    const hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      next
    });
    window.location.href = `/auth/handoff#${hash.toString()}`;
  }


  async function saveVaultItem(values = {}) {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user) throw new Error('You need to be signed in to save a Vault item.');
    const payload = {
      user_id: user.id,
      raw_text: String(values.raw_text || '').trim(),
      item_type: values.item_type || 'other',
      career_relationship: values.career_relationship || 'undecided',
      status: values.status || 'active',
      priority: values.priority || 'normal',
      context_note: values.context_note || null,
      linked_career_id: values.linked_career_id || null,
      linked_direction_id: values.linked_direction_id || null,
      updated_at: new Date().toISOString()
    };
    if (!payload.raw_text) throw new Error('Please enter something to remember.');
    const { data, error } = await coreTable('career_diya_vault_item').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function getVaultItems() {
    if (!isAuthenticated()) return [];
    const { data, error } = await coreTable('career_diya_vault_item')
      .select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function updateVaultItem(id, values = {}) {
    if (!isAuthenticated()) throw new Error('You need to be signed in to update your Vault.');
    if (!id) throw new Error('Vault item id is required.');
    const allowed = {};
    ['raw_text','item_type','career_relationship','status','priority','context_note','linked_career_id','linked_direction_id'].forEach(k => {
      if (Object.prototype.hasOwnProperty.call(values, k)) {
        if (k === 'raw_text') {
          const value = String(values[k] || '').trim();
          if (!value) throw new Error('Vault thought cannot be empty.');
          allowed[k] = value;
        } else {
          allowed[k] = values[k];
        }
      }
    });
    allowed.updated_at = new Date().toISOString();
    const { data, error } = await coreTable('career_diya_vault_item')
      .update(allowed).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function deleteVaultItem(id) {
    if (!isAuthenticated()) throw new Error('You need to be signed in to delete your Vault.');
    if (!id) throw new Error('Vault item id is required.');
    const { error } = await coreTable('career_diya_vault_item')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  async function getCareerDirections() {
    if (!isAuthenticated()) return [];
    const { data, error } = await coreTable('career_diya_direction')
      .select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function upsertCareerDirection({ careerId, careerName, status = 'considering', reason = null, source = 'careerdiya' } = {}) {
    const client = getSupabaseClient();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user) throw new Error('You need to be signed in to save a Career Direction.');
    if (!careerId || !careerName) throw new Error('A canonical career is required.');
    const { data: existing, error: existingError } = await coreTable('career_diya_direction')
      .select('*').eq('user_id', user.id).eq('career_id', careerId)
      .in('status', ['considering','exploring','active','paused']).limit(1).maybeSingle();
    if (existingError) throw existingError;
    const payload = { user_id:user.id, career_id:careerId, career_name_snapshot:careerName, status, reason, source, updated_at:new Date().toISOString() };
    if (existing) {
      const { data, error } = await coreTable('career_diya_direction').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await coreTable('career_diya_direction').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function signOut() {
    try { await getSupabaseClient().auth.signOut(); }
    finally {
      localStorage.removeItem('careerdiya_auth_session');
      localStorage.removeItem('careerdiya_post_auth_return');
    }
  }

  window.CareerDiyaProfileAuth = { saveVaultItem, getVaultItems, updateVaultItem, deleteVaultItem, getCareerDirections, upsertCareerDirection, openCareerAsana, setCurrentRole, resolveHandoffCurrentRole, signUp, signIn, signInWithProvider, handleOAuthReturn, refreshLocalSession, ensureProfile, getProfile, saveExplorationDefaults, getExplorationDefaults, saveProfile, getEducationRecords, getExperienceRecords, saveBackground, saveExploration, getSavedExploration, setAudience, signOut, getSession, isAuthenticated };
})();
