-- 013: Indexes
-- Rule: every user_id lookup, every status filter, and every cursor-pagination
-- sort column (created_at DESC / as_of DESC / occurred_at DESC) has an index.

-- ── core.profile ─────────────────────────────────────────────────────────────
-- PK is user_id; no extra index needed.

-- ── core.consent ─────────────────────────────────────────────────────────────
CREATE INDEX idx_consent_user_occurred     ON core.consent (user_id, occurred_at DESC);
CREATE INDEX idx_consent_user_purpose      ON core.consent (user_id, purpose);

-- ── core.activation_session ──────────────────────────────────────────────────
CREATE INDEX idx_activation_session_user   ON core.activation_session (user_id, created_at DESC);

-- ── core.idempotency_key ─────────────────────────────────────────────────────
-- Expiry sweep (background cleaner)
CREATE INDEX idx_idempotency_expires       ON core.idempotency_key (expires_at);

-- ── core.job ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_job_user_status           ON core.job (user_id, status);
CREATE INDEX idx_job_user_created          ON core.job (user_id, created_at DESC);

-- ── core.twin_signal ─────────────────────────────────────────────────────────
-- Worker queue: fetch unprocessed signals for a user
CREATE INDEX idx_twin_signal_user_applied  ON core.twin_signal (user_id, applied, occurred_at DESC);
-- Provenance lookup: find the signal that produced a given fact
CREATE INDEX idx_twin_signal_user_occurred ON core.twin_signal (user_id, occurred_at DESC);

-- ── core.readiness_history ───────────────────────────────────────────────────
-- Trend line query (GET /readiness/history)
CREATE INDEX idx_readiness_history_user    ON core.readiness_history (user_id, as_of DESC);

-- ── core.blueprint ───────────────────────────────────────────────────────────
-- PK is user_id; no extra index needed.

-- ── core.goal ────────────────────────────────────────────────────────────────
CREATE INDEX idx_goal_user_status          ON core.goal (user_id, status);
CREATE INDEX idx_goal_user_created         ON core.goal (user_id, created_at DESC);

-- ── core.task ────────────────────────────────────────────────────────────────
CREATE INDEX idx_task_goal                 ON core.task (goal_id);
CREATE INDEX idx_task_user_status          ON core.task (user_id, status);
-- Calendar view (scheduledFrom / scheduledTo filter)
CREATE INDEX idx_task_user_scheduled       ON core.task (user_id, scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX idx_task_user_created         ON core.task (user_id, created_at DESC);

-- ── core.reflection ──────────────────────────────────────────────────────────
CREATE INDEX idx_reflection_user_created   ON core.reflection (user_id, created_at DESC);
CREATE INDEX idx_reflection_goal           ON core.reflection (goal_id) WHERE goal_id IS NOT NULL;

-- ── core.outcome ─────────────────────────────────────────────────────────────
CREATE INDEX idx_outcome_user_class        ON core.outcome (user_id, outcome_class);
CREATE INDEX idx_outcome_user_occurred     ON core.outcome (user_id, occurred_at DESC);
-- Inferred outcomes pending confirm/decay
CREATE INDEX idx_outcome_decays            ON core.outcome (decays_at) WHERE decays_at IS NOT NULL;

-- ── core.conversation ────────────────────────────────────────────────────────
CREATE INDEX idx_conversation_user_started ON core.conversation (user_id, started_at DESC);

-- ── core.coach_turn ──────────────────────────────────────────────────────────
-- Chronological turn list for a conversation
CREATE INDEX idx_coach_turn_convo_created  ON core.coach_turn (conversation_id, created_at ASC);
CREATE INDEX idx_coach_turn_user           ON core.coach_turn (user_id);

-- ── core.recommendation ──────────────────────────────────────────────────────
CREATE INDEX idx_recommendation_user_score  ON core.recommendation (user_id, score DESC);
CREATE INDEX idx_recommendation_user_status ON core.recommendation (user_id, status);
CREATE INDEX idx_recommendation_user_created ON core.recommendation (user_id, created_at DESC);

-- ── core.feedback ────────────────────────────────────────────────────────────
CREATE INDEX idx_feedback_user_type        ON core.feedback (user_id, target_type);

-- ── audit.audit_log ──────────────────────────────────────────────────────────
CREATE INDEX idx_audit_log_occurred        ON audit.audit_log (occurred_at DESC);
CREATE INDEX idx_audit_log_user_occurred   ON audit.audit_log (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_resource        ON audit.audit_log (resource_type, resource_id);
