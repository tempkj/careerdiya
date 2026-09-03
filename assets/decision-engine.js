/* Career Diya Free Exploration UI + recommendation orchestration.
 * Recommendation rules live in decision-data.js. Keep this file focused on UI flow.
 *
 * State model:
 *  - No `explorationId` in the URL and no wizard in progress: normal
 *    Profile Workspace entry point (start a NEW exploration).
 *  - A completed exploration's result — whether just-finished or reopened
 *    via `?explorationId=` — is always shown in "Exploration View" mode:
 *    it is scoped, visibly labelled, reversible, and driven entirely by
 *    that exploration's own stored audience/answers/result. Reopening never
 *    recomputes or reinterprets a stored result with the current engine.
 */

const PARENT_QUESTIONS = [
  {id:'stage', title:'What stage is your child in?', subtitle:'This helps us frame age-appropriate directions to explore.', options:[['child_2_7','Classes 2–7'],['child_8_10','Classes 8–10'],['child_11_12','Classes 11–12']]},
  {id:'intent', title:'What are you trying to figure out?', subtitle:'Pick the question closest to what is on your mind about your child.', options:[['choice','What kinds of directions may fit my child?'],['learning','Which subjects, streams or areas should we explore?'],['growth','How can I understand my child’s strengths better?'],['switch','My child is reconsidering the direction they started with'],['stuck','We feel stuck between a few possible paths']]},
  {id:'work', title:'What seems to give your child energy?', subtitle:'Answer based on what you have observed, not what you hope they will choose.', options:[['analytical','Solving problems, numbers or finding patterns'],['builder','Making, building, experimenting or fixing things'],['creative','Drawing, designing, writing or creating'],['people','Helping, teaching, leading or working with people'],['quality','Organising, improving or making things more accurate']]},
  {id:'environment', title:'What kind of learning environment seems to suit your child?', subtitle:'There is no right answer — choose what you have observed.', options:[['structured','Clear structure, routines and measurable progress'],['dynamic','Variety, experimentation and trying new things'],['collaborative','Discussion, teamwork and learning with others'],['independent','Quiet focus, autonomy and learning at their own pace']]},
  {id:'priority', title:'What matters most when choosing a direction?', subtitle:'Choose the outcome you would value most right now.', options:[['stability','Keeping strong future options open'],['growth','Building capability and confidence over time'],['impact','Finding something meaningful and engaging'],['flexibility','Keeping room to explore different possibilities']]},
  {id:'learning', title:'How does your child seem to learn best?', subtitle:'Choose what you have observed most often.', options:[['project','Projects, experiments and hands-on practice'],['structured','Structured lessons and guided instruction'],['mentor','Discussion, coaching and feedback'],['self','Self-paced exploration and trying things independently']]},
  {id:'commitment', title:'How ready are you to take the next step?', subtitle:'This changes the kind of action we recommend.', options:[['explore','Just exploring — we do not want to commit yet'],['validate','We want to validate a few directions first'],['plan','We are ready to make a practical plan'],['act','We are ready to start an assessment or activity']]}
];

const STUDENT_QUESTIONS = [
  {id:'stage', title:'Where are you right now?', subtitle:'This keeps the exploration appropriate for a late-school or college student aged 16+.', options:[['late_school','Class 11–12 / exploring study directions'],['college','In college / building a field'],['recent_grad','Recently graduated / choosing what comes next']]},
  {id:'intent', title:'What are you trying to figure out?', subtitle:'Pick the question closest to what is on your mind.', options:[['choice','I am not sure which field to pursue'],['learning','I am not sure what to study or learn'],['growth','I want to build towards a clear career direction'],['switch','I am reconsidering the direction I started with'],['stuck','I feel stuck between a few options']]},
  {id:'work', title:'What kind of work gives you energy?', subtitle:'Choose the type of problems you would rather spend time on.', options:[['analytical','Analysing, solving and finding patterns'],['builder','Building products, systems or solutions'],['creative','Creating, designing or communicating'],['people','Helping, coaching or influencing people'],['quality','Making things better, safer or more reliable']]},
  {id:'environment', title:'Which environment sounds more like you?', subtitle:'There is no right answer.', options:[['structured','Clear structure, standards and measurable outcomes'],['dynamic','Fast-changing, ambiguous and entrepreneurial'],['collaborative','Cross-functional, discussion-heavy and people-oriented'],['independent','Deep work with ownership and autonomy']]},
  {id:'priority', title:'What matters most in the next few years?', subtitle:'Choose the outcome you would value most.', options:[['stability','Keeping strong options and steady progress'],['growth','Growth, responsibility and earning potential'],['impact','Meaningful impact and visible contribution'],['flexibility','Flexibility and freedom in how I work']]},
  {id:'learning', title:'How do you prefer to learn?', subtitle:'This helps us suggest an action route.', options:[['project','Projects and hands-on practice'],['structured','Structured courses and guided instruction'],['mentor','Mentor-led discussion and feedback'],['self','Self-paced exploration and experimentation']]},
  {id:'commitment', title:'How ready are you to take action?', subtitle:'This changes the kind of next step we recommend.', options:[['explore','Just exploring — I do not want to commit yet'],['validate','I want to validate my direction first'],['plan','I am ready to make a 90-day plan'],['act','I am ready to start learning / acting']]}
];

