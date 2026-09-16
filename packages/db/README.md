# @careerasana/db

Supabase migrations + schemas (Database Design Spec v1.3).

- `supabase/migrations/` — DDL, applied in the §10 order (see `.gitkeep`).
- `schemas/*.schema.json` — `pg_jsonschema` validation targets (Twin + Readiness are **mandatory**, D6).
- `vocab.json` — controlled vocabularies (§6.6); the DB side of the enum-parity gate.

3 schemas (D1-rev): `core`, `knowledge`, `audit`. Module boundaries inside `core` are enforced by
table-name prefixes + the boundary lint. RLS is FORCED on every user-owned table.
