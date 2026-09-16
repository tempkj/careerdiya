## Summary
<!-- What does this PR do, in one or two sentences? -->

## Architecture impact
<!-- Modules touched. New cross-module dependencies? New seams? None is a fine answer. -->

## Contract change?
<!-- Does this touch contracts/, a DB migration/schema, or a production prompt version? -->
- [ ] No — Design Layer / behavior-preserving (no governance needed)
- [ ] Yes — governed amendment: version bumped, vocab/codegen updated, ADR linked below

## ADR
<!-- Required only if this meets the "ADR needed" bar in CONTRIBUTING. Link it, or state N/A. -->
- ADR: <!-- ADR-0XX or N/A -->

## Tests
- [ ] Unit
- [ ] Contract (if an endpoint is involved)
- [ ] Negative RLS test (if a protected resource is involved)

## Checklist
- [ ] `pnpm governance` green
- [ ] Types regenerated (`pnpm codegen`) if the contract changed
- [ ] No anti-pattern from Handbook §3

## Screenshots / demo
<!-- UI changes: before/after. Flows: short clip or steps. -->
