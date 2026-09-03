/* Career Diya Free Exploration Recommendation Matrix v1.0
 * Deterministic, explainable, non-psychometric prototype.
 * Scoring: cosine similarity per category -> weighted category average -> penalties.
 * Signal thresholds are provisional calibration defaults and must not be treated as validated constants.
 */

const FREE_ENGINE_CONFIG = {
  version: '1.0',
  categoryWeights: {
    interest: 0.20,
    strengths: 0.20,
    workPreference: 0.15,
    workStyle: 0.15,
    values: 0.20,
    practicalFit: 0.10
  },
  signalThresholds: {
    strongScore: 75,
    moderateScore: 62,
    strongMargin: 7
  },
  parentAgeBoundaryNote: 'Parent/school-stage free exploration is answered by the parent about the child and is not a child psychometric assessment.'
};

const ADULT_DIMENSIONS = [
  'analytical','creative','people','builder','technology','science','design','business','communication','organizing','research','commercial',
  'service','autonomy','variety','structure','hands_on','deep_focus','learning','stability','impact','income','freedom'
];

const PARENT_DIMENSIONS = [
  'analytical','creative','people','builder','technology','science','design','business','communication','organizing','research','commercial',
  'service','autonomy','variety','structure','hands_on','deep_focus','learning','stability','impact','flexibility','curiosity'
];

function vec(values, dims){
  const out={};
  dims.forEach(d=>{out[d]=Number(values&&values[d]||0);});
  return out;
}

const ANSWER_MAPPINGS = {
  adult: {
    work: {
      analytical: {interest:{analytical:0.95,research:0.55,deep_focus:0.35}, strengths:{analytical:0.9,research:0.55}},
      builder: {interest:{builder:0.95,analytical:0.55,hands_on:0.65}, strengths:{builder:0.9,analytical:0.45,hands_on:0.7}},
      creative: {interest:{creative:0.95,communication:0.55,variety:0.5}, strengths:{creative:0.9,communication:0.55}},
      people: {interest:{people:0.95,service:0.7,communication:0.7}, strengths:{people:0.9,communication:0.65,service:0.55}},
      quality: {interest:{structure:0.7,analytical:0.65,organizing:0.7}, strengths:{organizing:0.85,analytical:0.55,quality:0.2}}
    },
    environment: {
      structured:{workStyle:{structure:1,deep_focus:0.7,stability:0.45}},
      dynamic:{workStyle:{variety:1,autonomy:0.55,freedom:0.4}},
      collaborative:{workStyle:{people:0.8,communication:0.8,variety:0.4}},
      independent:{workStyle:{autonomy:1,deep_focus:0.8,structure:0.25}}
    },
    priority: {
      stability:{values:{stability:1,structure:0.55}},
      growth:{values:{learning:0.8,income:0.55,impact:0.35}},
      impact:{values:{impact:1,service:0.55,learning:0.45}},
      flexibility:{values:{freedom:1,autonomy:0.75,variety:0.55}}
    },
    learning: {
      project:{practicalFit:{hands_on:1,builder:0.55,autonomy:0.35}},
      structured:{practicalFit:{structure:1,learning:0.7}},
      mentor:{practicalFit:{people:0.55,communication:0.6,learning:0.8}},
      self:{practicalFit:{autonomy:1,learning:0.8,variety:0.45}}
    },
    commitment: {
      explore:{practicalFit:{autonomy:0.35,variety:0.25}},
      validate:{practicalFit:{learning:0.5,analytical:0.35}},
      plan:{practicalFit:{organizing:0.7,structure:0.55}},
      act:{practicalFit:{builder:0.55,autonomy:0.4}}
    }
  },
  parent: {
    work: {
      analytical:{interest:{analytical:0.95,research:0.55,curiosity:0.5},strengths:{analytical:0.8,research:0.5}},
      builder:{interest:{builder:0.95,hands_on:0.75,analytical:0.45},strengths:{builder:0.85,hands_on:0.75}},
      creative:{interest:{creative:0.95,communication:0.6,variety:0.45},strengths:{creative:0.85,communication:0.55}},
      people:{interest:{people:0.95,service:0.7,communication:0.65},strengths:{people:0.85,communication:0.65,service:0.55}},
      quality:{interest:{organizing:0.7,structure:0.65,analytical:0.6},strengths:{organizing:0.8,analytical:0.5}}
    },
    environment: {
      structured:{workStyle:{structure:1,deep_focus:0.65,stability:0.45}},
      dynamic:{workStyle:{variety:1,curiosity:0.65,autonomy:0.45}},
      collaborative:{workStyle:{people:0.8,communication:0.75,variety:0.4}},
      independent:{workStyle:{autonomy:0.9,deep_focus:0.8,structure:0.25}}
    },
    priority: {
      stability:{values:{stability:1,structure:0.5}},
      growth:{values:{learning:0.8,impact:0.45}},
      impact:{values:{impact:1,service:0.55,learning:0.4}},
      flexibility:{values:{flexibility:1,autonomy:0.7,variety:0.55}}
    },
    learning: {
      project:{practicalFit:{hands_on:1,builder:0.55,curiosity:0.4}},
      structured:{practicalFit:{structure:1,learning:0.65}},
      mentor:{practicalFit:{people:0.5,communication:0.55,learning:0.8}},
      self:{practicalFit:{autonomy:0.9,learning:0.8,variety:0.45}}
    },
    commitment: {
      explore:{practicalFit:{autonomy:0.3,variety:0.25}},
      validate:{practicalFit:{learning:0.5,curiosity:0.45}},
      plan:{practicalFit:{organizing:0.65,structure:0.55}},
      act:{practicalFit:{builder:0.5,autonomy:0.35}}
    }
  }
};

