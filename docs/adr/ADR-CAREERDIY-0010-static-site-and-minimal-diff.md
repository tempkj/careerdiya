# ADR-CAREERDIY-0010: Static Hosting and Minimal-Diff Implementation

- **Status:** Accepted
- **Date:** 2026-08-19

## Context

The current Career Diya site is a working static site intended to deploy on static hosting such as Hostinger.

## Decision

- Preserve the existing HTML/CSS/JS architecture.
- No framework or build step may be introduced merely for convenience.
- Keep changes minimal, diff-able and scoped to the requested feature.
- Do not rewrite functioning pages or decision-engine logic unless the requested change requires it.
- Preserve layout, grid system, component structure and responsive breakpoints unless explicitly changed.
- Use relative asset paths for static deployment.
- Validate every changed package with a plain HTTP server.
- Verify ZIP integrity before distribution.

## Consequences

The product remains easy to deploy, inspect and roll back. Architectural improvements must earn their complexity rather than being introduced as cleanup.
