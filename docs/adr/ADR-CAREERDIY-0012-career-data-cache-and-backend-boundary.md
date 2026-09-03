# ADR-CAREERDIY-0012: Career Data Backend Boundary and Cache

- **Status:** Accepted with implementation detail to finalize during backend phase
- **Date:** 2026-08-19

## Context

The Career Library response is structured and can be requested per canonical career. Direct browser calls to a partner endpoint would couple the frontend to CORS, rate limits, endpoint details and partner availability.

## Decision

The preferred runtime boundary is:

```text
Browser
  ↓
Career Diya backend / server-side function
  ↓
Career Library adapter
  ↓
Partner career-data endpoint
```

The adapter normalizes partner data into a Career Diya schema.

Career data should be cacheable so Career Diya can reduce repeated partner requests and remain resilient to temporary partner outages.

The initial implementation should not require persistent storage of the entire partner catalogue unless the product requirement justifies it.

## Consequences

Frontend code remains independent from partner transport details. The cache strategy can evolve from short-lived runtime caching to Supabase-backed persistence later without changing the Career Diya page contract.
