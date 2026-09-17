-- 032: Career Diya edge-guide LLM cache (ADR-CAREERDIY-0016)
--
-- Caches LLM-generated edge-guide output (broad exploratory territories, never a
-- personalised career verdict) for a (prompt_version, model, normalized stream/role,
-- intent) key, so an identical POST /api/v1/career-diya/guide request is served from
-- cache instead of re-hitting the model.
--
-- SHAPE — follows knowledge.career_diya_llm_cache (migration 031) and
-- knowledge.identification_cache (migration 025): no user_id, no RLS. Deliberately a
-- SEPARATE table from career_diya_llm_cache, not an overload of it: that table's schema
-- is shaped around a single direction_id (the enrichment path always has one chosen
-- direction); the guide path has no single chosen anything — it exists for stream/role
-- inputs that don't resolve to one. Mirrors why gap_analysis_cache and
-- identification_cache are two tables despite being conceptually similar.
--
-- GRANTS — same model as career_diya_llm_cache: the write happens INLINE in a live
-- request (cache miss -> call model -> validate -> write back), and invariant A5 forbids
-- the service-role key in a request path, so `authenticated` needs INSERT. `anon` gets no
-- grant: POST /api/v1/career-diya/guide requires an authenticated user (the app-wide
-- middleware in apps/web/middleware.ts returns 401 for any unauthenticated /api/v1/*
-- request that isn't in its PUBLIC_PATHS allowlist).

CREATE TABLE knowledge.career_diya_guide_cache (
  key_hash        text        PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),

  -- Denormalized alongside the hash for debuggability/inspection — never used to compute
  -- or verify the key's uniqueness (key_hash is the sole identity).
  prompt_version  text        NOT NULL,
  model           text        NOT NULL,
  stream_or_role  text        NOT NULL,
  intent          text        NOT NULL,

  -- Validated guide output ({ territories: string[] }). Validated + repaired, and
  -- screened for verdict-shaped language, before write (app layer) — this table must
  -- never hold unvalidated or verdict-like model output, since a bad generation cached
  -- here is served to every future matching request until the prompt_version bumps.
  output          jsonb       NOT NULL,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Debug/inspection: "what's cached for this stream/role"
CREATE INDEX idx_career_diya_guide_cache_stream_or_role ON knowledge.career_diya_guide_cache (stream_or_role);

-- Invalidation/purge support: "delete everything on a superseded prompt_version"
CREATE INDEX idx_career_diya_guide_cache_prompt_version ON knowledge.career_diya_guide_cache (prompt_version);

-- ── Grants ──────────────────────────────────────────────────────────────────────
-- Explicit per-table grants, not ALTER DEFAULT PRIVILEGES — migration 022 found that
-- default-privilege inheritance is session/apply-scoped and unreliable across cloud apply
-- sessions. State the intended grant explicitly and durably here instead.
--
-- Migrations 002/021's ALTER DEFAULT PRIVILEGES for the knowledge schema apply
-- automatically to THIS new table too (anon/authenticated/careerasana_app/
-- careerasana_readonly get SELECT by default; careerasana_worker gets SELECT/INSERT/
-- UPDATE; service_role gets full DML) — migrations 025/026/031 confirmed this by applying
-- locally and inspecting information_schema.role_table_grants. Re-verify after applying
-- this migration too, rather than trusting this comment. Explicit REVOKE first, then
-- state the intended grant, so this migration is self-contained.

REVOKE SELECT ON knowledge.career_diya_guide_cache FROM anon;
REVOKE UPDATE ON knowledge.career_diya_guide_cache FROM careerasana_worker;

-- Reads: authenticated + internal roles only (no anon — see rationale above).
GRANT SELECT ON knowledge.career_diya_guide_cache TO authenticated, careerasana_readonly;

-- Writes: authenticated may INSERT only — this is the live cache-miss write path, invoked
-- from within an authenticated user's request. No UPDATE grant: cache rows are immutable
-- once written (application uses ON CONFLICT (key_hash) DO NOTHING, so a racing duplicate
-- insert is a no-op, never an update). No DELETE grant: purge-on-invalidation is an
-- operator/worker action, not a request-path one.
GRANT SELECT, INSERT ON knowledge.career_diya_guide_cache TO authenticated;

-- Worker: read + write + purge (invalidation sweeps by prompt_version), matching the
-- schema-wide worker privilege model (migration 002) MINUS update — cache rows are
-- immutable for every role.
GRANT SELECT, INSERT, DELETE ON knowledge.career_diya_guide_cache TO careerasana_worker;

-- service_role: full DML, matching migration 021's schema-wide service_role grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge.career_diya_guide_cache TO service_role;
