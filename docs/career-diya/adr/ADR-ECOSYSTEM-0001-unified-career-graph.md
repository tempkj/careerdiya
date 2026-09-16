# ADR-ECOSYSTEM-0001: Unified Career Graph Compatibility

- **Status:** Accepted
- **Date:** 2026-08-19
- **Scope:** Career Diya and Skill Diya identity / persistent user data

## Context

Career Diya and Skill Diya remain separate consumer products, but their long-term value includes a single person's longitudinal career graph spanning guidance, decision, learning and outcomes.

Any feature that introduces identity, authentication, account records or persistent user-owned data must remain joinable to a future shared user identity.

## Decision

Use the conceptual structure:

```text
Shared identity
    ↓
shared user id
    ↓
product-specific records
+
append-only career events
    ↓
joinable longitudinal career graph
```

Career Diya may implement only its own product-specific subset today. It must not create an irreversible product-local identity silo.

Do not prematurely build a universal auth service, shared dashboard, career graph engine, event infrastructure or cross-product API unless a current feature actually requires it.

## Consequences

- Identity/per-user-data schemas must reserve a future shared-user-id shape.
- Career Diya and Skill Diya can keep separate UX and consumer journeys.
- Future cross-product career events remain joinable without forcing shared infrastructure now.
