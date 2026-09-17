# ADR-CAREERDIY-0015 — Free-Tier LLM Enrichment (Deterministic Floor + LLM Prose)

## Status
**Proposed — pending sign-off.** This ADR accompanies a new DB migration
(`packages/db/supabase/migrations/20260917000031_career_diya_llm_cache.sql`), which is
Contract-Freeze territory per `CLAUDE.md`. Do not apply the migration to any shared/hosted
Supabase project until this ADR is reviewed and accepted.

## Context
The free Career Diya exploration (`explore.html`) uses a deterministic, cosine-similarity
recommendation engine (`decision-data.js`, `FREE_ENGINE_CONFIG`) with context-aware routing
and a hard primary-eligibility gate (ADR-CD-001, `apps/web/public/assets/decision-data.js`).
That engine is free, fast, and — because of the eligibility gate — structurally unable to
surface a primary direction unrelated to a bounded/dropdown role's family under a
GROW/SWITCH intent.

Its weakness is prose: the "why this surfaced" and "what to do next" text is templated from
a small `skillPlan()` lookup, not written around the user's specific situation. This ADR adds
a low-cost LLM enrichment step for users who give us a **bounded** (dropdown-selected)
current/most-recent role — enough signal to justify the marginal cost.

## Decision

### Deterministic floor, LLM enrichment — never LLM-selected direction
The deterministic engine (`generateRecommendations()`, including
`eligibleFamiliesForIntent` / `roleFamilyForRole` / the primary-eligibility gate) continues to
choose the rendered direction for every user, bounded role or not. This is unconditional —
the LLM is never given the authority to choose or override the displayed direction.

For a **bounded** (dropdown) role, the client sends the deterministic pick
(`chosen[0].direction.id`, one of the closed `DIRECTION_PROFILES.adult` ids) to a new
server-side endpoint, which asks a cheap model to write **advice** and **course-type
recommendations** (any provider) around that fixed direction. The model's structured output
schema has no field capable of changing what's rendered as the primary direction.

For an "Other" (free-text) role, an unmapped role, or any LLM failure/timeout/invalid output,
the page renders the existing pure-deterministic result unchanged. This path never blocks
page render and never produces a blank or broken result.

