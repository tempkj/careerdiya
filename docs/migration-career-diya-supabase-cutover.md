# Career Diya Supabase cutover

The source projects use different Supabase projects. The merged repository intentionally uses
the CareerAsana Supabase project as the canonical project because it already owns the richer
`core` / `knowledge` / `audit` model and the CareerAsana auth/API runtime.

## What this build does

- Career Diya browser configuration is generated from the merged app's
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Career Diya profile data now targets `core.profile`.
- Career Diya background data targets the two `core.career_diya_*` tables.
- Career Diya exploration snapshots target `core.career_diya_exploration`.
- Lead/pre-application intake has corresponding `core.career_diya_*` tables.
- CareerAsana access is represented by `core.product_access`.

## Existing Career Diya accounts/data

Do not blindly copy rows from the old Career Diya Supabase project into the new project.

The old and new projects have independent `auth.users` identities. A production identity/data
migration must deliberately migrate or recreate the Auth users first and preserve their UUID
relationship before copying user-owned rows.

For a clean Phase 1 launch, the simplest path is to make the merged project the new source of
truth and let users sign in there. Historical Career Diya data can be migrated separately after
the identity strategy is chosen.

## Required production setup

1. Put the canonical Supabase URL and publishable/anon key in the merged `.env.local`/deployment
   secret store.
2. Apply all `packages/db/supabase/migrations/` migrations to the canonical project.
3. Set `CAREERASANA_ACCESS_MODE=paid`.
4. Connect the eventual billing system to grant/revoke `core.product_access`.
5. Keep service-role/secret keys server-side only.
6. Test the Career Diya → `/auth/handoff` → `/activate` flow with a real authenticated user.
