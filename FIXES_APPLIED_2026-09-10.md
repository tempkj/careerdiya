# CareerAsana — Current Role / Career Diya Handoff Fixes

Applied to the complete project supplied by the user.

## 1. Career Diya → CareerAsana auto-start
`apps/web/src/modules/activation/ui/ActivationForm.tsx`

The previous auto-start effect called `formRef.current?.requestSubmit()`, but the same component deliberately rendered the auto-start status screen instead of the `<form>`. Therefore the ref was null and the activation request was never sent.

The fix calls the activation pipeline directly from the auto-start effect. The manual role form is still skipped during Career Diya handoff.

## 2. Current-role substrate is enrichment, not a hard dependency
`apps/web/src/modules/knowledge/application/substrate.ts`
`apps/web/src/modules/activation/application/start.ts`

A Career Diya current/most-recent role is free text and does not need to exist in the shared role substrate catalogue.

`SubstrateStore.getCached()` performs a read-only lookup. `startActivation()` uses it for the current role. A cache miss no longer triggers substrate generation or a shared knowledge-table write.

The desired/target role continues to use the normal `get()` path.

## 3. Better local API diagnostics
`apps/web/app/api/v1/activation/start/route.ts`

In non-production, the API now returns the underlying activation error message instead of hiding it behind a generic 500. Production remains generic.

## 4. Database
No database migration or schema change is included or required for these fixes.

## Environment
`.env.local` contains blank placeholders. Populate it with the canonical CareerAsana Supabase project values before running the app.

The project could not be run through a full pnpm build in this environment because the required pnpm package was not locally available and external registry access was unavailable.
