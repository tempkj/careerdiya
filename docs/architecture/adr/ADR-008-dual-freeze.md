# ADR-008: Contract Freeze vs Design Layer

**Status:** Accepted

## Context
UX must iterate continuously while the contract stays stable enough for parallel work.

## Decision
Contract (DB/API/invariants/prompts) changes only via governed amendment; UI/UX/copy iterate freely. The boundary is the contract files; CI enforces it. (See ADR-002, ADR-003.)

## Consequences
Frontend and backend parallelize against a stable contract; no silent schema/endpoint/prompt drift.
