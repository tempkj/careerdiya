/* Career Diya entitlement abstraction.
 * There is no billing/subscription system yet, so every user resolves to the
 * free tier. This is the single seam a future paid check (booking/subscription
 * lookup) should replace — nothing else in the codebase should decide
 * free-vs-paid on its own.
 */
(function () {
  const cfg = (window.CareerDiyaExplorationConfig || {}).EXPLORATION_CONFIG || { free: { visibleCount: 1, storageLimit: 1 } };

  async function getUserEntitlements() {
    // TODO: once Career Diya paid services (S4/S5) exist, check a real
    // entitlement source (e.g. an active booking/subscription record) here
    // and return 'paid' when applicable. Until then, honestly report 'free'.
    const tier = 'free';
    return { tier, ...cfg[tier] };
  }

  window.CareerDiyaEntitlements = { getUserEntitlements };
})();
