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
function escHtml(s){return String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}

function skillPlan(direction,answers){
  const mode=answers.learning;
  const top=direction.skills.slice(0,3);
  const plan=mode==='mentor'?'mentor-led practice + feedback':mode==='project'?'a small project + guided practice':mode==='self'?'structured self-exploration + a small project':'a structured learning path + hands-on practice';
  return {top,plan};
}

function renderWizard(root, currentRole = null){
  let step=0;const answers={};const audience=currentAudience();const activeQuestions=questionsForAudience(audience);const total=activeQuestions.length;
  function draw(){
    const q=activeQuestions[step];
    const eyebrow=audience==='parent'?'Free direction exploration · parent view':audience==='student'?'Free direction exploration · 16+':'Free career exploration';
    root.innerHTML=`<div class="wizard-head"><div class="eyebrow">${eyebrow}</div><div class="wizard-progress"><span style="width:${((step+1)/total)*100}%"></span></div><div class="wizard-count">Question ${step+1} of ${total}</div><h2>${q.title}</h2><p>${q.subtitle}</p></div><div class="wizard-options">${q.options.map(([v,l])=>`<button class="wizard-option ${answers[q.id]===v?'selected':''}" data-value="${v}"><span class="radio-dot"></span><span>${l}</span></button>`).join('')}</div><div class="wizard-footer"><button class="btn btn-secondary" id="back" ${step===0?'disabled':''}>Back</button><button class="btn btn-primary" id="next" ${answers[q.id]?'':'disabled'}>${step===total-1?'See my directions':'Continue →'}</button></div>`;
    elsLocal('.wizard-option',root).forEach(b=>b.addEventListener('click',()=>{answers[q.id]=b.dataset.value;draw();}));
    root.querySelector('#back').addEventListener('click',()=>{if(step>0){step--;draw();}});
    root.querySelector('#next').addEventListener('click',()=>{
      if(!answers[q.id])return;
      if(step<total-1){step++;draw();return;}
      // ADR-CAREERDIY-0016: professional + GROW + a bounded from-role gets a contextual
      // to-role interstitial after the wizard, before results — mounted here rather than
      // as a conditional mid-wizard question because `total` above is a const captured
      // once at wizard start, not re-evaluated per step.
      const growToRoleEligible = audience==='professional' && answers.intent==='growth' && currentRole && typeof isBoundedRoleValue==='function' && isBoundedRoleValue(currentRole);
      if(growToRoleEligible) renderToRoleStep(root,answers,audience,currentRole);
      else gateBeforeResults(root,answers,audience,currentRole);
    });
  }
  draw();
}

// ADR-CAREERDIY-0016: to-role candidate pool for professional + GROW — the SAME pool
// eligibleFamiliesForIntent (decision-data.js) already treats as GROW-eligible: the
// from-role's own family plus its adjacent families. Pure reuse, zero new data; this is
// a read of already-shipped, already-trusted-for-this-purpose data, not a new taxonomy.
function buildToRoleGroups(currentRole){
  const family = typeof roleFamilyForRole==='function' ? roleFamilyForRole(currentRole) : null;
  if(!family || !STARTER_ROLE_FAMILIES[family]) return null;
  const info = STARTER_ROLE_FAMILIES[family];
  const familyIds = [family, ...(info.adjacent||[])];
  const seen = new Set([normalizeRoleText(currentRole)]);
  const groups = [];
  familyIds.forEach(fid=>{
    const fam = STARTER_ROLE_FAMILIES[fid];
    if(!fam) return;
    const options = [];
    fam.aliases.forEach(alias=>{
      const norm = normalizeRoleText(alias);
      if(seen.has(norm)) return;
      seen.add(norm);
      options.push(titleCaseRole(alias));
    });
    if(options.length) groups.push({label:fam.label, options});
  });
  return groups.length ? {fromFamilyLabel:info.label, groups} : null;
}

