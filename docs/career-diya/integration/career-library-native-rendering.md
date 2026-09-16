# Career Library Native Rendering — Deployment Note

Career Diya career detail pages are now rendered natively from the connected Career Library service.

## Runtime path

Browser → Supabase Edge Function `career-library` → Career Library `backend.php` → normalized `careerData` → Career Diya renderer.

The browser never calls the partner endpoint directly.

## Deploy

From the Career Diya project root, with the common Supabase project linked:

```bash
supabase functions deploy career-library --use-api
```

The function is intentionally public (`verify_jwt = false`) because career-detail pages are public. The function validates the requested canonical career name against the approved Career Library catalogue before proxying the request.

## Upstream contract

```text
POST https://careerdiya.edumilestones.com/global-career-library/backend.php

vars[careerName]
vars[country] = India
vars[language] = English
```

## Browser configuration

`assets/supabase-config.js` contains only the public Supabase URL and publishable/anon key. No service-role/secret key is used by the browser.
