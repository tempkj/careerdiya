# ADR-004: Modular monolith with enforced module boundaries

**Status:** Accepted

## Context
We want the clarity of bounded modules (Identity, Twin, Blueprint, Readiness, Planner, Outcome, Coach, Knowledge, Feedback, Activation) without the operational cost of microservices at MVP scale. But "modules by convention" rot into a big ball of mud the moment one module reaches into another's internals.

## Decision
- Build a **modular monolith**: one deployable Next.js app, modules under `apps/web/src/modules/<module>/{domain,application,infrastructure,ui}/`.
- Each module exposes a public surface via `index.ts`. Other modules import **only** that — never internals.
- Allowed cross-module dependencies are **explicitly declared**; any deep import fails the build.
- Modules communicate through **exported interfaces, not shared persistence**: a module never reads or
  writes another module's tables, even though all tables currently live in one database. The shared DB
  is a deployment detail, not a license to couple.
- (DB counterpart in ADR-007: module isolation inside the `core` schema via table-name prefixes.)

## Consequences
- Boundaries are mechanical, not aspirational (invariant A1).
- Modules can later be extracted to services by promoting an `index.ts` to a network boundary — low rework.
- A new module ships with the four-layer structure already in place.

## Enforced by
`scripts/check-module-boundaries.mjs` + the ESLint `no-restricted-imports` rule; CI gate 1.