// Mounted AFTER the wizard finishes (renderWizard's completion branch above), not as a
// conditional mid-wizard question — see the comment at that call site. "None of these" is
// a modest escape hatch (btn-secondary, same visual weight as e.g. the wizard's Back
// button) straight into the existing, unchanged gateBeforeResults/renderResults flow —
// deliberately not a distinct destination. No LLM anywhere on this path.
function renderToRoleStep(root,answers,audience,currentRole){
  const pool = buildToRoleGroups(currentRole);
  if(!pool){
    // Defensive: a bounded role should always resolve to a family with at least one
    // other alias somewhere in its adjacent set. If it somehow doesn't, never a dead end
    // — proceed exactly as if this step didn't exist.
    gateBeforeResults(root,answers,audience,currentRole);
    return;
  }

  const optgroups = pool.groups.map(g=>`<optgroup label="${escHtml(g.label)}">${g.options.map(o=>`<option value="${escHtml(o)}">${escHtml(o)}</option>`).join('')}</optgroup>`).join('');
  root.innerHTML = `<div class="profile-context-card">
    <div class="eyebrow">Growing from ${escHtml(currentRole)}</div>
    <h2>Which of these are you growing toward?</h2>
    <p class="profile-context-lead">These are roles within ${escHtml(pool.fromFamilyLabel)} and closely related areas — the same set we use to keep your result on-topic. Picking one just adds context to your result; it doesn't change how it's scored.</p>
    <label class="profile-context-label" for="targetRoleCapture">Target role</label>
    <select class="input" id="targetRoleCapture"><option value="">Select a target role…</option>${optgroups}</select>
    <div class="wizard-footer">
      <button class="btn btn-secondary" id="skipTargetRole">None of these — show my broad direction</button>
      <button class="btn btn-primary" id="continueTargetRole">Continue →</button>
    </div>
  </div>`;

  root.querySelector('#skipTargetRole').addEventListener('click',()=>{
    gateBeforeResults(root,answers,audience,currentRole,null);
  });
  root.querySelector('#continueTargetRole').addEventListener('click',()=>{
    const value = root.querySelector('#targetRoleCapture').value.trim();
    gateBeforeResults(root,answers,audience,currentRole,value||null);
  });
}

// ADR-CAREERDIY-0015: bounded (dropdown) role capture, seeded from the same curated
// role-family aliases ADR-CD-001's routing already uses (buildRoleDropdownGroups,
// decision-data.js), plus an "Other (type it)" free-text escape. A bounded selection is
// what makes a result eligible for LLM enrichment later in renderResults — see
// isBoundedRoleValue (decision-data.js), re-checked there rather than threaded through
// as a separate flag, so resume/reload paths get the same answer for free.
const OTHER_ROLE_VALUE='__other__';

function buildRoleOptionsHtml(selectedValue){
  const groups=typeof buildRoleDropdownGroups==='function'?buildRoleDropdownGroups():[];
  const optgroups=groups.map(g=>`<optgroup label="${escHtml(g.label)}">${g.options.map(o=>`<option value="${escHtml(o)}" ${o===selectedValue?'selected':''}>${escHtml(o)}</option>`).join('')}</optgroup>`).join('');
  return `<option value="">Select your current or most recent role…</option>${optgroups}<option value="${OTHER_ROLE_VALUE}" ${selectedValue===OTHER_ROLE_VALUE?'selected':''}>Other (type it)</option>`;
}

