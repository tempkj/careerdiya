/* Career Diya exploration configuration.
 * Central place for the engine version and free/paid history limits.
 * visibleCount = how many of the user's stored explorations the UI shows.
 * storageLimit = how many explorations the database will actually keep for that tier.
 * The two are independent: a tier could see fewer than it stores, or vice versa.
 */
const EXPLORATION_ENGINE_VERSION = 'free-exploration-v1';

const EXPLORATION_CONFIG = {
  free: {
    visibleCount: 1,
    storageLimit: 1
  },
  paid: {
    visibleCount: 3,
    storageLimit: 10
  }
};

window.CareerDiyaExplorationConfig = { EXPLORATION_ENGINE_VERSION, EXPLORATION_CONFIG };
