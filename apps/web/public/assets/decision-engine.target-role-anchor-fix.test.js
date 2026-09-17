/* Fix A (target-role anchoring) regression tests.
 * Load decision-data.js (career-mapping.js / decision-engine.js / student-stream-careers-
 * data.js are not required — this only exercises generateRecommendations), then run this
 * file in a browser console (same pattern as the other decision-engine.*.test.js files).
 * Writes results to window.CAREER_DIYA_TARGET_ROLE_ANCHOR_FIX_TESTS.
 */
(function () {
  const failures = [];
  const assert = (name, condition, details) => {
    if (!condition) failures.push({ name, details });
    console.log((condition ? '✅ ' : '❌ ') + name, details || '');
  };

  // ── The exact failing case from the screenshot ───────────────────────────────────────
  // Software Developer -> GROW -> target "Senior Software Engineer", with creative-
  // leaning answers that (confirmed empirically, pre-fix) score design_ux well above
  // software_engineering on raw cosine similarity alone.
  const screenshotAnswers = {
    stage: 'mid', intent: 'growth', work: 'creative', environment: 'dynamic',
    priority: 'flexibility', learning: 'self', commitment: 'explore',
  };

  const withoutTarget = generateRecommendations(screenshotAnswers, 'professional', 'Software Developer');
  assert('sanity check: WITHOUT a target role, design_ux legitimately outscores software_engineering on these answers (proves the fix changes a real outcome, not a no-op case)',
    withoutTarget.chosen[0].direction.id === 'design' && withoutTarget.anchoredDirectionId === null,
    withoutTarget.chosen.map((c) => `${c.direction.id}(${c.score.toFixed(1)})`));

  const withTarget = generateRecommendations(screenshotAnswers, 'professional', 'Software Developer', 'Senior Software Engineer');
  assert('screenshot case: WITH target "Senior Software Engineer", Software Engineering is primary',
    withTarget.chosen[0].direction.id === 'software', withTarget.chosen.map((c) => c.direction.id));
  assert('screenshot case: anchoredDirectionId reports the anchor happened (for honest explanation text)',
    withTarget.anchoredDirectionId === 'software');
  assert('screenshot case: the honest-adjacent nudge is preserved — design_ux still surfaces as an alternate, not suppressed',
    withTarget.chosen.slice(1).some((c) => c.direction.id === 'design'), withTarget.chosen.map((c) => c.direction.id));
  assert('screenshot case: the anchored direction keeps its OWN real score (no fabricated boost) — score is honest even though it lost on raw ranking',
    withTarget.chosen[0].score === withoutTarget.scored.find((x) => x.direction.id === 'software').score);

  // ── No to-role selected: ranking unchanged from current (pre-Fix-A) behaviour ────────

  const growBase = { stage: 'mid', intent: 'growth', work: 'people', environment: 'collaborative', priority: 'impact', learning: 'mentor', commitment: 'plan' };
  const noTargetOmitted = generateRecommendations(growBase, 'professional', 'Software Engineer');
  const noTargetExplicitNull = generateRecommendations(growBase, 'professional', 'Software Engineer', null);
  assert('omitting targetRole vs. explicitly passing null produce identical rankings',
    JSON.stringify(noTargetOmitted.chosen.map((c) => c.direction.id)) === JSON.stringify(noTargetExplicitNull.chosen.map((c) => c.direction.id)));
  assert('no target selected: anchoredDirectionId is null (no-op path taken)',
    noTargetOmitted.anchoredDirectionId === null && noTargetExplicitNull.anchoredDirectionId === null);

  // ── Primary-eligibility invariant still holds, target role or not ───────────────────

  const anchoredToProduct = generateRecommendations(growBase, 'professional', 'Software Engineer', 'Product Manager');
  assert('with a target set, an unrelated family (People/HR) still never becomes primary',
    !anchoredToProduct.chosen.some((c) => c.direction.id === 'people'), anchoredToProduct.chosen.map((c) => c.direction.id));
  assert('with a target set, an unrelated family (Hospitality) still never becomes primary',
    !anchoredToProduct.chosen.some((c) => c.direction.id === 'hospitality'), anchoredToProduct.chosen.map((c) => c.direction.id));
  assert('with a target set, the primaryEligible flag for the unrelated family is still false (gate itself untouched)',
    anchoredToProduct.scored.find((x) => x.direction.id === 'people').primaryEligible === false);
  assert('anchoring an in-pool adjacent (Product Manager) actually took effect',
    anchoredToProduct.anchoredDirectionId === 'product' && anchoredToProduct.chosen[0].direction.id === 'product');

  // ── Defensive: a target role outside the eligible pool fails open, never crashes, never bypasses the gate ──

  const outOfPoolTarget = generateRecommendations(growBase, 'professional', 'Software Engineer', 'HR Manager');
  assert('a target role outside the eligible pool does not anchor anything (fails open, not a gate bypass)',
    outOfPoolTarget.anchoredDirectionId === null);
  assert('a target role outside the eligible pool still leaves People/HR excluded from primary',
    !outOfPoolTarget.chosen.some((c) => c.direction.id === 'people'));

  // ── SWITCH/EXPLORE intents are unaffected — anchoring is GROW-only by construction ───

  const switchWithTarget = generateRecommendations({ ...growBase, intent: 'switch' }, 'professional', 'Software Engineer', 'Product Manager');
  assert('a target role passed under SWITCH intent does not anchor (this feature is GROW-only; the to-role step never renders for other intents)',
    switchWithTarget.anchoredDirectionId === null);

  const passed = failures.length === 0;
  console.log(passed ? 'FIX-A-TARGET-ROLE-ANCHOR: ALL PASS' : 'FIX-A-TARGET-ROLE-ANCHOR: FAILURES', failures);
  window.CAREER_DIYA_TARGET_ROLE_ANCHOR_FIX_TESTS = { passed, failures };
  return passed;
})();
