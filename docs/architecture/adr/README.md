# Architecture Decision Records

Why, not just what. The handbook captures current rules; ADRs preserve the *reasoning* so it survives staff turnover. One file per decision; **immutable once Accepted** (supersede with a new ADR, don't edit). Format: Context · Decision · Consequences · Status.

See [`../../../CONTRIBUTING.md`](../../../CONTRIBUTING.md#when-to-write-an-adr-and-when-not) for when an ADR is (and isn't) required.

## Foundational four (the engineering-governance baseline)
These were the CTO-mandated baseline before implementation. With them recorded, the governance layer is complete.

| ADR | Decision |
|---|---|
| [001](./ADR-001-twin-append-only-signals.md) | The Career Twin is append-only and evolves only through signals |
| [002](./ADR-002-openapi-first.md) | OpenAPI-first development with generated types |
| [003](./ADR-003-prompt-governance.md) | Prompts are governed, versioned assets |
| [004](./ADR-004-modular-monolith-boundaries.md) | Modular monolith with enforced module boundaries |

## Supporting decisions
| ADR | Decision |
|---|---|
| [005](./ADR-005-readiness-extracted.md) | Readiness is a standalone calculator, hosted not owned by Blueprint |
| [006](./ADR-006-single-coach.md) | Single Coach agent + tools, not multi-agent |
| [007](./ADR-007-three-schemas.md) | Three Postgres schemas with prefix-enforced module boundaries (DB counterpart to 004) |
| [008](./ADR-008-dual-freeze.md) | Contract Freeze vs Design Layer |
| [009](./ADR-009-jsonb-twin.md) | Twin stored as validated JSONB, not normalized aggregates |
| [010](./ADR-010-decouple-activation-save-from-twin-flush.md) | Activation save decoupled from Twin signal flush (save vs. promote) |
| [011](./ADR-011-role-substrate-derive-on-the-fly.md) | Role substrates stored; transitions derived on-the-fly, not materialized |
| [012](./ADR-012-blueprint.md) | Blueprint model defined: derived paths, promoted to a versioned, dependency-ordered roadmap over a task library — coexists with ADR-005's Readiness-hosting decision |
| [013](./ADR-013-blueprint-task-identification.md) | *(Proposed)* Blueprint task identification as an AI-first reasoning layer upstream of `derivePaths` — design only, build is a later chapter |

> ADR-001 consolidates two earlier draft records (Twin-immutable + signals-append-only) into one decision. Numbering was settled pre-implementation so the foundational four sit at 001-004; from here ADRs accrete and are not renumbered.