const PROFESSIONAL_QUESTIONS = [
  {id:'stage', title:'Where are you right now?', subtitle:'This helps us frame the recommendation.', options:[['early','Early career (0–3 years)'],['mid','Mid career (3–9 years)'],['senior','Senior / established career (10+ years)']]},
  {id:'intent', title:'What are you trying to figure out?', subtitle:'Pick the question closest to what is on your mind.', options:[['choice','I am not sure which career to choose'],['switch','I am thinking about a career switch'],['growth','I want to grow where I am'],['learning','I am not sure which course or skill to invest in'],['stuck','I feel stuck and need a new direction']]},
  {id:'work', title:'What kind of work gives you energy?', subtitle:'Choose the type of problems you would rather spend time on.', options:[['analytical','Analysing, solving and finding patterns'],['builder','Building products, systems or solutions'],['creative','Creating, designing or communicating'],['people','Helping, coaching or influencing people'],['quality','Making things better, safer or more reliable']]},
  {id:'environment', title:'Which environment sounds more like you?', subtitle:'There is no right answer.', options:[['structured','Clear structure, standards and measurable outcomes'],['dynamic','Fast-changing, ambiguous and entrepreneurial'],['collaborative','Cross-functional, discussion-heavy and people-oriented'],['independent','Deep work with ownership and autonomy']]},
  {id:'priority', title:'What matters most in the next few years?', subtitle:'Choose the outcome you would value most.', options:[['stability','Stability and dependable career progression'],['growth','Growth, responsibility and earning potential'],['impact','Meaningful impact and visible contribution'],['flexibility','Flexibility and freedom in how I work']]},
  {id:'learning', title:'How do you prefer to learn?', subtitle:'This helps us suggest an action route.', options:[['project','Projects and hands-on practice'],['structured','Structured courses and guided instruction'],['mentor','Mentor-led discussion and feedback'],['self','Self-paced exploration and experimentation']]},
  {id:'commitment', title:'How ready are you to take action?', subtitle:'This changes the kind of next step we recommend.', options:[['explore','Just exploring — I do not want to commit yet'],['validate','I want to validate my direction first'],['plan','I am ready to make a 90-day plan'],['act','I am ready to start learning / acting']]}
];

function qs(){return new URLSearchParams(location.search);}

function getEngineVersion(){
  const cfg = window.CareerDiyaExplorationConfig;
  return (cfg && cfg.EXPLORATION_ENGINE_VERSION) || 'free-exploration-v1';
}

function newExplorationId(){
  if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return 'exp-'+Date.now().toString(36)+'-'+Math.random().toString(16).slice(2);
}

function cachedProfileAudience(){
  try{
    const p=JSON.parse(localStorage.getItem('careerdiya_profile_details')||'null');
    return p && ['parent','student','professional'].includes(p.audience) ? p.audience : null;
  }catch(_){ return null; }
}

