# Module: knowledge

**Build phase:** Phase 1+ — taxonomy (O*NET) behind TaxonomyProvider; recommendations.

## Boundary (invariant A1)
- Public surface is `index.ts`. Everything else here is private.
- Allowed cross-module deps are declared in `scripts/check-module-boundaries.mjs`.
- Backing tables live in the `knowledge`-prefixed group of the `core`/`knowledge` schema (DB v1.3).
