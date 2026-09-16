-- 017: RLS hardening — restrict user write access on worker-managed tables
--
-- Two confirmed leaks discovered during schema-exposure audit (Sprint-0):
--
--   1. core.job — job_owner had no FOR clause, so it covered INSERT/UPDATE/DELETE.
--      Users could create jobs (kind='signal_application' etc.) and change their
--      status, bypassing the application layer entirely.
--      Fix: scope to FOR SELECT only. Job lifecycle is server-controlled.
--
--   2. core.idempotency_key — job_owner-equivalent policy also had no FOR clause.
--      Users could DELETE their own idempotency records, enabling replay of
--      previously-idempotent requests and undermining the guarantee.
--      Fix: explicit SELECT/INSERT/UPDATE policies; no DELETE policy = FORCE RLS blocks it.

-- ── core.job ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS job_owner ON core.job;

CREATE POLICY job_owner_select ON core.job
  FOR SELECT USING (user_id = auth.uid());

-- worker retains full access via the existing job_worker policy (unchanged)

-- ── core.idempotency_key ──────────────────────────────────────────────────────
-- The server-side consent flow uses the user-scoped client to read, write, and
-- update idempotency records — so SELECT/INSERT/UPDATE must remain available.
-- DELETE must be blocked; there is no legitimate reason for a user to erase a key.
DROP POLICY IF EXISTS idempotency_key_owner ON core.idempotency_key;

CREATE POLICY idempotency_key_select ON core.idempotency_key
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY idempotency_key_insert ON core.idempotency_key
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY idempotency_key_update ON core.idempotency_key
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- No DELETE policy → FORCE RLS blocks all DELETE from the authenticated role.
