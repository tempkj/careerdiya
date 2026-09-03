# Career Diya Architecture Decision Records

This directory contains the accepted architectural and product decisions that constrain the Career Diya implementation.

## How to use these ADRs

- Read the relevant ADR before changing architecture, user-data behavior, recommendation logic, audience routing, assessment routing, or Career Library integration.
- Accepted ADRs are normative unless a newer ADR explicitly supersedes them.
- Product matrices and mappings referenced by ADRs live under `docs/product/` and are normative data/configuration specifications.
- Prototype behavior must not be represented as validated psychometrics, clinical assessment, definitive career fit, or guaranteed career outcomes.

## ADR index

| ADR | Decision |
|---|---|
| [ADR-ECOSYSTEM-0001](./ADR-ECOSYSTEM-0001-unified-career-graph.md) | Unified Career Graph compatibility across Career Diya and Skill Diya |
| [ADR-CAREERDIY-0002](./ADR-CAREERDIY-0002-product-boundaries-and-common-admin.md) | Separate consumer products, common Swakojo Admin |
| [ADR-CAREERDIY-0003](./ADR-CAREERDIY-0003-free-exploration-vs-paid-assessment.md) | Free exploration vs deeper/paid assessment boundary |
| [ADR-CAREERDIY-0004](./ADR-CAREERDIY-0004-adaptive-audience-experience.md) | Audience selector, persistence, routing and adaptive copy |
| [ADR-CAREERDIY-0005](./ADR-CAREERDIY-0005-free-recommendation-engine-v1.md) | Free recommendation scoring model and selection logic |
| [ADR-CAREERDIY-0006](./ADR-CAREERDIY-0006-parent-school-stage-safety.md) | Parent/school-stage safety and language constraints |
| [ADR-CAREERDIY-0007](./ADR-CAREERDIY-0007-direction-vs-career-taxonomy.md) | Direction/family vs canonical career distinction |
| [ADR-CAREERDIY-0008](./ADR-CAREERDIY-0008-career-library-integration.md) | Structured Career Library integration and rendering boundary |
| [ADR-CAREERDIY-0009](./ADR-CAREERDIY-0009-partner-branding-and-redirects.md) | Partner naming, user-facing copy and redirect preservation |
| [ADR-CAREERDIY-0010](./ADR-CAREERDIY-0010-static-site-and-minimal-diff.md) | Static-hosting, minimal-diff and no-unnecessary-rewrite convention |
| [ADR-CAREERDIY-0011](./ADR-CAREERDIY-0011-brand-and-ux-system.md) | Career Diya brand and UX guardrails |
| [ADR-CAREERDIY-0012](./ADR-CAREERDIY-0012-career-data-cache-and-backend-boundary.md) | Server-side partner calls, normalization and caching boundary |
| [ADR-CAREERDIY-0013](./ADR-CAREERDIY-0013-free-profile-gate.md) | Free profile gate before revealing the exploration result |
| [ADR-CAREERDIY-0014](./ADR-CAREERDIY-0014-pre-application-and-offline-admissions-boundary.md) | Career Diya pre-application capture; downstream admissions remain offline |
