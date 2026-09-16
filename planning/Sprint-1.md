# Sprint 1 — Core platform (parallel tracks)

Enabled by the frozen contract. Two tracks build independently, merge at the slice.

## Track A (critical path)
- Activation hardening (journey[], `GET /activation/{sessionId}`).
- Twin: signal classifier (minor/major), snapshots, `GET /twin/explain` (provenance).
- Signal processing worker (async job → `GET /jobs/{id}`).

## Track B (scaffold vs contract)
- Blueprint scaffolding (regenerate job; document shape).
- Readiness scaffolding (calculator over declared inputs; `readiness_spec` seed; history).
- Planner scaffolding (goals → tasks; reflections; thin momentum; ETag/If-Match).

## Merge
Track B integrates once Track A's `TwinContext` is real. Contract tests assert conformance at the seam.
