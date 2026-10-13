/* Regression guard for Career Diya career-page returning-user context recovery.
 * Run: node apps/web/public/assets/career-context-session-recovery.test.js
 * This is a source-level guard for the static page's auth/profile orchestration;
 * it does not replace a live Supabase browser test.
 */
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'career.html'), 'utf8');
const failures = [];
function assert(name, condition) {
  if (!condition) failures.push(name);
  console.log((condition ? '✅ ' : '❌ ') + name);
}

const start = source.indexOf('async function renderCareer(career');
const end = source.indexOf('\nfunction ', start + 1);
const render = source.slice(start, end > start ? end : undefined);

assert('career page attempts Supabase session refresh before choosing guest state',
  render.indexOf('auth.refreshLocalSession()') >= 0 &&
  render.indexOf('let authenticated=false') >= 0);
assert('session refresh failure falls back to cached session/auth helper instead of immediately showing guest copy',
  render.includes('checking existing auth state') &&
  render.includes('auth.getSession()?.access_token') &&
  render.includes('auth.isAuthenticated()'));
assert('profile fetch is only attempted for an authenticated session',
  render.includes('if(authenticated && auth?.getProfile)'));
assert('profile loading failure is kept distinct in diagnostics from an unauthenticated visitor',
  render.includes('Authenticated profile could not be loaded'));
assert('transition lens and career-match context are rendered after profile resolution',
  render.indexOf('renderCareerMatchContext(career,profile,savedExploration,contextRecords)') >
  render.indexOf('if(authenticated && auth?.getProfile)') &&
  render.indexOf('renderCareerTransitionLens(career,profile,savedExploration)') >
  render.indexOf('renderCareerMatchContext(career,profile,savedExploration,contextRecords)'));

if (failures.length) {
  console.error('\nFailed checks:', failures);
  process.exitCode = 1;
} else {
  console.log('\nAll Career Diya returning-user context source checks passed.');
}