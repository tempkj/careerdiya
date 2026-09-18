/* Fix (state-contamination, round 2) regression tests.
 *
 * Unlike the other *.test.js files in this directory, this one does NOT run against an
 * already-loaded page — career.html's inline script has top-level, auto-running logic
 * (renderCareer -> CareerDiyaCareerLibrary.loadCareerProfile -> an external service) that
 * makes "open the page and run this in the console" impractical without a fully seeded
 * live environment. Instead this file, run under Node, extracts career.html's own inline
 * <script>...</script> content and evaluates it directly against a minimal DOM/auth mock —
 * so the assertions below exercise the REAL shipped markup's wireCareerAsanaBridge /
 * wireRelatedCareerOptions functions, not a reimplementation of them.
 *
 * Run: node apps/web/public/assets/career.state-leak-fix.test.js
 */
const fs = require('node:fs');
const path = require('node:path');

const failures = [];
const assert = (name, condition, details) => {
  if (!condition) failures.push({ name, details });
  console.log((condition ? '✅ ' : '❌ ') + name, details === undefined ? '' : JSON.stringify(details));
};

function extractInlineScript(html) {
  // career.html has exactly one <script> tag with no src attribute — everything else is
  // <script src="...">. Grab that one's body.
  const matches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)];
  const inline = matches.find((m) => !/\ssrc=/.test(m[0]));
  if (!inline) throw new Error('extractInlineScript: no inline <script> block found in career.html');
  return inline[1];
}

function makeFakeElement() {
  return { style: {}, disabled: false, textContent: '', onclick: null, addEventListener() {} };
}

async function run(scenario) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'career.html'), 'utf8');
  const script = extractInlineScript(html);

  // Lazily create (and cache) a fake element for ANY id the script asks for — the top-
  // level init alone touches several (careerName, careerIntro, careerDetails) that this
  // test doesn't otherwise care about; only careerAsanaCta's onclick is actually driven.
  const elements = {};
  const getOrCreateElement = (id) => elements[id] || (elements[id] = makeFakeElement());

  const openCareerAsanaCalls = [];
  const sandbox = {
    window: {},
    document: {
      getElementById: getOrCreateElement,
      querySelectorAll: () => [],
      querySelector: () => null,
    },
    location: { search: scenario.search, href: '', origin: 'http://localhost' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    URLSearchParams,
    console,
  };
  sandbox.window.CareerDiyaProfileAuth = {
    isAuthenticated: () => true,
    getProfile: async () => scenario.profile,
    openCareerAsana: async (args) => { openCareerAsanaCalls.push(args); },
  };
  // The inline script references these as bare globals (window === globalThis in a real
  // page); mirror that here without polluting the actual Node global object.
  const vm = require('node:vm');
  const ctx = vm.createContext({ ...sandbox, window: sandbox.window, document: sandbox.document });
  ctx.window.document = sandbox.document;
  ctx.self = ctx.window;
  // career.html's script reads `location`, `document`, `localStorage`, `window` as bare
  // globals — vm.createContext makes everything on ctx a real global inside the script.
  vm.runInContext(script, ctx, { filename: 'career.html (inline script, extracted)' });

  // The auto-run tail (careerId/directionId/name all absent in our scenario) only hits
  // the harmless final `else` branch — wireCareerAsanaBridge/wireRelatedCareerOptions are
  // NOT auto-invoked, so we call them ourselves, exactly as renderCareer() normally would.
  await ctx.wireCareerAsanaBridge(scenario.career);
  elements.careerAsanaCta.onclick();
  // onclick is async; give its microtasks a turn.
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { openCareerAsanaCalls };
}

(async () => {
  // ── The exact case from the report: student handoff, poisoned DB row ────────────────
  const studentResult = await run({
    search: '?audience=student',
    profile: { current_role_title: 'Software Engineer' }, // pre-seeded poisoned row
    career: { id: 'law_practitioner', canonicalName: 'Law Practitioner' },
  });
  assert('student page view (audience=student): openCareerAsana is called',
    studentResult.openCareerAsanaCalls.length === 1);
  assert('student page view: currentRole passed to openCareerAsana is null, even though profile.current_role_title is poisoned to "Software Engineer"',
    studentResult.openCareerAsanaCalls[0] && studentResult.openCareerAsanaCalls[0].currentRole === null,
    studentResult.openCareerAsanaCalls[0]);

  // ── Regression: a genuine professional page view still gets its real current role ───
  const professionalResult = await run({
    search: '?audience=professional',
    profile: { current_role_title: 'Software Engineer' },
    career: { id: 'product_management', canonicalName: 'Product Manager' },
  });
  assert('professional page view (audience=professional): currentRole IS passed through',
    professionalResult.openCareerAsanaCalls[0] && professionalResult.openCareerAsanaCalls[0].currentRole === 'Software Engineer',
    professionalResult.openCareerAsanaCalls[0]);

  // ── Missing/unknown audience fails closed, not open ─────────────────────────────────
  const unknownResult = await run({
    search: '', // no audience param at all
    profile: { current_role_title: 'Software Engineer' },
    career: { id: 'law_practitioner', canonicalName: 'Law Practitioner' },
  });
  assert('missing audience param: fails closed (currentRole is null, not assumed professional)',
    unknownResult.openCareerAsanaCalls[0] && unknownResult.openCareerAsanaCalls[0].currentRole === null,
    unknownResult.openCareerAsanaCalls[0]);

  const passed = failures.length === 0;
  console.log(passed ? 'CAREER-HTML-STATE-LEAK-FIX: ALL PASS' : 'CAREER-HTML-STATE-LEAK-FIX: FAILURES', failures);
  process.exitCode = passed ? 0 : 1;
})();
