# Career Library Integration Contract (Working)

## Known request shape

```text
POST https://careerdiya.edumilestones.com/global-career-library/backend.php

vars[careerName] = <canonical career name>
vars[country]    = India
vars[language]   = English
```

## Known response shape

```json
{
  "isValid": true,
  "careerData": { }
}
```

## Normalization boundary

The frontend must not consume the partner response directly. A Career Diya adapter should map the partner schema to a stable internal schema.

## Important fields currently observed

- seo
- title
- introduction
- whoShouldPursue
- workNature
- eligibility
- stats
- pathways
- conventionalOptions
- newAgeOptions
- aiRelatedOptions
- videoRecommendations

## Production note

This document records the technical shape observed in the supplied Career Library implementation. It is **not** a statement that the endpoint is an officially supported public API. Production authorization/partner approval must be confirmed separately.


## Career detail URL convention

The supplied Career Library uses the confirmed pattern `https://careerdiya.edumilestones.com/global-career-library/in/{career-name}/en-IN`. Career Diya must first resolve an exact canonical career name from the catalogue/mapping layer, then generate the partner detail path from that canonical name. A broad direction label must never be used directly.


## Native rendering adapter

The Career Diya frontend invokes `functions/v1/career-library` using the public Supabase key. The function is configured as a public endpoint (`verify_jwt = false`) because career profiles are public content. The function validates the canonical career name against the approved catalogue before calling the upstream Career Library service.

Supabase Edge Functions require CORS handling for browser invocation; the adapter uses the Supabase CORS headers and handles `OPTIONS` preflight.

## Market, language and video adapter parity (v1)

The native Career Diya integration sends `careerName`, `country`, and `language` to the `career-library` Edge Function. The current supported UI catalogue contains 41 countries and 14 languages observed in the connected Career Library experience. The adapter validates these values rather than accepting arbitrary strings.

Recommended-watch cards are resolved through `career-library-video`, which accepts `careerName`, `country`, `language`, and `type` (1 or 2), then calls the connected `videoBackend.php` and returns a validated HTTPS URL for a Career Diya-native modal.
