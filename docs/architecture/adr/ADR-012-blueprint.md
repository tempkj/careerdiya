# ADR-012 — Blueprint: the Organize Phase (Dependency-Ordered, User-Owned Roadmap)

**Status:** Accepted
**Date:** 2026-07-07
**Author:** Kunal
**Supersedes:** The unused `core.blueprint` document-blob schema (migration `007_readiness_blueprint.sql`, part of the `core.blueprint` table) and the OpenAPI `BlueprintDocument`/`Blueprint` schemas and `/blueprint`, `/blueprint/regenerate`, `/blueprint/explanation` endpoints as currently specified. Does **not** supersede ADR-005 — see "Relationship to ADR-005" below.
**Governance impact:** New DB migration (schema addition, `core` schema — table names TBD in the migration proposal). OpenAPI contract amendment required (version bump) — flagged here, drafted separately once the schema is reviewed.
**Governing artifacts:** VISION.md (EVOLVE spine, Governing Principle, save-vs-promote lineage from ADR-010, provenance from A16, Tonal Law)

---

## Context

Blueprint is the **Organize** phase of EVOLVE: the artifact that turns a chosen target +
the measured gap into an **executable, dependency-ordered structure** — the user's roadmap.
It is the first half of the "outcome engine" (Organize); execution/tracking (Learn/Planner)
is a separate, later epic. Blueprint is subordinate to the Governing Principle: the fastest
honest path from "chosen target" to "an executable plan the user owns."

This ADR defines what a Blueprint is, how it is generated, how it persists, how the user
interacts with it, and where its boundaries are.

### Why this is a "define," not a "supersede a decision"

`core.blueprint` (migration 007) and its OpenAPI contract already exist, but they were never
argued for in an ADR — ADR-005 is scoped narrowly to *readiness computation* ("a pure
ReadinessCalculator... Blueprint only hosts/renders the result"); it says nothing about
Blueprint's own shape or lifecycle. The document-blob shape (`vision`/`currentState`/
`targetState`/`goals`/`nextActions`, wholesale-regenerated on a major Twin signal) was
implemented as a stub alongside ADR-005 without its own governance record. It has **zero
consumers**: no domain/application/infrastructure/UI code in `apps/web/src/modules/blueprint`
(the module is `export {};`), no route, no caller of `getBlueprint`/`regenerateBlueprint`
anywhere in the codebase. This ADR is therefore the first real decision about what a
Blueprint *is* — not an amendment fighting a prior argued design.

### Relationship to ADR-005 (coexistence, not supersession)

ADR-005's decision stands and is preserved in full: **Readiness remains a standalone
calculator** with declared inputs, versioned via `readiness_spec`, historized via
`readiness_history`, computed independently of Blueprint internals. Blueprint continues to
**host and render** the readiness snapshot — the stored Blueprint entity below still carries
a `readiness` reference, populated the same way (a pure calculator writes it; Blueprint never
computes it). ADR-005 owns the Readiness-hosting decision; this ADR owns the Blueprint-model
decision. Neither overturns the other.

---

## Amendment (2026-07-09) — attachment retargeted from `core.goal` to `core.activation_session`

Decision 1 originally said a promoted Blueprint is "linked to the goal," implying `core.goal`
(Planner). That's revised: **a stored Blueprint attaches to a `core.activation_session`** — the
exploration/session representing the chosen target — **not to `core.goal`.**

