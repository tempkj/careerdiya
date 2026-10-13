-- ADR-CD-003: thin career baseline and separate parent/child context.
-- Reuse existing core.profile fields where semantics already match; only add genuinely
-- new dimensions. The exploration audience remains an immutable per-exploration value.
ALTER TABLE core.profile
  ADD COLUMN IF NOT EXISTS career_stage text,
  ADD COLUMN IF NOT EXISTS employment_status text,
  ADD COLUMN IF NOT EXISTS education_stage text,
  ADD COLUMN IF NOT EXISTS highest_completed_qualification text,
  ADD COLUMN IF NOT EXISTS field_of_study_or_stream text,
  ADD COLUMN IF NOT EXISTS further_education_status text,
  ADD COLUMN IF NOT EXISTS baseline_completeness text;

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_career_stage_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_career_stage_check
  CHECK (career_stage IS NULL OR career_stage IN
    ('pre_first_career','recent_graduate','professional','returning_to_work'));

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_employment_status_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_employment_status_check
  CHECK (employment_status IS NULL OR employment_status IN
    ('employed','between_jobs','self_employed','not_working_by_choice','not_applicable','unknown'));

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_education_stage_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_education_stage_check
  CHECK (education_stage IS NULL OR education_stage IN
    ('school','undergraduate','postgraduate','completed_education','other','unknown'));

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_further_education_status_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_further_education_status_check
  CHECK (further_education_status IS NULL OR further_education_status IN
    ('not_pursuing','considering','admitted','pursuing','completed','unknown'));

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_baseline_completeness_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_baseline_completeness_check
  CHECK (baseline_completeness IS NULL OR baseline_completeness IN ('thin','extended'));

COMMENT ON COLUMN core.profile.career_stage IS 'Confirmed career baseline stage; independent of the exploration audience.';
COMMENT ON COLUMN core.profile.employment_status IS 'Current employment status; does not determine career stage.';
COMMENT ON COLUMN core.profile.education_stage IS 'Current education stage, distinct from highest completed qualification.';
COMMENT ON COLUMN core.profile.further_education_status IS 'Further-education status; enrolment does not by itself imply a career switch.';
COMMENT ON COLUMN core.profile.baseline_completeness IS 'Thin baseline is sufficient for initial transition guidance; extended context is progressive.';

-- A parent's exploration of a child must not write the child's baseline into the parent's
-- own core.profile. This table stores a distinct child-context record owned by the parent.
CREATE TABLE IF NOT EXISTS core.career_diya_child_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_label text,
  education_stage text,
  field_of_study_or_stream text,
  highest_completed_qualification text,
  has_work_experience boolean,
  work_experience_summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_diya_child_education_stage_check
    CHECK (education_stage IS NULL OR education_stage IN
      ('school','undergraduate','postgraduate','completed_education','other','unknown'))
);

CREATE INDEX IF NOT EXISTS idx_cd_child_context_parent_updated
  ON core.career_diya_child_context(parent_user_id, updated_at DESC);

ALTER TABLE core.career_diya_child_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_child_context FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_child_context_owner ON core.career_diya_child_context;
CREATE POLICY cd_child_context_owner ON core.career_diya_child_context
  USING (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON core.career_diya_child_context TO authenticated;
GRANT SELECT, INSERT, UPDATE ON core.profile TO authenticated;
