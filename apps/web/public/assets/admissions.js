/* Career Diya pre-application capture.
 * This module intentionally stops at Career Diya's own pre-application boundary.
 * No Edumilestones/partner API or application submission is performed here.
 */
(function () {
  const cfg = window.CAREER_DIYA_SUPABASE || {};
  

  function assertConfig() {
    if (!cfg.url || !cfg.anonKey || String(cfg.anonKey).includes('REPLACE')) {
      throw new Error('Supabase application capture is not configured.');
    }
  }

  function makePreApplicationId() {
    const year = new Date().getFullYear();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    if (window.crypto && crypto.getRandomValues) {
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
    } else {
      for (let i = 0; i < 6; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `CD-PA-${year}-${suffix}`;
  }

  function getSessionUserId() {
    try {
      const session = window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.getSession
        ? window.CareerDiyaProfileAuth.getSession()
        : JSON.parse(localStorage.getItem('careerdiya_auth_session') || 'null');
      const id = session && session.user && session.user.id;
      return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
    } catch (_) {
      return null;
    }
  }

  async function submit(payload) {
    assertConfig();
    if (!payload || !payload.name || !payload.email || !payload.phone) {
      throw new Error('Please complete the required applicant details.');
    }
    if (!payload.college_name || !payload.programme_name) {
      throw new Error('The selected college and programme are required.');
    }

    const preApplicationId = payload.pre_application_id || makePreApplicationId();
    const body = {
      pre_application_id: preApplicationId,
      shared_user_id: payload.shared_user_id || getSessionUserId(),
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      location: payload.location || null,
      audience: payload.audience || null,
      education_level: payload.education_level || null,
      qualification: payload.qualification || null,
      completion_year: payload.completion_year || null,
      college_id: payload.college_id || null,
      college_name: payload.college_name,
      programme_id: payload.programme_id || null,
      programme_name: payload.programme_name,
      specialization: payload.specialization || null,
      source: 'careerdiya',
      status: 'pre_application',
      raw: payload.raw || {}
    };

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Career Diya application capture is unavailable. Please refresh and try again.');
    }
    if (!window.__CAREER_DIYA_ADMISSIONS_CLIENT) {
      window.__CAREER_DIYA_ADMISSIONS_CLIENT = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
    const { error } = await window.__CAREER_DIYA_ADMISSIONS_CLIENT
      .schema('core')
      .from('career_diya_pre_application')
      .insert(body);

    if (error) {
      if (error.code === '23505') {
        const retryBody = { ...body, pre_application_id: makePreApplicationId() };
        const { error: retryError } = await window.__CAREER_DIYA_ADMISSIONS_CLIENT
          .schema('core')
          .from('career_diya_pre_application')
          .insert(retryBody);
        if (retryError) throw new Error(`Application request failed: ${retryError.message}`);
        return retryBody.pre_application_id;
      }
      throw new Error(`Application request failed: ${error.message}`);
    }

    return preApplicationId;
  }

  window.CareerDiyaAdmissions = { submit, makePreApplicationId };
})();
