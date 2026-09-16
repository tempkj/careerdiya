# ADR-011 — Role Substrates as First-Class Stored Objects; Transitions Derived On-the-Fly

**Status:** Accepted  
**Date:** 2026-06-30  
**Author:** Kunal  
**Supersedes:** Nothing (new capability)  
**Governance impact:** One new DB migration (`019_role_substrate.sql`) in `knowledge` schema. No OpenAPI amendment required in v1 — substrate is an internal service layer, not a public endpoint.

---

## Context

Gap analysis, readiness calculation, and blueprint generation all depend on knowing what a role actually requires: its canonical skill profile, market context, and how it sits relative to adjacent roles. Today this knowledge is either absent (mock fixtures) or re-derived from scratch on every AI call (live mode). Neither is sustainable.

The question is how to store and serve this **base intelligence**:

1. **Option A — Derive everything on demand.** Every gap-analysis call asks the AI "what does a Product Manager need?" Every time. No caching, no consistency, high cost, non-deterministic across calls.

2. **Option B — Role substrates: pre-compute and store the role profile; compute transitions on-the-fly from pairs.** One substrate per `(role, region)` — a rich, versioned object describing the role. When a user's transition from A → B is needed, compute it live from `substrate(A)` + `substrate(B)`. No materialized transitions table.

3. **Option C — Materialize transitions too.** Pre-compute and store every `(sourceRole, targetRole)` pair that has been requested. Lower serve-time latency for repeat pairs; high refresh-consistency burden (refreshing role A invalidates all transitions involving A).

---

## Decision

**Option B.** Role substrates are first-class stored objects. Role-to-role transitions are computed on-the-fly from a pair of substrate lookups, not materialized.

Materialization of hot transitions (Option C) is a documented future optimization, gated on two conditions that do not yet exist: (a) observed traffic data showing which pairs are actually hot, and (b) a demonstrated nuance gap where derive-on-the-fly produces qualitatively worse transitions than a materialized version. Until both are true, Option C's refresh-consistency cost — every substrate refresh must invalidate all dependent transitions — is not justified.

---

## Substrate Model

A **role substrate** is a versioned, region-scoped, source-attributed profile of what a role requires and how it sits in the market. It is the stable, reusable intelligence unit that all downstream computation (gap analysis, readiness, blueprint, transitions) draws from.

### Key fields

| Field | Purpose |
|---|---|
| `(role_key, region)` | Natural composite key. `role_key = lower(trim(desired_role))` — normalized at write time by the application. Region defaults to `IN`. One substrate per pair. |
| `onet_code` | **Nullable grounding attribute — never the key.** Set when a confident O*NET match exists; NULL for modern/novel roles (creator, AI-era, etc.). Same pattern as `activation_session.onet_code` and `knowledge.skill.onet_code`. Keying on `onet_code` would exclude every role O*NET lacks — the coverage gap VISION.md §4 explicitly designed against. |
| `payload` | Versioned JSONB — skills (with proficiency levels), market context, typical entry paths, demand signal. Governed by `schema_version`. |
| `basis` | Provenance: `grounded` (from verified source) or `inferred` (AI-generated without external verification). Mirrors the confidence basis already used in `gap[]`. |
| `computed_at` | When this substrate was generated. |
| `valid_until` | Freshness boundary. NULL = no expiry. Null is acceptable for v1 where crawl is manual; structured expiry gates the Phase 2 auto-refresh. |
| `source` | What generated this substrate: `mock`, `crawl`, `licensed_feed`. Makes the source swappable without schema change. |
| `schema_version` | Format version (e.g., `substrate/v1`). Allows payload shape to evolve without a migration. |

### What's not in the substrate

- **User facts.** The substrate describes a role, not a person. User-specific gap is always computed as `userProfile ∩ substrate`, never stored in the substrate.
- **Transition deltas.** No pre-computed A→B diff. Transitions are a serve-time derivation.

---

## Transition Computation (Derive On-the-Fly)

When a transition from role A to role B is needed:

```
substrateA = SubstrateStore.get(onetCodeA, region)   // DB hit or lazy-fill
substrateB = SubstrateStore.get(onetCodeB, region)   // DB hit or lazy-fill
transition = TransitionService.compute(substrateA, substrateB)
```

`TransitionService.compute` is a pure function — no DB write, no state. It produces:
- skill delta (gains required, losses accepted)
- market context shift
- estimated transition difficulty

This is fast enough at P99 for v1 traffic (two indexed DB reads + in-process computation). Materialization becomes relevant only when profiling shows this is a measured bottleneck.

---

## Lazy-Fill Pattern

The substrate store fills on first demand (no pre-population job needed for v1):

```
get(onetCode, region):
  row = SELECT FROM knowledge.role_substrate WHERE onet_code = $1 AND region = $2
  if row exists AND (valid_until IS NULL OR valid_until > now()):
    return row
  substrate = SubstrateGenerator.generate(onetCode, region)   // mock or live
  UPSERT INTO knowledge.role_substrate ...
  return substrate
```

No background job. No scheduler. No warm-up. The first user who triggers a gap analysis for a given role pays the generation cost once; everyone after hits the cache. This is the right trade-off before traffic data exists.

---

## Mock / Live — One Code Path, Swappable Generator

The substrate layer follows the same `AI_MODE` pattern as the rest of the system:

```
SubstrateGenerator (interface)
  ├── MockSubstrateGenerator    AI_MODE=mock → deterministic fixture keyed on onet_code
  └── LiveSubstrateGenerator    AI_MODE=live → calls AI with a role description
```

