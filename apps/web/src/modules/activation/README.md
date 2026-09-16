# Module: activation

**Build phase:** Phase 1 Track A — Immediate Value Layer (Milestone 1). Emits the first Twin signals.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `activation`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
