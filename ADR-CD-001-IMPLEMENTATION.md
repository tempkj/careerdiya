# ADR-CD-001 implementation

Applied to the full Career Diya + CareerAsana integrated project.

## Changed
- `apps/web/public/assets/decision-data.js`
  - bumped free-engine version to `1.1-context-routing`
  - added small starter role-family mappings
  - added explicit `adjacent` and `transferable` relationships
  - Q2 intent routing
  - hard primary eligibility for GROW
  - explicit SWITCH eligibility
  - safe widening for unmapped roles
  - existing cosine/preference ranking retained within the eligible universe
- `apps/web/public/assets/decision-engine.js`
  - passes current/most-recent role into recommendation generation
  - stores routing context
  - explanation reflects the actual routing path
- `apps/web/public/assets/tests/decision-engine.adr-cd-001.test.js`
  - deterministic regression fixtures from ADR-CD-001

## Not changed
CareerAsana, paid AI, caching, Skill Diya implementation, question count, and stored historical exploration snapshots.

## Regression fixture
Load `decision-data.js`, then run the test file in a browser console. It writes results to
`window.CAREER_DIYA_ADR_CD_001_TESTS` and prints a console table.
