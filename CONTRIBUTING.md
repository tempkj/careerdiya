# Contributing to CareerĀsanā

The [Engineering Handbook](./ENGINEERING_HANDBOOK.md) defines the **rules and why**. This file is the **workflow and how**.

## Setup (once)
```bash
nvm use                      # Node 20 (.nvmrc)
pnpm install                 # workspace deps + lockfile
cp .env.example .env.local   # fill Supabase + provider keys
pnpm codegen                 # generate API types from the frozen contract
```

## Daily development loop
Every contributor follows the same rhythm:
```
Pull latest → Install/update → Run migrations → Create feature branch
   → Implement → Run governance → Run tests → Open PR → CI → Merge
```
```bash
git pull --ff-only
pnpm install                 # if lockfile changed
pnpm db:migrate              # if new migrations landed
git checkout -b feat/<module>-<short-desc>
# …implement…
pnpm governance && pnpm test # mirror the CI gates before pushing
git push -u origin HEAD      # open PR; CI runs the full pipeline
```

## Commands: local vs CI
The same scripts exist in both places; the *intent* differs.

**Local development** (fast feedback while building)
```bash
pnpm dev                     # run the app
pnpm test                    # unit
pnpm test:contract           # contract conformance
pnpm governance              # contract:validate + lint + enum parity + boundaries
```
**CI** (the merge gate — see `.github/workflows/ci.yml`)
```bash
pnpm governance              # gate 1: contract freeze + API↔DB parity + boundaries
pnpm typecheck && pnpm lint && pnpm test   # gate 2: quality
pnpm build && pnpm test:contract           # gate 3: build + conformance vs Supabase
```
Run `pnpm governance` locally before pushing anything that touches `contracts/`, `packages/db/`, or module structure.

## Feature branches & commit messages
Branch: `feat/ | fix/ | chore/ | docs/ | refactor/`, scoped by module — e.g. `feat/activation-start`.

Conventional commits, scoped by module, keep history readable:
```
feat(activation): add gap analysis to /activation/start
fix(twin): resolve provenance for inferred facts
docs(handbook): clarify the design layer
refactor(planner): extract task scheduling
chore(ci): cache pnpm store
test(twin): negative RLS coverage
```

## Run migrations (Phase 0+)
```bash
pnpm db:start                                  # local Supabase (Docker)
pnpm db:migrate                                # apply migrations
pnpm db:reset                                  # rebuild + reseed from zero
supabase migration new <name> --workdir packages/db   # new migration (governed — see below)
```
Migrations follow Database Design Spec v1.3 §10. Twin + Readiness JSONB must validate against `packages/db/schemas/*.schema.json`.

## Regenerate API types
```bash
pnpm codegen                 # writes packages/api-types/generated/ from the frozen OpenAPI
```
Never hand-edit `packages/api-types/generated/`. Wrong types → fix the contract (a governed amendment), not the generated file.

## Add / change a production prompt
Prompts are governed (Handbook §5). Never edit a published version in place:
```bash
cp packages/prompts/coach/v3.md packages/prompts/coach/v4.md   # bump id in front-matter
# update the prompt_registry seed to reference the new version + hash
```
Review a prompt diff like a schema diff.

## Propose a contract amendment (the governed path)
Use when a change touches `contracts/`, a DB migration/schema, or a production prompt — i.e. the [boundary test](./ENGINEERING_HANDBOOK.md#the-mechanical-boundary-test) says "Contract change."
1. **Write it up** — an ADR in `docs/architecture/adr/` (Status: Proposed).
2. **Review** — architecture review approves/rejects.
3. **Version bump** — OpenAPI `info.version` and/or new migration and/or new prompt/spec version. Additive within `/api/v1`; breaking → `/api/v2`.
4. **Update gates** — `packages/db/vocab.json` if enums changed; `pnpm codegen`.
5. **PR** — CI stays green; mark the ADR `Accepted`.

UI/UX/copy are **not** amendments — Design Layer; just open a normal PR.

## When to write an ADR (and when not)
Avoid ADR inflation — record decisions, not activity.

**ADR needed for:**
- Architectural decisions (a pattern, a trade-off with lasting consequences)
- Contract changes (API/DB/invariant)
- New module boundaries or allowed cross-module dependencies
- New invariants

**No ADR for:**
- Bug fixes
- Styling / visual changes
- Refactoring that preserves behavior
- Test additions
- Documentation edits

If you're unsure, ask: *would a new engineer in six months need to know why?* If yes, write the ADR.

## Module work (invariant A1)
- Code under `apps/web/src/modules/<module>/{domain,application,infrastructure,ui}/`.
- Export the public surface from `index.ts`; import other modules **only** via their `index.ts`.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`; `pnpm boundaries:check` fails on violations.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Types out of date / missing | `pnpm codegen` |
| Migration conflict or weird DB state | `pnpm db:reset` |
| Enum mismatch fails `enum:check` | update `packages/db/vocab.json` to match the (amended) contract, then `pnpm codegen` |
| `boundaries:check` fails | you imported another module's internals — use its `index.ts`, or declare the dependency |
| Spectral/validate fails after editing YAML | you changed the frozen contract — that's an amendment, not a commit (see above) |
| Contract tests fail | the implementation diverged from the spec — fix the code, not the spec |

## Definition of Done (per PR)
- [ ] `pnpm governance` green · types regenerated if contract touched
- [ ] tests added (unit + contract where an endpoint is involved)
- [ ] no anti-pattern from Handbook §3
- [ ] ADR added/updated **if** the change meets the "ADR needed" bar above
- [ ] for the slice: seams proven incl. the **negative RLS test** (Handbook §7)
