# ADR-CAREERDIY-0008: Career Library Integration

- **Status:** Accepted with production approval required
- **Date:** 2026-08-19

## Context

The co-branded Career Library is facilitated by Edumilestones and exposes rich career information. Supplied page source shows the library page is backed by structured `careerData` rather than only static HTML.

## Decision

Prefer **structured career-data consumption** over DOM scraping.

The known request shape is:

```text
POST /global-career-library/backend.php
vars[careerName] = <canonical career name>
vars[country] = India
vars[language] = English
```

The response shape is:

```json
{
  "isValid": true,
  "careerData": { ... }
}
```

Career Diya should normalize this into its own schema before rendering.

Do not make the Career Diya frontend depend directly on partner HTML structure, CSS classes or DOM layout.

## Production constraint

The existence of the endpoint does not by itself establish external API authorization. Production integration must be confirmed under the partnership/technical agreement before relying on programmatic access as a supported integration.

## Consequences

Career Diya can own the decision experience and presentation while using specialist career depth from the partner system, without copying the partner site's UI.
