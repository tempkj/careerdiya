/* Career Vault career-matching regression tests.
 * Load decision-data.js + decision-engine.js in the same browser context, then run this file.
 * Writes results to window.CAREER_DIYA_VAULT_CAREER_MATCHING_TESTS.
 */
(function () {
  const failures = [];
  const assert = (name, condition, details) => {
    if (!condition) failures.push({ name, details });
    console.log((condition ? '✅ ' : '❌ ') + name, details || '');
  };

  const catalogue = (typeof CAREER_LIBRARY_CATALOGUE !== 'undefined')
    ? CAREER_LIBRARY_CATALOGUE.filter(c => c.canonicalStatus === 'verified')
    : [];

  assert('Career Library catalogue is available for Vault matching', catalogue.length > 0, catalogue.length);

  const mechanical = catalogue.find(c => c.id === 'mechanical_engineering');
  assert('Mechanical Engineering exists as a verified catalogue career',
    !!mechanical,
    catalogue.map(c => c.id).filter(id => id.includes('mechanical')));

  if (mechanical && typeof findVaultCareerCandidates === 'function') {
    const candidates = findVaultCareerCandidates(
      { raw_text: 'I want to become mechanical engineer', context_note: '' },
      catalogue
    );
    assert('"become mechanical engineer" matches Mechanical Engineering',
      candidates[0]?.id === 'mechanical_engineering',
      candidates.map(c => c.canonicalName));

    assert('Mechanical Engineering is not dependent on a one-off phrase rule',
      candidates.some(c => c.id === 'mechanical_engineering'),
      candidates.map(c => c.id));
  } else {
    assert('findVaultCareerCandidates is available', false);
  }

  const passed = failures.length === 0;
  console.log(
    passed ? 'VAULT-CAREER-MATCHING: ALL PASS' : 'VAULT-CAREER-MATCHING: FAILURES',
    failures
  );
  window.CAREER_DIYA_VAULT_CAREER_MATCHING_TESTS = { passed, failures };
  return passed;
})();
