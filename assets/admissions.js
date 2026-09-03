/* Career Diya pre-application capture.
 * This module intentionally stops at Career Diya's own pre-application boundary.
 * No Edumilestones/partner API or application submission is performed here.
 */
(function () {
  const cfg = window.CAREER_DIYA_SUPABASE || {};
  const SUPABASE_REST = '/rest/v1/admissions_pre_applications';

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

    const res = await fetch(`${String(cfg.url).replace(/\/$/, '')}${SUPABASE_REST}`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      let detail = '';
      try {
        const json = await res.json();
        detail = json && (json.message || json.hint || json.details || json.code) ? JSON.stringify(json) : '';
      } catch (_) {}
      if (res.status === 409) {
        // One extremely rare generated-ID collision; retry once with a fresh identifier.
        const retryBody = { ...body, pre_application_id: makePreApplicationId() };
        const retryRes = await fetch(`${String(cfg.url).replace(/\/$/, '')}${SUPABASE_REST}`, {
          method: 'POST',
          headers: {
            apikey: cfg.anonKey,
            Authorization: `Bearer ${cfg.anonKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(retryBody)
        });
        if (!retryRes.ok) throw new Error(`Application request failed (${retryRes.status}). ${detail}`.trim());
        return retryBody.pre_application_id;
      }
      throw new Error(`Application request failed (${res.status}). ${detail}`.trim());
    }

    return preApplicationId;
  }

  window.CareerDiyaAdmissions = { submit, makePreApplicationId };
})();
