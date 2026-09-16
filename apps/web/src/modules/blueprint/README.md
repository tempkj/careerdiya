# Module: blueprint

**Build phase:** Phase 2 — single living document; hosts the readiness calculator.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `blueprint`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
