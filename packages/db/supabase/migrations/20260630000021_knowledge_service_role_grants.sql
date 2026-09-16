-- 021: Operational grants — service_role access to knowledge schema
-- Classification: infrastructure fix. No table/column/RLS/vocab/API change.
-- Governance: not a schema amendment; no ADR required.
--
-- service_role bypasses RLS but still requires explicit schema/table grants.
-- Needed for operational scripts (substrate commit.mjs, future workers) that
-- use the service role key outside the request path (A5 not violated).
-- anon + authenticated already had these grants (migration 019).
--
-- DEFAULT PRIVILEGES: grants propagate to tables created after this migration.
-- Without this, every new knowledge.* table reproduces the 42501 error.

GRANT USAGE ON SCHEMA knowledge TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA knowledge TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA knowledge
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
