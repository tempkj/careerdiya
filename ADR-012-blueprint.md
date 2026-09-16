
# ADR-012: Blueprint — the Organize Phase (Dependency-Ordered, User-Owned Roadmap)

**Status:** Proposed (draft for review; Claude Code to finalize against repo conventions)
**Date:** 2026-07-01
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
   the user, versioned, linked to the goal. The user's version is canonical.
5. The stored Blueprint is the reference execution (later epic) tracks against, and the
   artifact the user returns to.

### 2. Staleness: nudge-to-refresh, never auto-overwrite

When the underlying substrate refreshes (§5.2) or the user's Twin changes materially
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

**Tasks come from a hybrid library model** (mirrors the substrate precompute architecture):
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
  elevate) — the tag, not a module (per the "EVOLVE is taxonomy not architecture" rule)
- `dependencies` — task ids that softly block this one (recommended ordering, user-overridable;
  never a hard gate)
- `effort_estimate` — rough duration/effort
- `status` — reserved for the later execution/tracking epic (not used by Blueprint itself)
- `basis` / provenance flag — inherited from the substrate(s) the task derives from

### 5. Provenance honesty

A Blueprint built on `inferred` substrates must say so. The stored Blueprint carries a
provenance flag inherited from the substrates it was built on ("AI-inferred role requirements,
not yet validated against live market data"). Non-negotiable per §4/A16; implemented by
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

## Consequences

- **Positive:** reuses proven patterns (save-vs-promote, precompute library + lazy-fill +
  seed-expansion, mock-first, provenance propagation) — architectural consistency, no new
  paradigm. Delivers the core outcome-engine value (chosen target → owned roadmap) in mock, $0.
  User-owned, versioned, stale-aware, honest about provenance.
- **Cost/scope:** adds a **task library** layer (a seed effort parallel to substrates). This is
  real upfront work; the payoff is consistency + precompute economics + an accumulating asset.
- **Deferred:** execution/tracking (Planner), the none-of-these fallback, visual polish, live
  AI generation, live-signal-grounded task provenance.

## Open questions (resolve during build, not blockers)

- Exact drift-detection threshold for "material change" that triggers the refresh nudge.
- Task library schema + seed size for launch (how many seed tasks is "enough" to make
  library-backed meaningful — the substrate analogue was ~25 roles).
- Versioning granularity of a stored Blueprint (full-snapshot vs. diff on each edit).
- How the three path *strategies* differ algorithmically (what makes "fastest" fast — fewer
  tasks? parallel tasks? paid-resource-weighted? — vs. "longest" thorough). Needs definition
  when the generator is built.

## Invariants respected

A1 (module boundaries — Blueprint in its own module, composes from knowledge/task-library via
public surface), A5 (RLS + consent — stored Blueprints are user-owned, RLS-scoped; no
service-role in request path), A16 (Twin provenance — promotion event is provenance-tracked and
re-derivable), save-vs-promote (ADR-010), dual-freeze (this ADR governs the Blueprint schema
addition; the migration is governance-gated).
