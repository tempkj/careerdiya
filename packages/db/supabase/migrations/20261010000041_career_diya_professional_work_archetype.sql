-- Preserve the existing profile fields while adding the middle level of the work archetype.
ALTER TABLE core.profile
  ADD COLUMN IF NOT EXISTS current_department text,
  ADD COLUMN IF NOT EXISTS current_department_other text;

COMMENT ON COLUMN core.profile.industry IS 'Industry sector of the organisation (for example Healthcare or Financial Services).';
COMMENT ON COLUMN core.profile.current_department IS 'Department or functional area within the industry.';
COMMENT ON COLUMN core.profile.current_role_title IS 'Specific current role or designation within the department/function.';
