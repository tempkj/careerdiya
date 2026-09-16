(function(){
  const config = window.CAREER_DIYA_SUPABASE || {};

  function validatePayload(payload){
    const required = ['source','segment','interest','interest_kind'];
    for(const key of required){
      if(!payload || typeof payload[key] !== 'string' || !payload[key].trim()) {
        throw new Error(`Lead field "${key}" is required.`);
      }
    }
    if(!['careerdiya','skilldiya'].includes(payload.source)) throw new Error('Invalid lead source.');
    if(!['course','direction','general'].includes(payload.interest_kind)) throw new Error('Invalid lead interest_kind.');
  }

  function getClient(){
    if(!config.url || !config.anonKey) throw new Error('Supabase lead capture is not configured.');
    if(!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Career Diya lead capture is unavailable. Please refresh and try again.');
    }
    if(!window.__CAREER_DIYA_LEAD_CLIENT){
      window.__CAREER_DIYA_LEAD_CLIENT = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
    return window.__CAREER_DIYA_LEAD_CLIENT;
  }

  async function submitLead(payload){
    validatePayload(payload);
    const { error } = await getClient().schema('core').from('career_diya_lead').insert(payload);
    if(error) throw new Error(`Lead submit failed: ${error.message}`);
    return true;
  }

  window.CareerDiyaLeadCapture = { submitLead };
})();
