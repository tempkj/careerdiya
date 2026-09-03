# ADR-CAREERDIY-0013 — Free Profile Gate Before Exploration Result

## Status
Accepted

## Decision
After the seven-question Career Diya free exploration is completed, the default completion flow asks the visitor to create a free Career Diya profile before revealing the recommendation result.

The profile is created through Supabase Auth using the existing public Supabase project. No public profile table, Twin, CareerAsana, shared graph, or identity service is introduced by this decision. The authenticated Supabase user ID is the identity shape that can later serve as `shared_user_id` under the existing unified-career-graph constraint.

The completed exploration is preserved locally before profile creation so the user does not lose answers if registration fails.

## UX rule
Value is established before registration: the visitor completes all seven questions and then sees that the exploration is ready. The account gate explains what will be unlocked: saved exploration, starting directions, and the ability to return later.

The result is not hidden behind a paid service. It is a free-profile gate only.

## Scope boundary
This ADR does not introduce:
- a public `profiles` table
- Career Twin
- CareerAsana integration
- unified graph infrastructure
- a shared dashboard
- longitudinal tracking
- paid assessment logic

## Authentication
The implementation uses the existing Supabase project and anon/publishable key for browser-side Auth requests. No service-role key is exposed.


## Social sign-in

The profile gate offers Google and Microsoft sign-in in addition to email/password. Supabase Auth owns the OAuth exchange. Microsoft uses the Supabase `azure` provider with the `email` scope. Additional providers may be added later without changing the exploration/result contract.

## Post-registration handoff
When email confirmation is enabled, successful registration redirects the visitor to a dedicated Career Diya Sign In page with an explicit confirmation message. After a successful sign-in (or completed social authentication), the user is redirected back to the exploration and the stored seven answers are rendered as the result. The registration gate is never shown again for that completed exploration.

## Saved exploration access
For the current launch phase, the completed exploration result is persisted in browser storage after authentication. The Home page's `Explore My Assessment` action opens that stored exploration when an authenticated saved result exists; otherwise it opens `Start Exploration`. A later persistent database-backed exploration record can replace this storage without changing the user-facing flow.
