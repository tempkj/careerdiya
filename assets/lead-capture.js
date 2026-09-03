(function(){
  const config = window.CAREER_DIYA_SUPABASE || {};

  function validatePayload(payload){
    const required = ['source','segment','interest','interest_kind'];
    for(const key of required){
      if(!payload || typeof payload[key] !== 'string' || !payload[key].trim()) {
        throw new Error(`Lead field \"${key}\" is required.`);
      }
    }
    if(!['careerdiya','skilldiya'].includes(payload.source)) throw new Error('Invalid lead source.');
    if(!['course','direction','general'].includes(payload.interest_kind)) throw new Error('Invalid lead interest_kind.');
  }

  async function submitLead(payload){
    validatePayload(payload);
    if(!config.url || !config.anonKey || config.url.includes('YOUR-PROJECT')) {
      throw new Error('Supabase lead capture is not configured. Add supabase-config.js.');
    }
    const endpoint = `${config.url.replace(/\/$/,'')}/rest/v1/leads`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if(!res.ok){
      let detail='';
      try { detail = await res.text(); } catch(_) {}
      throw new Error(`Lead submit failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }
    return true;
  }

  window.CareerDiyaLeadCapture = { submitLead };
})();
