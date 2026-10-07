# Career Library deployment checklist

The local frontend already supports the observed Career Library country/language catalogue. The live Supabase project must have BOTH Edge Functions deployed from this same checkout.

## Deploy

```bash
./scripts/deploy-career-library.sh
```

## Expected functions

- `career-library` — ACTIVE
- `career-library-video` — ACTIVE

## Verify adapter versions

The JSON response includes `adapterVersion: "2.1"` for both functions.

## Browser checks

1. Load an India / English career.
2. Change Market to United States. The URL must change and the profile data must refresh.
3. Change Language to Hindi (or another supported language). The URL must change and the profile data must refresh.
4. Click Recommended Watch #1 and #2. A Career Diya modal must open.

## Diagnosis of the previous failure

A browser message saying `Only India / English is currently supported` proves the deployed `career-library` function is an older revision than the current local source. A 404 for `/functions/v1/career-library-video` proves that the video function is not deployed to the linked project.

## Career Intelligence cache and periodic refresh

The Career Library is now wrapped by a Career Diya-owned cache layer:

- `career-library-cache` — browser-facing, cache-first read path.
- `career-library-refresh` — authenticated worker that refreshes due variants.
- `knowledge.career_library_variant` — one country/language/source variant with refresh state.
- `knowledge.career_library_snapshot` — immutable upstream payload history.
- `knowledge.career_library_profile` — current Career Diya-owned profile used for serving.
- Default refresh interval is 30 days; failed upstream checks retry after 6 hours without discarding the last good profile.

The frontend now calls `career-library-cache`, while the existing `career-library` function remains the single upstream adapter. This keeps provider-specific parsing/validation in one place.

### Deployment prerequisites

Deploy both new functions alongside the existing Career Library functions:

```bash
supabase functions deploy career-library-cache
supabase functions deploy career-library-refresh
```

The refresh function requires JWT verification and uses the server-side `SUPABASE_SERVICE_ROLE_KEY` to write Career Intelligence data. Do not expose the service-role key to the browser.

The scheduled GitHub Action expects these repository secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

It invokes `career-library-refresh` every six hours and can also be run manually. GitHub scheduled workflows run from the repository's default branch, so the periodic job becomes active after this branch is merged to the default branch. The workflow intentionally sends only the publishable/anon key; the refresh function performs database writes with its server-side service-role secret.

### Migration sequence

1. Apply migration `20261007000039_career_library_intelligence.sql`.
2. Deploy `career-library-cache` and `career-library-refresh`.
3. Confirm the existing `career-library` upstream adapter is deployed and authorized.
4. Configure the GitHub repository secrets.
5. Load a career in Career Diya and confirm a `career_library_variant`, snapshot and current profile are created.
6. Run the refresh workflow manually once.
7. Confirm unchanged upstream content updates `last_checked_at` without creating a new snapshot.
8. Confirm changed upstream content creates a new immutable snapshot and updates the current profile.
9. Confirm an upstream failure continues serving the last successful cached profile and records `refresh_status=failed`.

This makes the third-party service a continuously refreshed upstream dependency rather than the long-term system of record.