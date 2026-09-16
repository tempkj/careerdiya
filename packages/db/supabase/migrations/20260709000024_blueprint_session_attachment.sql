-- 024: Retarget core.blueprint's attachment from core.goal to core.activation_session
-- (ADR-012 amendment, 2026-07-09).
--
-- core.goal/Planner is entirely unbuilt (no writer, no API route). The working
-- representation of "a user's goal" today is the Twin's aspiration.targetRole, which
-- derives from an activation_session (ADR-010's save-vs-promote model). Blueprint
-- attaches to that concrete session instead. See ADR-012's 2026-07-09 amendment for
-- full rationale.
--
-- core.blueprint has zero rows at the time of this migration — a schema retarget,
-- not a data migration.

ALTER TABLE core.blueprint DROP CONSTRAINT blueprint_goal_id_fkey;

ALTER TABLE core.blueprint RENAME COLUMN goal_id TO session_id;

ALTER TABLE core.blueprint
  ADD CONSTRAINT blueprint_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES core.activation_session(id) ON DELETE CASCADE;

-- Renamed for clarity — same constraints/index, correctly named for the retargeted column.
ALTER TABLE core.blueprint RENAME CONSTRAINT blueprint_version_per_goal TO blueprint_version_per_session;
ALTER INDEX core.idx_blueprint_one_active_per_goal RENAME TO idx_blueprint_one_active_per_session;
