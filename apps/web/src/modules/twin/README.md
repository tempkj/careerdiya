# Module: twin

**Build phase:** Phase 1 Track A — JSONB Twin, signal intake, provenance. No direct write.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `twin`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
