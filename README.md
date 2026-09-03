# Career Diya website prototype

A standalone, decision-first Career Diya website for the Swakojo ecosystem. It is designed around crossover customers and fence-sitters, while selectively deep-linking to the existing Edumilestones co-branded experience where deeper capability exists.

## Run locally

From this folder:

```bash
python3 -m http.server 8000
```

Open:

- http://localhost:8000/
- http://localhost:8000/explore.html
- http://localhost:8000/assessment.html
- http://localhost:8000/paths.html
- http://localhost:8000/counselling.html
- http://localhost:8000/resources.html
- http://localhost:8000/dashboard.html

## Product intent

Career Diya owns the decision journey: Understand → Explore → Decide → Learn → Grow.

Skill Diya owns the learning journey.

Edumilestones is used selectively as a specialist/deep-content partner through explicit links.

## Notes

This is a frontend prototype. Forms and dashboard data are illustrative. Replace mailto/external links and the local decision demo with real APIs/auth when productionising.

## Architecture & Product Decisions

The project maintains its accepted architecture/product constraints in `docs/adr/`.

Start with `docs/adr/README.md` for the ADR index. Normative recommendation, audience and Career Library mapping specifications live under `docs/product/`.
## Career Library taxonomy

The free recommendation engine operates on broad directions. Exact Career Library names are maintained in `assets/career-mapping.js` and documented in `docs/product/career-library-catalogue-v1.md` and `docs/product/direction-career-mapping-v1.md`. Canonical-name verification and direction relationship status are tracked separately.


## Launch lead capture
See `docs/integration/lead-capture-backend.md` and `supabase/migrations/001_create_leads.sql`. Configure `assets/supabase-config.js` from the provided example before deployment.


## Free profile gate

After the seventh exploration question, Career Diya asks the visitor to create a free profile before revealing the result. The gate supports email/password plus Google and Microsoft sign-in. Configure the Google and Azure (Microsoft) providers in Supabase Auth and add the local/production `explore.html` redirect URLs to the Supabase redirect allowlist before launch.

## Admissions pre-application
Career Diya now supports a launch-scoped college/programme pre-application flow. A selected opportunity can open `admissions.html` with college/programme query parameters. Submission creates a Career Diya Pre-Application ID in `public.admissions_pre_applications` and stops there: the admissions partner contacts the candidate offline and handles downstream documents/payment/application steps. No partner API adapter is implemented.

Apply migration `supabase/migrations/003_create_admissions_pre_applications.sql` before enabling the form in a deployed environment.
See `docs/adr/ADR-CAREERDIY-0014-pre-application-and-offline-admissions-boundary.md` and `docs/integration/admissions-preapplication.md`.

## Structured profile background

The authenticated profile now uses bounded taxonomies for personalization and supports multiple education records and multiple experience/knowledge areas. The controlled option lists live in `assets/profile-options.js`.

Apply `supabase/migrations/006_create_profile_background_tables.sql` after the existing profile migration. The migration adds:

- `public.career_profile_education` for multiple formal education records.
- `public.career_profile_experience` for multiple domains of academic, professional, project, certification, freelance, entrepreneurial or self-learning exposure.
- explicit `*_other` fields on `career_profiles` so custom values do not pollute the standardized taxonomy.

The UI caps each repeatable background section at five records and uses `Other` controls that reveal a custom-value field. The existing single-value profile columns are retained for compatibility and current-state personalization; the repeatable tables are the source for multi-background history.

Push the migration from the project root with:

```bash
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

Do not run `supabase db push` until the local project is linked to the intended Career Diya Supabase project.

## Background system update

The current build uses a blank paper page canvas with the Career Diya mural system only at intentional opening surfaces. Home uses the 1b spray-mural treatment; Explorer/Assessment use 2a; the remaining utility/content pages use 2b. Blooms and outline shapes move unless reduced motion is requested. The footer is the only true black surface. Profile and deeper-assessment CTAs use the same brand navy as the path-card system.
