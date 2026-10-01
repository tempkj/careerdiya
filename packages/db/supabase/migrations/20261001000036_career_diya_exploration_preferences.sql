-- Career Diya persistent exploration preferences
-- These are profile-level preferences used to prefill the lightweight free explorer.
-- They are editable persistent context, not immutable exploration answers.

ALTER TABLE core.profile
  ADD COLUMN IF NOT EXISTS exploration_work_preference text,
  ADD COLUMN IF NOT EXISTS exploration_environment text,
  ADD COLUMN IF NOT EXISTS exploration_priority text;

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
