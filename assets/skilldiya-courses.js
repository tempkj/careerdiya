(function(){
  const esc=s=>String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[m]));
  const audienceKey='careerdiyaAudience';
  const validAudiences=new Set(['parent','student','professional']);
  const fallbackAudience=()=>{
    const fromUrl=String(new URLSearchParams(location.search).get('audience')||'').toLowerCase();
    if(validAudiences.has(fromUrl)) return fromUrl;
    const saved=String(localStorage.getItem(audienceKey)||'').toLowerCase();
    return validAudiences.has(saved)?saved:'';
  };
  let catalogue=[];

  async function load(){
    if(catalogue.length) return catalogue;
    const r=await fetch('assets/skilldiya-catalogue.json',{cache:'no-store'});
    if(!r.ok) throw new Error(`Course catalogue could not be loaded (${r.status}).`);
    const j=await r.json(); catalogue=j.courses||[]; return catalogue;
  }
  function getCourse(id){ return catalogue.find(c=>c.id===id); }

  function recommendationDomains(){
    return {
      'product management':['Product & Business Technology','UX & Product Design'],
      'strategy consulting':['Product & Business Technology','Data & Analytics','Business, Entrepreneurship & Freelancing'],
      'project management':['Product & Business Technology','Business, Entrepreneurship & Freelancing'],
      'operations management':['Product & Business Technology','Business, Entrepreneurship & Freelancing'],
      'business management':['Product & Business Technology','Business, Entrepreneurship & Freelancing','Data & Analytics'],
      'data':['Data & Analytics','AI & Applied AI'], 'ai':['AI & Applied AI','Data & Analytics'],
      'technology':['Software Engineering','Quality Engineering','Cloud & DevOps','Cybersecurity'],
      'marketing':['Digital Growth & Marketing','Content & Creator Economy'], 'media':['Media & Film','Content & Creator Economy','Animation, VFX & Gaming'],
      'communication':['Writing, Language & Humanities','Digital Growth & Marketing'], 'finance':['Business, Entrepreneurship & Freelancing','Data & Analytics'],
      'engineering':['Engineering & Industrial Technology','Architecture & Built Environment','Skilled Trades & Crafts'],
      'design':['UX & Product Design','Fashion, Beauty & Lifestyle Professions','Architecture & Built Environment'],
      'hr':['People, HR & Workplace Practice'], 'law':['Law, Compliance & Public Policy'],
      'health':['Healthcare & Life Sciences'], 'education':['Writing, Language & Humanities'],
      'hospitality':['Hospitality, Travel & Events'], 'culinary':['Food & Culinary'], 'creative':['Arts, Music & Performing Arts','Media & Film']
    };
  }

  const directionAliases={
    software:'technology',data:'data',product:'product management',finance:'finance',design:'design',marketing:'marketing',
    people:'hr',law:'law',health:'health',built:'engineering',hospitality:'hospitality',entrepreneurship:'finance'
  };

  // Small, explicit launch-stage rules prevent generic keyword collisions such as
  // Strategy Consulting -> Creator Content Strategy. This is intentionally a curated
  // bridge until a real Career Diya -> Skill Diya skill graph/recommendation engine exists.
  const careerRules={
    'strategy consultant':{domains:['Product & Business Technology','Data & Analytics','Business, Entrepreneurship & Freelancing'],skills:['business analysis','strategy consulting','financial modeling','analytics']},
    'strategy consulting':{domains:['Product & Business Technology','Data & Analytics','Business, Entrepreneurship & Freelancing'],skills:['business analysis','strategy consulting','financial modeling','analytics']},
    'product manager':{domains:['Product & Business Technology','UX & Product Design','AI & Applied AI'],skills:['product management','product discovery','product','user research','ux']},
    'product management':{domains:['Product & Business Technology','UX & Product Design','AI & Applied AI'],skills:['product management','product discovery','product','user research','ux']},
    'data analyst':{domains:['Data & Analytics','AI & Applied AI'],skills:['data','analytics','sql','power bi','python']},
    'data scientist':{domains:['Data & Analytics','AI & Applied AI'],skills:['data','analytics','python','machine learning','sql']},
    'software engineer':{domains:['Software Engineering','Quality Engineering','Cloud & DevOps','Cybersecurity'],skills:['software','api','backend','typescript','python','automation']},
    'full stack developer':{domains:['Software Engineering','Cloud & DevOps','Quality Engineering'],skills:['software','api','backend','typescript','python']},
    'cyber security':{domains:['Cybersecurity','Cloud & DevOps'],skills:['security','owasp','api security','cybersecurity']},
    'digital marketing':{domains:['Digital Growth & Marketing','Content & Creator Economy'],skills:['marketing','performance marketing','marketing automation']},
    'growth marketing':{domains:['Digital Growth & Marketing'],skills:['marketing','performance marketing','analytics']},
    'ux designer':{domains:['UX & Product Design','Writing, Language & Humanities'],skills:['ux','user research','usability','design']},
    'user experience design ux':{domains:['UX & Product Design','Writing, Language & Humanities'],skills:['ux','user research','usability','design']},
    'graphic designer':{domains:['UX & Product Design','Architecture & Built Environment','Fashion, Beauty & Lifestyle Professions'],skills:['design','illustration']},
    'human resource management':{domains:['People, HR & Workplace Practice'],skills:['hr','interviewing','people analytics','performance management']},
    'law':{domains:['Law, Compliance & Public Policy'],skills:['legal','contract','privacy','research','case analysis']},
    'financial analysis':{domains:['Business, Entrepreneurship & Freelancing','Data & Analytics'],skills:['financial','financial modeling','analytics','data']},
    'project management':{domains:['Product & Business Technology','Business, Entrepreneurship & Freelancing'],skills:['project','operations','planning','business']},
    'operations management':{domains:['Product & Business Technology','Business, Entrepreneurship & Freelancing'],skills:['operations','business','planning']},
    'architecture':{domains:['Architecture & Built Environment','Engineering & Industrial Technology'],skills:['architecture','revit','design','built']},
    'interior design':{domains:['Architecture & Built Environment','UX & Product Design'],skills:['interior','design','architecture']},
    'culinary arts':{domains:['Food & Culinary'],skills:['culinary','baking','menu','food']},
    'event management':{domains:['Hospitality, Travel & Events'],skills:['event','hospitality','guest experience']}
  };

  // Curated launch-stage Career Diya -> Skill Diya bridge. The catalogue does not
  // yet expose a formal skill graph, so only explicitly mapped course IDs can match
  // a specific Career Library career. An unmapped career intentionally resolves to NONE.
  const careerCourseRules={
    investment_banking:{strong:{'financial-modeling-for-business-decisions':['financial modeling','financial decisions']},adjacent:{'sql-for-business-data-analytics':['business analytics'],'power-bi-business-intelligence':['business intelligence']}},
    financial_analysis:{strong:{'financial-modeling-for-business-decisions':['financial modeling']},adjacent:{'sql-for-business-data-analytics':['analytics'],'power-bi-business-intelligence':['business intelligence'],'data-protection-privacy-operations':['risk and compliance context']}},
    financial_planning:{strong:{'financial-modeling-for-business-decisions':['financial modeling','financial decisions']},adjacent:{'power-bi-business-intelligence':['business intelligence'],'sql-for-business-data-analytics':['analytics']}},
    risk_management:{strong:{'financial-modeling-for-business-decisions':['financial risk / decision modeling']},adjacent:{'data-protection-privacy-operations':['privacy risk'],'sql-for-business-data-analytics':['risk analytics'],'power-bi-business-intelligence':['risk reporting']}},
    investment_advisory:{strong:{'financial-modeling-for-business-decisions':['financial modeling','investment decisions']},adjacent:{'power-bi-business-intelligence':['client analytics'],'sql-for-business-data-analytics':['analytics']}},
    cost_and_management_accounting:{strong:{'financial-modeling-for-business-decisions':['financial modeling','management decisions']},adjacent:{'sql-for-business-data-analytics':['analytics'],'power-bi-business-intelligence':['business intelligence']}},
    chartered_accountancy:{strong:{'financial-modeling-for-business-decisions':['financial modeling']},adjacent:{'sql-for-business-data-analytics':['financial analytics'],'power-bi-business-intelligence':['business intelligence']}},

    strategy_consulting:{strong:{'financial-modeling-for-business-decisions':['financial modeling'],'product-management-prd-to-mvp':['strategy / prioritisation']},adjacent:{'sql-for-business-data-analytics':['analytics'],'power-bi-business-intelligence':['decision dashboards'],'ai-product-management':['technology strategy']}},
    strategy_consultant:{strong:{'financial-modeling-for-business-decisions':['financial modeling'],'product-management-prd-to-mvp':['strategy / prioritisation']},adjacent:{'sql-for-business-data-analytics':['analytics'],'power-bi-business-intelligence':['decision dashboards'],'ai-product-management':['technology strategy']}},
    product_management:{strong:{'product-management-prd-to-mvp':['product management','prioritisation'],'product-ux-design':['product experience'],'ux-research-usability-testing':['user research']},adjacent:{'ai-product-management':['AI product strategy'],'sql-for-business-data-analytics':['product analytics']}},
    product_manager:{strong:{'product-management-prd-to-mvp':['product management','prioritisation'],'product-ux-design':['product experience'],'ux-research-usability-testing':['user research']},adjacent:{'ai-product-management':['AI product strategy'],'sql-for-business-data-analytics':['product analytics']}},
    information_technology_business_analysis:{strong:{'product-management-prd-to-mvp':['requirements / prioritisation'],'sql-for-business-data-analytics':['business analysis'],'power-bi-business-intelligence':['business intelligence']},adjacent:{'ai-product-management':['technology product context'],'ux-research-usability-testing':['user research'],'rest-api-engineering':['API / system understanding']}},
    business_management:{strong:{'financial-modeling-for-business-decisions':['business decisions']},adjacent:{'power-bi-business-intelligence':['business intelligence'],'sql-for-business-data-analytics':['business analytics'],'product-management-prd-to-mvp':['planning / prioritisation']}},
    project_management:{strong:{'product-management-prd-to-mvp':['planning / prioritisation']},adjacent:{'power-bi-business-intelligence':['status / KPI reporting'],'sql-for-business-data-analytics':['project analytics']}},
    operations_management:{strong:{'power-bi-business-intelligence':['operational reporting']},adjacent:{'sql-for-business-data-analytics':['operations analytics'],'product-management-prd-to-mvp':['process / prioritisation']}},

    data_analyst:{strong:{'sql-for-business-data-analytics':['SQL','analytics'],'power-bi-business-intelligence':['business intelligence'],'python-for-data-analysis':['data analysis']},adjacent:{'generative-ai-application-development':['AI-enabled workflows']}},
    data_scientist:{strong:{'python-for-data-analysis':['Python','data analysis'],'sql-for-business-data-analytics':['SQL','analytics']},adjacent:{'generative-ai-application-development':['AI application development'],'rag-application-engineering':['applied AI']}},
    software_engineer:{strong:{'python-backend-development':['backend development'],'typescript-application-development':['application development'],'rest-api-engineering':['API engineering']},adjacent:{'api-test-automation':['API testing'],'cloud-foundations-with-aws':['cloud'],'docker-ci-cd-engineering':['CI/CD']}},
    full_stack_developer:{strong:{'typescript-application-development':['application development'],'python-backend-development':['backend development'],'rest-api-engineering':['API engineering']},adjacent:{'cloud-foundations-with-aws':['cloud'],'docker-ci-cd-engineering':['CI/CD'],'playwright-automation-engineering':['test automation']}},
    cyber_security:{strong:{'web-application-security-owasp':['web security','OWASP'],'api-security-engineering':['API security']},adjacent:{'data-protection-privacy-operations':['privacy operations'],'cloud-foundations-with-aws':['cloud security context']}},
    digital_marketing:{strong:{'marketing-automation-with-n8n':['marketing automation'],'performance-marketing-analytics':['performance marketing analytics']},adjacent:{'creator-content-strategy':['content strategy']}},
    growth_marketing:{strong:{'performance-marketing-analytics':['performance marketing analytics'],'marketing-automation-with-n8n':['marketing automation']},adjacent:{'creator-content-strategy':['content strategy']}},
    ux_designer:{strong:{'ux-research-usability-testing':['user research','usability'],'product-ux-design':['product UX']},adjacent:{'ux-writing':['UX writing'],'product-management-prd-to-mvp':['product discovery']}},
    user_experience_design_ux:{strong:{'ux-research-usability-testing':['user research','usability'],'product-ux-design':['product UX']},adjacent:{'ux-writing':['UX writing'],'product-management-prd-to-mvp':['product discovery']}},
    graphic_designer:{adjacent:{'motion-graphics-fundamentals':['motion graphics'],'blender-3d-fundamentals':['3D design'],'professional-video-content-production':['visual content'] }},
    human_resource_management:{strong:{'structured-interviewing-selection':['structured interviewing'],'performance-management-systems':['performance management']},adjacent:{'people-analytics-with-excel-power-bi':['people analytics']}},
    law:{strong:{'contract-drafting-review':['contract drafting'],'legal-research-case-analysis':['legal research']},adjacent:{'data-protection-privacy-operations':['privacy compliance']}},
    architecture:{strong:{'revit-architecture-fundamentals':['architectural modelling'],'quantity-estimation-boq':['quantity estimation']},adjacent:{'cad-for-mechanical-design':['CAD / design tooling']}},
    interior_design:{strong:{'revit-architecture-fundamentals':['architectural modelling']},adjacent:{'product-ux-design':['design process']}},
    culinary_arts:{strong:{'baking-fundamentals':['baking'],'menu-engineering':['menu engineering']},adjacent:{'food-photography':['food presentation']}},
    event_management:{strong:{'event-production-fundamentals':['event production'],'guest-experience-design':['guest experience']},adjacent:{'performance-marketing-analytics':['event performance analytics']}},
  };

  const careerNameAliases={
    'strategy consulting':'strategy_consulting',
    'strategy consultant':'strategy_consultant',
    'product management':'product_management',
    'product manager':'product_manager',
    'data analyst':'data_analyst',
    'data scientist':'data_scientist',
    'software engineer':'software_engineer',
    'full stack developer':'full_stack_developer',
    'cyber security':'cyber_security',
    'digital marketing':'digital_marketing',
    'growth marketing':'growth_marketing',
    'ux designer':'ux_designer',
    'user experience design ux':'user_experience_design_ux',
    'graphic designer':'graphic_designer',
    'human resource management':'human_resource_management',
    'law':'law',
    'financial analysis':'financial_analysis',
    'financial planning':'financial_planning',
    'risk management':'risk_management',
    'investment banking':'investment_banking',
    'investment advisory':'investment_advisory',
    'chartered accountancy':'chartered_accountancy',
    'cost and management accounting':'cost_and_management_accounting',
    'information technology business analysis':'information_technology_business_analysis',
    'business management':'business_management',
    'project management':'project_management',
    'operations management':'operations_management',
    'architecture':'architecture',
    'interior design':'interior_design',
    'culinary arts':'culinary_arts',
    'event management':'event_management'
  };

  function normalize(s){return String(s||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
  function ruleForCareer(careerName){
    const n=normalize(careerName);
    if(careerRules[n]) return careerRules[n];
    for(const [k,v] of Object.entries(careerRules)) if(n.includes(k)||k.includes(n)) return v;
    return null;
  }

  async function savedContext(){
    const a=window.CareerDiyaProfileAuth;
    if(!a||!a.isAuthenticated()) return {loggedIn:false,profile:null,exploration:null,user:null};
    try{
      const [p,e]=await Promise.all([a.getProfile(),a.getSavedExploration()]);
      const session=typeof a.getSession==='function'?a.getSession():null;
      return {loggedIn:true,profile:p,exploration:e,user:session?.user||null};
    }catch(_){ const session=typeof a.getSession==='function'?a.getSession():null; return {loggedIn:true,profile:null,exploration:null,user:session?.user||null}; }
  }

  function canonicalAudience(ctx={}){
    const profileAudience=String(ctx.profile?.audience||'').toLowerCase();
    if(ctx.loggedIn && validAudiences.has(profileAudience)) return profileAudience;
    const explorationAudience=String(ctx.exploration?.audience||ctx.exploration?.result?.audience||'').toLowerCase();
    if(ctx.loggedIn && validAudiences.has(explorationAudience)) return explorationAudience;
    return fallbackAudience() || 'general';
  }

  function segment(ctx){
    return canonicalAudience(ctx);
  }

  function contextRaw(ctx,currentCareer={}){
    return {
      audience:canonicalAudience(ctx),
      current_career_id:currentCareer.id||null,
      current_career_name:currentCareer.name||null,
      exploration_direction:ctx.exploration?.result?.recommendations?.[0]?.name||null,
      profile_context:ctx.profile?{
        education_level:ctx.profile.education_level||null,
        industry:ctx.profile.industry||null,
        current_role_title:ctx.profile.current_role_title||null,
        field_of_study:ctx.profile.field_of_study||null,
        experience_years:ctx.profile.experience_years||null
      }:null
    };
  }

  function closeInterest(){
    const m=document.getElementById('interestModal');
    if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
  }

  async function openInterest(item, options={}){
    const modal=document.getElementById('interestModal'); if(!modal) return;
    const form=document.getElementById('interestForm'); if(!form) return;
    const nameInput=form.querySelector('[name=name]');
    const emailInput=form.querySelector('[name=email]');
    const phoneInput=form.querySelector('[name=phone]');
    const message=document.getElementById('interestMessage');

    form.reset();
    form.dataset.interest=item.id||item.title||item.name||'';
    form.dataset.interestTitle=item.title||item.name||'';
    form.dataset.interestKind=options.interestKind||'course';
    form.dataset.pathId=options.pathId||'';
    form.dataset.pathName=options.pathName||'';
    form.dataset.interestType=options.interestType||'course';
    form.dataset.currentCareerId=options.careerId||'';
    form.dataset.currentCareerName=options.careerName||'';

    const title=options.modalTitle||item.title||item.name||'Training';
    const copy=options.modalCopy||"We'll tell you when this training opens. No enrolment is being taken yet.";
    document.getElementById('interestCourseName')?.replaceChildren(document.createTextNode(title));
    document.getElementById('interestCourseCopy')?.replaceChildren(document.createTextNode(copy));
    if(message){ message.textContent=''; message.className='form-message'; }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    setTimeout(()=>emailInput?.focus(),0);

    try{
      const ctx=await savedContext();
      if(ctx.profile?.display_name && nameInput && !nameInput.value) nameInput.value=ctx.profile.display_name;
      if(ctx.user?.email && emailInput && !emailInput.value) emailInput.value=ctx.user.email;
    }catch(_){ }
  }

  async function submitInterest(ev){
    ev.preventDefault();
    const form=ev.currentTarget;
    const email=form.querySelector('[name=email]').value.trim();
    const msg=document.getElementById('interestMessage');
    if(!email){ msg.textContent='Please enter your email so we know where to reach you.'; msg.className='form-message error'; return; }
    const ctx=await savedContext();
    const kind=form.dataset.interestKind||'course';
    const courseId=kind==='course'?form.dataset.interest:'';
    const courseTitle=kind==='course'?form.dataset.interestTitle:'';
    const pathId=form.dataset.pathId||'';
    const pathName=form.dataset.pathName||'';
    const interest=kind==='course' ? (courseId||courseTitle) : `courses-in-career-path:${pathId||pathName}`;
    const payload={
      source:'skilldiya', segment:segment(ctx), interest, interest_kind:kind,
      name:form.querySelector('[name=name]').value.trim()||null,
      email, phone:form.querySelector('[name=phone]').value.trim()||null,
      shared_user_id:ctx.user?.id||null,
      raw:{
        interest_type:form.dataset.interestType||kind, course_id:courseId||null, course_name:courseTitle||null,
        career_path_id:pathId||null, career_path_name:pathName||null,
        current_career_id:form.dataset.currentCareerId||null,
        current_career_name:form.dataset.currentCareerName||null,
        audience:canonicalAudience(ctx),
        exploration_direction:ctx.exploration?.result?.recommendations?.[0]?.name||null,
        profile_context:contextRaw(ctx,{id:form.dataset.currentCareerId,name:form.dataset.currentCareerName}).profile_context
      }
    };
    const cap=window.CareerDiyaLeadCapture;
    const btn=form.querySelector('button[type=submit]');
    btn.disabled=true; msg.textContent=''; msg.className='form-message';
    try{
      if(!cap) throw new Error('Lead capture is unavailable.');
      await cap.submitLead(payload);
      msg.textContent=kind==='course'
        ? "Thanks — we'll tell you when this training opens."
        : "Thanks — we've recorded your interest and will get back to you when relevant training is available.";
      msg.className='form-message success';
      setTimeout(closeInterest,2200);
    }catch(e){
      console.error('Skill Diya interest capture failed',e,payload);
      const detail=String(e?.message||'').toLowerCase();
      msg.textContent=detail.includes('configured')||detail.includes('unavailable')
        ? 'Interest capture is temporarily unavailable. Please try again later.'
        : 'We could not save your interest right now. Please try again.';
      msg.className='form-message error';
    }finally{btn.disabled=false;}
  }

  function careerRule(careerId, careerName){
    const id=String(careerId||'').trim();
    if(id && careerCourseRules[id]) return careerCourseRules[id];
    const key=careerNameAliases[normalize(careerName||'')];
    return key?careerCourseRules[key]||null:null;
  }

  function scoreMappedCourse(course,tier,signals=[]){
    const hay=normalize(`${course.title} ${course.description} ${course.domain}`);
    const matched=signals.filter(x=>hay.includes(normalize(x))).map(String);
    const base=tier==='strong'?100:60;
    return {...course,_matchTier:tier,_matchScore:base+Math.min(20,matched.length*5),_matchedSignals:signals};
  }

  function recommendationMatches(courses,careerId,careerName){
    const rule=careerRule(careerId,careerName);
    if(!rule){
      return {courses:[],strong:[],adjacent:[],exact:[],matchType:'none',basis:'no curated career mapping',label:'No meaningful Skill Diya course match'};
    }

    const strong=[],adjacent=[];
    for(const c of courses){
      if(rule.strong?.[c.id]) strong.push(scoreMappedCourse(c,'strong',rule.strong[c.id]));
      else if(rule.adjacent?.[c.id]) adjacent.push(scoreMappedCourse(c,'adjacent',rule.adjacent[c.id]));
    }
    strong.sort((a,b)=>b._matchScore-a._matchScore);
    adjacent.sort((a,b)=>b._matchScore-a._matchScore);
    const selected=[...strong.slice(0,3),...adjacent.slice(0,Math.max(0,3-strong.length))];
    return {
      courses:selected,
      strong:strong.slice(0,3),
      adjacent:adjacent.slice(0,Math.max(0,3-strong.length)),
      exact:strong.slice(0,3),
      matchType:strong.length?'strong':adjacent.length?'adjacent':'none',
      basis:'curated launch-stage career → course bridge',
      label:strong.length?'career-specific course mapping':'career-specific supporting-skill mapping'
    };
  }

  function directionRecommendationMatches(courses,directionId,directionName){
    const domains=recommendationDomains();
    const key=directionAliases[normalize(directionId||'')]||normalize(directionId||'');
    const targetDomains=new Set(domains[key]||[]);
    if(!targetDomains.size) return {courses:[],exact:[],adjacent:[],matchType:'none',basis:'no curated direction mapping',label:'No meaningful Skill Diya course match'};
    const adjacent=courses.filter(c=>targetDomains.has(c.domain));
    return {courses:adjacent.slice(0,3),exact:[],adjacent:adjacent.slice(0,3),matchType:adjacent.length?'adjacent':'none',basis:'curated exploration-direction/domain mapping',label:`Suggestions for ${directionName||'your exploration direction'}`};
  }

  function matchReason(matchType,c){
    const signals=(c._matchedSignals||[]).filter(Boolean);
    if(!signals.length) return '';
    const label=matchType==='strong'?'Career skill focus':'Relevant supporting skills';
    return `<strong>${label}:</strong> ${signals.map(esc).join(', ')}`;
  }

  function renderRecommendationSection(target,matches,careerName,careerId){
    if(!target) return;
    const name=careerName||'this career';
    if(!matches.courses.length){
      target.innerHTML=`<section class="skill-training-section no-course-state"><div class="eyebrow">Courses &amp; Training</div><h2>No Current Skill Diya Course For ${esc(name)} Yet</h2><p class="training-muted">We do not have a meaningful current course match for this career yet. Would you be interested in doing courses in this career path?</p><button class="btn btn-primary" type="button" data-career-path-interest data-career-path-id="${esc(careerId||'')}" data-career-path-name="${esc(name)}">Yes, I’d Be Interested</button></section>`;
      return;
    }
    const strong=matches.strong||matches.exact||[], adjacent=matches.adjacent||[];
    const cards=(arr,type)=>arr.map(c=>`<article class="course-card compact"><div class="course-card-top"><span class="tag">${esc(c.domain)}</span><span class="course-status">${esc(c.status)}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>${matchReason(type,c)?`<p class="course-match-reason">${matchReason(type,c)}</p>`:''}<div class="course-meta"><span>${esc(c.level)}</span><span>${esc(c.duration)}</span><span>${esc(c.format)}</span></div><div class="course-actions"><a class="btn btn-secondary" href="course.html?id=${encodeURIComponent(c.id)}&amp;careerId=${encodeURIComponent(careerId||'')}&amp;careerName=${encodeURIComponent(name)}">View Course</a><button class="btn btn-primary" data-course-interest="${esc(c.id)}" data-career-id="${esc(careerId||'')}" data-career-name="${esc(name)}" type="button">Register Interest</button></div></article>`).join('');
    const heading=strong.length?'Courses Closely Related To This Career':'Courses That May Help Build Relevant Skills';
    target.innerHTML=`<section class="skill-training-section"><div class="eyebrow">Courses &amp; Training</div><h2>${heading}</h2><p class="training-muted">These are launch-stage catalogue matches from Career Diya’s curated career-to-course bridge. They are not a live skills-gap engine.</p>${strong.length?`<div class="course-grid course-grid-compact">${cards(strong,'strong')}</div>`:''}${adjacent.length?`<h3 class="course-group-title adjacent-title">Courses That May Help Build Relevant Skills</h3><div class="course-grid course-grid-compact">${cards(adjacent,'adjacent')}</div>`:''}</section>`;
  }

  function renderList(courses,target){
    target.innerHTML=courses.length?courses.map(c=>`<article class="course-card"><div class="course-card-top"><span class="tag">${esc(c.domain)}</span><span class="course-status">${esc(c.status)}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div class="course-meta"><span>${esc(c.level)}</span><span>${esc(c.duration)}</span><span>${esc(c.format)}</span></div><div class="course-actions"><a class="btn btn-secondary" href="course.html?id=${encodeURIComponent(c.id)}">View Course</a><button class="btn btn-primary" data-course-interest="${esc(c.id)}" type="button">Register Interest</button></div></article>`).join(''):'<div class="course-empty"><h3>No Courses Match This Search</h3><p>Can’t find the training you were looking for? Tell us what would be useful and we’ll review the request.</p><button class="btn btn-primary" type="button" data-course-request>Tell Us What You Need</button></div>';
  }

  function wireGlobal(){
    document.addEventListener('click',async ev=>{
      const btn=ev.target.closest('[data-course-interest]');
      if(btn){ev.preventDefault(); const c=getCourse(btn.dataset.courseInterest); if(c) openInterest(c,{careerId:btn.dataset.careerId||'',careerName:btn.dataset.careerName||''}); return;}
      const req=ev.target.closest('[data-course-request]');
      if(req){ev.preventDefault(); openInterest({id:'course-request',title:'Tell Us About The Training You’re Looking For'},{modalTitle:'Tell Us What Training You’re Looking For',modalCopy:'Share the course, skill or training area you were hoping to find. We’ll record the demand and get back to you if we can add a relevant option.',interestKind:'course',interestType:'course_request'}); return;}
      const pathReq=ev.target.closest('[data-career-path-interest]');
      if(pathReq){ev.preventDefault(); const careerId=pathReq.dataset.careerPathId||''; const careerName=pathReq.dataset.careerPathName||'this career path'; openInterest({id:careerId||'career-path',name:careerName},{modalTitle:`Interested In Courses For ${careerName}?`,modalCopy:'Tell us you would be interested in training for this career path. We’ll record the demand and get back to you when relevant training plans are available.',interestKind:'direction',interestType:'course_in_career_path',pathId:careerId,pathName:careerName,careerId,careerName}); return;}
      if(ev.target.closest('[data-interest-close]')) closeInterest();
      if(ev.key==='Escape') closeInterest();
    });
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape') closeInterest();});
    const f=document.getElementById('interestForm'); if(f) f.addEventListener('submit',submitInterest);
  }

  if(!window.__skillDiyaInterestWired){ window.__skillDiyaInterestWired=true; wireGlobal(); }
  window.SkillDiyaCourses={load,getCourse,renderList,recommendationDomains,savedContext,openInterest,closeInterest,submitInterest,recommendationMatches,directionRecommendationMatches,renderRecommendationSection,segment,contextRaw,canonicalAudience,careerRule};
})();