**Why:** `core.goal`/Planner is entirely unbuilt — no writer, no API route (confirmed: zero
application code creates a `core.goal` row anywhere, and `POST /goals` is contracted in the
OpenAPI spec but has no route handler). The *working* representation of "a user's goal" today
is the Twin's `aspiration.targetRole`, which is derived from signals sourced from an
`activation_session` (ADR-010's save-vs-promote model) — not from a `core.goal` row. Blueprint
attaches to the concrete thing that already exists and already means "the user's chosen
target": the session. `core.goal`/Planner is explicitly out of Blueprint's attachment path —
the still-open question in this ADR about `core.blueprint_task` ↔ `core.task` (Planner) is a
separate, task-level question, unaffected by this change (see the disambiguation added to that
open question, below).

**"Is this Blueprint for my active goal?" stays a derived question, not a stored flag.** Exactly
as `listActivationSessions` already resolves `activeGoalSessionId` (`twin.aspiration.targetRole.source`
→ `twin_signal.source_ref` → `activation_session.id`, no `core.goal` involved), a stored
Blueprint's `session_id` is compared against that same derived pointer to answer "is this the
active goal's Blueprint?" No new "is this active" column is added to `core.blueprint` — reusing
the existing derivation keeps exactly one source of truth for "the active goal."

**What changes below:** every reference to `goal_id`/`core.goal` in Decision 1 and migration 023
is retargeted to `session_id`/`core.activation_session`, via migration 024 (see Governance
Impact). `core.blueprint` had zero rows at the time of this amendment — a schema retarget, not
a data migration. **Not touched by this amendment:** `promote.ts`'s existing `goalId` parameter
and the `StoredBlueprint.goalId` domain-type field still say "goal" — they become stale the
moment migration 024 lands, and are renamed to `sessionId`/`session_id` when promote is actually
wired (a later slice; promote is explicitly not wired yet).

---

## Decision

### 1. Lifecycle: paths are derived-ephemeral; the chosen+edited path is promoted-and-stored

Reuses the save-vs-promote pattern (ADR-010):

1. User completes gap analysis, opts to explore filling the gaps, provides intake info
   (current qualifications, additional skills, academic/practical experience in the target
   field).
2. System **derives three paths** — *fastest* (high effort, medium success probability),
   *longest* (traditional, highest probability), *optimal* (balanced, medium-to-high
   probability). These are **transient/ephemeral** — generated on demand, NOT stored. If the
   user leaves without choosing, nothing persists.
3. User **picks and edits** one path — reorder tasks, override (soft) dependencies, add/remove
   tasks.
4. On **approval**, the edited path is **promoted to a stored Blueprint**: persisted, owned by
   the user, versioned, linked to the `activation_session` representing the chosen target (not
   `core.goal` — see the 2026-07-09 amendment above). The user's version is canonical.
5. The stored Blueprint is the reference execution (later epic) tracks against, and the
   artifact the user returns to. It also hosts the readiness snapshot (ADR-005).

### 2. Staleness: nudge-to-refresh, never auto-overwrite

When the underlying substrate refreshes (VISION.md §7.2) or the user's Twin changes materially
(completed tasks, gained skills), the stored Blueprint may be stale. The system **detects
material drift and nudges** ("your field shifted / you've made progress — want to refresh your
roadmap?") at spiral boundaries or on material drift. It **never auto-overwrites**. The user's
stored version stays canonical; the system only *offers* to help it stay current (Tonal Law:
nudge, not poke; spiral model: Elevate proposes the next spiral's update).

### 3. Composition: deterministic scaffolding + AI-generated path strategies, over a task library

Blueprint is a **hybrid** of deterministic and AI-generated parts:

- **Deterministic:** the gap (`computeTransition`, already built); the dependency scaffolding
  (soft, common-sense ordering relationships between tasks — e.g. Learn-before-Venture-for-a-
  given-skill).
- **AI-generated:** the three path *strategies* (how to sequence/pace/frame the gap-closing
  work into fastest/longest/optimal, with honest success probabilities); task *articulation*
  where the library lacks a needed task.

**Tasks come from a hybrid library model** (mirrors the substrate precompute architecture,
ADR-011):
- Blueprints compose primarily from a **task library** — a curated/growing catalog of reusable
  tasks (library-first: consistent, precomputable, comparable across users, an accumulating
  asset).
- When the library lacks a needed task, the generator **creates it on-miss**, and novel tasks
  can be **promoted into the library** (same lazy-fill + seed-expansion pattern as substrates;
  same "mock content is never persisted" guard applies to any mock-generated task).

**Prerequisite (sequencing):** a seed task library must exist for the library-backed benefit
to be real at launch — analogous to seeding the 25 substrates. Building Blueprint includes
seeding an initial task library (generated in-chat, reviewed, SQL-written — no API spend — same
loop as substrates). Until seeded, all tasks fall through to generate-on-miss (functional but
the library benefit is empty). This is a chunk of work parallel to the substrate seed; do not
let it be invisible in estimates.

### 4. The task object

A task in the dependency graph carries:
- `id`, `title`, `description`
- `evolve_category` — which EVOLVE pillar (engage | visualize | organize | learn | venture |
  elevate) — the tag, not a module (per the "EVOLVE is taxonomy not architecture" rule,
  VISION.md §3)
- `dependencies` — task ids that softly block this one (recommended ordering, user-overridable;
  never a hard gate)

**Encoding choice: a plain array, not a join table.** Dependencies are stored as a `uuid[]`
column with no foreign-key enforcement on the array elements, not a
`blueprint_task_dependency(task_id, depends_on_task_id)` join table. A join table would impose
enforced referential integrity on a relationship this ADR defines as deliberately soft and
advisory — the wrong tool for "recommended, user-overridable, never a hard gate." Dangling
dependency ids (e.g. after a task is removed by the user) are accepted, not guarded against —
the same trade-off already accepted for substrate adjacency data (ADR-011). The array is
informational for ordering/rendering; nothing in Blueprint's logic requires it to resolve.
- `effort_estimate` — rough duration/effort
- `status` — reserved for the later execution/tracking epic (not used by Blueprint itself; not
  the same `status` vocabulary as the existing `core.task` Planner table — see "Relationship to
  the existing Planner `core.task`" below)
- `basis` / provenance flag — inherited from the substrate(s) the task derives from

### Relationship to the existing Planner `core.task` (migration 008)

`core.task` (goal-scoped, `todo`/`scheduled`/`completed`/`skipped`) already exists as part of
the Planner epic — it is the **execution-tracking** task, a child of `core.goal`. The Blueprint
task object above is a **different concept**: a node in Blueprint's dependency graph, library-
backed, EVOLVE-tagged, with no tracked status. The two are not merged in this ADR. How a stored
Blueprint's tasks connect to `core.task` rows once the later Execution/Planner epic starts
tracking them is an **open question**, deferred below — do not conflate the two schemas now.

### 5. Provenance honesty

A Blueprint built on `inferred` substrates must say so. The stored Blueprint carries a
provenance flag inherited from the substrates it was built on ("AI-inferred role requirements,
not yet validated against live market data"). Non-negotiable per invariant A16; implemented by
propagating substrate `basis` into the Blueprint and its tasks, surfaced in the UI.

### 6. Twin interaction and boundary

Promoting a Blueprint is a **Twin event** (the user committed to a path — meaningful career
state), written with provenance (A16). Blueprint **sets up** but does **not start** execution —
the tracker, nudging, milestones, and retrospectives are the **later Execution/Planner epic**.
Blueprint's responsibility ends at "stored, owned, referenced, Twin-noted."

### 7. Mock-first, no API spend

Build a **MockBlueprintGenerator** (deterministic fixture paths + fixture task articulation)
so the entire flow works end-to-end in `AI_MODE=mock`, $0, exactly as substrates did. The
`LiveBlueprintGenerator` is a stubbed one-line swap for later (same injection pattern as
`createSubstrateStore`). Mock-generated tasks are ephemeral / never persisted to the library
(reuse the mock-persistence guard policy).

### 8. Interaction contract (the core flow — first build)

Build the **core flow** first; the none-of-these fallback is a **fast-follow**.

Core flow:
`gap analysis → intake (qualifications, field experience) → summary/review → confirm →
three derived paths → user picks one → user edits (reorder / override soft deps / add-remove) →
approve → promote to stored Blueprint (owned, versioned, provenance-flagged) → Twin event`

Fast-follow (next, not first build): the "none of these paths" branch → multi-choice of what a
better path looks like → (still none) → free-text describe → AI infers → summary/review →
approve. Rationale (Governing Principle / speed): most users pick one of three good paths; the
fallback serves the minority. Build the 80% path first.

### 9. Frontend

Build a **functional, raw (unstyled) UI** that exercises the full interaction end-to-end
(see three paths, pick, edit, approve, see the stored roadmap) — the interaction model is part
of the system and must be *implemented and proven*, not just described. **Visual presentation
(styling, polish, delight) is deferred** to a later presentation pass before launch. Apple-1
now, polish later — but the *interactions* work now.

---

## Migration path from the existing document-blob model

Because the old model has zero consumers (§ "Why this is a define, not a supersede" above),
the migration is a clean replace, not a data migration:

1. **Drop the document-blob shape.** `core.blueprint.document` (free-form `BlueprintDocument`
   JSONB: `vision`/`currentState`/`targetState`/`goals`/`nextActions`) is replaced — there is no
   production data in it to carry forward (confirmed: no writers ever existed).
2. **Keep the readiness-hosting columns.** `readiness` (JSONB, pg_jsonschema-validated per
   `readiness.schema.json`), `generated_at`, `generated_by_model`, `prompt_version` stay —
   ADR-005's hosting relationship is unchanged, only what else the row carries changes.
3. **Add the new entities** (stored Blueprint header + its dependency-ordered tasks + the task
   library) as proposed in the migration to follow this ADR.
4. **`prompt_registry` row `blueprint/v2`** (the wholesale-regen prompt) is retired in favor of
   new prompts for path-derivation and task-articulation, versioned per ADR-003 (new versions,
   not edits).
5. **`core.job.kind = 'blueprint_regeneration'`** is repurposed: its semantics change from
   "wholesale LLM regeneration of the whole document" to "derive three path strategies" (the
   async step in the new flow, § Decision 1.2). No enum value change needed, only the job's
   internal behavior — but the OpenAPI description of what the job *does* must be amended (see
   Governance Impact below).

## Governance Impact

### DB migration required (🔒 Contract Freeze applies)

A schema addition/reshape in the `core` schema. This ADR is the governance artifact for the
*decision*; the migration file (proposed separately, for review before it is written/applied)
is the governance artifact for the *implementation*. Run `pnpm governance` after the migration
lands to confirm parity.

**Migration 024 (this amendment):** retargets `core.blueprint`'s attachment column —
`goal_id` → `session_id`, FK retargeted from `core.goal(id)` to `core.activation_session(id)
ON DELETE CASCADE`. `core.blueprint` has zero rows (confirmed before applying), so this is a
column/FK rename, not a data migration. Applied local-first (`db:reset` proves clean), then
cloud, with an explicit grant/RLS audit after cloud apply — same discipline as migration 023.

### OpenAPI amendment required — flagged, not yet drafted

The existing `/blueprint`, `/blueprint/regenerate`, `/blueprint/explanation` endpoints and the
`BlueprintDocument`/`Blueprint` schemas no longer describe the real system once this ADR's model
ships. This is a version bump (contract amendment), to be drafted as its own reviewed change
once the schema below is accepted — likely needs: an endpoint to request derived paths, an
endpoint to promote a chosen/edited path, and a reshaped `Blueprint` read schema (dependency-
ordered tasks, not the old free-form document). **Not specified further here** — this ADR
records that the amendment is owed, not its contents.

---

## Consequences

- **Positive:** reuses proven patterns (save-vs-promote, precompute library + lazy-fill +
  seed-expansion, mock-first, provenance propagation) — architectural consistency, no new
  paradigm. Delivers the core outcome-engine value (chosen target → owned roadmap) in mock, $0.
  User-owned, versioned, stale-aware, honest about provenance. Replaces a dead stub with a real,
  argued design at no migration cost (nothing consumed the stub).
- **Cost/scope:** adds a **task library** layer (a seed effort parallel to substrates). This is
  real upfront work; the payoff is consistency + precompute economics + an accumulating asset.
  Owes a follow-up OpenAPI amendment before the new Blueprint can be exposed publicly.
- **Deferred:** execution/tracking (Planner), the none-of-these fallback, visual polish, live
  AI generation, live-signal-grounded task provenance, the `core.task` (Planner) integration
  question, the OpenAPI amendment itself.
- **Decoupled (2026-07-09 amendment):** `core.goal`/Planner is explicitly out of Blueprint's
  attachment path — a stored Blueprint's existence and lifecycle never depend on Planner being
  built. This also removes what would otherwise have been a hard blocker (promote requiring a
  `core.goal` row that nothing creates).

## Open questions (resolve during build, not blockers)

- Exact drift-detection threshold for "material change" that triggers the refresh nudge.
- Task library schema + seed size for launch (how many seed tasks is "enough" to make
  library-backed meaningful — the substrate analogue was ~25 roles).
- Versioning granularity of a stored Blueprint (full-snapshot vs. diff on each edit).
- How the three path *strategies* differ algorithmically (what makes "fastest" fast — fewer
  tasks? parallel tasks? paid-resource-weighted? — vs. "longest" thorough). Needs definition
  when the generator is built.
- How a stored Blueprint's tasks connect to `core.task` (Planner) once execution/tracking
  starts — separate schemas for now (§4 above). **This is unaffected by the 2026-07-09
  attachment amendment**: that amendment resolved *header*-level attachment (`core.blueprint`
  → `core.activation_session`, not `core.goal`); this question is *task*-level
  (`core.blueprint_task` ↔ `core.task`) and remains genuinely open. **Deferred, but not optional
  to design carefully:** this connection must be defined *before* the Planner epic starts, not
  discovered mid-build — the two task schemas (`core.blueprint_task` and `core.task`) must
  not be allowed to drift independently in ways that make joining them hard later (e.g.
  incompatible id spaces, no way to trace a Planner task back to the Blueprint task it
  executes). `blueprint_task.status` may turn out to be entirely redundant once that
  relationship is defined — do not build any logic against `blueprint_task.status` in the
  meantime; it is reserved, not active.

## Invariants respected

A1 (module boundaries — Blueprint in its own module, composes from knowledge/task-library via
public surface), A5 (RLS + consent — stored Blueprints are user-owned, RLS-scoped; no
service-role in request path), A16 (Twin provenance — promotion event is provenance-tracked and
re-derivable), save-vs-promote (ADR-010), dual-freeze (this ADR governs the Blueprint schema
addition; the migration is governance-gated), ADR-005 (Readiness-hosting relationship preserved,
not altered).
