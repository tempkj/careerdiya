-- Defensive schema sync for Career Diya exploration context.
-- Migrations 36/37 introduced these fields. Keep this migration idempotent so
-- environments that missed or partially applied those migrations can converge.
ALTER TABLE core.profile
  ADD COLUMN IF NOT EXISTS exploration_work_preference text,
  ADD COLUMN IF NOT EXISTS exploration_environment text,
  ADD COLUMN IF NOT EXISTS exploration_priority text,
  ADD COLUMN IF NOT EXISTS exploration_default_context jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_exploration_work_preference_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_exploration_work_preference_check
  CHECK (
    exploration_work_preference IS NULL
    OR exploration_work_preference IN ('analytical','builder','creative','people','quality')
  );

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_exploration_environment_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_exploration_environment_check
  CHECK (
    exploration_environment IS NULL
    OR exploration_environment IN ('structured','dynamic','collaborative','independent','any')
  );

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_exploration_priority_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_exploration_priority_check
  CHECK (
    exploration_priority IS NULL
    OR exploration_priority IN ('stability','growth','impact','flexibility')
  );

GRANT SELECT, INSERT, UPDATE ON core.profile TO authenticated;

-- Ensure PostgREST sees the newly added columns immediately.
NOTIFY pgrst, 'reload schema';