function renderCurrentRoleStep(root, audience, onContinue){
  if(audience!=='professional'){
    onContinue(null);
    return;
  }

  let initialRole='';
  try {
    const saved=JSON.parse(localStorage.getItem('careerdiya_profile_details')||'null');
    initialRole=(saved?.current_role_title || saved?.current_role_other || saved?.current_role || '').trim();
  } catch(_){}
  if(!initialRole && window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated() && window.CareerDiyaProfileAuth.getProfile){
    window.CareerDiyaProfileAuth.getProfile().then(profile=>{
      const role=(profile?.current_role_title || profile?.current_role_other || profile?.current_role || '').trim();
      if(role){
        initialRole=role;
        draw(role,false);
      }
    }).catch(()=>{});
  }

  const draw=(role, fresher)=>{
    const isBounded=role && typeof isBoundedRoleValue==='function' && isBoundedRoleValue(role);
    const selectValue=role?(isBounded?role:OTHER_ROLE_VALUE):'';
    const otherValue=role&&!isBounded?role:'';
    root.innerHTML=`<div class="profile-context-card">
      <div class="eyebrow">Before we start</div>
      <h2>What is your current or most recent role?</h2>
      <p class="profile-context-lead">This gives us a starting point when you later explore a different career. It is not part of your assessment score.</p>
      <label class="profile-context-label" for="currentRoleCapture">Current / most recent role</label>
      <select class="input" id="currentRoleCapture" ${fresher?'disabled':''}>${buildRoleOptionsHtml(selectValue)}</select>
      <input class="input" id="currentRoleOther" type="text" value="${escHtml(otherValue)}" placeholder="Type your role" autocomplete="organization-title" ${fresher?'disabled':''} ${selectValue===OTHER_ROLE_VALUE?'':'hidden'}>
      <label class="profile-context-fresher"><input type="checkbox" id="currentRoleFresher" ${fresher?'checked':''}> I’m a fresher / I haven’t worked yet</label>
      <p class="profile-context-status" role="status" aria-live="polite"></p>
      <div class="wizard-footer">
        <span></span>
        <button class="btn btn-primary" id="continueRole">Continue →</button>
      </div>
    </div>`;

    const select=root.querySelector('#currentRoleCapture');
    const other=root.querySelector('#currentRoleOther');
    const check=root.querySelector('#currentRoleFresher');
    const status=root.querySelector('.profile-context-status');

    select.addEventListener('change',()=>{
      other.hidden=select.value!==OTHER_ROLE_VALUE;
      if(select.value===OTHER_ROLE_VALUE) other.focus();
    });
    check.addEventListener('change',()=>{
      select.disabled=check.checked;
      other.disabled=check.checked;
      if(check.checked){ select.value=''; other.value=''; other.hidden=true; }
      else select.focus();
    });
    root.querySelector('#continueRole').addEventListener('click',()=>{
      if(check.checked){
        onContinue(null);
        return;
      }
      const value=select.value===OTHER_ROLE_VALUE?other.value.trim():select.value;
      if(!value){
        status.textContent='Select your role, type it under "Other", or choose the fresher option.';
        status.className='profile-context-status err';
        (select.value===OTHER_ROLE_VALUE?other:select).focus();
        return;
      }
      // Fix B (state-contamination): this value is threaded through as a function
      // argument the whole way (renderWizard -> renderToRoleStep/gateBeforeResults ->
      // renderResults) — it is NOT persisted to a global localStorage key anymore. A
      // global 'careerdiya_current_role' key used to exist here and was read as a
      // fallback by renderResults/openCareerAsana/career.html whenever their own
      // currentRole argument was falsy — which leaked a professional's role into
      // parent/student explorations and the CareerAsana handoff in the same browser,
      // since the key was never scoped per audience/exploration or cleared. Removed
      // entirely rather than patched with a clear-on-new-exploration reset, which would
      // not have closed the concurrent-tab/OAuth-redirect variant of the same leak.
      onContinue(value);
    });
  };
  draw(initialRole, false);
}

// ── ADR-CAREERDIY-0016: student co-primary entry ──────────────────────────────────
//
// "Explore careers from your stream" and "See what actually fits you" (the unmodified
// 7-question wizard) are CO-PRIMARY — same button class, same visual weight, wired in
// initDecisionEngine's start-screen click handler. Neither demotes the other. A student
// who picks the stream lens still gets an always-visible "beyond my field" option on the
// results screen below, into the exact same preference wizard.

const STREAM_NOT_LISTED_VALUE='__stream_not_listed__';

// Non-removable per ADR-CAREERDIY-0016: injected into the template unconditionally,
// before the guide fetch even starts, and never touched by fetch success/failure — the
// model's own output has no way to omit or alter this text because it is never sourced
// from the model at all.
const GUIDE_DISCLAIMER_HTML = `<div class="notice guide-disclaimer"><b>These are general starting points, not a personalised read.</b> For a direction matched to you specifically, <a href="explore.html?audience=student&amp;start=1">run the free explorer →</a> or <a href="counselling.html">talk to a counsellor →</a>.</div>`;

// First question of the stream lens: which tier of the dataset applies. Reuses
// STUDENT_QUESTIONS' own 'stage' question verbatim (same options, same copy) rather than
// re-authoring a parallel one — one source of truth for "where are you right now."
// Pure markup builder — directly testable without a DOM. Both buttons share the exact
// same class list (btn btn-primary entry-choice-btn): "equal prominence" is a structural
// property of this markup, not a claim that depends on separately-authored CSS.
function buildStudentEntryChoiceHtml(startCopy){
  return `<div class="engine-start"><div class="eyebrow">${startCopy.eyebrow}</div><h2>${startCopy.title}</h2><p>${startCopy.copy}</p><div class="engine-benefits">${startCopy.benefits.map(x=>`<span>${x}</span>`).join('')}</div><div class="entry-choice-grid"><button class="btn btn-primary entry-choice-btn" id="startStreamPath"><span class="entry-choice-title">Explore careers from your stream →</span><span class="entry-choice-sub">Fast and concrete — based on your current stream or major</span></button><button class="btn btn-primary entry-choice-btn" id="startPreferencePath"><span class="entry-choice-title">See what actually fits you →</span><span class="entry-choice-sub">7 quick questions — a personalised read, not just your major</span></button></div></div>`;
}

