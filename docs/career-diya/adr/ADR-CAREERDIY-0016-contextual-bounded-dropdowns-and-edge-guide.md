# ADR-CAREERDIY-0016 — Contextual Bounded To-Role/Stream Dropdowns + Edge Guide LLM

## Status
**Proposed — pending sign-off.** This ADR accompanies a new DB migration
(`packages/db/supabase/migrations/20260918000032_career_diya_guide_cache.sql`), which is
Contract-Freeze territory per `CLAUDE.md`. Do not apply the migration to any shared/hosted
Supabase project until this ADR is reviewed and accepted.

## Context
ADR-CAREERDIY-0015 shipped a deterministic-floor + LLM-enrichment free explorer for
professionals with a bounded current-role. This ADR extends the same "deterministic core,
LLM only on the edge, edge LLM guides never verdicts" posture to two more cases:

1. **Professional + GROW intent** already has a bounded from-role and an eligibility-gated
   family pool (`eligibleFamiliesForIntent`, ADR-CD-001) — but that pool is only ever used to
   *filter* the 12 broad directions, never surfaced as a pickable list of specific *roles*.
2. **Students** get no role/stream capture at all today — every student is scored on the same
   12-direction adult engine via the 7-question preference wizard, with no way to ask "what
   careers actually come out of my stream/major."

## Decision

### Professional + GROW: contextual to-role dropdown (deterministic, no LLM)
After the 7-question wizard finishes (`renderWizard`'s existing completion branch,
`decision-engine.js`), if `audience==='professional' && answers.intent==='growth'` and the
captured current role is **bounded** (`isBoundedRoleValue`), an interstitial step offers a
to-role dropdown populated from `{fromFamily.aliases, ...fromFamily.adjacent-families'
aliases}` — the *exact same pool* `eligibleFamiliesForIntent` already treats as GROW-eligible
(ADR-CD-001). No new data, no LLM. "None of these" skips straight to the existing
`gateBeforeResults`/`renderResults` flow, unchanged — a plain, modest escape hatch, not a
distinct destination.

Mounted **after** the wizard, not as a conditional mid-wizard question:
`renderWizard`'s question count/step accounting (`total`, `decision-engine.js:49`) is a
`const` captured once at wizard start, not re-evaluated per step. Inserting a
conditionally-appearing question would require restructuring that closure; an after-wizard
interstitial reuses the exact same architectural pattern the shipped pre-wizard current-role
step already established, at the cost of a one-line branch change.

### Students: co-primary entry, not a funnel
Two equally-weighted entry points on the student start screen — neither demotes the other:

- **"Explore careers from your stream →"** — a stage-tiered dropdown (late_school → school
  stream; college/recent_grad → UG major) against a new curated dataset
  (`STUDENT_STREAM_CAREERS`), rendering a deterministic stream-relevant career list.
- **"See what actually fits you →"** — the existing unmodified 7-question preference wizard.

Both are real, permanent primary paths: the stream lens answers "what does my major already
point toward" (fast, concrete, honest about being a starting signal, not a destiny); the
preference lens is the differentiated, personalised read a stored major can't replace. Neither
is styled as a fallback link off the other. The stream-results screen additionally carries an
always-visible "Explore paths beyond my field →" into the preference wizard — framed as
encouraged, not as "you didn't match."

An unlisted/uncommon stream or major — or an empty `careerIds` list for a not-yet-filled-in
dataset entry — routes to the **edge guide** (below) rather than a blank list.

### Edge guide LLM — guides, never a verdict
`POST /api/v1/career-diya/guide` (new `careerdiya`-module route, mirrors
`/recommend`'s shape): cheap model via `AI_MODE`/`AI_MODEL` config, output capped, server-side
only, cache-first. Two closed layers against ever issuing a personalised verdict:

- **Prompt constraint:** the system prompt forbids naming a single career as "the" or "your"
  path, forbids a fit/confidence claim, and instructs broad exploratory territory only.
- **Validation + fallback:** `containsVerdictLanguage` (`guideCache.ts`) screens the validated
  output for verdict-shaped phrasing ("you should become", "your best fit is", "I recommend",
  "you are best suited to be a", etc.) — a heuristic, not exhaustive, but the same
  defense-in-depth posture as ADR-CAREERDIY-0015's off-topic-direction screen. A hit
  regenerates once; a second hit throws and the caller falls back to a static, LLM-free guide
  message. The output *type* itself has no field for a single named career or a fit score —
  only `territories: string[]` (2-4 short broad phrases) — so there is no schema slot for a
  verdict to occupy even before the text screen runs.
- **Non-removable disclaimer:** rendered by the client template *around* the LLM output,
  never sourced from the model's response — "These are general starting points, not a
  personalised read. For a direction matched to you specifically, [run the free explorer →]
  or [talk to a counsellor →]." Present even if the model's own output is entirely absent
  (a total call failure still renders the disclaimer + a static fallback message + the same
  two handoff links) — this is what "no dead ends" means for the one path that has no
  deterministic floor to anchor to.
- **Cache:** new `knowledge.career_diya_guide_cache` table, keyed on
  `promptVersion | model | normalizeRoleText(streamOrRole) | intent`, hashed — a **separate**
  table from `knowledge.career_diya_llm_cache` (ADR-CAREERDIY-0015), not an overload of it:
  that table's schema is shaped around a single `direction_id`, which this path has none of.
  Mirrors why `gap_analysis_cache` and `identification_cache` are two tables despite being
  conceptually similar.
- **Logging:** the same `guide_cache_hit` / `guide_success` / `guide_timeout` /
  `guide_invalid` / `guide_offtopic_verdict` / `guide_error` outcome events as ADR-0015's
  `llm_*` set, so hit-rate/failure-mix is visible from day one.
- Today this route has exactly one caller: the student "stream not listed" case
  (`intent: 'stream_unlisted'`). The request shape (`streamOrRole`, `intent`) is intentionally
  generic so a future second caller doesn't require a contract change — but no second caller
  exists yet, and professional GROW's "none of these" is explicitly **not** one (it stays
  LLM-free per the section above).

### Dataset
`apps/web/public/assets/student-stream-careers-data.js` — a `<script>`-tag-loaded global
(`STUDENT_STREAM_CAREERS`), matching `decision-data.js`/`career-mapping.js`'s existing
loading pattern (no fetch-based loading exists anywhere else in this static site). Shape:
`{ school_stream: { <key>: {label, careerIds} }, ug_major: { <key>: {label, careerIds} } }`.
`careerIds` reference `CAREER_LIBRARY_CATALOGUE` ids where possible, resolved through the
already-shipped `canonicalCareerById`. Ships with a couple of populated categories as working
examples; the rest are explicit stubs for real content.

## Consequences
- New Contract-Freeze migration requiring sign-off (see Status).
- No changes to `STARTER_ROLE_FAMILIES`, the eligibility gate, or `DIRECTION_PROFILES` — the
  to-role dropdown is a pure read of data that already exists and is already trusted for
  exactly this purpose (GROW eligibility).
- The existing 7-question wizard, its scoring, and its bounded-role LLM enrichment
  (ADR-CAREERDIY-0015) are unchanged for every audience.
- Parent audience is untouched by this ADR.
