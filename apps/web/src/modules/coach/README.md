# Module: coach

**Build phase:** Phase 2 — single agent + tools; emits signals, never writes the Twin.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `coach`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