// Precedence for the audience used to start a NEW exploration / drive the
// normal workspace: an explicit URL choice always reflects the visitor's
// current, deliberate intent and wins. Failing that, an authenticated
// user's saved profile audience is the default (never a stale old
// exploration or stale localStorage). Anonymous visitors fall back to
// whatever audience they last selected, then a plain default.
function currentAudience(){
  const fromUrl = qs().get('audience');
  if(['parent','student','professional'].includes(fromUrl)) return fromUrl;
  const authed = window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated && window.CareerDiyaProfileAuth.isAuthenticated();
  if(authed){
    const profileAudience = cachedProfileAudience();
    if(profileAudience) return profileAudience;
  }
  const saved = localStorage.getItem('careerdiyaAudience');
  return ['parent','student','professional'].includes(saved) ? saved : 'professional';
}

function questionsForAudience(a){return a==='parent'?PARENT_QUESTIONS:a==='student'?STUDENT_QUESTIONS:PROFESSIONAL_QUESTIONS;}
function elsLocal(q,p){return [...p.querySelectorAll(q)];}

function skillPlan(direction,answers){
  const mode=answers.learning;
  const top=direction.skills.slice(0,3);
  const plan=mode==='mentor'?'mentor-led practice + feedback':mode==='project'?'a small project + guided practice':mode==='self'?'structured self-exploration + a small project':'a structured learning path + hands-on practice';
  return {top,plan};
}

function renderWizard(root){
  let step=0;const answers={};const audience=currentAudience();const activeQuestions=questionsForAudience(audience);const total=activeQuestions.length;
  function draw(){
    const q=activeQuestions[step];
    const eyebrow=audience==='parent'?'Free direction exploration · parent view':audience==='student'?'Free direction exploration · 16+':'Free career exploration';
    root.innerHTML=`<div class="wizard-head"><div class="eyebrow">${eyebrow}</div><div class="wizard-progress"><span style="width:${((step+1)/total)*100}%"></span></div><div class="wizard-count">Question ${step+1} of ${total}</div><h2>${q.title}</h2><p>${q.subtitle}</p></div><div class="wizard-options">${q.options.map(([v,l])=>`<button class="wizard-option ${answers[q.id]===v?'selected':''}" data-value="${v}"><span class="radio-dot"></span><span>${l}</span></button>`).join('')}</div><div class="wizard-footer"><button class="btn btn-secondary" id="back" ${step===0?'disabled':''}>Back</button><button class="btn btn-primary" id="next" ${answers[q.id]?'':'disabled'}>${step===total-1?'See my directions':'Continue →'}</button></div>`;
    elsLocal('.wizard-option',root).forEach(b=>b.addEventListener('click',()=>{answers[q.id]=b.dataset.value;draw();}));
    root.querySelector('#back').addEventListener('click',()=>{if(step>0){step--;draw();}});
    root.querySelector('#next').addEventListener('click',()=>{if(!answers[q.id])return;if(step<total-1){step++;draw();}else completeExploration(root,answers,audience);});
  }
  draw();
}

// Builds the persisted result payload once, at completion. This object is
// what gets stored (locally and/or in the database) and later replayed
// as-is for historical views — it is never recomputed from stored answers.
function buildStoredResult(answers,audience){
  const result=generateRecommendations(answers,audience);
  const recommendations=result.chosen.map(x=>({id:x.direction.id,name:x.direction.name,tags:x.direction.tags||[],skills:x.direction.skills||[],score:x.score,similarities:x.similarities,penalty:x.penalty}));
  return {
    profileCreated:true,audience,answers,
    recommendationMatrixVersion:FREE_ENGINE_CONFIG.version,
    score:result.chosen[0].score,signal:result.signal,margin:result.margin,
    userProfile:result.userProfile,
    recommendations,recs:recommendations,
    topSignals:result.topSignals,
    updatedAt:new Date().toISOString()
  };
}

// Completion is ungated: the result renders immediately regardless of
// whether the visitor is signed in. A self-contained snapshot is captured
// once, here, so it can be replayed later without ever recomputing it.
async function completeExploration(root,answers,audience){
  const storedResult=buildStoredResult(answers,audience);
  const explorationId=newExplorationId();
  const engineVersion=getEngineVersion();
  const completedAt=new Date().toISOString();
  const snapshot={exploration_id:explorationId,audience,answers,result:storedResult,engine_version:engineVersion,completed_at:completedAt};

  localStorage.setItem('careerdiya_profile',JSON.stringify(storedResult));

  const auth=window.CareerDiyaProfileAuth;
  const authenticated=!!(auth && auth.isAuthenticated && auth.isAuthenticated());
  if(authenticated){
    localStorage.removeItem('careerdiya_pending_exploration');
    if(auth.saveNewExploration){
      auth.saveNewExploration(snapshot).catch(err=>console.warn('Career Diya exploration persistence failed:',err));
    }
  } else {
    localStorage.setItem('careerdiya_pending_exploration',JSON.stringify(snapshot));
  }

  renderExplorationResult(root,{audience,answers,result:storedResult,historical:false,authenticated,snapshot});
}

