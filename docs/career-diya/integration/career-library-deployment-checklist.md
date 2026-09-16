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