function renderStudentStageStep(root){
  const stageQuestion = STUDENT_QUESTIONS.find(q=>q.id==='stage');
  root.innerHTML=`<div class="wizard-head"><div class="eyebrow">Explore careers from your stream</div><h2>${stageQuestion.title}</h2><p>${stageQuestion.subtitle}</p></div><div class="wizard-options">${stageQuestion.options.map(([v,l])=>`<button class="wizard-option" data-value="${v}"><span class="radio-dot"></span><span>${l}</span></button>`).join('')}</div>`;
  elsLocal('.wizard-option',root).forEach(b=>b.addEventListener('click',()=>{
    const tier = b.dataset.value==='late_school' ? 'school_stream' : 'ug_major';
    renderStudentStreamDropdown(root,tier);
  }));
}

// Pure, DOM-free decision logic — directly testable without a browser. Given a tier and
// the selected dropdown value, decides whether to show deterministic stream results or
// fall through to the edge guide. Never returns something that would produce a blank
// screen: an unmapped key AND a known-but-content-empty key both route to 'edge', exactly
// like an explicit "not listed" pick (ADR-CAREERDIY-0016).
function resolveStreamSelection(tier,value){
  if(!value) return null;
  if(value===STREAM_NOT_LISTED_VALUE) return {kind:'edge', label:''};
  const entry = typeof streamCareersFor==='function' ? streamCareersFor(tier,value) : null;
  if(!entry || !entry.careerIds || !entry.careerIds.length) return {kind:'edge', label: entry ? entry.label : ''};
  return {kind:'results', entry};
}

function renderStudentStreamDropdown(root,tier){
  const options = typeof streamOptionsFor==='function' ? streamOptionsFor(tier) : null;
  const tierLabel = tier==='school_stream' ? 'stream' : 'major';
  const optionsHtml = (options||[]).map(o=>`<option value="${escHtml(o.key)}">${escHtml(o.label)}</option>`).join('');
  root.innerHTML=`<div class="profile-context-card">
    <div class="eyebrow">Explore careers from your ${tierLabel}</div>
    <h2>What's your ${tierLabel}?</h2>
    <p class="profile-context-lead">We'll show you careers that commonly follow from it. This is a starting signal, not a destiny — "Explore paths beyond my field" is always there on the next screen if you want it.</p>
    <label class="profile-context-label" for="streamCapture">Your ${tierLabel}</label>
    <select class="input" id="streamCapture">
      <option value="">Select your ${tierLabel}…</option>
      ${optionsHtml}
      <option value="${STREAM_NOT_LISTED_VALUE}">My ${tierLabel} isn't listed</option>
    </select>
    <div class="wizard-footer">
      <span></span>
      <button class="btn btn-primary" id="continueStream">Continue →</button>
    </div>
  </div>`;

  root.querySelector('#continueStream').addEventListener('click',()=>{
    const value=root.querySelector('#streamCapture').value;
    // "Not listed" gets one extra step to capture WHAT they actually study, so the edge
    // guide isn't handed the bare "unspecified stream/major" fallback — see
    // renderStreamNotListedCapture. Every other value (including an unmapped/stub key)
    // still goes straight through the unchanged resolveStreamSelection routing.
    if(value===STREAM_NOT_LISTED_VALUE){
      renderStreamNotListedCapture(root,tier);
      return;
    }
    const resolution=resolveStreamSelection(tier,value);
    if(!resolution) return;
    if(resolution.kind==='edge') renderStreamEdgeGuide(root,resolution.label,tier);
    else renderStreamResults(root,resolution.entry,tier);
  });
}

// Free-text capture for "not listed" only (ADR-CAREERDIY-0016 follow-up). Optional — a
// blank submission keeps renderStreamEdgeGuide's existing `streamOrRoleLabel ||
// 'unspecified ${tierLabel}'` fallback exactly as before; nothing here changes that path.
// The typed value is sent to the server AS-IS (untrimmed of nothing beyond whitespace);
// normalization (lowercase/trim/collapse) and the "treat as data, not instructions"
// guarantee both live server-side (computeGuideCacheKeyHash's normalizeRoleText, and the
// <student_field_of_study>-delimited, explicitly-data-not-instruction prompt in guide.ts)
// — this step only collects the text, it doesn't re-implement either guarantee client-side.
// Pure, DOM-free — directly testable. '' (or whitespace-only) means "skip", which
// renderStreamEdgeGuide's existing `streamOrRoleLabel || 'unspecified ...'` fallback
// already handles unchanged; a non-blank value is trimmed and passed through as-is
// (normalization and the data-not-instruction handling both live server-side).
function resolveNotListedFieldOfStudy(typedValue){
  return String(typedValue||'').trim();
}

