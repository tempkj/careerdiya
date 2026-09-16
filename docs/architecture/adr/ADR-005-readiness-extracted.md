# ADR-005: Readiness is a standalone calculator, hosted not owned by Blueprint

**Status:** Accepted

## Context
Readiness derives from Twin + Planner + Outcomes + Recommendation fit, not from the Blueprint.

## Decision
A pure ReadinessCalculator with declared inputs; Blueprint only hosts/renders the result. Versioned via `readiness_spec`; every recompute appends to `readiness_history` stamped with the spec version.

## Consequences
Clean future extraction to its own service; no coupling to Blueprint internals (A12/A13/A14).