const DIRECTION_PROFILES = {
  adult: [
    {id:'software',name:'Software Engineering',icon:'</>',tags:['technology','problem solving'],skills:['Programming','APIs','Testing','Git/CI'],routes:['student','switch','growth'],profile:{interest:{technology:0.95,analytical:0.75},strengths:{analytical:0.9,builder:0.8},workPreference:{builder:0.85,analytical:0.75},workStyle:{deep_focus:0.9,independent:0.7,structure:0.65},values:{learning:0.9,income:0.75,stability:0.65,freedom:0.65},practicalFit:{learning:0.8,autonomy:0.7}} ,tagsForScoring:['analytical','builder','technology','problem solving'],mismatches:['strong_people_service']},
    {id:'data',name:'Data, Science & Research',icon:'◫',tags:['analytics','research'],skills:['SQL','Python','Statistics','Storytelling'],routes:['student','switch','growth'],profile:{interest:{analytical:0.9,research:0.95},strengths:{analytical:0.95,research:0.9},workPreference:{analytical:0.9,research:0.85},workStyle:{deep_focus:0.9,independent:0.65,structure:0.65},values:{learning:0.95,stability:0.7,income:0.7},practicalFit:{learning:0.85,structure:0.6}},tagsForScoring:['analytical','research','analytics'],mismatches:['strong_people_service']},
    {id:'product',name:'Product, Business & Operations',icon:'◎',tags:['business','technology'],skills:['Discovery','Prioritisation','Communication','Analytics'],routes:['switch','growth'],profile:{interest:{commercial:0.8,people:0.75,builder:0.65},strengths:{communication:0.85,organizing:0.8,analytical:0.65},workPreference:{builder:0.7,people:0.75,communication:0.8},workStyle:{collaborative:0.9,variety:0.8,autonomy:0.65},values:{learning:0.85,income:0.75,impact:0.65,freedom:0.65},practicalFit:{organizing:0.75,learning:0.75}},tagsForScoring:['business','technology','communication','people']},
    {id:'finance',name:'Finance, Economics & Risk',icon:'₹',tags:['business','analytics'],skills:['Financial Analysis','Excel','Data','Business Acumen'],routes:['student','switch','growth'],profile:{interest:{analytical:0.85,commercial:0.85},strengths:{analytical:0.9,organizing:0.75},workPreference:{analytical:0.8,quality:0.65},workStyle:{structure:0.9,deep_focus:0.75},values:{stability:0.9,income:0.95,learning:0.7},practicalFit:{structure:0.8,learning:0.65}},tagsForScoring:['business','analytics','quality']},
    {id:'design',name:'Design, UX & Creative Technology',icon:'✦',tags:['creative','technology'],skills:['Research','Interaction Design','Prototyping','Visual Design'],routes:['student','switch','growth'],profile:{interest:{creative:0.95,builder:0.55,people:0.55},strengths:{creative:0.9,communication:0.7},workPreference:{creative:0.9,builder:0.55},workStyle:{variety:0.85,autonomy:0.75,collaborative:0.7},values:{freedom:0.9,learning:0.8,impact:0.55},practicalFit:{hands_on:0.7,autonomy:0.8}},tagsForScoring:['creative','technology','design']},
    {id:'marketing',name:'Marketing, Media & Communication',icon:'↗',tags:['creative','business'],skills:['Content','Growth','Performance','Analytics'],routes:['student','switch','growth'],profile:{interest:{creative:0.85,commercial:0.8,communication:0.95},strengths:{communication:0.95,creative:0.8},workPreference:{communication:0.9,creative:0.8},workStyle:{variety:0.9,collaborative:0.75,autonomy:0.65},values:{freedom:0.85,income:0.7,learning:0.8,impact:0.5},practicalFit:{variety:0.8,autonomy:0.7}},tagsForScoring:['creative','business','communication']},
    {id:'people',name:'People, Education & HR',icon:'◌',tags:['people','service'],skills:['Communication','Coaching','People Analytics','Facilitation'],routes:['student','switch','growth'],profile:{interest:{people:0.98,service:0.95,communication:0.8},strengths:{people:0.9,communication:0.9,service:0.8},workPreference:{people:0.95,communication:0.85},workStyle:{collaborative:0.9,structure:0.65},values:{impact:0.95,stability:0.65,learning:0.75},practicalFit:{people:0.8,learning:0.7}},tagsForScoring:['people','service','communication']},
    {id:'law',name:'Law, Policy & Public Affairs',icon:'§',tags:['research','communication'],skills:['Research','Writing','Argumentation','Policy Analysis'],routes:['student','switch'],profile:{interest:{research:0.9,communication:0.85,people:0.55},strengths:{communication:0.9,analytical:0.8,research:0.85},workPreference:{analytical:0.75,communication:0.8},workStyle:{structure:0.75,deep_focus:0.7,collaborative:0.65},values:{impact:0.85,stability:0.8,learning:0.9},practicalFit:{structure:0.8,learning:0.8}},tagsForScoring:['research','communication','people']},
    {id:'health',name:'Health, Life Sciences & Care',icon:'✚',tags:['science','service'],skills:['Science','Research','Communication','Care'],routes:['student'],profile:{interest:{research:0.85,service:0.9,people:0.7},strengths:{analytical:0.7,people:0.8,service:0.95},workPreference:{research:0.75,people:0.7},workStyle:{structure:0.75,collaborative:0.7},values:{impact:0.95,learning:0.95,stability:0.8},practicalFit:{learning:0.95,structure:0.75}},tagsForScoring:['science','service','people']},
    {id:'built',name:'Architecture, Built & Applied Design',icon:'⌂',tags:['creative','hands-on'],skills:['Design','Materials','Planning','Making'],routes:['student','switch'],profile:{interest:{creative:0.8,builder:0.9},strengths:{creative:0.75,builder:0.9,analytical:0.65},workPreference:{hands_on:0.95,builder:0.9},workStyle:{autonomy:0.7,deep_focus:0.65,collaborative:0.65},values:{impact:0.6,freedom:0.75,learning:0.8},practicalFit:{hands_on:0.95,learning:0.8}},tagsForScoring:['creative','hands-on','builder']},
    {id:'hospitality',name:'Hospitality, Travel & Service',icon:'✧',tags:['people','service'],skills:['Communication','Operations','Guest Experience','Service'],routes:['student','switch'],profile:{interest:{people:0.95,service:0.95,communication:0.85},strengths:{people:0.85,communication:0.85,organizing:0.65},workPreference:{people:0.95,communication:0.85},workStyle:{variety:0.95,collaborative:0.9},values:{freedom:0.6,impact:0.6,learning:0.75},practicalFit:{variety:0.9,people:0.8}},tagsForScoring:['people','service']},
    {id:'entrepreneurship',name:'Entrepreneurship & Independent Work',icon:'↗',tags:['business','ownership'],skills:['Problem Discovery','Sales','Planning','Execution'],routes:['student','switch','growth'],profile:{interest:{commercial:0.9,builder:0.85},strengths:{organizing:0.9,commercial:0.9,builder:0.8},workPreference:{builder:0.85,commercial:0.8},workStyle:{autonomy:0.98,variety:0.9},values:{freedom:0.98,income:0.9,learning:0.95,impact:0.65},practicalFit:{autonomy:0.95,variety:0.9}},tagsForScoring:['business','ownership','builder']}
  ],
  parent: [
    {id:'parent_technology',name:'Technology & Engineering',icon:'⚙',tags:['problem solving','building'],skills:['Maths & logic','Technology','Projects','Systems thinking'],profile:{interest:{analytical:0.9,builder:0.95},strengths:{analytical:0.85,builder:0.9},workPreference:{builder:0.95,analytical:0.75},workStyle:{deep_focus:0.75,independent:0.65,structure:0.6},values:{learning:0.95,stability:0.65},practicalFit:{hands_on:0.8,learning:0.85}},requiredSignals:['builder','analytical']},
    {id:'parent_science',name:'Science, Research & Data',icon:'◫',tags:['curiosity','analysis'],skills:['Science','Analysis','Research','Data literacy'],profile:{interest:{analytical:0.95,research:0.95},strengths:{analytical:0.9,research:0.85},workPreference:{analytical:0.9,research:0.9},workStyle:{deep_focus:0.9,structure:0.7,independent:0.55},values:{learning:1,stability:0.65},practicalFit:{learning:0.9,structure:0.7}},requiredSignals:['analytical','research']},
    {id:'parent_business',name:'Business & Leadership',icon:'◎',tags:['business','people'],skills:['Communication','Problem solving','Decision making','Teamwork'],profile:{interest:{commercial:0.8,people:0.7,builder:0.55},strengths:{communication:0.85,organizing:0.9,people:0.7},workPreference:{people:0.75,organizing:0.8},workStyle:{collaborative:0.85,variety:0.7},values:{impact:0.65,learning:0.85},practicalFit:{organizing:0.8,people:0.65}},requiredSignals:['people','organizing']},
    {id:'parent_design',name:'Design, Media & Communication',icon:'✦',tags:['creative','communication'],skills:['Design','Writing','Communication','Storytelling'],profile:{interest:{creative:0.95,communication:0.8},strengths:{creative:0.9,communication:0.8},workPreference:{creative:0.9,communication:0.8},workStyle:{variety:0.85,collaborative:0.7,autonomy:0.65},values:{freedom:0.9,impact:0.6,learning:0.8},practicalFit:{hands_on:0.65,autonomy:0.75}},requiredSignals:['creative','communication']},
    {id:'parent_people',name:'People, Education & Society',icon:'◌',tags:['people','impact'],skills:['Communication','Empathy','Research','Facilitation'],profile:{interest:{people:0.98,service:0.9,communication:0.8},strengths:{people:0.95,communication:0.85,service:0.85},workPreference:{people:0.95,communication:0.8},workStyle:{collaborative:0.9,structure:0.6},values:{impact:1,learning:0.8,stability:0.6},practicalFit:{people:0.85,communication:0.7}},requiredSignals:['people','service']},
    {id:'parent_health',name:'Health & Life Sciences',icon:'✚',tags:['science','care'],skills:['Science','Observation','Communication','Care'],profile:{interest:{research:0.85,service:0.95,analytical:0.75},strengths:{analytical:0.7,people:0.8,service:0.95},workPreference:{research:0.75,people:0.7},workStyle:{structure:0.75,collaborative:0.7},values:{impact:1,learning:0.95,stability:0.8},practicalFit:{learning:0.95,structure:0.75}},requiredSignals:['service','research']},
    {id:'parent_built',name:'Architecture, Built & Applied',icon:'⌂',tags:['creative','hands-on'],skills:['Design','Materials','Planning','Making'],profile:{interest:{creative:0.8,builder:0.9},strengths:{creative:0.75,builder:0.9},workPreference:{hands_on:0.95,builder:0.9},workStyle:{autonomy:0.7,deep_focus:0.65},values:{freedom:0.75,learning:0.8},practicalFit:{hands_on:0.95,learning:0.8}},requiredSignals:['builder','creative']}
  ]
};