// Shared rendering for a completed exploration's result, whether just
// finished (`historical:false`) or reopened from storage (`historical:true`,
// with `meta` describing the stored row). The historical path never calls
// generateRecommendations() — it only renders what was already stored.
function renderExplorationResult(root,ctx){
  const {audience,answers,result:storedResult,historical,authenticated,meta}=ctx;
  const isParent=audience==='parent';
  const recommendations=storedResult.recommendations||storedResult.recs||[];
  const top=recommendations[0];
  const alternatives=recommendations.slice(1);
  const plan=top?skillPlan({skills:top.skills||[]},answers):{top:[],plan:''};
  const signal=storedResult.signal||'Early signal';
  const rationale=(storedResult.topSignals&&storedResult.topSignals.length)?storedResult.topSignals.join(', '):'the mix of preferences you selected';

  if(!top){
    root.innerHTML=`<div class="results-wrap"><div class="notice">This exploration's result is unavailable. <a href="explore.html?start=1&audience=${encodeURIComponent(audience)}">Run a new exploration →</a></div></div>`;
    return;
  }

  const topMapping=typeof getDirectionCareerMapping==='function'?getDirectionCareerMapping(top.id):null;
  const topHasVerifiedCareers=!!(topMapping&&(topMapping.careers||[]).some(c=>c.status==='verified'));
  const primaryAction=isParent
    ? '<a class="btn btn-primary" href="https://careerdiya.edumilestones.com/career-lab/">Explore school-stage assessment →</a>'
    : topHasVerifiedCareers
      ? `<a class="btn btn-primary" href="career.html?direction=${encodeURIComponent(top.id)}&audience=${encodeURIComponent(audience)}">Explore careers in ${top.name} →</a>`
      : `<span class="btn btn-secondary" aria-disabled="true" title="Career Library mappings for this direction are still being verified.">Career options being mapped</span>`;
  const extra=isParent?`<a class="btn btn-secondary" href="explore.html?audience=parent&start=1">Start another exploration</a>`:`<a class="btn btn-secondary" href="assessment.html?audience=${audience}">Need more confidence?</a>`;
  const renderDirectionLink=(direction)=>{
    const m=typeof getDirectionCareerMapping==='function'?getDirectionCareerMapping(direction.id):null;
    const hasVerified=!!(m&&(m.careers||[]).some(c=>c.status==='verified'));
    return hasVerified
      ? `<a class="mini-result" href="career.html?direction=${encodeURIComponent(direction.id)}&audience=${encodeURIComponent(audience)}"><strong>${direction.name}</strong><span>Explore →</span></a>`
      : `<div class="mini-result disabled" aria-disabled="true"><strong>${direction.name}</strong><span>Career options being mapped</span></div>`;
  };
  const resultEyebrow=isParent?'Your child’s starting directions':'Your starting directions';
  const heading=`A direction worth exploring: ${top.name}`;
  const lead=isParent?'This is an exploration signal based on the observations you shared about your child. It is not a final stream recommendation or a child psychometric assessment.':'These are exploration signals based on the preferences you shared. They are not a definitive career-fit assessment.';
  const nextTitle=isParent?'Build evidence before choosing a stream.':'Build evidence before you commit.';
  const nextCopy=isParent?`You highlighted ${rationale}. Start with ${(plan.top||[]).join(', ')} and use ${plan.plan}. Then consider the age-designed school-stage assessment for deeper evidence.`:`You highlighted ${rationale}. Start with ${(plan.top||[]).join(', ')} and use ${plan.plan}. This is a low-risk way to test whether the direction feels right.`;

  const historicalBanner=historical?`<div class="exploration-context-banner"><span>Viewing your exploration · ${new Date(meta.completed_at||meta.updatedAt||Date.now()).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})} · ${audience.charAt(0).toUpperCase()+audience.slice(1)}</span><a class="link-button" href="dashboard.html">← Back to My Workspace</a></div>`:'';
  const legacyNotice=(meta&&meta.legacy)?`<div class="notice">This exploration was completed before Career Diya began saving full engine-version history. Your original answers and result are preserved as originally shown.</div>`:'';

  const saveJourneyPanel=(!historical && !authenticated)?renderSaveJourneyPanelHTML():'';
  const leadCopy="Leave your email and we'll keep this direction on file against your details — no spam, no automatic email, no pressure to buy.";

  root.innerHTML=`<div class="results-wrap">${historicalBanner}${legacyNotice}<div class="eyebrow">${resultEyebrow}</div><h2>${heading}</h2><p class="results-lead">${lead}</p><div class="results-grid"><div class="result-panel"><span class="tag">${signal}</span><h3>${top.name}</h3><p>${(top.tags||[]).join(' · ')}</p><div class="scorebar"><span style="width:${Math.max(35,Math.min(94,top.score||0))}%"></span></div><small>Exploration signal based on your answers; this score is not a validated percentage.</small><p class="result-why"><b>Why it surfaced:</b> ${rationale}.</p></div><div class="result-panel"><span class="tag">Other directions worth exploring</span>${alternatives.map(renderDirectionLink).join('')}</div></div><div class="result-panel next-step"><span class="tag">What to do next</span><h3>${nextTitle}</h3><p>${nextCopy}</p><div class="actions">${primaryAction}${extra}</div></div>${!historical?`<div class="result-panel lead-panel"><span class="tag">Keep this on file</span><h3>Keep me posted about this direction</h3><p>${leadCopy}</p><form id="leadForm" class="lead-form" novalidate><input class="input" type="text" name="name" placeholder="Name (optional)" autocomplete="name"><input class="input" type="email" name="email" placeholder="you@email.com" required autocomplete="email"><input class="input" type="tel" name="phone" placeholder="Phone (optional)" autocomplete="tel"><button class="btn btn-primary" type="submit">Keep Me Posted</button></form><p class="lead-status" role="status" aria-live="polite"></p></div>`:''}<div class="notice">${isParent?'<b>Parent note:</b> This free exploration uses observations you provided about your child and is intentionally broad. Use the age-designed school-stage assessment when you need deeper evidence.':'<b>Free exploration note:</b> This is a lightweight, deterministic exploration tool. A deeper assessment can provide more evidence when you are ready.'}</div>${saveJourneyPanel}</div>`;

  if(!historical) wireLeadForm(root,top,audience,answers,signal);
  if(saveJourneyPanel) wireSaveJourneyPanel(root);
}

