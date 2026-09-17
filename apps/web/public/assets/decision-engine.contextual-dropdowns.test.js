/* ADR-CAREERDIY-0016 deterministic browser-console regression tests.
 * Load decision-data.js, career-mapping.js and student-stream-careers-data.js, then run
 * this file in a browser console (same pattern as decision-engine.adr-cd-001.test.js /
 * decision-engine.llm-enrichment.test.js). Writes results to
 * window.CAREER_DIYA_CONTEXTUAL_DROPDOWNS_TESTS and prints a console table.
 *
 * These test the pure, DOM-free logic/markup-builder functions extracted specifically
 * for this purpose (buildToRoleGroups, resolveStreamSelection, buildStudentEntryChoiceHtml,
 * buildStreamResultsHtml, buildStreamEdgeGuideHtml) — decision-engine.js's interactive
 * wiring (event listeners, fetch calls) is exercised manually/visually, consistent with
 * this file having no jsdom/browser-DOM test runner.
 */
(function(){
  const failures=[];
  const assert=(name,condition,details)=>{
    if(!condition) failures.push({name,details});
    console.log((condition?'✅ ':'❌ ')+name,details||'');
  };

  // ── Professional GROW: to-role list is progressions/adjacents, never unrelated ──────

  const softwareGroups = buildToRoleGroups('Software Engineer');
  assert('Software Engineer to-role pool exists and is non-empty',
    !!softwareGroups && softwareGroups.groups.length>0);
  const softwareOptionLabels = (softwareGroups?softwareGroups.groups:[]).map(g=>g.label);
  assert('Software Engineer to-role pool covers Software Engineering itself',
    softwareOptionLabels.includes('Software Engineering'), softwareOptionLabels);
  assert('Software Engineer to-role pool never includes People/HR (unrelated family)',
    !softwareOptionLabels.includes('People, Education & HR'), softwareOptionLabels);
  assert('Software Engineer to-role pool never includes Hospitality (unrelated family)',
    !softwareOptionLabels.includes('Hospitality, Travel & Service'), softwareOptionLabels);
  assert('Software Engineer to-role pool matches exactly {family, adjacent} — same set the GROW eligibility gate uses',
    (()=>{
      const r=generateRecommendations({stage:'mid',intent:'growth',work:'people',environment:'collaborative',priority:'impact',learning:'mentor',commitment:'plan'},'professional','Software Engineer');
      const eligibleLabels=new Set(r.scored.filter(x=>x.primaryEligible).map(x=>STARTER_ROLE_FAMILIES[x.roleFamily]?.label).filter(Boolean));
      return softwareOptionLabels.every(l=>eligibleLabels.has(l)) && [...eligibleLabels].every(l=>softwareOptionLabels.includes(l));
    })());
  assert('to-role pool excludes the from-role itself',
    !softwareGroups.groups.some(g=>g.options.some(o=>normalizeRoleText(o)===normalizeRoleText('Software Engineer'))));
  assert('an unmapped/unbounded from-role yields no to-role pool (defensive, never a dead end — falls through to the existing flow)',
    buildToRoleGroups('Underwater Basket Weaver')===null);

  // ── Student: known stream renders a stream-relevant primary set + both co-primary entries ──

  const entryHtml = buildStudentEntryChoiceHtml({eyebrow:'e',title:'t',copy:'c',benefits:['b']});
  const streamBtnMatch = entryHtml.match(/class="([^"]*)" id="startStreamPath"/);
  const prefBtnMatch = entryHtml.match(/class="([^"]*)" id="startPreferencePath"/);
  assert('student start screen renders both co-primary entry points',
    !!streamBtnMatch && !!prefBtnMatch);
  assert('both co-primary entry points share the exact same class list (equal prominence, not a styling claim)',
    !!streamBtnMatch && !!prefBtnMatch && streamBtnMatch[1]===prefBtnMatch[1], [streamBtnMatch&&streamBtnMatch[1], prefBtnMatch&&prefBtnMatch[1]]);

  const commerceEntry = streamCareersFor('school_stream','commerce');
  assert('a known school-stream entry has a populated careerIds set to test against',
    !!commerceEntry && commerceEntry.careerIds.length>0);
  const streamResultsHtml = buildStreamResultsHtml(commerceEntry,'school_stream');
  assert('known stream -> primary set renders at least one resolved career name',
    /Chartered Accountancy|Investment Banking|Financial Analysis|Business Management|Company Secretaryship/.test(streamResultsHtml));
  assert('known stream results screen always carries "Explore paths beyond my field" (co-primary, always-visible, not buried)',
    streamResultsHtml.includes('id="exploreBeyondField"') && streamResultsHtml.includes('Explore paths beyond my field'));

  // ── Uncommon stream / edge guide: no verdict, disclaimer always present ─────────────

  assert('resolveStreamSelection: known stream with content -> results',
    resolveStreamSelection('school_stream','commerce').kind==='results');
  assert('resolveStreamSelection: explicit "not listed" -> edge (never a dead end)',
    resolveStreamSelection('school_stream',STREAM_NOT_LISTED_VALUE).kind==='edge');
  assert('resolveStreamSelection: unknown key entirely -> edge (never a dead end)',
    resolveStreamSelection('school_stream','totally_made_up_stream').kind==='edge');
  assert('resolveStreamSelection: a known stream whose content is still an empty stub -> edge (partial content rollout is never a blank screen)',
    resolveStreamSelection('school_stream','arts_humanities').kind==='edge');
  assert('resolveStreamSelection: no selection -> null (caller does not submit, never a premature dead end)',
    resolveStreamSelection('school_stream','')===null);

  const edgeGuideHtml = buildStreamEdgeGuideHtml();
  assert('edge guide screen renders the non-removable disclaimer in its static initial markup — present before any model call, so it cannot depend on what the model returns',
    edgeGuideHtml.includes('These are general starting points, not a personalised read'));
  assert('edge guide disclaimer offers both handoffs (explorer + counsellor)',
    /run the free explorer/.test(edgeGuideHtml) && /talk to a counsellor/.test(edgeGuideHtml));
  assert('edge guide screen always carries "Explore paths beyond my field" too, even before any fetch resolves',
    edgeGuideHtml.includes('id="exploreBeyondFieldGuide"'));

  // ── Global: every path resolves — no reachable dead end ─────────────────────────────

  assert('every school_stream option resolves to either results or edge, never throws or returns undefined',
    (streamOptionsFor('school_stream')||[]).every(o=>{
      const r=resolveStreamSelection('school_stream',o.key);
      return r && (r.kind==='results'||r.kind==='edge');
    }));
  assert('every ug_major option resolves to either results or edge, never throws or returns undefined',
    (streamOptionsFor('ug_major')||[]).every(o=>{
      const r=resolveStreamSelection('ug_major',o.key);
      return r && (r.kind==='results'||r.kind==='edge');
    }));

  const passed=failures.length===0;
  console.log(passed?'ADR-CAREERDIY-0016: ALL PASS':'ADR-CAREERDIY-0016: FAILURES',failures);
  window.CAREER_DIYA_CONTEXTUAL_DROPDOWNS_TESTS={passed,failures};
  return passed;
})();
