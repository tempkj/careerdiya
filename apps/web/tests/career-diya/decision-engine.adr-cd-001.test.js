/* ADR-CD-001 deterministic browser-console regression tests. */
(function(){
  const failures=[];
  const assert=(name,condition,details)=>{
    if(!condition) failures.push({name,details});
    console.log((condition?'✅ ':'❌ ')+name,details||'');
  };
  const base={stage:'mid',work:'people',environment:'collaborative',priority:'impact',learning:'mentor',commitment:'plan'};

  let r=generateRecommendations({...base,intent:'growth'},'professional','Software Engineer');
  assert('Software Engineer + GROW => People/HR not primary',
    !r.chosen.some(x=>x.direction.id==='people'),
    r.chosen.map(x=>x.direction.name));
  assert('Software Engineer + GROW => Hospitality not primary',
    !r.chosen.some(x=>x.direction.id==='hospitality'),
    r.chosen.map(x=>x.direction.name));
  assert('Software Engineering eligible under GROW',
    r.scored.find(x=>x.direction.id==='software')?.primaryEligible===true);
  assert('Approved adjacent Product eligible under GROW',
    r.scored.find(x=>x.direction.id==='product')?.primaryEligible===true);
  assert('Unrelated People/HR excluded under GROW',
    r.scored.find(x=>x.direction.id==='people')?.primaryEligible===false);
  assert('Unrelated Hospitality excluded under GROW',
    r.scored.find(x=>x.direction.id==='hospitality')?.primaryEligible===false);

  r=generateRecommendations({...base,intent:'switch'},'professional','Software Engineer');
  assert('SWITCH permits approved adjacent Product',
    r.scored.find(x=>x.direction.id==='product')?.primaryEligible===true);
  assert('SWITCH still excludes unapproved People/HR',
    r.scored.find(x=>x.direction.id==='people')?.primaryEligible===false);

  r=generateRecommendations({...base,intent:'growth'},'professional','Unknown Role XYZ');
  assert('Unknown role + GROW safely widens',
    r.context.roleFamily===null && r.scored.every(x=>x.primaryEligible===true));

  r=generateRecommendations({...base,intent:'learning'},'professional','Unknown Role XYZ');
  assert('Unknown role + SKILL safely widens',
    r.context.intent==='SKILL' && r.scored.every(x=>x.primaryEligible===true));

  r=generateRecommendations({...base,intent:'choice'},'professional','Software Engineer');
  assert('EXPLORE remains broad',
    r.context.intent==='EXPLORE' && r.scored.every(x=>x.primaryEligible===true));

  r=generateRecommendations({...base,intent:'growth'},'student',null);
  assert('Student/no role has no role-family restriction',
    r.scored.every(x=>x.primaryEligible===true));

  r=generateRecommendations({...base,intent:'growth'},'professional','Software Developer');
  assert('Software Developer maps to software_engineering',
    r.context.roleFamily==='software_engineering');

  r=generateRecommendations({...base,intent:'growth'},'professional','Senior Software Engineer');
  assert('Senior Software Engineer maps to software_engineering',
    r.context.roleFamily==='software_engineering');

  // Student stream lens must open the canonical Career Library career, not treat a
  // career id such as software_engineering as a Career Diya direction id.
  const studentStreamHtml=buildStreamResultsHtml(
    {label:'Computer Science',careerIds:['software_engineering']},
    'major'
  );
  assert('Student stream card uses careerId for canonical career navigation',
    studentStreamHtml.includes('career.html?careerId=software_engineering&audience=student') &&
    !studentStreamHtml.includes('career.html?direction=software_engineering&audience=student'));

  const passed=failures.length===0;
  console.log(passed?'ADR-CD-001: ALL PASS':'ADR-CD-001: FAILURES',failures);
  window.CAREER_DIYA_ADR_CD_001_TESTS={passed,failures};
  return passed;
})();
