-- 031: Career Diya LLM enrichment cache (ADR-CAREERDIY-0015)
--
-- Caches LLM-generated free-tier enrichment (advice + course-type recommendations) for a
-- (prompt_version, model, normalized role, sorted answers, chosen direction) key, so an
-- identical POST /api/v1/career-diya/recommend request is served from cache instead of
-- re-hitting the model. The deterministic direction is never part of what the model
-- chooses — it is an input to the prompt, not an output — but it IS part of the cache key,
-- because the enrichment text is written around that specific direction.
--
-- SHAPE — follows knowledge.identification_cache (migration 025): no user_id, no RLS. This
-- is (role, answers, direction)-level shared reference data, not user-owned — the cache key
-- never includes a user identifier, so unrelated users with the same bounded role, answers
-- and deterministic pick share a hit.
--
-- shadow_llm_direction is measurement-only (ADR-CAREERDIY-0015): the direction the model
-- would have picked independently, from the same closed enum, never surfaced to the
-- browser. Nullable — populated only when CAREER_DIYA_SHADOW_DIRECTION is enabled.
--
-- GRANTS — same model as identification_cache/gap_analysis_cache: the write happens INLINE
-- in a live request (cache miss -> call model -> validate -> write back), and invariant A5
-- forbids the service-role key in a request path, so `authenticated` needs INSERT. `anon`
-- gets no grant: POST /api/v1/career-diya/recommend requires an authenticated user (the
-- app-wide middleware in apps/web/middleware.ts returns 401 for any unauthenticated
-- /api/v1/* request that isn't in its PUBLIC_PATHS allowlist).

CREATE TABLE knowledge.career_diya_llm_cache (
  key_hash             text        PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),

  -- Denormalized alongside the hash for debuggability/inspection — never used to compute
  -- or verify the key's uniqueness (key_hash is the sole identity).
  prompt_version       text        NOT NULL,
  model                text        NOT NULL,
  role_normalized      text        NOT NULL,
  direction_id         text        NOT NULL,

  -- Validated enrichment output (advice, courseRecommendations). Validated + repaired
  -- against the fixed schema before write (app layer) — this table must never hold
  -- unvalidated model output, since a bad generation cached here is served to every future
  -- matching request until the prompt_version bumps.
  output               jsonb       NOT NULL,

  -- Measurement only — see ADR-CAREERDIY-0015. Never read by the request-serving path in a
  -- way that affects the rendered result.
  shadow_llm_direction text,

  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Debug/inspection: "what's cached for this role"
CREATE INDEX idx_career_diya_llm_cache_role ON knowledge.career_diya_llm_cache (role_normalized);

-- Invalidation/purge support: "delete everything on a superseded prompt_version"
CREATE INDEX idx_career_diya_llm_cache_prompt_version ON knowledge.career_diya_llm_cache (prompt_version);

-- Measurement query support: "how often did the model disagree with the deterministic gate"
CREATE INDEX idx_career_diya_llm_cache_shadow_direction ON knowledge.career_diya_llm_cache (shadow_llm_direction)
  WHERE shadow_llm_direction IS NOT NULL;

-- ── Grants ──────────────────────────────────────────────────────────────────────
-- Explicit per-table grants, not ALTER DEFAULT PRIVILEGES — migration 022 found that
-- default-privilege inheritance is session/apply-scoped and unreliable across cloud apply
-- sessions. State the intended grant explicitly and durably here instead.
--
-- Migrations 002/021's ALTER DEFAULT PRIVILEGES for the knowledge schema apply
-- automatically to THIS new table too (anon/authenticated/careerasana_app/
-- careerasana_readonly get SELECT by default; careerasana_worker gets SELECT/INSERT/
-- UPDATE; service_role gets full DML) — migrations 025/026 confirmed this by applying
-- locally and inspecting information_schema.role_table_grants. Re-verify after applying
-- this migration too, rather than trusting this comment. Explicit REVOKE first, then state
-- the intended grant, so this migration is self-contained.

REVOKE SELECT ON knowledge.career_diya_llm_cache FROM anon;
REVOKE UPDATE ON knowledge.career_diya_llm_cache FROM careerasana_worker;

-- Reads: authenticated + internal roles only (no anon — see rationale above).
GRANT SELECT ON knowledge.career_diya_llm_cache TO authenticated, careerasana_readonly;

-- Writes: authenticated may INSERT only — this is the live cache-miss write path, invoked
-- from within an authenticated user's request. No UPDATE grant: cache rows are immutable
-- once written (application uses ON CONFLICT (key_hash) DO NOTHING, so a racing duplicate
-- insert is a no-op, never an update). No DELETE grant: purge-on-invalidation is an
-- operator/worker action, not a request-path one.
GRANT SELECT, INSERT ON knowledge.career_diya_llm_cache TO authenticated;

-- Worker: read + write + purge (invalidation sweeps by prompt_version), matching the
-- schema-wide worker privilege model (migration 002) MINUS update — cache rows are
-- immutable for every role.
GRANT SELECT, INSERT, DELETE ON knowledge.career_diya_llm_cache TO careerasana_worker;

-- service_role: full DML, matching migration 021's schema-wide service_role grant.
GRANT SELECT, INSERT, UPDATE, DELETE ON knowledge.career_diya_llm_cache TO service_role;
