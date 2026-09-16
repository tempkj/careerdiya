# Module: planner

**Build phase:** Phase 2 — goals to tasks (no milestones), reflections, thin momentum.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `planner`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
