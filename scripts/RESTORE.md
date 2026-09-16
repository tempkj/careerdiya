# Restoring a database backup

Steps to pull a backup archive from R2 and restore it into a **local**
Supabase instance (`supabase start`). This is a disaster-recovery /
test-restore procedure, not a way to clone data into a running prod project.

## 1. Pull the archive from R2

```bash
source .env.local

export RCLONE_CONFIG_R2_TYPE="s3"
export RCLONE_CONFIG_R2_PROVIDER="Cloudflare"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="$R2_ENDPOINT"

# List available backups, newest first
rclone lsf "r2:${R2_BUCKET_NAME}/backups/" | sort -r

# Pull the one you want
rclone copyto "r2:${R2_BUCKET_NAME}/backups/<archive-name>.tar.gz" "/tmp/<archive-name>.tar.gz"
```

## 2. Unpack

```bash
mkdir -p /tmp/restore && tar xzf "/tmp/<archive-name>.tar.gz" -C /tmp/restore
ls /tmp/restore   # roles.sql  schema.sql  data.sql
```

## 3. Start a fresh local Supabase instance

```bash
pnpm db:start     # runs: supabase start --workdir packages/db
```

Confirm you're pointed at the **local** instance, not a hosted project, before
running any restore commands below (`supabase status` shows the local DB URL).

**Note:** `supabase start` auto-applies this repo's own migrations
(`packages/db/supabase/migrations/`) and `seed.sql` on boot. That means
`core`/`knowledge`/`audit` already exist before you reach step 4 — running
`schema.sql` against that will fail with "already exists" on every
`CREATE TABLE`. Two ways to proceed depending on what you're trying to prove:
- **Testing recoverability from scratch** (this doc's original intent —
  what verified the auth nuance below): temporarily move
  `packages/db/supabase/migrations/` and `seed.sql` aside, and set
  `[api] schemas = ["public"]` / `extra_search_path = ["public"]` in
  `config.toml` (the CLI's own PostgREST healthcheck otherwise refuses to
  start against a DB where `core`/`knowledge`/`audit` don't exist yet).
  Restore all three files in order. Move the migrations/seed/config back
  and restart when done.
- **Restoring data into an already-migrated local dev DB** (the more common
  case): skip `schema.sql` entirely — the schema already matches via
  migrations — and go straight to `psql -f data.sql` after truncating the
  app tables you're restoring into.

## 4. Restore in order: roles → schema → data

Order matters — schema objects can depend on roles, and data (COPY
statements) depends on the schema already existing.

```bash
LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"  # from `supabase status`

psql "$LOCAL_DB_URL" -f /tmp/restore/roles.sql
psql "$LOCAL_DB_URL" -f /tmp/restore/schema.sql
psql "$LOCAL_DB_URL" -f /tmp/restore/data.sql
```

## Auth nuance — corrected after a real test-restore (2026-07-10)

An earlier draft of this doc claimed `supabase db dump` excludes the `auth`
schema. **That's wrong** — verified against an actual archive: `data.sql`
contains `COPY "auth"."users" ...` and `auth.identities`, including
`encrypted_password` bcrypt hashes and user metadata. Restoring `data.sql`
into a fresh project *does* repopulate `auth.users`, so FK-constrained
tables (`activation_session.user_id` → `auth.users.id`, etc.) restore
cleanly in the normal case. Two consequences:

**1. Treat backup archives as containing credentials/PII, not just app data.**
Password hashes and emails for every user are in every archive. The R2
bucket, its access tokens, and local copies in `backups/` should be handled
with the same care as a credentials store — this wasn't obvious from the
schema/data split and is easy to assume away.

**2. The FK constraint will NOT catch a broken/partial restore — verify integrity explicitly.**
`data.sql` opens with `SET session_replication_role = replica;` (standard
for data-only dumps, so COPY doesn't have to respect FK dependency order).
This has a real side effect: it disables FK (and trigger) enforcement for
the *entire* data load. Confirmed by test: after deliberately deleting
`auth.users` rows that `activation_session` referenced and re-running
`data.sql`, the `auth.users` COPY failed (duplicate key on rows that
survived) — but `activation_session`'s COPY succeeded anyway and silently
loaded 21 rows referencing users that don't exist. No error, no warning.
`convalidated = t` on the FK the whole time; the constraint was never
consulted.

**Practical implication:** a restore that partially fails partway through
`data.sql` (network blip, a `\.` mid-COPY, restoring an archive from a
moment when the source itself was inconsistent) will not surface as an FK
error. It will surface — if at all — as orphaned rows discovered later by
the application. Step 5 below adds an explicit orphan check for this
reason; don't skip it.

## 5. Verify after restore

```bash
# Row counts per schema — sanity check nothing silently failed
psql "$LOCAL_DB_URL" -c "
  SELECT schemaname, relname, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY schemaname, relname;
"

# RLS is still enabled on restored tables (schema.sql includes RLS policies,
# but confirm — a bad restore order or partial failure can leave it off)
psql "$LOCAL_DB_URL" -c "
  SELECT schemaname, tablename, rowsecurity
  FROM pg_tables
  WHERE schemaname IN ('core', 'knowledge', 'audit')
  ORDER BY schemaname, tablename;
"

# Orphan check — required, not optional. FK enforcement is off during
# data.sql (see auth nuance above), so a broken restore loads silently.
psql "$LOCAL_DB_URL" -c "
  SELECT count(*) AS orphaned_activation_sessions
  FROM core.activation_session a
  LEFT JOIN auth.users u ON u.id = a.user_id
  WHERE u.id IS NULL;
"
```

`rowsecurity` should be `t` for every user-data table except
`knowledge.role_substrate` (intentionally `f` in source — a public
reference catalog, confirmed against the hosted DB, not a restore defect).
If any *other* table shows `f`, something in the restore order broke.

`orphaned_activation_sessions` must be `0`. Any positive count means the
`auth.users` portion of the restore didn't fully apply — check the psql
output for `data.sql` for errors on the `COPY "auth"."users"` block
specifically; don't rely on the overall exit code, since FK-related
silence means a broken restore can otherwise look identical to a clean one.

## Known local-CLI-only failure (not a restore blocker)

Local `supabase start` defaults to Postgres 15 (`major_version = 15` in
`config.toml`); the hosted project runs Postgres 17. `schema.sql`'s tail
end includes `ALTER DEFAULT PRIVILEGES ... GRANT ... MAINTAIN ...` for the
`public` schema (`MAINTAIN` is PG17+ only), which errors out on a
PG15 local instance and halts that psql invocation. Confirmed harmless:
everything before it in `schema.sql` — all `core`/`knowledge`/`audit`
schemas, tables, RLS policies, indexes — applies successfully first; only
those trailing grants on the unused `public` schema fail. Restoring into
an actual fresh **hosted** Supabase project (PG17) should not hit this.