function normalizeProfile(profile, dimensions){
  const out={};
  Object.keys(profile||{}).forEach(category=>{out[category]=vec(profile[category],dimensions);});
  return out;
}

function cosineSimilarity(a,b){
  const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);
  let dot=0,na=0,nb=0;
  keys.forEach(k=>{const x=Number(a[k]||0),y=Number(b[k]||0);dot+=x*y;na+=x*x;nb+=y*y;});
  if(!na||!nb) return 0;
  return dot/(Math.sqrt(na)*Math.sqrt(nb));
}

function buildFreeProfile(answers,audience){
  const kind=audience==='parent'?'parent':'adult';
  const dims=kind==='parent'?PARENT_DIMENSIONS:ADULT_DIMENSIONS;
  const mappings=ANSWER_MAPPINGS[kind];
  const profile={interest:{},strengths:{},workPreference:{},workStyle:{},values:{},practicalFit:{}};
  const add=(category,m)=>Object.entries(m||{}).forEach(([d,v])=>{profile[category][d]=(profile[category][d]||0)+v;});
  const workMap=mappings.work[answers.work];
  if(workMap){add('interest',workMap.interest);add('strengths',workMap.strengths);add('workPreference',workMap.interest);}
  const env=mappings.environment[answers.environment]; if(env)add('workStyle',env.workStyle);
  const priority=mappings.priority[answers.priority]; if(priority)add('values',priority.values);
  const learning=mappings.learning[answers.learning]; if(learning)add('practicalFit',learning.practicalFit);
  const commitment=mappings.commitment[answers.commitment]; if(commitment)add('practicalFit',commitment.practicalFit);
  return normalizeProfile(profile,dims);
}

