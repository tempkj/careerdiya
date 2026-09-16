/*
 * ADR-CD-001 regression fixtures.
 * Run in a browser console after loading decision-data.js.
 */
(function(){
  const checks = [];
  const adult = (answers, role) => generateRecommendations(answers, 'professional', role);

  function assert(name, condition){
    checks.push({name, pass:!!condition});
    if(!condition) console.error('ADR-CD-001 FAIL:', name);
  }

  const base = {
    stage:'mid', work:'people', environment:'collaborative',
    priority:'impact', learning:'mentor', commitment:'plan'
  };

  let r = adult({...base, intent:'growth'}, 'Software Engineer');
  assert('Software Engineer + GROW excludes People/HR from primary', !r.chosen.some(x=>x.direction.id==='people'));
  assert('Software Engineer + GROW keeps Software Engineering eligible', r.scored.find(x=>x.direction.id==='software')?.primaryEligible === true);
  assert('Software Engineer + GROW allows approved adjacent Product', r.scored.find(x=>x.direction.id==='product')?.primaryEligible === true);

  r = adult({...base, intent:'switch'}, 'Software Engineer');
  assert('Software Engineer + SWITCH allows approved adjacent', r.scored.find(x=>x.direction.id==='product')?.primaryEligible === true);
  assert('Software Engineer + SWITCH excludes unapproved People/HR', r.scored.find(x=>x.direction.id==='people')?.primaryEligible === false);

  r = adult({...base, intent:'growth'}, 'Quantum Systems Architect');
  assert('Unknown role + GROW safely widens', r.scored.every(x=>x.primaryEligible === true));

  r = adult({...base, intent:'learning'}, 'Quantum Systems Architect');
  assert('Unknown role + SKILL safely widens', r.scored.every(x=>x.primaryEligible === true));

  r = adult({...base, intent:'choice'}, 'Software Engineer');
  assert('EXPLORE remains broad', r.scored.every(x=>x.primaryEligible === true));

  r = generateRecommendations({...base, intent:'growth'}, 'student', null);
  assert('Student/no role has no role-family restriction', r.scored.every(x=>x.primaryEligible === true));

  r = adult({...base, intent:'growth'}, 'Software Developer');
  assert('Software Developer alias maps to software family', r.context.roleFamily === 'software_engineering');

  console.table(checks);
  window.CAREER_DIYA_ADR_CD_001_TESTS = checks;
  return checks.every(x=>x.pass);
})();