function renderStreamNotListedCapture(root,tier){
  const tierLabel = tier==='school_stream' ? 'stream' : 'major/course';
  root.innerHTML=`<div class="profile-context-card">
    <div class="eyebrow">Tell us a bit more</div>
    <h2>What are you studying?</h2>
    <p class="profile-context-lead">This helps point the broad territories below toward something actually relevant to you. Optional — leave it blank to skip.</p>
    <label class="profile-context-label" for="notListedStreamInput">Your ${tierLabel}</label>
    <input class="input" id="notListedStreamInput" type="text" maxlength="120" placeholder="e.g. Forestry, Linguistics, Ancient History">
    <div class="wizard-footer">
      <span></span>
      <button class="btn btn-primary" id="continueNotListedStream">Continue →</button>
    </div>
  </div>`;

  root.querySelector('#continueNotListedStream').addEventListener('click',()=>{
    const typed=resolveNotListedFieldOfStudy(root.querySelector('#notListedStreamInput').value);
    renderStreamEdgeGuide(root,typed,tier);
  });
}

// Pure markup builder — directly testable without a DOM. The "beyond my field" action is
// always present here regardless of how many careers resolved (ADR-CAREERDIY-0016:
// co-primary, always-visible, never a buried escape hatch).
function buildStreamResultsHtml(entry,tier){
  const tierLabel = tier==='school_stream' ? 'stream' : 'major';
  const cards = entry.careerIds.map(id=>{
    const career = typeof canonicalCareerById==='function' ? canonicalCareerById(id) : null;
    const name = career ? career.canonicalName : id;
    const verified = !!(career && career.canonicalStatus==='verified');
    return verified
      ? `<a class="mini-result" href="career.html?direction=${encodeURIComponent(career.id)}&audience=student"><strong>${escHtml(name)}</strong><span>Explore →</span></a>`
      : `<div class="mini-result disabled" aria-disabled="true"><strong>${escHtml(name)}</strong><span>Career options being mapped</span></div>`;
  }).join('');

  return `<div class="results-wrap">
    <div class="eyebrow">Careers from ${escHtml(entry.label)}</div>
    <h2>Careers that commonly follow from ${escHtml(entry.label)}</h2>
    <p class="results-lead">This is a starting signal based on your ${tierLabel} — not a personalised read, and not a destiny.</p>
    <div class="result-panel"><span class="tag">Stream-relevant careers</span>${cards}</div>
    <div class="result-panel next-step">
      <span class="tag">Want the personalised read?</span>
      <h3>Explore paths beyond my field →</h3>
      <p>Your ${tierLabel} is a starting point, not your only option. The 7-question path looks at how you actually think and work, not just what you studied.</p>
      <div class="actions"><button class="btn btn-primary" id="exploreBeyondField">Explore paths beyond my field →</button></div>
    </div>
  </div>`;
}

// Deterministic — no LLM, no auth gate: this is the "fast, concrete" lens, a direct read
// of the curated dataset. (The edge-guide path below DOES require auth, because it's a
// cost-bearing server call; this path has nothing to gate.)
function renderStreamResults(root,entry,tier){
  root.innerHTML=buildStreamResultsHtml(entry,tier);
  root.querySelector('#exploreBeyondField').addEventListener('click',()=>renderWizard(root,null));
}

// Pure markup builder — directly testable without a DOM. The disclaimer is part of this
// STATIC initial markup, built before any fetch runs, so "present even if the model omits
// it" is true by construction: there is no code path that renders this screen without it.
function buildStreamEdgeGuideHtml(){
  return `<div class="results-wrap">
    <div class="eyebrow">Exploring beyond our curated list</div>
    <h2>Broad territory worth exploring</h2>
    <p class="results-lead" id="guideStatus">Finding some broad directions to start with…</p>
    <div class="result-panel" id="guideTerritories" hidden><span class="tag">Worth exploring</span><ul id="guideTerritoriesList"></ul></div>
    ${GUIDE_DISCLAIMER_HTML}
    <div class="result-panel next-step"><span class="tag">Prefer the personalised read?</span><h3>Explore paths beyond my field →</h3><div class="actions"><button class="btn btn-primary" id="exploreBeyondFieldGuide">Explore paths beyond my field →</button></div></div>
  </div>`;
}

