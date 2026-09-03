/* Career Diya Free Exploration UI + recommendation orchestration.
 * Recommendation rules live in decision-data.js. Keep this file focused on UI flow.
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
function currentAudience(){const a=qs().get('audience')||localStorage.getItem('careerdiyaAudience');return ['parent','student','professional'].includes(a)?a:'professional';}
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
    root.querySelector('#next').addEventListener('click',()=>{if(!answers[q.id])return;if(step<total-1){step++;draw();}else gateBeforeResults(root,answers,audience);});
  }
  draw();
}

function gateBeforeResults(root,answers,audience){
  const existing = window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated();
  if (existing) {
    renderResults(root,answers,audience);
    return;
  }

  localStorage.setItem('careerdiya_pending_exploration', JSON.stringify({
    audience,
    answers,
    savedAt:new Date().toISOString()
  }));

  const title = audience==='parent' ? 'Your child’s exploration is ready.' : 'Your career exploration is ready.';
  const copy = audience==='parent'
    ? 'Create your free Career Diya profile to save this exploration and see the broad directions that surfaced for your child.'
    : 'Create your free Career Diya profile to save this exploration and see the directions that surfaced from your answers.';

  root.innerHTML=`<div class="profile-gate">
    <div class="eyebrow">Your exploration is ready</div>
    <h2>${title}</h2>
    <p class="profile-gate-lead">${copy}</p>
    <div class="profile-gate-promise">
      <span>✓ Save your exploration</span>
      <span>✓ See your starting directions</span>
      <span>✓ Come back and continue later</span>
    </div>
    <div class="profile-gate-panel">
      <h3>Create your free profile</h3>
      <p>Choose how you want to create your Career Diya profile. Your result will appear after your profile is successfully created and signed in.</p>
      <div class="profile-social" aria-label="Social sign in options">
        <button type="button" class="social-btn" data-provider="google"><span class="social-mark">G</span><span>Continue with Google</span></button>
        <button type="button" class="social-btn" data-provider="azure"><span class="social-mark">▦</span><span>Continue with Microsoft</span></button>
      </div>
      <div class="profile-divider"><span>or use email</span></div>
      <form id="profileGateForm" class="profile-gate-form" novalidate>
        <input class="input" type="text" name="name" placeholder="Your name" autocomplete="name" required>
        <input class="input" type="email" name="email" placeholder="Email address" autocomplete="email" required>
        <input class="input" type="password" name="password" placeholder="Create a password (8+ characters)" autocomplete="new-password" minlength="8" required>
        <button class="btn btn-primary" type="submit">Create My Free Profile →</button>
      </form>
      <p class="profile-gate-status" role="status" aria-live="polite"></p>
      <p class="profile-gate-switch">Already have a Career Diya profile? <a class="link-button" href="auth.html?return=explore">Sign In</a></p>
    </div>
    <p class="profile-gate-note">Free profile only. No paid service is required to create it.</p>
  </div>`;

  root.querySelectorAll('.social-btn').forEach(btn=>btn.addEventListener('click',async()=>{
    const provider=btn.dataset.provider;
    root.querySelectorAll('.social-btn').forEach(b=>b.disabled=true);
    const status=root.querySelector('.profile-gate-status');
    if(status){status.textContent=provider==='azure'?'Redirecting to Microsoft…':'Redirecting to Google…';status.className='profile-gate-status ok';}
    try {
      if(!window.CareerDiyaProfileAuth) throw new Error('Profile authentication is not loaded.');
      await window.CareerDiyaProfileAuth.signInWithProvider(provider);
    } catch(err) {
      if(status){status.textContent=err && err.message ? err.message : 'We could not start social sign-in. Please try again.';status.className='profile-gate-status err';}
      root.querySelectorAll('.social-btn').forEach(b=>b.disabled=false);
    }
  }));

  const form=root.querySelector('#profileGateForm');
  if(!form)return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=form.querySelector('[type="submit"]');
    const status=root.querySelector('.profile-gate-status');
    const data=new FormData(form);
    const email=(data.get('email')||'').trim();
    const password=(data.get('password')||'').trim();
    const name=(data.get('name')||'').trim();
    if(!email || !password || !name){if(status){status.textContent='Please complete your name, email and password.';status.className='profile-gate-status err';}return;}
    if(password.length<8){if(status){status.textContent='Use a password with at least 8 characters.';status.className='profile-gate-status err';}return;}
    if(btn){btn.disabled=true;btn.textContent='Creating Profile…';}
    try{
      if(!window.CareerDiyaProfileAuth) throw new Error('Profile authentication is not loaded.');
      const result=await window.CareerDiyaProfileAuth.signUp({name,email,password,audience});
      if(result.authenticated){
        renderResults(root,answers,audience,'Your profile is ready — here is your exploration result.');
        return;
      }
      // Email confirmation is enabled: take the user to the clean sign-in page.
      const params=new URLSearchParams({created:'1',email,return:'explore'});
      window.location.href=`auth.html?${params.toString()}`;
    }catch(err){
      if(status){status.textContent=err && err.message ? err.message : 'We could not create your profile. Please try again.';status.className='profile-gate-status err';}
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Create My Free Profile →';}
    }
  });
}

function renderResults(root,answers,audience,profileMessage=''){
  const authenticated = !!(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated());
  if(!authenticated){
    gateBeforeResults(root,answers,audience);
    return;
  }
  const result=generateRecommendations(answers,audience);const top=result.chosen[0].direction;const alternatives=result.chosen.slice(1);const plan=skillPlan(top,answers);const isParent=audience==='parent';
  const signal=result.signal;const rationale=result.topSignals.length?result.topSignals.join(', '):'the mix of preferences you selected';
  const storedResult={profileCreated:true,audience,answers,recommendationMatrixVersion:FREE_ENGINE_CONFIG.version,score:result.chosen[0].score,signal,margin:result.margin,userProfile:result.userProfile,recommendations:result.chosen.map(x=>({id:x.direction.id,name:x.direction.name,score:x.score,similarities:x.similarities,penalty:x.penalty})),recs:result.chosen.map(x=>({id:x.direction.id,name:x.direction.name,skills:x.direction.skills||[],score:x.score,similarities:x.similarities,penalty:x.penalty})),updatedAt:new Date().toISOString()};
  localStorage.setItem('careerdiya_profile',JSON.stringify(storedResult));
  localStorage.removeItem('careerdiya_pending_exploration');
  if(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.saveExploration){
    window.CareerDiyaProfileAuth.saveExploration({audience,answers,result:storedResult}).catch(err=>console.warn('Career Diya exploration persistence failed:',err));
  }
  const resultEyebrow=isParent?'Your child’s starting directions':'Your starting directions';
  const heading=isParent?`A direction worth exploring: ${top.name}`:`A direction worth exploring: ${top.name}`;
  const lead=isParent?'This is an exploration signal based on the observations you shared about your child. It is not a final stream recommendation or a child psychometric assessment.':'These are exploration signals based on the preferences you shared. They are not a definitive career-fit assessment.';
  const nextTitle=isParent?'Build evidence before choosing a stream.':'Build evidence before you commit.';
  const nextCopy=isParent?`You highlighted ${rationale}. Start with ${plan.top.join(', ')} and use ${plan.plan}. Then consider the age-designed school-stage assessment for deeper evidence.`:`You highlighted ${rationale}. Start with ${plan.top.join(', ')} and use ${plan.plan}. This is a low-risk way to test whether the direction feels right.`;
  const topMapping = typeof getDirectionCareerMapping==='function' ? getDirectionCareerMapping(top.id) : null;
  const topHasVerifiedCareers = !!(topMapping && (topMapping.careers||[]).some(c=>c.status==='verified'));
  const primaryAction=isParent
    ? '<a class="btn btn-primary" href="https://careerdiya.edumilestones.com/career-lab/">Explore school-stage assessment →</a>'
    : topHasVerifiedCareers
      ? `<a class="btn btn-primary" href="career.html?direction=${encodeURIComponent(top.id)}&audience=${encodeURIComponent(audience)}">Explore careers in ${top.name} →</a>`
      : `<span class="btn btn-secondary" aria-disabled="true" title="Career Library mappings for this direction are still being verified.">Career options being mapped</span>`;
  const extra=isParent?'<a class="btn btn-secondary" href="explore.html?audience=parent">Start another exploration</a>':`<a class="btn btn-secondary" href="assessment.html?audience=${audience}">Need more confidence?</a>`;
  const renderDirectionLink=(direction,aud) => {
    const m=typeof getDirectionCareerMapping==='function' ? getDirectionCareerMapping(direction.id) : null;
    const hasVerified=!!(m && (m.careers||[]).some(c=>c.status==='verified'));
    return hasVerified
      ? `<a class="mini-result" href="career.html?direction=${encodeURIComponent(direction.id)}&audience=${encodeURIComponent(aud)}"><strong>${direction.name}</strong><span>Explore →</span></a>`
      : `<div class="mini-result disabled" aria-disabled="true"><strong>${direction.name}</strong><span>Career options being mapped</span></div>`;
  };
  const leadCopy="Leave your email and we'll send this exploration summary so you can revisit it — no spam, no pressure to buy.";
  root.innerHTML=`<div class="results-wrap">${profileMessage?`<div class="profile-confirmation">${profileMessage}</div>`:''}<div class="eyebrow">${resultEyebrow}</div><h2>${heading}</h2><p class="results-lead">${lead}</p><div class="results-grid"><div class="result-panel"><span class="tag">${signal}</span><h3>${top.name}</h3><p>${top.tags.join(' · ')}</p><div class="scorebar"><span style="width:${Math.max(35,Math.min(94,result.chosen[0].score))}%"></span></div><small>Exploration signal based on your answers; this score is not a validated percentage.</small><p class="result-why"><b>Why it surfaced:</b> ${rationale}.</p></div><div class="result-panel"><span class="tag">Other directions worth exploring</span>${alternatives.map(c=>renderDirectionLink(c.direction,audience)).join('')}</div></div><div class="result-panel next-step"><span class="tag">What to do next</span><h3>${nextTitle}</h3><p>${nextCopy}</p><div class="actions">${primaryAction}${extra}</div></div><div class="result-panel lead-panel"><span class="tag">Get this by email</span><h3>Send me this direction</h3><p>${leadCopy}</p><form id="leadForm" class="lead-form" novalidate><input class="input" type="text" name="name" placeholder="Name (optional)" autocomplete="name"><input class="input" type="email" name="email" placeholder="you@email.com" required autocomplete="email"><input class="input" type="tel" name="phone" placeholder="Phone (optional)" autocomplete="tel"><button class="btn btn-primary" type="submit">Send me this direction</button></form><p class="lead-status" role="status" aria-live="polite"></p></div><div class="notice">${isParent?'<b>Parent note:</b> This free exploration uses observations you provided about your child and is intentionally broad. Use the age-designed school-stage assessment when you need deeper evidence.':'<b>Free exploration note:</b> This is a lightweight, deterministic exploration tool. A deeper assessment can provide more evidence when you are ready.'}</div></div>`;
  wireLeadForm(root,top,audience,answers,signal);
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
    if(btn){btn.disabled=true;btn.textContent='Sending…';}
    setStatus('Sending…','busy');
    const lead=window.CareerDiyaLeadCapture;
    const submit=lead?lead.submitLead(payload):Promise.reject(new Error('Lead capture is not loaded.'));
    submit.then(function(){
      form.reset();
      setStatus("Sent — we'll keep this linked to you.",'ok');
    }).catch(function(err){
      setStatus((err&&err.message)||'Something went wrong — please try again.','err');
    }).then(function(){
      if(btn){btn.disabled=false;btn.textContent=original;}
    });
  });
}

async function initDecisionEngine(){
  const root=document.getElementById('decisionEngine');if(!root)return;
  try { await (window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.handleOAuthReturn ? window.CareerDiyaProfileAuth.handleOAuthReturn() : Promise.resolve()); } catch(err) { /* normal page load can continue */ }
  const pendingRaw=localStorage.getItem('careerdiya_pending_exploration');
  const resumeRequested=qs().get('resume')==='1';
  if(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated()) {
    try {
      if(pendingRaw){
        const pending=JSON.parse(pendingRaw);
        if(pending && pending.answers && pending.audience){
          renderResults(root,pending.answers,pending.audience,'Your profile is ready — here is your exploration result.');
          return;
        }
      }
      if(resumeRequested){
        const saved=JSON.parse(localStorage.getItem('careerdiya_profile')||'null');
        if(saved && saved.answers && saved.audience){
          renderResults(root,saved.answers,saved.audience,'Here is your saved exploration result.');
          return;
        }
        if(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.getSavedExploration){
          const persisted=await window.CareerDiyaProfileAuth.getSavedExploration();
          if(persisted && persisted.answers && persisted.audience){
            renderResults(root,persisted.answers,persisted.audience,'Here is your saved exploration result.');
            return;
          }
        }
      }
    } catch(_) {}
  }
  const audience=currentAudience();
  const startCopy=audience==='parent'?{eyebrow:'Free · a few minutes',title:'Explore your child’s direction before choosing a stream.',copy:'Answer a few questions about your child’s stage, interests and strengths. We will suggest broad directions worth exploring and a sensible next step.',benefits:['✓ Free profile to see your result','✓ No pressure to buy','✓ Use an age-designed assessment when you need deeper evidence']} : audience==='student'?{eyebrow:'Free · a few minutes',title:'Explore your direction before committing to a field.',copy:'Answer a few questions about your study stage, interests, strengths and goals. We will suggest broad directions worth exploring and a practical next step.',benefits:['✓ Free profile to see your result','✓ No pressure to buy','✓ Designed for students aged 16+']} : {eyebrow:'Free · 5–7 minutes',title:'Get a starting direction before you buy anything.',copy:'Answer a few questions about your situation, work preferences and goals. We will turn that into a short list of directions worth exploring and the most sensible next action.',benefits:['✓ Free profile to see your result','✓ No pressure to buy','✓ Skill Diya connection']};
  if(qs().get('intent')||(!qs().get('wizard')&&qs().get('start')==='1'))renderWizard(root);else root.innerHTML=`<div class="engine-start"><div class="eyebrow">${startCopy.eyebrow}</div><h2>${startCopy.title}</h2><p>${startCopy.copy}</p><div class="engine-benefits">${startCopy.benefits.map(x=>`<span>${x}</span>`).join('')}</div><button class="btn btn-primary" id="startEngine">Start my exploration →</button></div>`;
  const start=document.getElementById('startEngine');if(start)start.addEventListener('click',()=>renderWizard(root));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDecisionEngine);else initDecisionEngine();
