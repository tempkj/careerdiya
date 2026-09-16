# ADR-002: OpenAPI-first development with generated types

**Status:** Accepted

## Context
Frontend and backend must build in parallel without waiting on each other, and the implementation must
not silently drift from the agreed interface. A hand-written, convention-based API guarantees drift.

## Decision
- The OpenAPI 3.1 document (`contracts/careerasana_openapi_v1.yaml`, frozen at 1.1.1) is the **single
  source of truth** for the API. It is authored/reviewed first; code conforms to it.
- TypeScript types are **generated** from the contract into `packages/api-types/generated/`
  (`pnpm codegen`) and are never hand-edited. Generated code is a **disposable artifact** — it may be
  deleted and recreated at any time from the contract, and is gitignored for that reason. They are **disposable artifacts** — they may be deleted
  and recreated at any time, which is precisely why hand-editing them is pointless and forbidden.
- Conformance is enforced by **contract tests** (the running implementation must satisfy the spec) and
  by **Spectral** + structural validation + **enum parity** (the spec must satisfy our conventions and
  match the DB vocab). All run in CI on every PR.

## Consequences
- The frozen contract becomes the boundary that enables parallel Track A / Track B work.
- Changing the API is a governed amendment (version bump), not an ad-hoc commit.
- Generated + hand-written code are kept in separate directories to avoid confusion.

## Enforced by
`scripts/validate-openapi.mjs`, `contracts/careerasana_api_spectral.yaml`,
`scripts/check-enum-parity.mjs`, the contract-test harness, CI gate 1.
