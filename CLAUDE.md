# CLAUDE.md — CareerĀsanā

Orientation for Claude Code. Read this first; follow it every session. Deep docs are referenced, not duplicated (keep this file lean).

## What this is
A Career Operating System — memory-first, event-driven, agentic. A **modular monolith**: Next.js (App Router) · TypeScript · Tailwind/shadcn · Supabase (Auth, Postgres + RLS, Realtime) · OpenAI + Anthropic · pnpm + Turborepo. India region.

## The one rule that governs everything: the Two Freezes
- **Contract Freeze 🔒** — `contracts/` (OpenAPI 1.2.0), `packages/db/` migrations + `vocab.json`, the invariants, and production prompts. **Change only via a governed amendment** (ADR → review → version bump). Never edit these to satisfy a UI need.
- **Design Layer ❄️** — UI, UX, copy, styling, product docs. Iterates freely.
- **Mechanical test:** *does the change edit `contracts/`, a DB migration/schema, or a prompt version?* → Contract change (governance). Otherwise → free.

Full detail: `ENGINEERING_HANDBOOK.md`. Workflow/how-to: `CONTRIBUTING.md`. Rationale: `docs/architecture/adr/`.

## Never do these (anti-patterns — all CI-enforced)
- ❌ Write the Twin directly. It changes **only** via signals (`POST /twin/signals`); there is no `PUT /twin`. *(ADR-001)*
- ❌ Bypass RLS. No service-role key in a request path; user-scoped client only. *(invariant A5)*
- ❌ Edit generated code (`packages/api-types/generated/`). It's disposable — regenerate with `pnpm codegen`. *(ADR-002)*
- ❌ Change the OpenAPI or DB schema without governance. That's an amendment, not a commit.
- ❌ Import another module's internals. Public `index.ts` only; declared deps in `scripts/check-module-boundaries.mjs`. *(ADR-004)*
- ❌ Edit a published prompt or readiness spec in place. New version, like a migration. *(ADR-003)*

## Commands
```bash
pnpm install                 # deps + lockfile
pnpm codegen                 # generate API types FROM the frozen contract (never hand-edit output)
pnpm governance              # contract:validate + spectral lint + enum parity + module boundaries
pnpm dev | test | test:contract | typecheck | lint
pnpm db:start | db:migrate | db:reset     # local Supabase (Docker)
```
Before pushing anything touching `contracts/`, `packages/db/`, or module structure: run `pnpm governance` and keep it green.

## AI cost controls
Three tiers — pick the cheapest that's sufficient:

| Mode | When | Cost | How |
|---|---|---|---|
| `AI_MODE=mock` | All dev & test work | **$0** | Deterministic fixtures keyed on `desiredRole` keyword. Default when `NODE_ENV ≠ production`. |
| `AI_MODE=live` + Haiku (`AI_DEFAULT_MODEL=claude-haiku-4-5-20251001`) | Real-API dev testing | ~$0.001/call | Set `AI_MODE=live` locally; key must be set. |
| `AI_MODE=live` + Sonnet/Opus | Production | Full cost | Set via secrets manager only. |

**Safety boundary:** `AI_MODE` resolves to `'live'` in production automatically (no env var needed). Mock data never reaches prod. Dev DB is expected to contain test-fixture sessions — that's acceptable; reset the dev DB periodically if it gets noisy.

**Tests must run in mock mode** for determinism. Never set `AI_MODE=live` in CI unless the test is specifically an API-cost regression test.

## Repo map
```
contracts/        FROZEN OpenAPI + Spectral ruleset (the governance boundary)
apps/web/         Next.js app; src/modules/<m>/{domain,application,infrastructure,ui}/ (boundary-enforced)
packages/db/      Supabase migrations (DB v1.3 §10 order), pg_jsonschema schemas, vocab.json
packages/api-types/  types GENERATED from the contract (generated/ is gitignored)
packages/prompts/    versioned prompt templates (back prompt_registry)
scripts/          governance: enum parity, module boundaries, codegen, validate
docs/             architecture/adr (why) · product · ux · research
planning/         Sprint-0/1 + Backlog (the executable plan)
```

## Architectural invariants (don't violate; changing them is an ADR)
A1 module boundaries · A2/A16 Twin re-derivable + per-fact provenance, signals-only · A5 RLS + consent on all user data · A12 readiness hosted-not-owned · A13/A14 readiness versioned + historized · A17 activation_session immutable.

## Current state & what to build next

