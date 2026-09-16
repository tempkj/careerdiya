# Module: identity

**Build phase:** Phase 0 step 4 — Authentication, profile, consent. The published anchor.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `identity`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
