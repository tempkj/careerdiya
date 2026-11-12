/* ADR-CAREERDIY-0015 deterministic browser-console regression tests.
 * Load decision-data.js, then run this file in a browser console (same pattern as
 * decision-engine.adr-cd-001.test.js). Writes results to
 * window.CAREER_DIYA_LLM_ENRICHMENT_TESTS and prints a console table.
 *
 * These cover the client-side half of the deterministic-floor + LLM-enrichment
 * invariants. The LLM-cannot-override-direction guarantee itself is tested server-side
 * in apps/web/src/modules/careerdiya/application/enrichmentCache.test.ts
 * ("drops a rogue 'direction' field") — that type has no `direction` field for a model
 * response to smuggle one through, so there is nothing for the client to additionally
 * guard against beyond always rendering result.chosen[0].direction (which these tests
 * confirm is untouched by this change).
 */
(function(){
  const failures=[];
  const assert=(name,condition,details)=>{
    if(!condition) failures.push({name,details});
    console.log((condition?'✅ ':'❌ ')+name,details||'');
  };
  const base={stage:'mid',work:'people',environment:'collaborative',priority:'impact',learning:'mentor',commitment:'plan'};

  // Checks "bumped past the ADR-CD-001 baseline", not an exact string — later fixes
  // (e.g. Fix A's target-role anchoring) legitimately bump this further; pinning to one
  // exact value here would make this assertion go stale on every future, unrelated bump.
  assert('FREE_ENGINE_CONFIG.version bumped for the LLM-enrichment envelope change',
    FREE_ENGINE_CONFIG.version!=='1.1-context-routing', FREE_ENGINE_CONFIG.version);

  // Same fixture as ADR-CD-001's regression test, re-run here: the deterministic gate
  // that decides the rendered direction is completely untouched by this change.
  let r=generateRecommendations({...base,intent:'growth'},'professional','Software Engineer');
  assert('Software Engineer + GROW => People/HR still not primary (gate unaffected by enrichment)',
    !r.chosen.some(x=>x.direction.id==='people'),
    r.chosen.map(x=>x.direction.name));

  assert('isBoundedRoleValue: a curated alias is bounded',
    isBoundedRoleValue('Software Engineer')===true);
  assert('isBoundedRoleValue: case/whitespace-insensitive',
    isBoundedRoleValue('  software   ENGINEER  ')===true);
  assert('isBoundedRoleValue: an unmapped free-text role is NOT bounded => deterministic-only path',
    isBoundedRoleValue('Underwater Basket Weaving Instructor')===false);
  assert('isBoundedRoleValue: empty/null is not bounded',
    isBoundedRoleValue('')===false && isBoundedRoleValue(null)===false);

  const groups=buildRoleDropdownGroups();
  assert('buildRoleDropdownGroups covers all 12 starter role families',
    groups.length===Object.keys(STARTER_ROLE_FAMILIES).length, groups.length);
  const allOptions=groups.flatMap(g=>g.options);
  assert('every dropdown option is bounded (round-trips through isBoundedRoleValue)',
    allOptions.every(o=>isBoundedRoleValue(o)),
    allOptions.filter(o=>!isBoundedRoleValue(o)));
  assert('dropdown options are de-duplicated within each family',
    groups.every(g=>new Set(g.options).size===g.options.length),
    groups.map(g=>[g.label,g.options.length]));

  assert('titleCaseRole applies curated acronym casing',
    titleCaseRole('hr manager')==='HR Manager' && titleCaseRole('ux designer')==='UX Designer');

  const passed=failures.length===0;
  console.log(passed?'ADR-CAREERDIY-0015: ALL PASS':'ADR-CAREERDIY-0015: FAILURES',failures);
  window.CAREER_DIYA_LLM_ENRICHMENT_TESTS={passed,failures};
  return passed;
})();