**Sprint-0 is complete. Milestone 1 ("First Meaningful Returning User") is proven.**

### What's shipped
| Epic | What landed | Key commits |
|---|---|---|
| Platform | Scaffold + migrations 001–018 (all 16 schema migrations + 2 RLS fixes) applied to hosted Supabase | `448a9af` `f38198c` `0c44a2b` `cba6e96` |
| Identity (Epic 2) | Sign-up / sign-in / JWT · Profile (ETag) · Consent · RLS forced + tenant isolation proven | `fa28bc0` |
| Activation (Epic 3) | `POST /start` (mock + live) · `POST /complete` (Twin signals) · `GET /{id}` · `GET /latest` · AI cost controls (`AI_MODE`) | `e1eb47d` |
| UI | `/login` · `/activate` (blank form → gap result → welcome-back returning view) | `07176db` `b905949` |

### Milestone 1 exit criterion — verified
Sign up → activate → gap analysis persisted → complete (Twin signals flushed) → sign out → sign back in → `GET /activation/latest` returns identical session from cold DB (no new AI call, no re-derivation). Provenance: 5 `twin_signal` rows with `sessionId` linkage.

### What to build next (Sprint-1 / Phase 1)
- **Epic 4 — Twin**: `POST /twin/signals` intake endpoint · signal application (`applied=true`) · `GET /twin` shaped read view · provenance per fact
- **Epic 5 — Integration**: baseline readiness from Twin facts · job catalog · audit log · end-to-end demo with real Anthropic call (`AI_MODE=live`)
- **CI pipeline**: governance → quality → contract-tests wired to GitHub Actions (Sprint-0 Epic 1 remainder)

See `planning/Sprint-1.md` and `planning/Backlog.md` for full detail.

## Standing gotchas (hard-won — don't re-learn these)
- **`pnpm test` needs `--root ../..`** in `apps/web/package.json`. Without it, Turbo runs Vitest from `apps/web/` and silently finds zero tests. Never remove that flag.
- **No inline secrets.** Read from `process.env` only. Supabase uses `sb_publishable`/`sb_secret` key prefixes; legacy JWT auth is disabled.
- **DB password URL-encoding:** `@` → `%40` in direct `psql` connection strings.
- **Three-layer activation model (ADR-010):** `save` (complete, no flush) ≠ `promote` (flushes signals, sets aspiration) ≠ `draft`. `promote` is the **only** writer of `aspiration.targetRole`.
- **PostgREST error triage — read the code before touching config:** `42501` = PostgreSQL privilege problem (role missing `GRANT USAGE ON SCHEMA` or table grant) — fix with SQL, not dashboard. `PGRST106` / "schema must be one of" = PostgREST routing config missing the schema — fix in exposed-schemas setting. The code names the layer; they are not interchangeable.
- **Never diagnose schema exposure from a role that lacks USAGE.** A `42501` makes the schema appear unexposed regardless of what PostgREST's `db_schema` list contains. Always check grants first (`has_schema_privilege(role, schema, 'USAGE')`), then routing config. This caused a multi-attempt misdiagnosis: `service_role` lacked `GRANT USAGE ON SCHEMA knowledge`; `knowledge` was in `db_schema` the whole time.
- **Migrations must schema-qualify DDL on `core.`/`knowledge.` objects.** The DB `search_path` is `"$user", public, extensions` and does **not** include `core`/`knowledge`, so unqualified `ALTER INDEX` / `ALTER TABLE` / etc. on an object in those schemas silently resolves against the wrong schema and fails with "relation does not exist" — it doesn't error on the DDL syntax, it just can't find the object. Migration 024's `ALTER INDEX idx_blueprint_one_active_per_goal RENAME TO ...` hit this; fixed by writing `ALTER INDEX core.idx_blueprint_one_active_per_goal ...`. Always schema-qualify, don't rely on search_path in migrations.
- **Next.js `redirect()`/`notFound()` throw control-flow signals** — never call them inside a `try` whose `catch` is unqualified, or the `catch` silently swallows the redirect. Guard only the fallible call (e.g. the session fetch) in the `try`; run redirect-triggering checks *after*. Hit in `blueprint/page.tsx` (ADR-013 sub-slice 2).

## When you finish a unit of work
- Run `pnpm governance && pnpm test` before proposing a commit.
- Write an ADR only for real architectural decisions/contract changes (see `CONTRIBUTING.md` "When to write an ADR"). Not for bug fixes, styling, refactors, tests, or docs.
- If you correct me on a convention, add the rule here so it persists across sessions.
