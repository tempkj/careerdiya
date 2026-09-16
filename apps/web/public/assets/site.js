const AUDIENCE_KEY='careerdiyaAudience';
const AUDIENCE_DATA={
  parent:{title:"Not sure which direction could fit your child? <span class='gradient'>Start with clarity.</span>",subhead:"Answer a few practical questions about your child’s stage, interests and strengths. We’ll surface directions that may be worth exploring — not a final verdict.",primary:"Explore My Child’s Direction →",primaryHref:'explore.html?audience=parent',assessment:"Explore My Assessment",assessmentHref:'https://careerdiya.edumilestones.com/career-lab/',note:"For parents helping a school-age child explore streams and directions.",exampleTitle:"Choose a direction with more confidence.",exampleCopy:"Start with your child’s stage, strengths and interests, then explore suitable streams and directions before committing to a path.",exampleCta:"Explore My Child’s Direction →",exploreTitle:"Explore Your Child’s Direction",exploreCopy:"Answer a few guided questions about your child’s stage, interests and strengths to identify directions worth exploring.",explorePageTitle:"Explore Your Child’s Direction Before Choosing A Stream.",explorePageSubhead:"Answer a few questions about your child’s stage, interests and strengths. We’ll suggest directions worth exploring — not a final verdict.",assessmentTitle:"Use A School-Stage Assessment When You Need More Evidence.",assessmentCopy:"For school-age choices, use the age-designed school-stage assessment rather than an adult interest inventory.",cardCopy:"Use the deeper school-stage assessment when you want a fuller, age-designed assessment/report journey.",choice1:"Your child’s stage, strengths and interests",choice2:"Interests, strengths and preferences",choice3:"Streams and directions worth exploring",choice4:"Schools, courses and support"},
  student:{title:"Not sure what direction is right for you? <span class='gradient'>Start with clarity.</span>",subhead:"Explore your interests, strengths and possible paths so you can make a better decision about what to study and where you want to go next.",primary:"Explore My Direction →",primaryHref:'explore.html?audience=student',assessment:"Explore My Assessment",assessmentHref:'assessment.html?audience=student',note:"For late-school and college students aged 16+ figuring out what comes next.",exampleTitle:"Figure out what to explore next.",exampleCopy:"Compare possible directions, identify what interests you and build evidence before committing to a course or career path.",exampleCta:"Explore My Direction →",exploreTitle:"Explore Your Next Direction",exploreCopy:"Answer a few guided questions about your study stage, interests, strengths and goals to get a starting direction.",explorePageTitle:"Explore Your Direction Before Committing To A Field.",explorePageSubhead:"Answer a few questions. We’ll suggest directions worth exploring and a practical next step for your study or early-career decisions.",assessmentTitle:"Use Assessment When You Need More Confidence.",assessmentCopy:"For late-school and college students aged 16+, the Career Diya assessment path can provide deeper evidence for a direction.",cardCopy:"Use the deeper Career Diya assessment path when you want a fuller assessment/report journey.",choice1:"Your stage, interests and direction",choice2:"Subjects, strengths and preferences",choice3:"Fields and paths worth exploring",choice4:"Courses, colleges and support"},
  professional:{title:"Not sure what to do next? <span class='gradient'>Start with clarity.</span>",subhead:"Understand where you are, explore where you could go, and find a practical next step before committing more time, money or effort to the wrong path.",primary:"Explore My Career →",primaryHref:'explore.html?audience=professional',assessment:"Explore My Assessment",assessmentHref:'assessment.html?audience=professional',note:"For graduates and professionals considering growth, change, a switch or a new direction.",exampleTitle:"Make your next career move with more evidence.",exampleCopy:"Explore realistic paths, compare the skills involved and test a direction before making a high-stakes move.",exampleCta:"Explore My Career →",exploreTitle:"Explore Your Next Career Move",exploreCopy:"Answer seven quick questions to get a starting direction and a practical next step for growth, switching or a new career move.",explorePageTitle:"Get A Starting Direction Before You Commit.",explorePageSubhead:"Answer a few questions. We will suggest career directions, explain what to test next, and connect the learning step to Skill Diya.",assessmentTitle:"Use Assessment When You Need More Confidence.",assessmentCopy:"For graduates and professionals, the Career Diya assessment path can provide deeper evidence alongside exploration and guidance.",cardCopy:"Use the deeper Career Diya assessment path when you want a fuller assessment/report journey.",choice1:"Your stage, experience and direction",choice2:"Interests, strengths and preferences",choice3:"Career paths worth exploring",choice4:"Skills, courses and support"}
};
const DEFAULT_AUDIENCE={title:"Not sure what’s next? <span class='gradient'>A few minutes could give you a direction worth exploring.</span>",subhead:"Explore your interests, strengths and situation to find career directions worth considering — whether you’re figuring things out for yourself or helping your child choose a path.",primary:"Start Exploring →",primaryHref:'explore.html',assessment:"Explore My Assessment",assessmentHref:'assessment.html',note:"For students, professionals and parents helping a child choose a path.",exampleTitle:"Start with the question closest to you.",exampleCopy:"Career Diya can help you or your child explore a suitable direction before making a bigger decision.",exampleCta:"Start Exploring →",exploreTitle:"Start With A Guided Career Exploration.",exploreCopy:"Answer seven quick questions to get a starting direction and a practical next step.",explorePageTitle:"Get A Starting Direction Before You Commit.",explorePageSubhead:"Answer a few questions. We will suggest directions worth exploring and explain what to test next.",assessmentTitle:"Use Assessment When You Need More Confidence.",assessmentCopy:"Start with a lightweight decision journey. Use a deeper assessment when a formal assessment is the better next step.",cardCopy:"Use the deeper Career Diya assessment path when you want a fuller assessment/report journey.",choice1:"Your stage, strengths and interests",choice2:"Interests, strengths and preferences",choice3:"Paths worth exploring",choice4:"Courses and support"};
const AUDIENCE_INTENTS={
  neutral:[
    ['choice','I Don’t Know Which Career To Choose','Explore options based on your interests, strengths and situation.'],
    ['stuck','I Feel Stuck In My Career','Understand what is blocking progress and which directions are realistic.'],
    ['switch','I Am Thinking About A Career Switch','See transition routes, skill gaps and learning options.'],
    ['growth','I Want To Grow Where I Am','Map the skills and moves that can accelerate your current path.'],
    ['learning','I Am Not Sure Which Course To Take','Validate the direction before committing to a programme.'],
    ['guidance','I Want To Talk To Someone','Connect with career guidance when self-exploration is not enough.']
  ],
  parent:[
    ['child-direction','I Don’t Know Which Direction Fits My Child','Explore possible directions using your child’s stage, interests and strengths.'],
    ['stream','Which Subjects Or Streams Should We Explore?','Compare broad directions before committing to a stream or subject choice.'],
    ['compare','We’re Choosing Between A Few Paths','Put possible options side by side and see what may be worth exploring.'],
    ['strengths','I Want To Understand My Child’s Strengths','Use a guided exploration to organise observations without turning them into a verdict.'],
    ['next-stage','What Should We Explore After 10th Or 12th?','Look at possible directions before narrowing the next educational step.'],
    ['guidance','I Want To Talk To Someone','Connect with career guidance when the decision needs a conversation.']
  ],
  student:[
    ['choice','I Don’t Know Which Field To Choose','Explore options based on your interests, strengths and situation.'],
    ['study','I’m Not Sure What To Study','Compare fields and directions before committing to a course.'],
    ['compare','I Want To Compare A Few Directions','Build a shortlist and explore what each direction could involve.'],
    ['fit','I Want To Understand What Fits Me','Use a guided exploration to organise your interests and strengths.'],
    ['learning','I’m Unsure Which Course To Take','Validate the career direction before choosing a programme.'],
    ['guidance','I Want To Talk To Someone','Connect with career guidance when self-exploration is not enough.']
  ],
  professional:[
    ['choice','I Don’t Know Which Career Direction To Choose','Explore realistic options based on your strengths, interests and situation.'],
    ['stuck','I Feel Stuck In My Career','Understand what is blocking progress and which directions are realistic.'],
    ['switch','I Am Thinking About A Career Switch','See transition routes, skill gaps and ways to test a move.'],
    ['growth','I Want To Grow Where I Am','Map the skills and moves that can accelerate your current path.'],
    ['learning','I Am Not Sure Which Course To Take','Validate the direction before committing to another programme.'],
    ['guidance','I Want To Talk To Someone','Connect with career guidance when the decision needs a conversation.']
  ]
};

