# CareerĀsanā

A Career Operating System — memory-first, event-driven, agentic. This is the application monorepo.

> **New here?** Read [`ENGINEERING_HANDBOOK.md`](./ENGINEERING_HANDBOOK.md) (rules + why) and [`CONTRIBUTING.md`](./CONTRIBUTING.md) (workflow + how).

## Stack
Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase (Auth, Postgres + pgvector, RLS, Realtime) · OpenAI + Anthropic (behind an ACL) · PostHog + OpenTelemetry. Pipeline: pnpm workspaces + Turborepo.

## Prerequisites
- Node `20` (`.nvmrc`) · pnpm `9+` · Supabase CLI · Docker (for local Supabase)

## Quickstart
```bash
pnpm install
cp .env.example .env.local        # fill in Supabase + provider keys
pnpm db:start                     # local Supabase
pnpm db:migrate                   # apply migrations (Phase 0, step 3)
pnpm codegen                      # generate API types from the frozen contract
pnpm dev                          # run the web app
```

## Governance commands (also run in CI)
```bash
pnpm contract:validate   # OpenAPI 3.1 structural validation
pnpm contract:lint       # Spectral ruleset
pnpm enum:check          # API enums must match DB vocab (packages/db/vocab.json)
pnpm boundaries:check    # module isolation (invariant A1)
pnpm typecheck && pnpm lint && pnpm test && pnpm test:contract
```

## Layout
```
careerasana/
├─ ENGINEERING_HANDBOOK.md   # the two freezes, invariants, milestones — read first
├─ contracts/                # FROZEN API contract + Spectral ruleset (governance boundary)
├─ apps/web/                 # Next.js modular monolith
│  ├─ app/                   # App Router (UI + /api/v1 route handlers = BFF)
│  └─ src/modules/           # the bounded modules (boundary-enforced)
├─ packages/
│  ├─ api-types/             # types generated from the OpenAPI contract (codegen output)
│  └─ db/                    # Supabase migrations, pg_jsonschema schemas, controlled vocab
├─ scripts/                  # governance: enum parity, module boundaries, codegen
├─ tests/                    # contract / unit / integration
└─ .github/workflows/        # CI pipeline (the governance gates)
```

## What this skeleton is — and isn't
It's the **foundation**: structure, config, CI/CD, governance gates, and stubs. It deliberately contains **no feature/business logic** — Authentication, Activation, Twin, etc. are later phases (see handbook §7). The seams and gates exist so those features can't drift from the frozen contract.


## Career Diya integration

This repository now hosts the Career Diya free decision experience and the CareerAsana deeper execution layer in one deployable application. See `docs/integration-career-diya-careerasana.md` for the boundary and handoff design.

For local preview, set `CAREERASANA_ACCESS_MODE=preview`. Production should use `paid` with `core.product_access` entitlements.
