# ADR-009: Twin stored as validated JSONB, not normalized aggregates

**Status:** Accepted

## Context
MVP needs iteration speed; full normalization of the Twin is premature.

## Decision
Single JSONB Twin + signal log + snapshots; `pg_jsonschema` validates Twin + Readiness (mandatory), app-layer for Blueprint/Recommendation (D6).

## Consequences
Fast iteration with provenance preserved; split into aggregates at 1000+ users or a measured bottleneck.
