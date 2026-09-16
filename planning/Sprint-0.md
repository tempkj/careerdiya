# Sprint 0 — Integration (not "start coding")

> Sprint 0 is the **integration** sprint: it proves the foundational pieces work together as one vertical slice. It is *not* "begin coding features." By the end, a single user journey touches every architectural layer and every seam is proven.

---

## 1. Goal

Stand up the foundation and connect it end-to-end: repo + CI + migrations + auth + activation + Twin, wired so that **one real user journey** flows Frontend → Activation → Signal → Twin → baseline Readiness → DB, with RLS, Jobs, and Audit proven. Exit on **Milestone 1 — First Meaningful Returning User**.

---

## 2. Architecture Proven (what this sprint validates)

The seams, not the features. By close of sprint we have evidence that:
- Auth + **RLS** isolate tenants (proven by a negative test, not just a positive one).
- The Twin changes **only via signals** (no direct write) and every fact carries provenance.
- The async path works: `202 → Location → GET /jobs/{id}` resolves.
- Schema lives **only** in migrations; the API **cannot drift** from the contract (gates green).

---

## 3. Epics

### Epic 1 — Platform
- Repository skeleton ✅ (this repo)
- CI pipeline (governance → quality → contract-tests)
- Contract-test harness wired
- SQL migrations (DB v1.3 §10) applied to a real Supabase instance

### Epic 2 — Identity
- Supabase Auth (sign up / sign in / JWT)
- Profile (region, locale, display name; ETag baseline)
- Consent (append-only; `ai_personalization` gate)
- RLS forced on all user-owned tables

### Epic 3 — Activation
- `POST /activation/start` — current → desired role intake
- Gap analysis + first action (the 60-second value)
- `POST /activation/complete` — finalize, flush facts into the Twin as signals
- `GET /activation/{sessionId}` — canonical retrieval (Day-2 path)

### Epic 4 — Twin
- Signal intake (`POST /twin/signals`, append-only log, minor/major classify)
- Twin generation/application from signals (JSONB; `pg_jsonschema` valid)
- Provenance: every fact → `source` signal + `capturedAt`; `GET /twin/explain`

### Epic 5 — Integration
- **Baseline** readiness trigger (see §9 — minimal, pipeline-proving only)
- Job API (`GET /jobs/{id}`) backing the async signal/blueprint paths
- Audit (sensitive-op fingerprint, no PII)
- End-to-end flow wired + the negative RLS test

---

## 4. Acceptance Criteria (per epic)

**Epic 1 — Platform**
- [ ] `pnpm governance` passes (OpenAPI valid · Spectral · enum parity · boundaries)
- [ ] CI green on a clean checkout; contract tests run against local Supabase
- [ ] Migrations apply from zero via `pnpm db:reset`; 3 schemas present (core/knowledge/audit)

**Epic 2 — Identity**
- [ ] User can sign up and sign in; JWT issued and accepted
- [ ] Another user's rows are **not** returned (RLS negative test passes)
- [ ] Consent recorded; `ai_personalization`-gated op returns 403 when absent
- [ ] Profile PATCH requires `If-Match`; stale → 412

**Epic 3 — Activation**
- [ ] `start` returns gap (each item with confidence) + a concrete first action
- [ ] `complete` sets `completedAt` and emits ≥1 Twin signal
- [ ] `GET /activation/{sessionId}` returns the artifact with its `journey[]`

**Epic 4 — Twin**
- [ ] A signal is appended, classified, and applied; `GET /twin` reflects it
- [ ] Twin JSONB validates against `twin.schema.json`
- [ ] `GET /twin/explain?path=…` resolves a fact to its originating signal

**Epic 5 — Integration**
- [ ] Completing activation produces a Twin and a baseline readiness history row
- [ ] A 202 path returns `Location`; polling `GET /jobs/{id}` reaches `done`
- [ ] A sensitive op writes an `audit_log` row (fingerprint only, no PII)
- [ ] Full journey passes in one run, including the negative RLS test

---

## 5. Definition of Done

Per-PR DoD from `CONTRIBUTING.md`, plus the slice-level Vertical Slice 1 DoD (Handbook §7): one journey touches every layer and proves every seam, with the negative RLS test included. All CI gates green; no manual DB changes.

---

## 6. Exit Criterion — Milestone 1 "First Meaningful Returning User"

**Day 1:** sign up → activate → receive value (gap + first action) → Twin created → leave.
**Day 2:** sign in → Twin restored → activation artifact retrievable (`GET /activation/{sessionId}`) → provenance visible → ready for the next session.

Day 2 is the point: it proves persistence, auth, RLS, retrieval, reconstruction, and provenance — not just generation.

---

## 7. Out of Scope (explicitly — do NOT build in Sprint 0)

Stating this so the sprint can't quietly expand:
- ❌ Blueprint generation (full)
- ❌ Planner (goals/tasks/reflections)
- ❌ Coach (conversations, agent, tools)
- ❌ Recommendations
- ❌ Feedback
- ❌ Activity timeline / event stream
- ❌ Analytics / dashboards
- ❌ The **sophisticated** Readiness module (only the baseline calc in §9)
- ❌ Embeddings / pgvector; bulk ops; feature-flag overrides (all roadmap-gated)

These are Phase 2–3. Track B may *scaffold* against the frozen contract, but no feature work lands this sprint.

---

## 8. Primary Risks

| Risk | Why it's risky | Mitigation |
|---|---|---|
| Supabase **RLS** configuration | Sole tenant boundary; a wrong policy leaks data | Negative RLS test in CI from the first protected table |
| **JSONB Twin** schema | Loose JSONB can rot silently | `pg_jsonschema` mandatory on Twin + Readiness; validate on write |
| **Signal processing** correctness | Twin must be re-derivable from the log | Apply-worker tests; assert every fact resolves to a signal |
| **OpenAPI ↔ implementation drift** | Contract is only worth it if obeyed | Contract tests + enum-parity gate on every PR |
| Async **job** semantics | 202 is useless if the poll loop breaks | Contract test asserts 202 → Location → job `done` |

---

## 9. Readiness in Sprint 0 — baseline only

> Sprint 0 implements the **minimal** readiness calculation required to prove the pipeline: trigger a baseline readiness computation sufficient to validate **signal → calculation → persistence** (a history row written, stamped with `readiness-spec/v1`). The sophisticated ReadinessCalculator (full dimension weighting, confirm/decay inputs) belongs in Phase 2. Keep the sprint focused on the seam, not the formula.

---

## 10. Deliverables (artifacts for sprint review)

- [ ] Running Next.js app (`pnpm dev`)
- [ ] Running local Supabase instance
- [ ] Migrations `001…00x` applied (DB v1.3 §10 order)
- [ ] CI pipeline green
- [ ] Contract tests green
- [ ] Twin persisted and restorable after sign-out
- [ ] Audit + Jobs demonstrable
- [ ] **Demo script** walking the Day-1 → Day-2 journey

---

## 11. Sprint Success Metrics (objective)

Sprint 0 succeeds when **all** are true:
- ✓ CI passes
- ✓ 100% of contract tests pass
- ✓ RLS negative test passes
- ✓ A user completes activation in under 60 seconds
- ✓ Twin generated
- ✓ Twin restored after sign-out (Day-2)
- ✓ Zero manual DB changes (everything via migrations)
- ✓ All schema changes shipped as migrations
- ✓ No contract drift (enum parity + Spectral + validation green)
