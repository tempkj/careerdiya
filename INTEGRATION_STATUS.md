# Integration status — 2026-09-07

## Implemented in this merge

- CareerAsana monorepo is the canonical host/deployment.
- Career Diya static experience is bundled into `apps/web/public` and remains visually intact for this slice.
- `/` opens Career Diya; CareerAsana continues at `/activate` and `/blueprint`.
- Career Diya and CareerAsana are configured to use the same Supabase project at build time.
- Career Diya profile data is mapped onto `core.profile`.
- Career Diya explorations are append-only in `core.career_diya_exploration`.
- Career Diya background/intake tables are in the shared `core` schema.
- Career Diya exact-career pages have a contextual CareerAsana bridge.
- Session handoff from the static Career Diya client to the Next.js cookie session is implemented at `/auth/handoff`.
- CareerAsana activation/Blueprint pages and APIs have a server-side product-access gate.
- `CAREERASANA_ACCESS_MODE=preview` enables internal preview; `paid` enforces `core.product_access`.

## Not implemented yet

- Checkout/payment provider.
- Automatic entitlement provisioning after payment.
- Porting Career Diya static pages into React/Next components.
- Full historical migration of the old Career Diya Supabase project's Auth users/data.
- A free personalized skill-gap engine in Career Diya. The free layer remains the existing deterministic exploration + Career Library decision experience.
- Production live-AI tuning/cost policy changes beyond the access boundary.

## Recommended next slice

1. Run the merged app in preview mode against a fresh/local shared Supabase database.
2. Verify the Career Diya profile → exact career → CareerAsana handoff.
3. Verify access denial in `paid` mode and manual entitlement grant.
4. Then wire the actual payment/entitlement provider.
5. Only after that decide which Career Diya pages are worth porting to React rather than merely serving statically.
