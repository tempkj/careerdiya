-- Repair profile background access for authenticated Career Diya users.
-- Do not grant anon access: these tables contain private education and experience data.
GRANT USAGE ON SCHEMA core TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE core.career_diya_profile_education
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE core.career_diya_profile_experience
  TO authenticated;

-- Ensure the owner-only policies remain in place.
ALTER TABLE core.career_diya_profile_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_profile_education FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_profile_education_owner ON core.career_diya_profile_education;
CREATE POLICY cd_profile_education_owner
  ON core.career_diya_profile_education
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

ALTER TABLE core.career_diya_profile_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_profile_experience FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_profile_experience_owner ON core.career_diya_profile_experience;
CREATE POLICY cd_profile_experience_owner
  ON core.career_diya_profile_experience
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

NOTIFY pgrst, 'reload schema';
