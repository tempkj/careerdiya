# Contracts (FROZEN 🔒)

These files are the **Contract Freeze** boundary (see `../ENGINEERING_HANDBOOK.md` §1).

- `careerasana_openapi_v1.yaml` — the API contract, **1.1.1**. API version `/api/v1`.
- `careerasana_api_spectral.yaml` — the governance ruleset enforcing conventions.

## Rules
- Do **not** edit these to satisfy a UI need. UI/UX is the *Design Freeze* and changes freely.
- A change here is a **governed amendment**: gap → architecture review → approved → version bump.
- CI enforces this: `contract:validate`, `contract:lint` (Spectral), and `enum:check`
  (parity against `../packages/db/vocab.json`) must pass on every PR.
- Types in `../packages/api-types` are **generated** from this file. Never hand-edit them.
