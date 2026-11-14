const AUDIENCE_KEY='careerdiyaAudience';
const AUDIENCE_DATA={
  parent:{title:"Not sure which direction could fit your child? <span class='gradient'>Start with clarity.</span>",subhead:"Answer a few practical questions about your child’s stage, interests and strengths. We’ll surface directions that may be worth exploring — not a final verdict.",primary:"Explore my child’s direction →",primaryHref:'explore.html?audience=parent',assessment:"See my exploration",assessmentHref:'assessment.html?audience=parent',note:"For parents helping a school-age child explore streams and directions.",exampleTitle:"Choose a direction with more confidence",exampleCopy:"Start with your child’s stage, strengths and interests, then explore suitable streams and directions before committing to a path.",exampleCta:"Explore my child’s direction →",exploreTitle:"Explore your child’s direction",exploreCopy:"Answer a few guided questions about your child’s stage, interests and strengths to identify directions worth exploring.",explorePageTitle:"Explore your child’s direction before choosing a stream",explorePageSubhead:"Answer a few questions about your child’s stage, interests and strengths. We’ll suggest directions worth exploring — not a final verdict.",assessmentTitle:"Talk it through when you need more confidence",assessmentCopy:"For school-age choices, start with a short exploration, then talk it through with a counsellor if you need more confidence.",cardCopy:"An age-appropriate assessment with a written report, arranged with a Career Diya counsellor.",choice1:"Your child’s stage, strengths and interests",choice2:"Interests, strengths and preferences",choice3:"Streams and directions worth exploring",choice4:"Schools, courses and support"},
  student:{title:"Not sure what direction is right for you? <span class='gradient'>Start with clarity.</span>",subhead:"Explore your interests, strengths and possible paths so you can make a better decision about what to study and where you want to go next.",primary:"Explore my direction →",primaryHref:'explore.html?audience=student',assessment:"See my exploration",assessmentHref:'assessment.html?audience=student',note:"For late-school and college students aged 16+ figuring out what comes next.",exampleTitle:"Figure out what to explore next",exampleCopy:"Compare possible directions, identify what interests you and build evidence before committing to a course or career path.",exampleCta:"Explore my direction →",exploreTitle:"Explore your next direction",exploreCopy:"Answer a few guided questions about your study stage, interests, strengths and goals to get a starting direction.",explorePageTitle:"Explore your direction before committing to a field",explorePageSubhead:"Answer a few questions. We’ll suggest directions worth exploring and a practical next step for your study or early-career decisions.",assessmentTitle:"Use assessment when you need more confidence",assessmentCopy:"For late-school and college students aged 16+, the Career Diya assessment path can provide deeper evidence for a direction.",cardCopy:"A fuller psychometric assessment with a written report, arranged with a Career Diya counsellor.",choice1:"Your stage, interests and direction",choice2:"Subjects, strengths and preferences",choice3:"Fields and paths worth exploring",choice4:"Courses, colleges and support"},
  professional:{title:"Not sure what to do next? <span class='gradient'>Start with clarity.</span>",subhead:"Understand where you are, explore where you could go, and find a practical next step before committing more time, money or effort to the wrong path.",primary:"Start exploring →",primaryHref:'explore.html?audience=professional',assessment:"See my exploration",assessmentHref:'assessment.html?audience=professional',note:"For graduates and professionals considering growth, change, a switch or a new direction.",exampleTitle:"Make your next career move with more evidence",exampleCopy:"Explore realistic paths, compare the skills involved and test a direction before making a high-stakes move.",exampleCta:"Start exploring →",exploreTitle:"Explore your next career move",exploreCopy:"Answer seven quick questions to get a starting direction and a practical next step for growth, switching or a new career move.",explorePageTitle:"Get a starting direction before you commit",explorePageSubhead:"Answer a few questions. We will suggest career directions, explain what to test next, and connect the learning step to Skill Diya.",assessmentTitle:"Use assessment when you need more confidence",assessmentCopy:"For graduates and professionals, the Career Diya assessment path can provide deeper evidence alongside exploration and guidance.",cardCopy:"A fuller psychometric assessment with a written report, arranged with a Career Diya counsellor.",choice1:"Your stage, experience and direction",choice2:"Interests, strengths and preferences",choice3:"Career paths worth exploring",choice4:"Skills, courses and support"}
};
const DEFAULT_AUDIENCE={title:"Not sure what’s next? <span class='gradient'>Start with clarity.</span>",subhead:"Explore your interests, strengths and situation to find career directions worth considering.",primary:"Start exploring →",primaryHref:'explore.html',assessment:"See my exploration",assessmentHref:'assessment.html',note:"For students, professionals and parents helping a child choose a path.",exampleTitle:"Start with the question closest to you",exampleCopy:"Career Diya can help you or your child explore a suitable direction before making a bigger decision.",exampleCta:"Start exploring →",exploreTitle:"Start with a guided career exploration",exploreCopy:"Answer seven quick questions to get a starting direction and a practical next step.",explorePageTitle:"Get a starting direction before you commit",explorePageSubhead:"Answer a few questions. We will suggest directions worth exploring and explain what to test next.",assessmentTitle:"Use assessment when you need more confidence",assessmentCopy:"Start with a lightweight decision journey. Use a deeper assessment when a formal assessment is the better next step.",cardCopy:"A fuller psychometric assessment with a written report, arranged with a Career Diya counsellor.",choice1:"Your stage, strengths and interests",choice2:"Interests, strengths and preferences",choice3:"Paths worth exploring",choice4:"Courses and support"};
// Each card's key matches an answer to the explorer's "What are you trying to figure out?"
// question for that audience, so the explorer can skip asking it again (?intent=…).
const AUDIENCE_INTENTS={
  neutral:[
    ['choice','I don’t know which career to choose','Explore options based on your interests, strengths and situation.'],
    ['stuck','I feel stuck in my career','Understand what is blocking progress and which directions are realistic.'],
    ['switch','I’m thinking about a career switch','See transition routes, skill gaps and learning options.'],
    ['growth','I want to grow where I am','Map the skills and moves that can accelerate your current path.'],
    ['learning','I’m not sure which course to take','Check the direction before committing to a programme.'],
    ['guidance','I want to talk to someone','Connect with career guidance when self-exploration is not enough.']
  ],
  parent:[
    ['choice','I don’t know which direction fits my child','Explore possible directions using your child’s stage, interests and strengths.'],
    ['learning','Which subjects or streams should we explore?','Compare broad directions before choosing a stream after 10th or 12th.'],
    ['stuck','We’re choosing between a few paths','Put the options side by side and see what may be worth exploring.'],
    ['growth','I want to understand my child’s strengths','Organise what you have noticed without turning it into a verdict.'],
    ['switch','My child is rethinking their direction','Look at nearby directions before changing course.'],
    ['guidance','I want to talk to someone','Connect with career guidance when the decision needs a conversation.']
  ],
  student:[
    ['choice','I don’t know which field to choose','Explore options based on your interests, strengths and situation.'],
    ['learning','I’m not sure what to study','Compare fields and directions before committing to a course.'],
    ['stuck','I’m stuck between a few options','Build a shortlist and see what each direction could involve.'],
    ['growth','I want to work towards a clear direction','Organise your interests and strengths into a direction to build on.'],
    ['switch','I’m rethinking the direction I started with','See nearby directions before changing course.'],
    ['guidance','I want to talk to someone','Connect with career guidance when self-exploration is not enough.']
  ],
  professional:[
    ['choice','I don’t know which career direction to choose','Explore realistic options based on your strengths, interests and situation.'],
    ['stuck','I feel stuck in my career','Understand what is blocking progress and which directions are realistic.'],
    ['switch','I’m thinking about a career switch','See transition routes, skill gaps and ways to test a move.'],
    ['growth','I want to grow where I am','Map the skills and moves that can accelerate your current path.'],
    ['learning','I’m not sure which course to take','Check the direction before committing to another programme.'],
    ['guidance','I want to talk to someone','Connect with career guidance when the decision needs a conversation.']
  ]
};

