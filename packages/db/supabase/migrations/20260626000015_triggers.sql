-- 015: Triggers
-- All trigger functions were defined in 003 (shared_fns); this migration
-- attaches them to tables now that all tables exist.

-- ── Bootstrap: auth.users → profile + twin ───────────────────────────────────
-- Creates profile and twin rows the moment a new auth user is registered.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION core.handle_new_user();

-- ── updated_at auto-stamps ───────────────────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.profile
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.twin
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.blueprint
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.goal
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.task
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.recommendation
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- ── Activation immutability (invariant A17) ──────────────────────────────────
-- Prevents any UPDATE once completed_at is set. activation_session is history,
-- not a source of truth; once the session is completed it must not change.
CREATE TRIGGER activation_session_immutable
  BEFORE UPDATE ON core.activation_session
  FOR EACH ROW EXECUTE FUNCTION core.prevent_activation_session_mutation();

-- ── Signal → readiness cascade ───────────────────────────────────────────────
-- When a worker marks a twin_signal as applied, queue a readiness recompute job.
-- The worker dequeues from core.job (kind = 'signal_application').
CREATE TRIGGER twin_signal_enqueue_readiness
  AFTER UPDATE OF applied ON core.twin_signal
  FOR EACH ROW EXECUTE FUNCTION core.enqueue_readiness_on_signal_applied();