function categorySimilarities(userProfile,directionProfile){
  return Object.fromEntries(Object.keys(FREE_ENGINE_CONFIG.categoryWeights).map(cat=>[cat,cosineSimilarity(userProfile[cat]||{},directionProfile[cat]||{})*100]));
}

function intentAdjustment(answers,direction,audience){
  let p=0;
  const routes=direction.routes||[];
  if(audience!=='parent'){
    if(answers.intent==='switch'&&routes.includes('switch'))p+=3;
    if(answers.intent==='growth'&&routes.includes('growth'))p+=3;
    if(answers.intent==='learning')p+=1;
  } else {
    if(answers.intent==='switch'&&['parent_business','parent_design','parent_technology'].includes(direction.id))p+=1.5;
    if(answers.intent==='learning')p+=1;
  }
  return p;
}

function mismatchPenalty(answers,direction,audience){
  let penalty=0;
  if(answers.environment==='structured' && direction.profile.workStyle && (direction.profile.workStyle.variety||0)>0.8 && (direction.profile.workStyle.structure||0)<0.5) penalty+=3;
  if(answers.environment==='independent' && direction.profile.workStyle && (direction.profile.workStyle.collaborative||0)>0.85 && (direction.profile.workStyle.autonomy||0)<0.5) penalty+=3;
  if(answers.environment==='collaborative' && direction.profile.workStyle && (direction.profile.workStyle.deep_focus||0)>0.88 && (direction.profile.workStyle.people||0)<0.4) penalty+=2;
  if(answers.priority==='stability' && direction.profile.values && (direction.profile.values.stability||0)<0.5) penalty+=5;
  if(answers.priority==='flexibility' && direction.profile.values && (direction.profile.values.freedom||0)<0.5) penalty+=4;
  if(answers.priority==='impact' && direction.profile.values && (direction.profile.values.impact||0)<0.5) penalty+=3;
  return penalty;
}

