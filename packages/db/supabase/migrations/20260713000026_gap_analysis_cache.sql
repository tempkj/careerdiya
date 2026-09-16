-- 026: Gap-analysis cache — production caching layer for live activation gap analysis
--
-- Caches AI-generated gap-analysis output (desiredPosition, currentTopSkills, gap[],
-- firstAction) for a (prompt_version, from_role_key, to_role_key) key, so identical
-- live /activation/start requests are served from cache instead of re-hitting the model.
-- Mirrors knowledge.identification_cache (migration 025) with one difference: no
-- gate_bucket dimension — gap analysis (unlike task identification) never consumes
-- gate answers, so there is nothing to bucket.
--
-- SHAPE — same rationale as identification_cache: role-pair-level shared reference
-- data, no user_id, no RLS. from_role_key uses the literal 'none' sentinel when no
-- current role was supplied (matches the convention already established in
-- blueprint/identify/route.ts's fromRoleKey construction) — an ungrounded gap analysis
-- for a given desired role is still worth caching and sharing.
--
-- GRANTS — identical model to identification_cache (migration 025): authenticated gets
-- SELECT + INSERT (this cache is written inline in a live request, invariant A5 forbids
-- service_role in a request path), no anon grant (POST /activation/start requires an
-- authenticated user), careerasana_worker gets SELECT/INSERT/DELETE (purge-on-
-- invalidation), service_role gets full DML.

CREATE TABLE knowledge.gap_analysis_cache (
  key_hash       text        PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),

  prompt_version text        NOT NULL,
  from_role_key  text        NOT NULL,
  to_role_key    text        NOT NULL,

  -- Validated AIActivationResult shape (desiredPosition, currentTopSkills, gap,
  -- firstAction). Validated + repaired against the model's raw output before write
  -- (app layer) — never holds unvalidated model output.
  output         jsonb       NOT NULL,

  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Debug/inspection: "what's cached for this role pair"
CREATE INDEX idx_gap_analysis_cache_roles ON knowledge.gap_analysis_cache (from_role_key, to_role_key);

-- Invalidation/purge support: "delete everything on a superseded prompt_version"
CREATE INDEX idx_gap_analysis_cache_prompt_version ON knowledge.gap_analysis_cache (prompt_version);

-- ── Grants ──────────────────────────────────────────────────────────────────────
-- Explicit per-table grants, not ALTER DEFAULT PRIVILEGES — migration 022 found that
-- default-privilege inheritance is session/apply-scoped and unreliable across cloud
-- apply sessions. State the intended grant explicitly and durably here instead.
--
-- IMPORTANT: migrations 002/021's ALTER DEFAULT PRIVILEGES for the knowledge schema
-- apply automatically to THIS new table too (anon/authenticated/careerasana_app/
-- careerasana_readonly get SELECT by default; careerasana_worker gets SELECT/INSERT/
-- UPDATE; service_role gets full DML) — migration 025 found this by inspecting
-- information_schema.role_table_grants after applying, which is how the two REVOKEs
-- below were found to be necessary, not optional. Re-verify after applying this
-- migration too, rather than trusting this comment.

REVOKE SELECT ON knowledge.gap_analysis_cache FROM anon;
REVOKE UPDATE ON knowledge.gap_analysis_cache FROM careerasana_worker;

-- Reads: authenticated + internal roles only (no anon — see rationale above).
GRANT SELECT ON knowledge.gap_analysis_cache TO authenticated, careerasana_readonly;

-- Writes: authenticated may INSERT only — this is the live cache-miss write path,
-- invoked from within an authenticated user's request. No UPDATE grant: cache rows are
-- immutable once written (application uses ON CONFLICT (key_hash) DO NOTHING, so a
-- racing duplicate insert is a no-op, never an update). No DELETE grant: purge-on-
-- invalidation is an operator/worker action, not a request-path one.
GRANT SELECT, INSERT ON knowledge.gap_analysis_cache TO authenticated;

-- Worker: read + write + purge (invalidation sweeps by prompt_version), matching the
-- schema-wide worker privilege model (migration 002) MINUS update — cache rows are
-- immutable for every role, not just authenticated (see REVOKE above).
GRANT SELECT, INSERT, DELETE ON knowledge.gap_analysis_cache TO careerasana_worker;

-- service_role: full DML, matching migration 021's schema-wide service_role grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge.gap_analysis_cache TO service_role;