function getAudience(){const p=new URLSearchParams(window.location.search).get('audience'); if(p&&AUDIENCE_DATA[p]){localStorage.setItem(AUDIENCE_KEY,p); return p;} const saved=localStorage.getItem(AUDIENCE_KEY); return AUDIENCE_DATA[saved]?saved:null;}
function setAudience(a){
  if(!AUDIENCE_DATA[a]) return;
  localStorage.setItem(AUDIENCE_KEY,a);
  syncAudience(a);
  try{
    const auth=window.CareerDiyaProfileAuth;
    if(auth && typeof auth.isAuthenticated==='function' && auth.isAuthenticated() && typeof auth.setAudience==='function'){
      auth.setAudience(a).catch(err=>console.warn('Career Diya audience profile update failed:',err));
    }
  }catch(err){ console.warn('Career Diya audience profile update unavailable:',err); }
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
    return `<a class="intent" href="${u.pathname}${u.search}"><div class="num">${String(i+1).padStart(2,'0')}</div><h3>${title}</h3><p>${copy}</p></a>`;
  }).join('');
}
function syncAudience(a=getAudience()){const d=a?AUDIENCE_DATA[a]:DEFAULT_AUDIENCE; document.documentElement.dataset.audience=a||'neutral'; renderAudienceIntents(a); els('[data-path-action],[data-path-step]').forEach(x=>{const type=x.dataset.pathAction||x.dataset.pathStep; const target=(type==='decide'||type==='assessment')?'assessment.html':(type==='next'||type==='act'?'paths.html':'explore.html'); const u=new URL(target,window.location.href); if(a)u.searchParams.set('audience',a); x.href=u.pathname+(u.searchParams.toString()?`?${u.searchParams}`:'');}); els('[data-audience-hero-title]').forEach(x=>x.innerHTML=d.title); els('[data-audience-hero-subhead]').forEach(x=>x.textContent=d.subhead); els('[data-audience-hero-note]').forEach(x=>x.textContent=d.note); els('[data-audience-primary-cta]').forEach(x=>{x.href=d.primaryHref;x.textContent=d.primary;}); els('[data-audience-assessment-cta]').forEach(x=>{x.href=d.assessmentHref;x.textContent=d.assessment;}); els('[data-audience-example-title]').forEach(x=>x.textContent=d.exampleTitle); els('[data-audience-example-copy]').forEach(x=>x.textContent=d.exampleCopy); els('[data-audience-example-cta]').forEach(x=>{x.href=d.primaryHref;x.textContent=d.exampleCta;}); els('[data-audience-explore-title]').forEach(x=>x.textContent=d.exploreTitle); els('[data-audience-explore-copy]').forEach(x=>x.textContent=d.exploreCopy); els('[data-audience-explore-page-title]').forEach(x=>x.textContent=d.explorePageTitle); els('[data-audience-explore-page-subhead]').forEach(x=>x.textContent=d.explorePageSubhead); els('[data-audience-assessment-title]').forEach(x=>x.textContent=d.assessmentTitle); els('[data-audience-assessment-copy]').forEach(x=>x.textContent=d.assessmentCopy); els('[data-audience-assessment-card-copy]').forEach(x=>x.textContent=d.cardCopy); els('[data-audience-choice-1]').forEach(x=>x.textContent=d.choice1); els('[data-audience-choice-2]').forEach(x=>x.textContent=d.choice2); els('[data-audience-choice-3]').forEach(x=>x.textContent=d.choice3); els('[data-audience-choice-4]').forEach(x=>x.textContent=d.choice4); els('[data-audience-external-assessment]').forEach(x=>{if(a==='parent'){x.href='https://careerdiya.edumilestones.com/career-lab/';} else if(a==='student'||a==='professional'){x.href='assessment.html?audience='+a;} else {x.href='https://careerdiya.edumilestones.com/career-lab/';}}); els('a[href="assessment.html"]').forEach(x=>{if(a==='parent')x.href='assessment.html?audience=parent'; else if(a==='student')x.href='assessment.html?audience=student'; else if(a==='professional')x.href='assessment.html?audience=professional';}); els('.audience-option').forEach(x=>{const selected=x.dataset.audience===a; x.classList.toggle('selected',selected); x.setAttribute('aria-pressed',String(selected));}); const c=el('[data-audience-clear]'); if(c)c.style.visibility=a?'visible':'hidden';}
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
  if(authenticated && profile && profile.answers){return {href:'explore.html?resume=1',label:'Explore My Assessment'};}
  if(authenticated){return {href:'explore.html?start=1',label:'Start Exploration'};}
  return {href:'explore.html?start=1',label:'Start Exploration'};
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
  els('[data-logged-out-hidden]').forEach(x=>x.classList.toggle('hidden',!authenticated));
  els('[data-logged-in-only]').forEach(x=>x.classList.toggle('hidden',!authenticated));
}
function syncAssessmentCtas(){
  const d=assessmentDestination();
  els('[data-audience-assessment-cta]').forEach(x=>{x.href=d.href;x.textContent=d.label;});
  if(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated && window.CareerDiyaProfileAuth.isAuthenticated() && window.CareerDiyaProfileProfileAuth !== false && window.CareerDiyaProfileAuth.getSavedExploration){
    window.CareerDiyaProfileAuth.getSavedExploration().then(saved=>{
      const finalDest=(saved && saved.answers && saved.audience)
        ? {href:'explore.html?resume=1',label:'Explore My Assessment'}
        : {href:'explore.html?start=1',label:'Start Exploration'};
      els('[data-audience-assessment-cta]').forEach(x=>{x.href=finalDest.href;x.textContent=finalDest.label;});
    }).catch(()=>{});
  }
}