`SubstrateStore` receives the generator as a dependency. The store's get/upsert logic is identical in both modes. Tests always use `MockSubstrateGenerator`. Production uses `LiveSubstrateGenerator`. The swap is the same env-var gate (`AI_MODE`) already used in activation.

**Critically:** mock substrates must be structurally identical to live substrates — same `payload` shape, same `basis`, same `schema_version`. Mock fixtures are not simplified stubs; they are deterministic instances of the real schema.

---

## Currency Source (Phase 1: Web Crawl — Design Note, Not Yet Built)

The eventual refresh validates currency-critical substrate fields (demand signals, salary bands, role prevalence) against live market data. Phase 1 source is web crawl.

**Design constraints (enforce now, build later):**

1. **Source is a field, not a code path.** `source` on the substrate row (`crawl`, `licensed_feed`, etc.) means switching from crawl to a licensed feed requires no schema change — only a new generator implementation.

2. **Freshness is explicit, not silent.** `valid_until` is set by the generator (crawl sets it to `now() + 30 days`; licensed feed sets it per feed contract). A monitoring query on `valid_until < now()` surfaces stale substrates loudly. Silent currency degradation — crawl breaks, substrates quietly expire, system serves stale data without alarm — is not acceptable.

3. **Free government data as legally-clean alternative.** Before building the crawl, evaluate India Labour Bureau / MoSDE / O*NET (US, freely licensed) as primary sources. These are slower to update but legally unambiguous. Crawled data from job boards carries ToS risk. Check licensing before committing to a crawl source.

4. **Crawl health signal.** The crawl job (when built) must emit a success/failure event to the job table. A broken crawl that silently stops refreshing substrates must surface as a monitoring alert, not as gradually degrading substrate freshness.

---

## Governance Impact

### DB migration required (🔒 Contract Freeze applies)

New table `knowledge.role_substrate` in the existing `knowledge` schema. This is a new migration (`019_role_substrate.sql`) and constitutes a schema change under the Contract Freeze.

**This ADR is the governance artifact.** No separate amendment document needed — the ADR records the decision; the migration file records the implementation. Run `pnpm governance` after adding the migration to confirm parity.

### No OpenAPI amendment required

The substrate is an internal service layer. No new public endpoints are introduced in v1. Existing endpoints (`/activation/start`, `/readiness/current`) consume substrates internally; their response shapes are unchanged. If a `GET /roles/{onetCode}/substrate` endpoint is added in a future version, that will require a v1.3.0 contract amendment at that time.

---

## Consequences

**Positive:**
- Zero refresh-consistency burden. Refreshing a substrate has no cascading invalidation — there are no materialized transitions to expire.
- Serve path is two indexed DB reads + pure computation. Fast enough at v1 scale.
- Mock and live are one code path. Tests are deterministic and cheap.
- Source field makes the data pipeline swappable without a schema or code-path change.
- Freshness is explicit — substrate expiry is observable, not silent.

**Negative / accepted:**
- Repeated transitions between the same role pair re-compute on every request (no materialized cache). Acceptable at v1 traffic; materialization is the documented upgrade path.
- Lazy-fill means the first request for a new role in live mode pays AI generation latency. Acceptable for v1; pre-population job is the documented upgrade path.
- `valid_until = NULL` in v1 (manual crawl) means freshness is only checked when a new generation is triggered, not on every read. A substrate can be served indefinitely if never re-triggered. Monitoring alert on age is the mitigation.

---

## Alternatives Considered

**Derive everything on demand (Option A):** High AI cost, non-deterministic across calls for the same role, no caching benefit. Rejected.

**Materialize transitions (Option C):** Adds a transitions table, refresh-invalidation logic, and a warm-up job — before there is any traffic data to justify which transitions are worth materializing. Rejected as premature. Revisit when profiling shows P99 transition latency is a real problem.

**Store transitions as a JSONB array inside the substrate:** Bloats the substrate, makes it role-pair-dependent (substrate for A would need to know about B), and still requires full recomputation on refresh. Rejected — clean separation between role knowledge (substrate) and transition knowledge (derive-on-the-fly) is architecturally cleaner.

---

## Amendment (2026-07-24) — adjacentRoles surfaced on ActivationResult (contract v1.8.0)

This ADR originally scoped substrates as an internal service layer with "no OpenAPI amendment
required... if a `GET /roles/{onetCode}/substrate` endpoint is added in a future version, that
will require a v1.3.0 contract amendment at that time." That trigger has now fired — not via a
new substrate endpoint, but via surfacing one substrate field on an existing response.

**What changed:** `ActivationResult` (the response of `POST /activation/start`) gains an
additive `adjacentRoles: AdjacentRoleSuggestion[]` field. `AdjacentRoleSuggestion` is
`{ roleKey, direction }`, with `direction` restricted to `lateral | step_up` — `step_down` is
part of the underlying `SubstrateAdjacentRole.direction` domain type (still `lateral | step_up |
step_down`) but is intentionally excluded from the API-facing enum, since a demotion is never a
user-facing suggestion. Contract bumped 1.7.0 → 1.8.0 (additive within `/api/v1`).

**No new data path.** `adjacentRoles` is populated from `substrate(desiredRole).payload
.adjacent_roles`, the same substrate object `startActivation` already loads to run
`computeTransition` — no new fetch, no new generator call, no new DB migration.

**Confirms the release-1 scope already recorded in `planning/Backlog.md`** (role-canonicalization
decision, commit `ba64812`): adjacent-roles is powered by each substrate's own AI-generated
`adjacent_roles` field, not cross-role canonicalization/dedup — so this amendment carries none
of the canonicalization merge-risk discussed there, and needs no additional review gate.
