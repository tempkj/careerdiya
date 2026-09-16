# ADR-007: Three Postgres schemas with prefix-enforced module boundaries

**Status:** Accepted

## Context
Eight schemas were operationally heavy on Supabase; one schema loses DB-level boundaries.

## Decision
`core` / `knowledge` / `audit`; module isolation inside `core` via table-name prefixes + the CI boundary lint (D1-rev). The DB counterpart to ADR-004.

## Consequences
Simpler migrations/grants/PITR; RLS becomes the sole tenant boundary; clean future schema-split by rename.