function directionScore(answers,userProfile,direction,audience){
  const sims=categorySimilarities(userProfile,direction.profile);
  const base=Object.entries(FREE_ENGINE_CONFIG.categoryWeights).reduce((sum,[cat,w])=>sum+sims[cat]*w,0);
  const adjusted=base+intentAdjustment(answers,direction,audience)-mismatchPenalty(answers,direction,audience);
  return {score:Math.max(0,Math.min(100,adjusted)),similarities:sims,penalty:mismatchPenalty(answers,direction,audience)};
}

function signalFor(score,margin){
  const t=FREE_ENGINE_CONFIG.signalThresholds;
  if(score>=t.strongScore && margin>=t.strongMargin) return 'Strong signal';
  if(score>=t.moderateScore) return 'Moderate signal';
  return 'Early signal';
}

function topSignals(userProfile,direction){
  const pairs=[];
  const names={
    analytical:'analytical problem-solving',creative:'creative thinking',people:'working with people',builder:'building and creating',communication:'communication',organizing:'organising',research:'curiosity and research',commercial:'business thinking',service:'helping and service',autonomy:'independence',variety:'variety',structure:'structure',hands_on:'hands-on activity',deep_focus:'focused work',learning:'learning and growth',stability:'stability',impact:'meaningful impact',income:'financial progress',freedom:'freedom and flexibility',flexibility:'room to explore',curiosity:'curiosity'
  };
  const d=direction.profile;
  Object.entries(userProfile).forEach(([cat,vec1])=>Object.entries(vec1).forEach(([dim,u])=>{
    const v=(d[cat]||{})[dim]||0;
    if(u>0&&v>0)pairs.push({score:u*v,label:names[dim]||dim});
  }));
  return [...new Map(pairs.sort((a,b)=>b.score-a.score).map(x=>[x.label,x])).values()].slice(0,3).map(x=>x.label);
}

function selectDiverse(recs,n=3){
  const selected=[];
  const seen=new Set();
  for(const r of recs){
    const signature=[...(r.direction.tagsForScoring||r.direction.tags||[])].slice(0,2).sort().join('|');
    if(selected.length===0 || !seen.has(signature)){
      selected.push(r);seen.add(signature);
    }
    if(selected.length===n)break;
  }
  for(const r of recs){if(selected.length===n)break;if(!selected.includes(r))selected.push(r);}
  return selected;
}

function generateRecommendations(answers,audience){
  const kind=audience==='parent'?'parent':'adult';
  const directions=DIRECTION_PROFILES[kind];
  const userProfile=buildFreeProfile(answers,audience);
  const scored=directions.map(direction=>{
    const ds=directionScore(answers,userProfile,direction,audience);
    return {direction, ...ds};
  }).sort((a,b)=>b.score-a.score);
  const chosen=selectDiverse(scored,3);
  const margin=chosen.length>1?chosen[0].score-chosen[1].score:chosen[0].score;
  const signal=signalFor(chosen[0].score,margin);
  return {userProfile,scored,chosen,signal,topSignals:topSignals(userProfile,chosen[0].direction),margin};
}
