# Module: outcome

**Build phase:** Phase 2 — hard/soft outcomes; confirm/decay.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `outcome`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
