# Documentation

Split by audience and change cadence:

- `architecture/` — engineering decisions (ADRs) and architecture notes. Governed.
- `product/` — Founder Edition, PRD, personas, journeys, GTM. Design-freeze.
- `ux/` — wireframes, flows, copy, visual hierarchy. Design-freeze.
- `research/` — interviews, usability, Founder-Learning outputs.

The **frozen build contract** (OpenAPI + Spectral) lives in `../contracts/`, not here. The frozen
**design source-of-truth** documents (Engineering Blueprint v1.3.1, Database Design Spec v1.3,
OpenAPI 1.1.1) are referenced by these folders; drop the canonical copies into `product/` (Founder
Edition) and keep engineering specs alongside `architecture/`.