// The one path with no deterministic floor to anchor to — hence the non-removable
// disclaimer (injected below, unconditionally, before the fetch even starts) and a
// static, LLM-free fallback on ANY failure, including no active session at all: never a
// dead end, never a broken page, never a shipped verdict.
async function renderStreamEdgeGuide(root,streamOrRoleLabel,tier){
  const tierLabel = tier==='school_stream' ? 'stream' : 'major';
  root.innerHTML=buildStreamEdgeGuideHtml();

  root.querySelector('#exploreBeyondFieldGuide').addEventListener('click',()=>renderWizard(root,null));

  const statusEl = root.querySelector('#guideStatus');
  const renderFallback=()=>{ if(statusEl) statusEl.textContent="We couldn't generate tailored territories right now — here's how to keep exploring:"; };

  const session = window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.getSession && window.CareerDiyaProfileAuth.getSession();
  const token = session && session.access_token;
  if(!token){
    // No account yet — the guide call requires auth (a cost-bearing server call). Never
    // a dead end: fall back to the static message + disclaimer + handoff, same as any
    // other guide failure.
    renderFallback();
    return;
  }

  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),8000);
  try{
    const res=await fetch('/api/v1/career-diya/guide',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body:JSON.stringify({streamOrRole:streamOrRoleLabel||`unspecified ${tierLabel}`,intent:'stream_unlisted'}),
      signal:controller.signal
    });
    if(!res.ok) throw new Error('Guide request failed with status '+res.status);
    const data=await res.json();
    if(!data || !Array.isArray(data.territories) || !data.territories.length) throw new Error('Guide response missing territories.');

    if(statusEl) statusEl.textContent='A few broad directions to start exploring:';
    const list=root.querySelector('#guideTerritoriesList');
    const panel=root.querySelector('#guideTerritories');
    if(list && panel){
      list.innerHTML=data.territories.map(t=>`<li>${escHtml(t)}</li>`).join('');
      panel.hidden=false;
    }
  }catch(err){
    console.warn('Career Diya edge guide unavailable — showing static fallback:',err && err.message);
    renderFallback();
  }finally{
    clearTimeout(timeoutId);
  }
}

