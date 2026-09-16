-- 022: Explicit grant normalization — security fix for cloud grant drift
--
-- PROBLEM
-- Cloud Supabase accumulated stale ALTER DEFAULT PRIVILEGES from pre-migration
-- dashboard sessions that granted anon + authenticated full DML (SELECT/INSERT/
-- UPDATE/DELETE) on knowledge schema tables. Migration 002 set SELECT-only defaults
-- for anon/authenticated in knowledge, but an earlier session on cloud set broader
-- defaults that stacked and were never revoked. Migration 018 revoked SELECT on
-- prompt_registry but the stale DML grants persisted, and SELECT was re-applied
-- by the same mechanism when later migrations (019+) touched the schema.
-- Additionally, core.activation_session missed its authenticated grant entirely
-- because ALTER DEFAULT PRIVILEGES is role+session scoped and the table was created
-- in a different apply session on cloud.
--
-- EFFECT (pre-fix on cloud)
-- anon (public key, no auth): INSERT/UPDATE/DELETE on role_substrate, onet_occupation,
--   skill; full DML including SELECT on prompt_registry (IP leak + write surface).
-- authenticated: same as anon plus DELETE on role_substrate/onet_occupation/skill.
-- core.activation_session: authenticated had zero grants → activation/start 500.
--
-- FIX
-- Explicit per-table REVOKE/GRANT — no ALTER DEFAULT PRIVILEGES (too session-scoped
-- to be reliable across cloud apply sessions). Each table's intended grant is stated
-- in a comment. After this migration, cloud matches local-from-migrations exactly.
--
-- CLASSIFICATION: DB-layer security fix. No schema/column/RLS/API/vocab change.
-- GOVERNANCE: No ADR required — this restores the state already defined by migrations
--   002 and 018. The intended access model is unchanged; this makes it durable on
--   cloud where the implicit DEFAULT PRIVILEGES mechanism was insufficient.
--   Cross-reference: migration 002 (role setup), 018 (prompt_registry lockdown).

-- ── knowledge.role_substrate ──────────────────────────────────────────────────
-- Correct grant: anon/authenticated SELECT only.
-- This is public reference data (role skill maps). Reads are allowed via PostgREST
-- for the substrate cache-hit path. Writes are service_role only (commit.mjs runs
-- outside the request path; A5 not violated — no user PII on this table).
-- Excess INSERT/UPDATE/DELETE on anon/authenticated is cloud drift — never intended.
REVOKE INSERT, UPDATE, DELETE ON knowledge.role_substrate FROM anon, authenticated;
-- SELECT is already correct on both sides; explicit re-grant for clarity.
GRANT SELECT ON knowledge.role_substrate TO anon, authenticated;

-- ── knowledge.onet_occupation ─────────────────────────────────────────────────
-- Correct grant: anon/authenticated SELECT only.
-- O*NET reference catalog; loaded by worker/admin tooling. No user-facing write path
-- exists or is planned. Same pattern as role_substrate.
REVOKE INSERT, UPDATE, DELETE ON knowledge.onet_occupation FROM anon, authenticated;
GRANT SELECT ON knowledge.onet_occupation TO anon, authenticated;

-- ── knowledge.skill ───────────────────────────────────────────────────────────
-- Correct grant: anon/authenticated SELECT only.
-- Skill catalog is reference data with the same write-restriction rationale as
-- onet_occupation. anon/authenticated DML was cloud drift only.
REVOKE INSERT, UPDATE, DELETE ON knowledge.skill FROM anon, authenticated;
GRANT SELECT ON knowledge.skill TO anon, authenticated;

-- ── knowledge.prompt_registry ─────────────────────────────────────────────────
-- Correct grant: anon/authenticated NO access whatsoever.
-- Migration 018 intent: prompt templates are internal IP; the server reads via
-- service_role (bypasses both privilege check and RLS). No app path uses anon or
-- authenticated to read prompts. SELECT was revoked in 018 but re-granted by the
-- stale cloud default privileges. All remaining DML was never intentional.
-- careerasana_worker and careerasana_readonly retain their existing grants.
REVOKE ALL ON knowledge.prompt_registry FROM anon, authenticated;

-- ── core.activation_session ──────────────────────────────────────────────────
-- Correct grant: authenticated + careerasana_app full DML (scoped by RLS policy
-- activation_session_owner: user_id = auth.uid()); careerasana_worker read+write
-- for async job processing; careerasana_readonly SELECT for internal tooling.
-- This was a runtime-only patch applied 2026-07-01 after the bug was found.
-- Repeated GRANT is idempotent — safe on any DB state.
GRANT SELECT, INSERT, UPDATE, DELETE ON core.activation_session TO authenticated, careerasana_app;
GRANT SELECT, INSERT, UPDATE          ON core.activation_session TO careerasana_worker;
GRANT SELECT                          ON core.activation_session TO careerasana_readonly;
