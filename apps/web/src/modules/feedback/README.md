# Module: feedback

**Build phase:** Phase 3 — thumbs up/down on coach turns and recommendations.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `feedback`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
