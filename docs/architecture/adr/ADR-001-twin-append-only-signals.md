# ADR-001: The Career Twin is append-only and evolves only through signals

**Status:** Accepted
**Supersedes:** the earlier split records (Twin-immutable + signals-append-only), now consolidated here.

## Context
The Twin is the product moat. It must be explainable ("why do we believe this?"), re-derivable
(reconstructable from its inputs), and auditable. A directly-mutable Twin loses all three.

## Decision
- The Twin is never written directly. There is no `PUT /twin`. It changes **only** by submitting a
  signal (`POST /twin/signals`).
- Signals are an **append-only** log; the Twin is (re)computed by applying them. Snapshots, readiness
  history, coach turns, consent, and the audit log are likewise append-only.
- Every Twin fact carries provenance: `source` (the originating signal) + `capturedAt`, and a
  `confidence {value, basis}`.
- Consumers treat the Twin as a **derived read model**, not a primary write model: reads come from the
  Twin; writes go to the signal log and the Twin is recomputed (a CQRS-style read/write split).
- Consumers treat the Twin as a **derived read model**, not a primary write model (CQRS-like): reads
  hit the computed Twin; the only write path is the signal log it is derived from.

## Consequences
- Full provenance + re-derivability (invariants A2/A16); the signal log is the audit spine.
- Slightly more indirection on writes; storage grows (mitigated by retention sweeps on non-provenance data).
- Enables a future Twin re-derivation/training pipeline and a clean Twin-store split with no API change.

## Enforced by
`no PUT /twin` in the contract; append-only RLS + triggers; contract test asserting the invariant.