const partner={home:'https://careerdiya.edumilestones.com/',careerLab:'https://careerdiya.edumilestones.com/career-lab/',assessment:'https://careerdiya.edumilestones.com/login/career-lab/',reports:'https://careerdiya.edumilestones.com/career-lab/reports',library:'https://careerdiya.edumilestones.com/global-career-library/'};
const skills='https://skilldiya.netlify.app/';
const skillCourses='https://skilldiya.netlify.app/courses';
const el=(q,p=document)=>p.querySelector(q); const els=(q,p=document)=>[...p.querySelectorAll(q)];
function bind(){els('[data-href]').forEach(a=>a.addEventListener('click',()=>{window.location.href=a.dataset.href;}));
els('[data-external]').forEach(a=>a.addEventListener('click',()=>{window.location.href=partner[a.dataset.external]||a.href;}));
els('.audience-option').forEach(a=>a.addEventListener('click',()=>{setAudience(a.dataset.audience); const u=new URL(window.location.href); u.searchParams.set('audience',a.dataset.audience); history.replaceState({},'',u);}));
const clear=el('[data-audience-clear]'); if(clear)clear.addEventListener('click',clearAudience);
syncAudience();
const u=getStoredSessionUser(); if(u){ els('[data-user-name]').forEach(x=>x.textContent=((u.user_metadata||{}).display_name||u.email||'there').split('@')[0]); }
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
