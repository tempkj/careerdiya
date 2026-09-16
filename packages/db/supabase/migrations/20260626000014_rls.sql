-- 014: Row-Level Security — FORCED on every user-owned table (invariant A5)
--
-- FORCE ROW LEVEL SECURITY: the table owner is also subject to policies.
-- Superusers (postgres) still bypass — but the application role (authenticated)
-- and the worker role are both constrained to their own rows.
--
-- Policy naming convention: <table>_<role_descriptor>
-- USING   → which rows are visible (SELECT, UPDATE, DELETE)
-- WITH CHECK → which values may be written (INSERT, UPDATE)

-- ── core.profile ─────────────────────────────────────────────────────────────
ALTER TABLE core.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.profile FORCE ROW LEVEL SECURITY;
CREATE POLICY profile_owner ON core.profile
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.consent ─────────────────────────────────────────────────────────────
ALTER TABLE core.consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.consent FORCE ROW LEVEL SECURITY;
CREATE POLICY consent_owner ON core.consent
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.activation_session ──────────────────────────────────────────────────
ALTER TABLE core.activation_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.activation_session FORCE ROW LEVEL SECURITY;
CREATE POLICY activation_session_owner ON core.activation_session
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.idempotency_key ─────────────────────────────────────────────────────
ALTER TABLE core.idempotency_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.idempotency_key FORCE ROW LEVEL SECURITY;
CREATE POLICY idempotency_key_owner ON core.idempotency_key
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.job ─────────────────────────────────────────────────────────────────
ALTER TABLE core.job ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.job FORCE ROW LEVEL SECURITY;
-- Users see their own jobs via API
CREATE POLICY job_owner ON core.job
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- Workers need unrestricted access to process queued jobs
CREATE POLICY job_worker ON core.job
  TO careerasana_worker
  USING     (true)
  WITH CHECK (true);

-- ── core.twin ────────────────────────────────────────────────────────────────
ALTER TABLE core.twin ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.twin FORCE ROW LEVEL SECURITY;
CREATE POLICY twin_owner ON core.twin
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- Worker writes the twin after applying signals (the only write path — ADR-001)
CREATE POLICY twin_worker ON core.twin
  TO careerasana_worker
  USING     (true)
  WITH CHECK (true);

-- ── core.twin_signal ─────────────────────────────────────────────────────────
ALTER TABLE core.twin_signal ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.twin_signal FORCE ROW LEVEL SECURITY;
CREATE POLICY twin_signal_owner ON core.twin_signal
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- Worker marks signals applied
CREATE POLICY twin_signal_worker ON core.twin_signal
  TO careerasana_worker
  USING     (true)
  WITH CHECK (true);

-- ── core.blueprint ───────────────────────────────────────────────────────────
ALTER TABLE core.blueprint ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.blueprint FORCE ROW LEVEL SECURITY;
CREATE POLICY blueprint_owner ON core.blueprint
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY blueprint_worker ON core.blueprint
  TO careerasana_worker
  USING     (true)
  WITH CHECK (true);

-- ── core.readiness_history ───────────────────────────────────────────────────
ALTER TABLE core.readiness_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.readiness_history FORCE ROW LEVEL SECURITY;
CREATE POLICY readiness_history_owner ON core.readiness_history
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY readiness_history_worker ON core.readiness_history
  TO careerasana_worker
  USING     (true)
  WITH CHECK (true);

-- ── core.goal ────────────────────────────────────────────────────────────────
ALTER TABLE core.goal ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.goal FORCE ROW LEVEL SECURITY;
CREATE POLICY goal_owner ON core.goal
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.task ────────────────────────────────────────────────────────────────
ALTER TABLE core.task ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.task FORCE ROW LEVEL SECURITY;
CREATE POLICY task_owner ON core.task
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.reflection ──────────────────────────────────────────────────────────
ALTER TABLE core.reflection ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.reflection FORCE ROW LEVEL SECURITY;
CREATE POLICY reflection_owner ON core.reflection
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.outcome ─────────────────────────────────────────────────────────────
ALTER TABLE core.outcome ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outcome FORCE ROW LEVEL SECURITY;
CREATE POLICY outcome_owner ON core.outcome
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.conversation ────────────────────────────────────────────────────────
ALTER TABLE core.conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.conversation FORCE ROW LEVEL SECURITY;
CREATE POLICY conversation_owner ON core.conversation
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.coach_turn ──────────────────────────────────────────────────────────
ALTER TABLE core.coach_turn ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.coach_turn FORCE ROW LEVEL SECURITY;
CREATE POLICY coach_turn_owner ON core.coach_turn
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.recommendation ──────────────────────────────────────────────────────
ALTER TABLE core.recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.recommendation FORCE ROW LEVEL SECURITY;
CREATE POLICY recommendation_owner ON core.recommendation
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- Worker generates and updates recommendations
CREATE POLICY recommendation_worker ON core.recommendation
  TO careerasana_worker
  USING     (true)
  WITH CHECK (true);

-- ── core.feedback ────────────────────────────────────────────────────────────
ALTER TABLE core.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.feedback FORCE ROW LEVEL SECURITY;
CREATE POLICY feedback_owner ON core.feedback
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── core.readiness_spec ──────────────────────────────────────────────────────
-- Not user-owned; globally readable, worker-writable.
ALTER TABLE core.readiness_spec ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.readiness_spec FORCE ROW LEVEL SECURITY;
CREATE POLICY readiness_spec_read ON core.readiness_spec
  FOR SELECT USING (true);
CREATE POLICY readiness_spec_worker ON core.readiness_spec
  TO careerasana_worker
  USING     (true)
  WITH CHECK (true);

-- ── knowledge.* ──────────────────────────────────────────────────────────────
-- Public read; only worker (or admin migration) writes.
ALTER TABLE knowledge.onet_occupation ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.onet_occupation FORCE ROW LEVEL SECURITY;
CREATE POLICY onet_read   ON knowledge.onet_occupation FOR SELECT USING (true);
CREATE POLICY onet_worker ON knowledge.onet_occupation TO careerasana_worker USING (true) WITH CHECK (true);

ALTER TABLE knowledge.skill ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.skill FORCE ROW LEVEL SECURITY;
CREATE POLICY skill_read   ON knowledge.skill FOR SELECT USING (true);
CREATE POLICY skill_worker ON knowledge.skill TO careerasana_worker USING (true) WITH CHECK (true);

ALTER TABLE knowledge.prompt_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.prompt_registry FORCE ROW LEVEL SECURITY;
CREATE POLICY prompt_read   ON knowledge.prompt_registry FOR SELECT USING (true);
CREATE POLICY prompt_worker ON knowledge.prompt_registry TO careerasana_worker USING (true) WITH CHECK (true);

-- ── audit.audit_log ──────────────────────────────────────────────────────────
-- Worker-insert only; readonly role can query; no row is visible to the API user.
ALTER TABLE audit.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_log_worker   ON audit.audit_log FOR INSERT TO careerasana_worker   WITH CHECK (true);
CREATE POLICY audit_log_readonly ON audit.audit_log FOR SELECT TO careerasana_readonly USING (true);
