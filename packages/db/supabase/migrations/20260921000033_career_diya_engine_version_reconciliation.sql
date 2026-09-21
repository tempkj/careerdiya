-- 033: Reconcile Career Diya exploration version stamping.
--
-- The application now uses engine_version as the single authoritative version column.
-- Migration 030 originally created recommendation_matrix_version; keep that legacy
-- column for compatibility while making a clean database reproduce the current app
-- contract.

ALTER TABLE core.career_diya_exploration
  ADD COLUMN IF NOT EXISTS engine_version text;

UPDATE core.career_diya_exploration
SET engine_version = COALESCE(
  NULLIF(engine_version, ''),
  NULLIF(recommendation_matrix_version, ''),
  '1.3-target-role-anchor'
)
WHERE engine_version IS NULL OR engine_version = '';

ALTER TABLE core.career_diya_exploration
  ALTER COLUMN engine_version SET DEFAULT '1.3-target-role-anchor';

ALTER TABLE core.career_diya_exploration
  ALTER COLUMN engine_version SET NOT NULL;