function renderSaveJourneyPanelHTML(){
  return `<div class="profile-gate save-journey-panel">
    <div class="eyebrow">Optional</div>
    <h3>Save your journey</h3>
    <p class="profile-gate-lead">Create a free Career Diya profile to keep this exploration, come back to it later, and build a history as you explore more directions. Your result above is already yours — this step is optional.</p>
    <div class="profile-gate-promise">
      <span>✓ Come back and continue later</span>
      <span>✓ Keep a history as you explore more</span>
      <span>✓ Free — no paid service required</span>
    </div>
    <div class="profile-gate-panel">
      <div class="profile-social" aria-label="Social sign in options">
        <button type="button" class="social-btn" data-provider="google"><span class="social-mark">G</span><span>Continue with Google</span></button>
        <button type="button" class="social-btn" data-provider="azure"><span class="social-mark">▦</span><span>Continue with Microsoft</span></button>
      </div>
      <div class="profile-divider"><span>or use email</span></div>
      <form id="saveJourneyForm" class="profile-gate-form" novalidate>
        <input class="input" type="text" name="name" placeholder="Your name" autocomplete="name" required>
        <input class="input" type="email" name="email" placeholder="Email address" autocomplete="email" required>
        <input class="input" type="password" name="password" placeholder="Create a password (8+ characters)" autocomplete="new-password" minlength="8" required>
        <button class="btn btn-primary" type="submit">Save My Journey →</button>
      </form>
      <p class="profile-gate-status" role="status" aria-live="polite"></p>
      <p class="profile-gate-switch">Already have a Career Diya profile? <a class="link-button" href="auth.html?return=explore">Sign In</a></p>
    </div>
  </div>`;
}

