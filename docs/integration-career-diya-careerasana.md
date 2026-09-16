# Career Diya + CareerAsana integration — Phase 1

## Decision

The projects are consolidated into one deployable repository, with CareerAsana's Next.js
application and Supabase project as the canonical runtime/backend.

Career Diya remains the public/free decision experience. Its existing static pages are served
from the same Next.js deployment during this first integration slice, so the UI can be migrated
to React/Next incrementally instead of being rewritten.

### Product boundary

```text
Career Diya (free)
  Explore → evaluate → compare → decide
                         │
                         ▼
                 high-intent handoff
                         │
                         ▼
CareerAsana (paid/deeper)
  activate → deeper gap diagnosis → AI task identification
           → consent/edit → paths → blueprint → execution
```

The free Career Diya experience must remain deterministic/bounded. It does not call CareerAsana's
LLM-backed activation/blueprint engine merely to produce a free result.

## Shared identity

CareerAsana's Supabase project is the canonical auth/backend project. Career Diya's browser
experience is pointed at the same project at build time. A small `/auth/handoff` page exchanges
the browser-held Supabase session into the Next.js cookie session before entering CareerAsana.

No access token is sent to the server as a query parameter; the handoff data is carried in the
browser fragment and removed from the visible URL immediately after `setSession`.

## Data

`core.profile` is the canonical per-user profile and is extended with Career Diya's bounded
profile fields.

Career Diya explorations are stored in `core.career_diya_exploration` as append-only snapshots.
This fixes the old one-row-per-user limitation and lets future comparison preserve historical
answers/result/logic.

Career Diya background records live in:
- `core.career_diya_profile_education`
- `core.career_diya_profile_experience`

Operational intake records live in:
- `core.career_diya_lead`
- `core.career_diya_pre_application`

## Paid boundary

`core.product_access` is the server-enforced entitlement seam.

- `CAREERASANA_ACCESS_MODE=preview` bypasses entitlement checks for local/internal preview.
- `CAREERASANA_ACCESS_MODE=paid` requires an active `core.product_access` row.
- Payment integration is deliberately not invented here. A future billing adapter grants/revokes
  entitlement; it does not change CareerAsana's planning APIs.

The UI gate is not the security boundary. Activation and Blueprint API routes also check entitlement.

## Existing CareerAsana reused

The integration intentionally reuses the existing:
- activation sessions and historical goal/exploration model;
- gap analysis structure and provenance;
- target-role / O*NET normalization;
- substrate and transition model;
- AI task identification + validation/cache;
- consent/dispute model;
- deterministic Fastest / Optimal / Thorough path derivation;
- roadmap/Blueprint editing, dependencies, effort totals and versioning;
- Twin provenance/promote mechanics.

## Career Diya → CareerAsana handoff

The handoff is deliberately made only after the user has chosen a concrete destination career
or related career option, not while they are still at a broad exploration direction.

A user explores a broad direction in Career Diya, opens an exact canonical career, then sees:

> Ready to turn this career choice into a personalized plan?

The bridge passes:
- exact canonical career name;
- Career Diya career ID;
- current role from the shared profile when available;
- authenticated Supabase session.

CareerAsana receives the already-known starting and destination roles. For a Career Diya
handoff it skips the redundant From/To role form and immediately runs the existing gap-analysis
pipeline. A direct CareerAsana entry point may still use the From/To form.

## What is intentionally not merged yet

- Career Diya's static pages are not rewritten into React in this slice.
- CareerAsana's Twin/Coach/Readiness/outcome machinery is not exposed as free Career Diya functionality.
- No billing provider is hard-coded.
- No generic cross-product "unified dashboard" is introduced.
- Career Diya's free recommendation matrix remains the source of truth for free exploration.
- CareerAsana's live AI task identification remains behind the paid boundary.

This is an incremental consolidation, not a rewrite.