### Off-topic-direction prose screen
The direction *field* can't be overridden by construction (above), but the model can still
write advice/course-recommendation *prose* that argues for a different direction while
leaving the field alone ("your direction is Software Engineering... here's why you should
pivot to HR"). That is the same confidently-wrong failure the eligibility gate exists to
prevent, arriving through text instead of a field, so it is closed the same way: as a
validation failure, not a display concern.

- **Prompt constraint:** the system prompt explicitly forbids suggesting, recommending, or
  arguing for a different direction in the advice/course fields — the model's own
  independent view belongs only in `shadowDirection`, never in prose. Cheap, catches the
  common case, not relied on alone.
- **Validation + fallback (the actual guarantee):** `findOtherDirectionReference`
  (`enrichmentCache.ts`) screens the validated advice + every course-recommendation field for
  a reference to any direction other than the chosen one. Match terms per direction are
  derived, not hand-authored: the direction's own label (`DIRECTION_LABELS`), the Career
  Library category phrasing career-mapping.js's `DIRECTION_ID_ALIASES` resolves to
  (`DIRECTION_CANONICAL_SLUG_WORDS`), and any ALL-CAPS segment of the label (mechanically
  pulled out — `HR`, `UX`) — deliberately *not* every comma-separated word (`Research`,
  `Care`, `Service`, `Business`, `Policy` are common English words that would false-positive
  on unrelated, perfectly on-topic advice).
- On a hit, `getEnrichment` regenerates **once** (`generateAndScreenOnce`, same inputs). If
  the retry is clean, that response ships and the call still counts as an overall success. If
  the retry is *also* off-topic, `getEnrichment` throws and the route falls back to the
  deterministic result exactly like any other enrichment failure — never contradictory prose.
- Every firing is logged as `llm_offtopic_direction` (with an `attempt` field distinguishing
  a self-healed first hit from a terminal second one), alongside the existing
  `llm_cache_hit` / `llm_success` / `llm_timeout` / `llm_invalid` / `llm_error` outcomes.
- This prompt change bumped `CAREER_DIYA_ENRICHMENT_PROMPT_VERSION` to
  `career-diya-enrichment/v2` — no stale pre-screen answer is served under the new version.

### Shadow-logged LLM direction pick (measurement only)
Each bounded-role call also asks the model which single direction (from the same closed
enum) it would have picked independently, given the same inputs. This is stored server-side
in the cache row only (`shadow_llm_direction`) — never returned to the browser, never
rendered, never used to affect the result. It exists purely so we can later measure how often
and for which roles the LLM would have disagreed with the deterministic gate. Gated behind an
env flag (`CAREER_DIYA_SHADOW_DIRECTION=1`, default off in this slice) so it can be disabled
without a code change.

### Server-side, cheap model, capped, cached
The call lives in a new Next.js route, `POST /api/v1/career-diya/recommend`
(`apps/web/app/api/v1/career-diya/recommend/route.ts`), inside a new `careerdiya` module
(`apps/web/src/modules/careerdiya/` — no hyphen: `scripts/check-module-boundaries.mjs`'s
module-ref regex only matches `[a-z]+`, so a hyphenated module name would be silently
unchecked). It is not part of CareerAsana's frozen OpenAPI
contract (`contracts/careerasana_openapi_v1.yaml`) — it is a free CareerDiya surface, not a
paid CareerAsana endpoint.

- Model comes from config (`AI_MODEL` / `AI_MODE`, `apps/web/src/lib/ai.ts`) — never hardcoded.
  Free tier runs on the Haiku-class default; accuracy bar is explicitly low-to-medium.
- Output is a tight structured-JSON schema with per-field length caps and a conservative
  `max_tokens`.
- Cached in `knowledge.career_diya_llm_cache`, keyed on
  `promptVersion | model | normalizeRoleText(role) | sortedAnswers | chosenDirectionId`,
  hashed — mirrors `knowledge.identification_cache` (migration 025)'s shape: no user_id, no
  RLS (shared reference data), authenticated INSERT/SELECT only, no anon grant (this route
  requires an authenticated user, same as `/blueprint/identify`).
- A prompt or model change bumps `CAREER_DIYA_ENRICHMENT_PROMPT_VERSION`, which changes the
  cache key — no stale answer is ever served across a prompt/model change.

### Bounded role capture
`renderCurrentRoleStep` (`decision-engine.js`) changes from a free-text input to a `<select>`
seeded from the existing `STARTER_ROLE_FAMILIES` aliases (`decision-data.js`, already
hand-curated for ADR-CD-001's routing), plus an "Other (type it)" option that reveals a
free-text field. The dropdown selection writes to `core.profile.current_role_title`; "Other"
free text writes to `core.profile.current_role_other`. Both columns already exist
(migration `20260907000030_career_diya_integration.sql`) — no migration needed for this part.

### Versioning
`FREE_ENGINE_CONFIG.version` bumps from `1.1-context-routing` to `1.2-llm-enrichment` — the
result envelope's meaning changes (an `llmEnriched` field and enrichment-sourced prose can now
appear) even though the scoring/gating math is untouched. Historical
`core.career_diya_exploration` rows are immutable snapshots and are never recomputed against
the new version.

## Consequences
- New Contract-Freeze migration requiring sign-off (see Status).
- New `careerdiya` module boundary entry in `scripts/check-module-boundaries.mjs`.
- The "never confidently wrong" and "no fabricated precision" invariants are structurally
  enforced by construction: the LLM cannot change the direction, and the score bar/percentage
  already rendered comes from the deterministic engine untouched.
- CareerAsana (Track A) is unaffected — this ADR touches only the free CareerDiya surface.
