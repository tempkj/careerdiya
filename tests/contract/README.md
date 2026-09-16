# Contract tests

Proves the **running implementation** conforms to the frozen OpenAPI contract — the gap
that Spectral (spec quality) and enum-parity (spec↔DB) don't cover.

Approach (OpenAPI-first): for each operation, exercise the endpoint against a local
Supabase-backed instance and assert the response status + body validate against the
contract's schema. Encoded invariants to assert explicitly:
- no `PUT /twin` (Twin changes only via signals)
- mutable PATCH requires `If-Match`; stale → 412
- every 202 returns a pollable `Location` → `GET /jobs/{id}` resolves
- **negative RLS**: another user cannot read these rows (Vertical-Slice DoD)
