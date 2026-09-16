# Module: readiness

**Build phase:** Phase 2 — standalone calculator + spec-versioned history (hosted by blueprint, not owned).

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `readiness`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
