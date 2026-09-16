-- 025: Identification cache — production caching layer for live task identification (ADR-013)
--
-- Caches AI-generated counsellor-assessment task output for a
-- (prompt_version, from_role_key, to_role_key, bucketed gate profile) key, so identical
-- live-identify requests are served from cache instead of re-hitting the model. This is
-- the production caching layer, not test scaffolding — zero-cost-on-repeat for identical
-- test conditions is a direct consequence of the same mechanism, not a separate path.
--
-- SHAPE — follows knowledge.role_substrate (migration 019): no user_id, no RLS. This is
-- role-pair-level shared reference data, not user-owned — the cache key never includes a
-- user identifier, so there is nothing to scope per-user; the whole point is that
-- unrelated users hitting the same (roles, bucketed gates) key share a hit.
--
-- GRANTS — deliberately DIVERGE from role_substrate on one axis. role_substrate's write
-- path today is offline-only (an admin/seed script using service_role, never exercised by
-- a live request — see migration 022's comment on role_substrate grants), so anon/
-- authenticated are SELECT-only there. This cache's write happens INLINE in a live
-- request (POST /blueprint/identify: cache miss -> call model -> validate -> write back),
-- and invariant A5 forbids using the service-role key in a request path — so
-- `authenticated` needs INSERT here, unlike role_substrate. `anon` gets no grant at all
-- (tighter than role_substrate's anon-SELECT precedent): /blueprint/identify requires an
-- authenticated user (route.ts returns 401 otherwise), so there is no legitimate anon
-- caller to grant read access to.

CREATE TABLE knowledge.identification_cache (
  key_hash       text        PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),

  -- Denormalized alongside the hash for debuggability/inspection — never used to compute
  -- or verify the key's uniqueness (key_hash is the sole identity), but lets an operator
  -- read "what does this row represent" without recomputing the hash by hand.
  prompt_version text        NOT NULL,
  from_role_key  text        NOT NULL,
  to_role_key    text        NOT NULL,
  gate_bucket    jsonb       NOT NULL,

  -- Stored counsellor-assessment output. Validated + repaired against the source
  -- transition delta before write (app layer) — this table must never hold unvalidated
  -- model output, since a bad generation cached here is served to every future matching
  -- request until the prompt_version bumps.
  output         jsonb       NOT NULL,

  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Debug/inspection: "what's cached for this role pair"
CREATE INDEX idx_identification_cache_roles ON knowledge.identification_cache (from_role_key, to_role_key);

-- Invalidation/purge support: "delete everything on a superseded prompt_version"
CREATE INDEX idx_identification_cache_prompt_version ON knowledge.identification_cache (prompt_version);

-- ── Grants ──────────────────────────────────────────────────────────────────────
-- Explicit per-table grants, not ALTER DEFAULT PRIVILEGES — migration 022 found that
-- default-privilege inheritance is session/apply-scoped and unreliable across cloud
-- apply sessions. State the intended grant explicitly and durably here instead.
--
-- IMPORTANT: migrations 002/021's ALTER DEFAULT PRIVILEGES for the knowledge schema
-- apply automatically to THIS new table too (anon/authenticated/careerasana_app/
-- careerasana_readonly get SELECT by default; careerasana_worker gets SELECT/INSERT/
-- UPDATE; service_role gets full DML) — confirmed by applying this migration locally
-- and inspecting information_schema.role_table_grants, which is how the two REVOKEs
-- below were found to be necessary, not optional. GRANT-only (no REVOKE, unlike
-- migration 022's pattern for role_substrate et al.) would have silently left anon
-- with SELECT and careerasana_worker with UPDATE, contradicting the design stated
-- above. Explicit REVOKE first, then state the intended grant, so this migration is
-- self-contained and doesn't rely on migration 002/021 never changing.

REVOKE SELECT ON knowledge.identification_cache FROM anon;
REVOKE UPDATE ON knowledge.identification_cache FROM careerasana_worker;

-- Reads: authenticated + internal roles only (no anon — see rationale above).
GRANT SELECT ON knowledge.identification_cache TO authenticated, careerasana_readonly;

-- Writes: authenticated may INSERT only — this is the live cache-miss write path,
-- invoked from within an authenticated user's request. No UPDATE grant: cache rows are
-- immutable once written (application uses ON CONFLICT (key_hash) DO NOTHING, so a
-- racing duplicate insert is a no-op, never an update). No DELETE grant: purge-on-
-- invalidation is an operator/worker action, not a request-path one.
GRANT SELECT, INSERT ON knowledge.identification_cache TO authenticated;

-- Worker: read + write + purge (invalidation sweeps by prompt_version), matching the
-- schema-wide worker privilege model (migration 002) MINUS update — cache rows are
-- immutable for every role, not just authenticated (see REVOKE above).
GRANT SELECT, INSERT, DELETE ON knowledge.identification_cache TO careerasana_worker;

-- service_role: full DML, matching migration 021's schema-wide service_role grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge.identification_cache TO service_role;
