# ADR-CAREERDIY-0007: Direction / Family vs Canonical Career

- **Status:** Accepted
- **Date:** 2026-08-19
- **Specification:** `../product/direction-career-mapping-v1.md`

## Context

Free exploration produces broad directions such as “Design, Media & Communication”. The partner Career Library exposes individual canonical career names such as “Product Design” or “User Experience Design UX”. A direction is therefore not necessarily a valid Career Library career name.

## Decision

Maintain three layers:

```text
Direction / family
    ↓
Direction ↔ Career mapping
    ↓
Canonical Career Library career
```

A free-exploration direction must never be converted directly into a Career Library URL unless an explicit canonical mapping exists.

Mappings may be many-to-many. A career may belong to more than one direction with different relationship strength / priority.

Mapping status must distinguish:

- **Verified:** canonical name observed in supplied Career Library/search/API evidence.
- **Provisional:** plausible relationship but canonical name not yet verified.
- **Unmapped:** requires catalogue discovery before linking.

## Consequences

Users explore a direction first, then select an actual career entity. This avoids broken or semantically incorrect Career Library URLs and preserves the broad nature of the free exploration.
