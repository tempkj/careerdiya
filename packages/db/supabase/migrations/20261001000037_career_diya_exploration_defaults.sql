-- Persist the user's first free-exploration context as reusable profile defaults.
-- The exploration snapshot remains immutable; this field is only the mutable/default
-- context used when starting a new exploration.
ALTER TABLE core.profile
  ADD COLUMN IF NOT EXISTS exploration_default_context jsonb NOT NULL DEFAULT '{}'::jsonb;

GRANT SELECT, INSERT, UPDATE ON core.profile TO authenticated;