function getAudience(){const p=new URLSearchParams(window.location.search).get('audience'); if(p&&AUDIENCE_DATA[p]){localStorage.setItem(AUDIENCE_KEY,p); return p;} const saved=localStorage.getItem(AUDIENCE_KEY); return AUDIENCE_DATA[saved]?saved:null;}
// Picking an audience on the home page only changes what this browser shows. The account's
// "I'm exploring as" is set on Profile and by completing an exploration, never by a click here.
function setAudience(a){
  if(!AUDIENCE_DATA[a]) return;
  localStorage.setItem(AUDIENCE_KEY,a);
  syncAudience(a);
}
function clearAudience(){localStorage.removeItem(AUDIENCE_KEY); const u=new URL(window.location.href); u.searchParams.delete('audience'); history.replaceState({},'',u); syncAudience(null);}
function renderAudienceIntents(a=getAudience()){
  const grid=el('[data-audience-intent-grid]');
  if(!grid)return;
  const key=a&&AUDIENCE_INTENTS[a]?a:'neutral';
  grid.innerHTML=AUDIENCE_INTENTS[key].map((item,i)=>{
    const [intent,title,copy]=item;
    const href=intent==='guidance'?'counselling.html':`explore.html?intent=${encodeURIComponent(intent)}`;
    const u=new URL(href,window.location.href);
    if(a)u.searchParams.set('audience',a);
    return `<a class="intent" href="${u.pathname}${u.search}"><h3>${title}</h3><p>${copy}</p></a>`;
  }).join('');
}
const AUDIENCE_SUMMARY={parent:'parents',student:'students',professional:'graduates and professionals'};
function syncAudiencePicker(a){
  const picker=el('#audiencePicker'); if(!picker)return;
  picker.classList.toggle('is-collapsed',!!a);
  els('[data-audience-summary]').forEach(x=>x.textContent=a?AUDIENCE_SUMMARY[a]:'');
  els('.audience-option').forEach(x=>{const on=x.dataset.audience===a; x.classList.toggle('selected',on); x.setAttribute('aria-pressed',on?'true':'false');});
}
function syncAudience(a=getAudience()){syncAudiencePicker(a); const d=a?AUDIENCE_DATA[a]:DEFAULT_AUDIENCE; document.documentElement.dataset.audience=a||'neutral'; renderAudienceIntents(a); els('[data-path-action],[data-path-step]').forEach(x=>{const type=x.dataset.pathAction||x.dataset.pathStep; const target=(type==='decide'||type==='assessment')?'assessment.html':(type==='next'||type==='act'?'paths.html':'explore.html'); const u=new URL(target,window.location.href); if(a)u.searchParams.set('audience',a); x.href=u.pathname+(u.searchParams.toString()?`?${u.searchParams}`:'');}); els('[data-audience-hero-title]').forEach(x=>x.innerHTML=d.title); els('[data-audience-hero-subhead]').forEach(x=>x.textContent=d.subhead); els('[data-audience-hero-note]').forEach(x=>x.textContent=d.note); els('[data-audience-primary-cta]').forEach(x=>{x.href=d.primaryHref;x.textContent=d.primary;}); els('[data-audience-assessment-cta]').forEach(x=>{x.href=d.assessmentHref;x.textContent=d.assessment;}); els('[data-audience-example-title]').forEach(x=>x.textContent=d.exampleTitle); els('[data-audience-example-copy]').forEach(x=>x.textContent=d.exampleCopy); els('[data-audience-example-cta]').forEach(x=>{x.href=d.primaryHref;x.textContent=d.exampleCta;}); els('[data-audience-explore-title]').forEach(x=>x.textContent=d.exploreTitle); els('[data-audience-explore-copy]').forEach(x=>x.textContent=d.exploreCopy); els('[data-audience-explore-page-title]').forEach(x=>x.textContent=d.explorePageTitle); els('[data-audience-explore-page-subhead]').forEach(x=>x.textContent=d.explorePageSubhead); els('[data-audience-assessment-title]').forEach(x=>x.textContent=d.assessmentTitle); els('[data-audience-assessment-copy]').forEach(x=>x.textContent=d.assessmentCopy); els('[data-audience-assessment-card-copy]').forEach(x=>x.textContent=d.cardCopy); els('[data-audience-choice-1]').forEach(x=>x.textContent=d.choice1); els('[data-audience-choice-2]').forEach(x=>x.textContent=d.choice2); els('[data-audience-choice-3]').forEach(x=>x.textContent=d.choice3); els('[data-audience-choice-4]').forEach(x=>x.textContent=d.choice4); els('[data-audience-external-assessment]').forEach(x=>{x.href='counselling.html#request';}); els('a[href="assessment.html"]').forEach(x=>{if(a==='parent')x.href='assessment.html?audience=parent'; else if(a==='student')x.href='assessment.html?audience=student'; else if(a==='professional')x.href='assessment.html?audience=professional';}); els('.audience-option').forEach(x=>{const selected=x.dataset.audience===a; x.classList.toggle('selected',selected); x.setAttribute('aria-pressed',String(selected));}); const c=el('[data-audience-clear]'); if(c)c.style.visibility=a?'visible':'hidden';}
function getStoredProfile(){
  try{return JSON.parse(localStorage.getItem('careerdiya_profile')||'null');}catch(_){return null;}
}
function getStoredSessionUser(){
  try{const s=JSON.parse(localStorage.getItem('careerdiya_auth_session')||'null'); return s&&s.user?s.user:null;}catch(_){return null;}
}
function hasAuthenticatedProfile(){
  try{const s=JSON.parse(localStorage.getItem('careerdiya_auth_session')||'null'); return !!(s&&s.access_token);}catch(_){return false;}
}
function assessmentDestination(){
  const authenticated=hasAuthenticatedProfile();
  const profile=getStoredProfile();
  if(authenticated && profile && profile.answers){return {href:'explore.html?resume=1',label:'See my exploration'};}
  if(authenticated){return {href:'explore.html?start=1',label:'Jump straight to the questions'};}
  return {href:'explore.html?start=1',label:'Jump straight to the questions'};
}
// A real account, not the anonymous guest session used when login is switched off.
function isSignedInAccount(){
  const u=getStoredSessionUser();
  return hasAuthenticatedProfile() && !!u && !u.is_anonymous;
}
// First name for greetings: the Profile name, then the account name. Never the email address.
function firstNameFor(user,profile){
  const meta=user&&user.user_metadata||{};
  const name=String(profile?.display_name||meta.display_name||meta.full_name||meta.name||'').trim();
  const first=name.split(/\s+/)[0]||'';
  return first?first.charAt(0).toUpperCase()+first.slice(1):'';
}
function initialsForUser(user){
  const meta=user&&user.user_metadata||{};
  const name=(meta.display_name||meta.full_name||meta.name||user?.email?.split('@')[0]||'').trim();
  const parts=name.split(/\s+/).filter(Boolean);
  if(parts.length>=2)return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  return (name.slice(0,2)||'U').toUpperCase();
}
function syncProfileNav(){
  const authenticated=hasAuthenticatedProfile();
  const user=getStoredSessionUser();
  const avatarUrl=user?.user_metadata?.avatar_url||user?.user_metadata?.picture||'';
  els('[data-profile-menu]').forEach(node=>{
    if(authenticated){
      node.className='profile-menu'; node.href='dashboard.html'; node.removeAttribute('aria-disabled'); node.title='Open My Career';
      node.innerHTML=avatarUrl?`<span class="profile-avatar"><img src="${avatarUrl}" alt=""></span>`:`<span class="profile-avatar">${initialsForUser(user)}</span>`;
    }else{
      node.className='profile-menu guest'; node.href='javascript:void(0)'; node.setAttribute('aria-disabled','true'); node.title='Sign in or create a free profile to unlock your Career Diya workspace'; node.innerHTML='<span class="profile-avatar">?</span>';
    }
  });
  els('.nav-cta:not([data-sign-out])').forEach(node=>{
    if(authenticated){
      const replacement=document.createElement('a'); replacement.className='profile-menu'; replacement.href='dashboard.html'; replacement.title='Open My Career'; replacement.innerHTML=avatarUrl?`<span class="profile-avatar"><img src="${avatarUrl}" alt=""></span>`:`<span class="profile-avatar">${initialsForUser(user)}</span>`;
      node.replaceWith(replacement);
    }else{
      node.className='profile-menu guest'; node.href='javascript:void(0)'; node.setAttribute('aria-disabled','true'); node.removeAttribute('data-sign-out'); node.title='Sign in or create a free profile to unlock your Career Diya workspace'; node.innerHTML='<span class="profile-avatar">?</span>';
    }
  });
  const signedIn=isSignedInAccount();
  els('[data-logged-out-hidden]').forEach(x=>x.classList.toggle('hidden',!authenticated));
  els('[data-logged-in-only]').forEach(x=>x.classList.toggle('hidden',!signedIn));
  els('[data-logged-out-only]').forEach(x=>x.classList.toggle('hidden',signedIn));
  // A grey "?" circle that does nothing is noise next to "Sign in"; guests see only the link.
  els('.profile-menu.guest').forEach(x=>x.classList.add('hidden'));
  els('.navlinks').forEach(nav=>{
    let link=nav.querySelector('[data-nav-my-career]');
    if(signedIn && !link){
      link=document.createElement('a'); link.href='dashboard.html'; link.dataset.navMyCareer=''; link.textContent='My Career';
      if(/dashboard\.html$/.test(location.pathname)) link.setAttribute('aria-current','page');
      nav.appendChild(link);
    }else if(!signedIn && link){ link.remove(); }
  });
  els('[data-auth-login]').forEach(node=>{
    if(authenticated){
      node.className='nav-signin hidden';
      node.setAttribute('aria-hidden','true');
    }else{
      node.className='nav-signin';
      node.href='auth.html?return=dashboard';
      node.removeAttribute('aria-hidden');
    }
  });
}
function escText(v){return String(v==null?'':v).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
// Home page: a signed-in person continues where they left off; a visitor gets the pitch.
// The switch is decided synchronously from the stored session so the page does not flash.
function syncHomeHero(){
  const guestHero=el('[data-hero-guest]'), memberHero=el('[data-hero-member]');
  if(!guestHero||!memberHero)return;
  const auth=window.CareerDiyaProfileAuth;
  const signedIn=isSignedInAccount();
  guestHero.classList.toggle('hidden',signedIn);
  memberHero.classList.toggle('hidden',!signedIn);
  if(!signedIn){
    const resume=el('[data-hero-resume]');
    const local=getStoredProfile();
    if(resume) resume.classList.toggle('hidden',!(local&&local.answers));
    if(resume && hasAuthenticatedProfile() && auth?.getSavedExploration){
      auth.getSavedExploration().then(saved=>{ if(saved&&saved.answers) resume.classList.remove('hidden'); }).catch(()=>{});
    }
    return;
  }
  const user=getStoredSessionUser();
  const setName=profile=>{
    const first=firstNameFor(user,profile);
    els('[data-member-title]').forEach(x=>x.innerHTML=first?`Welcome back, <span class="gradient">${escText(first)}</span>.`:'Welcome back.');
  };
  const setExploration=saved=>{
    const top=saved?.result?.recommendations?.[0]?.name||saved?.result?.recs?.[0]?.name||'';
    const copy=el('[data-member-copy]'), primary=el('[data-member-primary]'), secondary=el('[data-member-secondary]');
    if(saved&&saved.answers){
      if(copy) copy.innerHTML=top?`Your latest exploration pointed to <b>${escText(top)}</b>. Your directions, saved careers and next steps are in My Career.`:'Your directions, saved careers and next steps are in My Career.';
      if(primary){primary.href='dashboard.html';primary.textContent='Open My Career';}
      if(secondary){secondary.href='explore.html?start=1';secondary.textContent='Start a new exploration';secondary.classList.remove('hidden');}
    }else{
      if(copy) copy.textContent='Start with a short exploration. It takes a few minutes and gives you a few directions worth looking at.';
      if(primary){primary.href='explore.html?start=1';primary.textContent='Start exploring →';}
      if(secondary) secondary.classList.add('hidden');
    }
  };
  setName(null);
  setExploration(getStoredProfile()?.answers?{answers:getStoredProfile().answers,result:getStoredProfile()}:null);
  if(auth?.getProfile){
    auth.getProfile().then(profile=>{
      setName(profile);
      if(profile?.display_name){ const i=initialsForUser({user_metadata:{display_name:profile.display_name}}); els('.profile-menu:not(.guest) .profile-avatar').forEach(x=>{ if(!x.querySelector('img')) x.textContent=i; }); }
      // The account decides which questions the cards show, not whatever this browser last picked.
      const a=String(profile?.audience||'').toLowerCase();
      if(AUDIENCE_DATA[a] && a!==getAudience()){ localStorage.setItem(AUDIENCE_KEY,a); syncAudience(a); }
    }).catch(()=>{});
  }
  if(auth?.getSavedExploration){ auth.getSavedExploration().then(saved=>{ if(saved) setExploration(saved); }).catch(()=>{}); }
}
function syncAssessmentCtas(){
  const d=assessmentDestination();
  els('[data-audience-assessment-cta]').forEach(x=>{x.href=d.href;x.textContent=d.label;});
  if(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated && window.CareerDiyaProfileAuth.isAuthenticated() && window.CareerDiyaProfileProfileAuth !== false && window.CareerDiyaProfileAuth.getSavedExploration){
    window.CareerDiyaProfileAuth.getSavedExploration().then(saved=>{
      const finalDest=(saved && saved.answers && saved.audience)
        ? {href:'explore.html?resume=1',label:'See my exploration'}
        : {href:'explore.html?start=1',label:'Jump straight to the questions'};
      els('[data-audience-assessment-cta]').forEach(x=>{x.href=finalDest.href;x.textContent=finalDest.label;});
    }).catch(()=>{});
  }
}

// No external assessment partner for now: every former partner destination stays on Career Diya.
const partner={home:'index.html',careerLab:'counselling.html#request',assessment:'counselling.html#request',reports:'counselling.html#request',library:'paths.html'};
const skills='https://skilldiya.netlify.app/';
const skillCourses='https://skilldiya.netlify.app/courses';
const el=(q,p=document)=>p.querySelector(q); const els=(q,p=document)=>[...p.querySelectorAll(q)];
function bind(){els('[data-href]').forEach(a=>a.addEventListener('click',()=>{window.location.href=a.dataset.href;}));
els('[data-external]').forEach(a=>a.addEventListener('click',()=>{window.location.href=partner[a.dataset.external]||a.href;}));
els('.audience-option').forEach(a=>a.addEventListener('click',()=>{setAudience(a.dataset.audience); const u=new URL(window.location.href); u.searchParams.set('audience',a.dataset.audience); history.replaceState({},'',u);}));
const clear=el('[data-audience-clear]'); if(clear)clear.addEventListener('click',clearAudience);
const change=el('[data-audience-change]'); if(change)change.addEventListener('click',()=>{const picker=el('#audiencePicker'); if(picker){picker.classList.remove('is-collapsed'); const sel=picker.querySelector('.audience-option.selected')||picker.querySelector('.audience-option'); if(sel)sel.focus();}});
syncAudience();
syncHomeHero();
syncAssessmentCtas();
syncProfileNav();
const explore=el('#exploreForm'); if(explore){explore.addEventListener('submit',e=>{e.preventDefault(); const intent=el('#intent').value; const target=el('#target').value; const role=el('#role').value; const q=new URLSearchParams({intent,target,role}); window.location.href=`explore.html?${q}`;});}
const careerSearch=el('#careerSearch'); if(careerSearch){const out=el('#careerResults'); const data=[['Data Scientist','analytics, experimentation, Python, ML','in-demand'],['Product Manager','product strategy, discovery, delivery','high-leverage'],['QA Automation Engineer','test engineering, Playwright, CI/CD','in-demand'],['HR Business Partner','people strategy, employee relations, business partnering','people'],['UX Designer','research, interaction design, prototyping','creative'],['Digital Marketing Specialist','content, growth, performance marketing','growth']]; function render(term=''){out.innerHTML=data.filter(x=>x.join(' ').toLowerCase().includes(term.toLowerCase())).map(x=>`<article class="career-card"><span class="tag">${x[2]}</span><h3>${x[0]}</h3><p>${x[1]}</p><div class="score"><b>Explore path</b><a class="btn btn-secondary" href="career.html?name=${encodeURIComponent(x[0])}">View</a></div></article>`).join('')||'<div class="notice">No matching paths yet. Try a broader term.</div>'; } render(); careerSearch.addEventListener('input',e=>render(e.target.value));}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();

function wireGlobalActions(){
  syncAssessmentCtas();
  syncProfileNav();
  const signOut=el('[data-sign-out]');
  if(signOut){
    signOut.addEventListener('click',async()=>{
      signOut.disabled=true;
      try{
        if(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.signOut){
          await window.CareerDiyaProfileAuth.signOut();
        } else {
          localStorage.removeItem('careerdiya_auth_session');
        }
      }catch(_){
        localStorage.removeItem('careerdiya_auth_session');
      }
      window.location.href='index.html';
    });
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wireGlobalActions);else wireGlobalActions();
