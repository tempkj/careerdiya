# CareerĀsanā — Engineering Handbook

> Read this before your first commit. It defines **what may change freely** and **what may change only through governance** — and the principles behind those rules. For the practical *how* (branches, migrations, codegen, amendments), see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## 1. Engineering Principles

The rules below exist to serve these. When a rule seems inconvenient, check it against the principle it protects.

- **Product over framework** — we build the user's outcome, not an elegant abstraction. The Immediate Value Layer is the point; the stack serves it.
- **Workflow over CRUD** — APIs and modules expose capabilities (`/activation/complete`, `regenerate`), not table operations.
- **Contracts over convention** — the OpenAPI + DB schema + invariants are the boundary that lets teams work in parallel. A stable contract beats a shared habit.
- **Evidence over assumptions** — score weights, prompts, and features are hypotheses validated against data (Founder-Learning loop), versioned so we can tell what changed.
- **Automation over manual enforcement** — every rule worth having is a CI gate. If it isn't enforced by a script, it will drift.

## 2. The Two Freezes

Different, and never conflated.

### Contract Freeze 🔒
**Database schema · API contract · domain rules · invariants.** Changes **only** through governance:
```
Need / wireframe → Gap identified → Architecture review → Approved amendment → Version bump → Continue
```
Frozen artifacts: `contracts/careerasana_openapi_v1.yaml` (API, **1.2.0**), `packages/db/` migrations + `packages/db/vocab.json` (DB, Spec v1.3), the invariants in §4, and **production prompts** (§5).

### Design Layer ❄️ (continuous evolution)
**UI · UX · copy · visual hierarchy · component styling · product docs.** Iterates continuously; no governance needed. (Formerly "Design Freeze (NOT frozen)" — renamed because it isn't frozen at all; it's the layer that evolves freely.)

### The mechanical boundary test
> **If a change requires editing `contracts/`, a DB migration/schema, or a production prompt version, it is a Contract change → governance.**
> **If it doesn't, it's the Design Layer → free.**
No judgment call. The files *are* the boundary; CI enforces it.

## 3. What NOT to do (anti-patterns)

The fastest ways to break the architecture. Each maps to an invariant/principle; each is enforced.

- ❌ **Never write directly to the Twin.** It changes only via signals. *(A2; no `PUT /twin`.)*
- ❌ **Never bypass RLS.** No service-role key in a request path; user-scoped client only. *(A5.)*
- ❌ **Never edit generated code.** `packages/api-types/generated/` is derived from the contract. Regenerate, don't hand-edit.
- ❌ **Never change the OpenAPI or DB schema without governance.** That's a contract amendment, not a commit. *(§2.)*
- ❌ **Never import another module's internals.** Public `index.ts` only. *(A1; boundary lint.)*
- ❌ **Never edit a published prompt in place.** New version, like a migration. *(§5.)*
- ❌ **Never edit a readiness spec in place.** New `readiness_spec` version. *(A13.)*

## 4. Architectural invariants (Contract-frozen — changing these is an amendment)
- **A1** Module boundaries hold: code touches only its own module (+ published anchors). Enforced by `scripts/check-module-boundaries.mjs`.
- **A2/A16** The Twin is re-derivable and per-fact explainable; changes **only** via signals (no direct write). Every fact carries `source` + `capturedAt`.
- **A5** RLS + consent on 100% of user data; PII minimized (lives in `auth.users`).
- **A12** Readiness is *hosted, not owned* by Blueprint — a standalone calculator over declared inputs.
- **A13/A14** Readiness scoring is versioned (`readiness_spec`) and historized; never edited in place.
- **A17** `activation_session` is an immutable onboarding artifact (history, not source of truth).

## 5. Prompt governance

Production prompts are **governed assets**, on par with database migrations and readiness specs. They live in `packages/prompts/` as versioned files; `prompt_registry.template_ref`/`template_hash` reference them, and every AI artifact records the `promptVersion` that produced it.

> A change to a production prompt follows the Prompt Registry process and **requires a new version** (e.g. `coach/v3.md` → `coach/v4.md`), never an in-place edit — comparable to a readiness-spec version bump (A13). Review a prompt diff like a schema diff: it changes model behavior.

## 6. The CI pipeline (every PR)
```
commit → OpenAPI validate → Spectral lint → enum parity (API↔DB) → module-boundary lint → typecheck → unit → contract tests → integration → merge
```
Defined in `.github/workflows/ci.yml`. A red gate blocks merge — drift is caught at the PR, not three sprints later. *(Principle: automation over manual enforcement.)*

## 7. Definition of Done — Vertical Slice 1 (north star)
> One complete user journey touches every architectural layer **and proves every seam**.

Frontend → Activation API (auth + RLS) → Twin Signal (no-direct-write invariant) → Twin (applied via log, provenance attached) → Readiness (calculator + history row) → DB → **RLS negative test** (another user cannot see the rows) → Job tracking (202 → Location → `GET /jobs` resolves) → Audit (sensitive op leaves a fingerprint, no PII).

## 8. Milestone 1 — "First Meaningful Returning User"
- ✓ Sign up · ✓ Authenticate · ✓ Complete activation · ✓ Receive immediate value (gap + first action) · ✓ Twin created · ✓ Leave
- ✓ Return next day · ✓ Twin restored · ✓ Activation artifact retrievable (`GET /activation/{sessionId}`) · ✓ Provenance preserved · ✓ Ready for next coaching session

Day 2 is the point: it proves **persistence, auth, RLS, retrieval, reconstruction, provenance** — not just generation.

## 9. Execution order — and why parallelism depends on the freeze

The whole reason we stabilized the OpenAPI + DB before writing features: a frozen contract is the boundary that lets two tracks build at once without waiting on each other.

```
                      FROZEN CONTRACT (OpenAPI 1.2.0 + DB v1.3)
                                     |
              +----------------------+----------------------+
              v                                             v
        Track A (critical path)                       Track B (scaffold vs contract)
        Activation -> Twin -> Signals                 Blueprint -> Readiness -> Planner
              +----------------------+----------------------+
                                     v
                       Merge -> Vertical Slice 1 -> Milestone 1
```

- **Phase 0 — Foundation:** Repository Skeleton -> SQL Migrations -> Authentication.
- **Phase 1 — Parallel streams** (the diagram above; enabled by the freeze).
- **Phase 2 — Product intelligence:** Blueprint -> Readiness -> Planner -> Coach.
- **Phase 3 — Growth:** Recommendations -> Feedback -> Activity Timeline -> Analytics.

Without the frozen contract, Track B blocks on Track A and everyone waits. With it, they integrate at one planned seam.

## 10. Source-of-truth hierarchy

| Layer | Document | Freeze | Home |
|---|---|---|---|
| Product vision | **Founder Edition** | Design Layer | `docs/product/` |
| Engineering governance | **This Handbook** | governed | repo root |
| Architectural rationale | **ADRs** | immutable once Accepted | `docs/architecture/adr/` |
| Product strategy | Blueprint v1.3.1 | governed | `docs/` (engineering) |
| Data | Database Design Spec v1.3 | Contract | `packages/db/` + spec |
| API | OpenAPI 1.2.0 + Spectral | Contract | `contracts/` |

The Founder Edition says *why the product exists*; the Handbook says *how we build*; ADRs say *why we decided what we did*; the Blueprint/DB/API say *what we build*. Together they form a complete hierarchy from vision to contract.