function wireSaveJourneyPanel(root){
  const panel=root.querySelector('.save-journey-panel');
  if(!panel)return;
  panel.querySelectorAll('.social-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    const provider=btn.dataset.provider;
    panel.querySelectorAll('.social-btn').forEach(b=>b.disabled=true);
    const status=panel.querySelector('.profile-gate-status');
    if(status){status.textContent=provider==='azure'?'Redirecting to Microsoft…':'Redirecting to Google…';status.className='profile-gate-status ok';}
    try{
      if(!window.CareerDiyaProfileAuth) throw new Error('Profile authentication is not loaded.');
      await window.CareerDiyaProfileAuth.signInWithProvider(provider);
    }catch(err){
      if(status){status.textContent=err&&err.message?err.message:'We could not start social sign-in. Please try again.';status.className='profile-gate-status err';}
      panel.querySelectorAll('.social-btn').forEach(b=>b.disabled=false);
    }
  }));

  const form=panel.querySelector('#saveJourneyForm');
  if(!form)return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=form.querySelector('[type="submit"]');
    const status=panel.querySelector('.profile-gate-status');
    const data=new FormData(form);
    const email=(data.get('email')||'').trim();
    const password=(data.get('password')||'').trim();
    const name=(data.get('name')||'').trim();
    if(!email||!password||!name){if(status){status.textContent='Please complete your name, email and password.';status.className='profile-gate-status err';}return;}
    if(password.length<8){if(status){status.textContent='Use a password with at least 8 characters.';status.className='profile-gate-status err';}return;}
    if(btn){btn.disabled=true;btn.textContent='Creating Profile…';}
    try{
      if(!window.CareerDiyaProfileAuth) throw new Error('Profile authentication is not loaded.');
      const audienceForSignup=currentAudience();
      const result=await window.CareerDiyaProfileAuth.signUp({name,email,password,audience:audienceForSignup});
      if(result.authenticated){
        if(status){status.textContent='Your profile is ready — this exploration has been saved to it.';status.className='profile-gate-status ok';}
        form.reset();
        return;
      }
      const params=new URLSearchParams({created:'1',email,return:'explore'});
      window.location.href=`auth.html?${params.toString()}`;
    }catch(err){
      if(status){status.textContent=err&&err.message?err.message:'We could not create your profile. Please try again.';status.className='profile-gate-status err';}
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Save My Journey →';}
    }
  });
}

function wireLeadForm(root,direction,audience,answers,signal){
  const form=root.querySelector('#leadForm');
  if(!form)return;
  const status=root.querySelector('.lead-status');
  function setStatus(msg,kind){ if(!status)return; status.textContent=msg; status.className='lead-status '+kind; }
  form.addEventListener('submit',function(e){
    e.preventDefault();
    const btn=form.querySelector('[type="submit"]');
    const original=btn?btn.textContent:'';
    const data=new FormData(form);
    const payload={
      source:'careerdiya',
      segment:audience,
      interest:direction.id,
      interest_kind:'direction',
      name:(data.get('name')||'').trim()||undefined,
      email:(data.get('email')||'').trim()||undefined,
      phone:(data.get('phone')||'').trim()||undefined,
      shared_user_id:null,
      raw:{directionName:direction.name,audience,answers,signal,page:'explore-results',url:location.href}
    };
    if(btn){btn.disabled=true;btn.textContent='Saving…';}
    setStatus('Saving…','busy');
    const lead=window.CareerDiyaLeadCapture;
    const submit=lead?lead.submitLead(payload):Promise.reject(new Error('Lead capture is not loaded.'));
    submit.then(function(){
      form.reset();
      setStatus("Saved — we'll keep this linked to you. No automatic email is sent.",'ok');
    }).catch(function(err){
      setStatus((err&&err.message)||'Something went wrong — please try again.','err');
    }).then(function(){
      if(btn){btn.disabled=false;btn.textContent=original;}
    });
  });
}

