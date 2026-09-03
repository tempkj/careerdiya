# ADR-CAREERDIY-0004: Adaptive Audience Experience

- **Status:** Accepted
- **Date:** 2026-08-19

## Context

Career Diya serves a wider audience than an adult-professional-only landing page suggests. The product should support approximately ages 7-50 through one experience, while respecting the difference between a parent acting for a child and a person acting for themselves.

## Decision

Use one shared page tree with three audience states:

1. **Parent / school-stage:** parent choosing a stream or direction for a school-age child.
2. **Student 16+:** late-school / college student deciding what to study or pursue next.
3. **Graduate / professional:** graduate or working professional considering growth, change, switching or a new direction.

The selected audience is represented through `?audience=` and lightweight browser state. State is persistent but changeable.

### State rules

- Missing audience → neutral experience.
- Invalid audience → neutral experience.
- Cleared state → neutral experience.
- User can re-open the selector and change audience at any time.
- Audience state must never create duplicate page trees.

### Routing rules

| Audience | Definition | Assessment destination |
|---|---|---|
| Parent / school-stage | Child in school-age segment | Co-branded age-designed school-stage assessment |
| Student 16+ | Late-school / college, age 16+ | Career Diya RIASEC-42 adult/16-50 assessment |
| Graduate / professional | Graduate / working professional | Career Diya RIASEC-42 adult/16-50 assessment |

The parent path **must never route to RIASEC-42**.

## Consequences

Hero copy, examples and CTA targets can adapt without duplicating HTML pages. The audience selector must appear early enough that a visitor can self-identify before the primary action.