function gateBeforeResults(root,answers,audience,currentRole=null,targetRole=null){
  const existing = window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated();
  if (existing) {
    renderResults(root,answers,audience,'',currentRole,targetRole);
    return;
  }

  localStorage.setItem('careerdiya_pending_exploration', JSON.stringify({
    audience,
    answers,
    currentRole: currentRole || null,
    targetRole: targetRole || null,
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
        renderResults(root,answers,audience,'Your profile is ready — here is your exploration result.',currentRole,targetRole);
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

// Fix B (state-contamination) — pure, directly testable. Trusts ONLY the argument
// threaded through the current exploration's own call chain; deliberately no fallback to
// any shared/global storage. A falsy currentRole (parent/student, or a professional who
// chose "fresher") resolves to null, full stop — never silently backfilled from a
// different exploration, audience, or browser tab.
function resolveEffectiveCurrentRole(currentRole){
  return (currentRole||'').trim() || null;
}

function renderResults(root,answers,audience,profileMessage='',currentRole=null,targetRole=null){
  const authenticated = !!(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.isAuthenticated());
  if(!authenticated){
    gateBeforeResults(root,answers,audience);
    return;
  }
  // Fix B (state-contamination): no global-localStorage-key fallback. `currentRole` is
  // already the complete, correctly-threaded value for THIS exploration (professional's
  // own flow passes it all the way through from renderCurrentRoleStep; parent/student
  // flows never capture one, so it's legitimately null/absent here) — resolving it from
  // anywhere else was the leak. See resolveEffectiveCurrentRole for the isolated, testable
  // form of this rule.
  const effectiveCurrentRole=resolveEffectiveCurrentRole(currentRole);
  const result=generateRecommendations(answers,audience,effectiveCurrentRole);
  const isBoundedRole=!!(effectiveCurrentRole && audience==='professional' && typeof isBoundedRoleValue==='function' && isBoundedRoleValue(effectiveCurrentRole));
  if(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.setCurrentRole){
    // audience is passed through so setCurrentRole's own backstop guard (profile-auth.js)
    // can refuse a write for any non-professional render, even if this call site were
    // ever changed to pass a non-null role for one.
    window.CareerDiyaProfileAuth.setCurrentRole(effectiveCurrentRole, {isOther: !!effectiveCurrentRole && !isBoundedRole, audience}).catch(err=>console.warn('Career Diya current-role persistence failed:',err));
  }const top=result.chosen[0].direction;const alternatives=result.chosen.slice(1);const plan=skillPlan(top,answers);const isParent=audience==='parent';
  const signal=result.signal;
  const rationale=result.topSignals.length?result.topSignals.join(', '):'the mix of preferences you selected';
  const explanation=result.routingNote ? `${result.routingNote} Within that set, your answers highlighted ${rationale}.` : `Your answers highlighted ${rationale}.`;
  const effectiveTargetRole=(targetRole||'').trim()||null;
  const storedResult={profileCreated:true,audience,currentRole:effectiveCurrentRole,targetRole:effectiveTargetRole,answers,recommendationMatrixVersion:FREE_ENGINE_CONFIG.version,score:result.chosen[0].score,signal,margin:result.margin,userProfile:result.userProfile,contextRouting:result.context?{intent:result.context.intent,roleFamily:result.context.roleFamily,currentRole:result.context.currentRole}:null,recommendations:result.chosen.map(x=>({id:x.direction.id,name:x.direction.name,score:x.score,similarities:x.similarities,penalty:x.penalty})),recs:result.chosen.map(x=>({id:x.direction.id,name:x.direction.name,skills:x.direction.skills||[],score:x.score,similarities:x.similarities,penalty:x.penalty})),updatedAt:new Date().toISOString()};
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
  // ADR-CAREERDIY-0015: llmAdviceBlock/courseRecsPanel start hidden/empty and are only
  // populated if the bounded-role enrichment fetch below succeeds. "Why it surfaced"
  // above always stays the deterministic explanation, unedited — this block is
  // additive and clearly attributed, never a replacement for it.
  const llmSection=isBoundedRole?`<p class="llm-advice" id="llmAdviceBlock" hidden></p>`:'';
  const courseRecsPanel=isBoundedRole?`<div class="result-panel courses-panel" id="courseRecsPanel" hidden><span class="tag">AI-suggested · explore further</span><h3>Suggested learning</h3><div id="courseRecsList"></div></div>`:'';
  root.innerHTML=`<div class="results-wrap">${profileMessage?`<div class="profile-confirmation">${profileMessage}</div>`:''}<div class="eyebrow">${resultEyebrow}</div><h2>${heading}</h2><p class="results-lead">${lead}</p>${effectiveTargetRole?`<p class="target-role-note">Targeting: <b>${escHtml(effectiveTargetRole)}</b></p>`:''}<div class="results-grid"><div class="result-panel"><span class="tag">${signal}</span><h3>${top.name}</h3><p>${top.tags.join(' · ')}</p><div class="scorebar"><span style="width:${Math.max(35,Math.min(94,result.chosen[0].score))}%"></span></div><small>Exploration signal based on your answers; this score is not a validated percentage.</small><p class="result-why"><b>Why it surfaced:</b> ${explanation}</p></div><div class="result-panel"><span class="tag">Other directions worth exploring</span>${alternatives.map(c=>renderDirectionLink(c.direction,audience)).join('')}</div></div><div class="result-panel next-step"><span class="tag">What to do next</span><h3>${nextTitle}</h3><p>${nextCopy}</p><div class="actions">${primaryAction}${extra}</div>${llmSection}</div>${courseRecsPanel}<div class="result-panel lead-panel"><span class="tag">Get this by email</span><h3>Send me this direction</h3><p>${leadCopy}</p><form id="leadForm" class="lead-form" novalidate><input class="input" type="text" name="name" placeholder="Name (optional)" autocomplete="name"><input class="input" type="email" name="email" placeholder="you@email.com" required autocomplete="email"><input class="input" type="tel" name="phone" placeholder="Phone (optional)" autocomplete="tel"><button class="btn btn-primary" type="submit">Send me this direction</button></form><p class="lead-status" role="status" aria-live="polite"></p></div><div class="notice">${isParent?'<b>Parent note:</b> This free exploration uses observations you provided about your child and is intentionally broad. Use the age-designed school-stage assessment when you need deeper evidence.':'<b>Free exploration note:</b> This is a lightweight, deterministic exploration tool. A deeper assessment can provide more evidence when you are ready.'}</div></div>`;
  wireLeadForm(root,top,audience,answers,signal);
  if(isBoundedRole) enrichBoundedResult(root,effectiveCurrentRole,answers,top.id);
}

// ADR-CAREERDIY-0015: fire-and-forget. The deterministic result above is already fully
// rendered and usable — this only ever ADDS the advice block / course panel on success.
// Any failure, timeout, or invalid response is caught and logged, never surfaced to the
// user and never blocks or breaks the page.
async function fetchBoundedEnrichment(role,answers,chosenDirectionId){
  const session=window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.getSession && window.CareerDiyaProfileAuth.getSession();
  const token=session && session.access_token;
  if(!token) throw new Error('No active Career Diya session for enrichment call.');
  const controller=new AbortController();
  const timeoutId=setTimeout(()=>controller.abort(),8000);
  try{
    const res=await fetch('/api/v1/career-diya/recommend',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body:JSON.stringify({role,answers,chosenDirectionId}),
      signal:controller.signal
    });
    if(!res.ok) throw new Error('Enrichment request failed with status '+res.status);
    const data=await res.json();
    if(!data || typeof data.advice!=='string') throw new Error('Enrichment response missing advice.');
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function enrichBoundedResult(root,role,answers,chosenDirectionId){
  fetchBoundedEnrichment(role,answers,chosenDirectionId).then(data=>{
    const adviceEl=root.querySelector('#llmAdviceBlock');
    if(adviceEl && data.advice){
      adviceEl.innerHTML=`<b>AI-suggested next step:</b> ${escHtml(data.advice)}`;
      adviceEl.hidden=false;
    }
    const coursesPanel=root.querySelector('#courseRecsPanel');
    const coursesList=root.querySelector('#courseRecsList');
    if(coursesPanel && coursesList && Array.isArray(data.courseRecommendations) && data.courseRecommendations.length){
      coursesList.innerHTML=data.courseRecommendations.map(c=>`<div class="mini-result"><strong>${escHtml(c.title)}</strong><span>${escHtml(c.provider)}${c.type?' · '+escHtml(c.type):''}</span></div>`).join('');
      coursesPanel.hidden=false;
    }
  }).catch(err=>{
    console.warn('Career Diya enrichment unavailable — showing deterministic result only:',err && err.message);
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
          renderResults(root,pending.answers,pending.audience,'Your profile is ready — here is your exploration result.',pending.currentRole||null,pending.targetRole||null);
          return;
        }
      }
      if(resumeRequested){
        const saved=JSON.parse(localStorage.getItem('careerdiya_profile')||'null');
        if(saved && saved.answers && saved.audience){
          renderResults(root,saved.answers,saved.audience,'Here is your saved exploration result.',saved.currentRole||null,saved.targetRole||null);
          return;
        }
        if(window.CareerDiyaProfileAuth && window.CareerDiyaProfileAuth.getSavedExploration){
          const persisted=await window.CareerDiyaProfileAuth.getSavedExploration();
          if(persisted && persisted.answers && persisted.audience){
            renderResults(root,persisted.answers,persisted.audience,'Here is your saved exploration result.',persisted.result?.currentRole||null,persisted.result?.targetRole||null);
            return;
          }
        }
      }
    } catch(_) {}
  }
  const audience=currentAudience();
  const startCopy=audience==='parent'?{eyebrow:'Free · a few minutes',title:'Explore your child’s direction before choosing a stream.',copy:'Answer a few questions about your child’s stage, interests and strengths. We will suggest broad directions worth exploring and a sensible next step.',benefits:['✓ Free profile to see your result','✓ No pressure to buy','✓ Use an age-designed assessment when you need deeper evidence']} : audience==='student'?{eyebrow:'Free · a few minutes',title:'Two ways to start exploring.',copy:'Jump straight to careers that come from your stream or major, or answer 7 quick questions for a read based on how you actually think and work. Neither is the "real" one — pick whichever you want first.',benefits:['✓ Free profile to see your result','✓ No pressure to buy','✓ Designed for students aged 16+']} : {eyebrow:'Free · 5–7 minutes',title:'Get a starting direction before you buy anything.',copy:'Answer a few questions about your situation, work preferences and goals. We will turn that into a short list of directions worth exploring and the most sensible next action.',benefits:['✓ Free profile to see your result','✓ No pressure to buy','✓ Skill Diya connection']};
  const autoStartWizard = qs().get('intent')||(!qs().get('wizard')&&qs().get('start')==='1');
  if(autoStartWizard){
    renderWizard(root);
  } else if(audience==='student'){
    // ADR-CAREERDIY-0016: co-primary — both buttons use the SAME class (btn btn-primary),
    // same markup weight, side by side. Neither is styled as the fallback off the other.
    root.innerHTML=buildStudentEntryChoiceHtml(startCopy);
  } else {
    root.innerHTML=`<div class="engine-start"><div class="eyebrow">${startCopy.eyebrow}</div><h2>${startCopy.title}</h2><p>${startCopy.copy}</p><div class="engine-benefits">${startCopy.benefits.map(x=>`<span>${x}</span>`).join('')}</div><button class="btn btn-primary" id="startEngine">Start my exploration →</button></div>`;
  }
  const start=document.getElementById('startEngine');
  if(start) start.addEventListener('click',()=>{
    const aud=currentAudience();
    if(aud==='professional') renderCurrentRoleStep(root,aud,(role)=>renderWizard(root,role));
    else renderWizard(root,null);
  });
  const startStream=document.getElementById('startStreamPath');
  if(startStream) startStream.addEventListener('click',()=>renderStudentStageStep(root));
  const startPreference=document.getElementById('startPreferencePath');
  if(startPreference) startPreference.addEventListener('click',()=>renderWizard(root,null));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDecisionEngine);else initDecisionEngine();