// Loads and renders a specific stored exploration by id ("Exploration
// View" mode). The exploration's own audience/answers/result are
// authoritative here regardless of the viewer's current profile.
async function renderStoredExploration(root,explorationId){
  const auth=window.CareerDiyaProfileAuth;
  if(!auth||!auth.isAuthenticated||!auth.isAuthenticated()){
    window.location.replace(`auth.html?return=explore&explorationId=${encodeURIComponent(explorationId)}`);
    return;
  }
  root.innerHTML='<div class="notice">Loading your exploration…</div>';
  try{
    const exploration=await auth.getExploration(explorationId);
    if(!exploration){
      root.innerHTML='<div class="results-wrap"><div class="notice">We could not find that exploration, or it does not belong to this account. <a href="dashboard.html">Back to My Workspace →</a></div></div>';
      return;
    }
    if(!exploration.result){
      root.innerHTML=`<div class="results-wrap"><div class="exploration-context-banner"><span>Viewing your exploration · ${new Date(exploration.completed_at).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})} · ${exploration.audience}</span><a class="link-button" href="dashboard.html">← Back to My Workspace</a></div><div class="notice">This exploration was completed before Career Diya began saving full results. Your original answers are preserved, but the historical result is unavailable.</div><a class="btn btn-primary" href="explore.html?start=1&audience=${encodeURIComponent(exploration.audience)}">Run a New Exploration →</a></div>`;
      return;
    }
    renderExplorationResult(root,{audience:exploration.audience,answers:exploration.answers,result:exploration.result,historical:true,authenticated:true,meta:exploration});
  }catch(err){
    root.innerHTML=`<div class="results-wrap"><div class="notice">We could not load this exploration. ${err&&err.message?err.message:''}</div></div>`;
  }
}

async function initDecisionEngine(){
  const root=document.getElementById('decisionEngine');if(!root)return;
  try { await (window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.handleOAuthReturn ? window.CareerDiyaProfileAuth.handleOAuthReturn() : Promise.resolve()); } catch(err) { /* normal page load can continue */ }

  const explorationId=qs().get('explorationId');
  if(explorationId){
    await renderStoredExploration(root,explorationId);
    return;
  }

  const auth=window.CareerDiyaProfileAuth;
  const resumeRequested=qs().get('resume')==='1';
  if(auth && auth.isAuthenticated && auth.isAuthenticated()){
    try{ await auth.promotePendingExploration(); }catch(_){}
    if(resumeRequested && auth.getSavedExploration){
      try{
        const latest=await auth.getSavedExploration();
        if(latest && latest.id){
          window.location.replace(`explore.html?explorationId=${encodeURIComponent(latest.id)}`);
          return;
        }
      }catch(_){}
    }
  }

  const audience=currentAudience();
  const startCopy=audience==='parent'?{eyebrow:'Free · a few minutes',title:'Explore your child’s direction before choosing a stream.',copy:'Answer a few questions about your child’s stage, interests and strengths. We will suggest broad directions worth exploring and a sensible next step.',benefits:['✓ See your result immediately — no account required','✓ No pressure to buy','✓ Use an age-designed assessment when you need deeper evidence']} : audience==='student'?{eyebrow:'Free · a few minutes',title:'Explore your direction before committing to a field.',copy:'Answer a few questions about your study stage, interests, strengths and goals. We will suggest broad directions worth exploring and a practical next step.',benefits:['✓ See your result immediately — no account required','✓ No pressure to buy','✓ Designed for students aged 16+']} : {eyebrow:'Free · 5–7 minutes',title:'Get a starting direction before you buy anything.',copy:'Answer a few questions about your situation, work preferences and goals. We will turn that into a short list of directions worth exploring and the most sensible next action.',benefits:['✓ See your result immediately — no account required','✓ No pressure to buy','✓ Skill Diya connection']};
  if(qs().get('intent')||(!qs().get('wizard')&&qs().get('start')==='1'))renderWizard(root);else root.innerHTML=`<div class="engine-start"><div class="eyebrow">${startCopy.eyebrow}</div><h2>${startCopy.title}</h2><p>${startCopy.copy}</p><div class="engine-benefits">${startCopy.benefits.map(x=>`<span>${x}</span>`).join('')}</div><button class="btn btn-primary" id="startEngine">Start my exploration →</button></div>`;
  const start=document.getElementById('startEngine');if(start)start.addEventListener('click',()=>renderWizard(root));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDecisionEngine);else initDecisionEngine();
