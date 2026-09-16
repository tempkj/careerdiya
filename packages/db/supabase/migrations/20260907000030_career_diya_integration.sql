-- Career Diya integration layer
-- The CareerAsana Supabase project becomes the shared identity/backend for the
-- integrated Career Diya + CareerAsana experience. Career Diya remains the free
-- decision layer; CareerAsana remains the paid/deeper execution layer.
--
-- Existing core.profile is extended rather than creating a second user profile.
-- Free explorations are append-only snapshots so multiple career directions can
-- coexist and later be compared without reinterpreting history.

ALTER TABLE core.profile
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_other text,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS field_of_study text,
  ADD COLUMN IF NOT EXISTS graduation_year text,
  ADD COLUMN IF NOT EXISTS current_role_title text,
  ADD COLUMN IF NOT EXISTS current_role_other text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS industry_other text,
  ADD COLUMN IF NOT EXISTS experience_years text,
  ADD COLUMN IF NOT EXISTS career_interests text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS career_interests_other text,
  ADD COLUMN IF NOT EXISTS career_goals text,
  ADD COLUMN IF NOT EXISTS career_goals_other text,
  ADD COLUMN IF NOT EXISTS strengths text,
  ADD COLUMN IF NOT EXISTS strengths_other text,
  ADD COLUMN IF NOT EXISTS weaknesses text,
  ADD COLUMN IF NOT EXISTS weaknesses_other text,
  ADD COLUMN IF NOT EXISTS learning_preferences text,
  ADD COLUMN IF NOT EXISTS learning_preferences_other text,
  ADD COLUMN IF NOT EXISTS audience text;

ALTER TABLE core.profile
  DROP CONSTRAINT IF EXISTS profile_audience_check;
ALTER TABLE core.profile
  ADD CONSTRAINT profile_audience_check
  CHECK (audience IN ('parent','student','professional') OR audience IS NULL);

CREATE TABLE IF NOT EXISTS core.career_diya_profile_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  education_level text NOT NULL,
  education_level_other text,
  field_of_study text NOT NULL,
  field_of_study_other text,
  institution text,
  graduation_year text,
  is_current boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_profile_education_profile
  ON core.career_diya_profile_education(profile_id, sort_order);

CREATE TABLE IF NOT EXISTS core.career_diya_profile_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL,
  domain_other text,
  exposure_type text NOT NULL,
  exposure_level text NOT NULL,
  role_family text,
  role_family_other text,
  years_bucket text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_profile_experience_profile
  ON core.career_diya_profile_experience(profile_id, sort_order);

CREATE TABLE IF NOT EXISTS core.career_diya_exploration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK (audience IN ('parent','student','professional')),
  answers jsonb NOT NULL,
  result jsonb NOT NULL,
  recommendation_matrix_version text,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_exploration_user_completed
  ON core.career_diya_exploration(user_id, completed_at DESC);

-- Leads and admissions remain operational intake records. They are placed in
-- core so the integrated app has one exposed PostgREST schema and one RLS model.
CREATE TABLE IF NOT EXISTS core.career_diya_lead (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('careerdiya','skilldiya')),
  segment text,
  interest text,
  interest_kind text CHECK (interest_kind IN ('course','direction','general')),
  name text,
  email text,
  phone text,
  shared_user_id uuid,
  raw jsonb
);

CREATE INDEX IF NOT EXISTS idx_cd_lead_source ON core.career_diya_lead(source);
CREATE INDEX IF NOT EXISTS idx_cd_lead_interest ON core.career_diya_lead(interest);
CREATE INDEX IF NOT EXISTS idx_cd_lead_created ON core.career_diya_lead(created_at);

CREATE TABLE IF NOT EXISTS core.career_diya_pre_application (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pre_application_id text NOT NULL UNIQUE,
  shared_user_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  location text,
  audience text,
  education_level text,
  qualification text,
  completion_year text,
  college_id text,
  college_name text NOT NULL,
  programme_id text,
  programme_name text NOT NULL,
  specialization text,
  source text NOT NULL DEFAULT 'careerdiya',
  status text NOT NULL DEFAULT 'pre_application',
  raw jsonb
);

CREATE INDEX IF NOT EXISTS idx_cd_preapp_created
  ON core.career_diya_pre_application(created_at);

CREATE INDEX IF NOT EXISTS idx_cd_preapp_email
  ON core.career_diya_pre_application(email);

-- User-owned data: RLS is mandatory.
ALTER TABLE core.career_diya_profile_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_profile_education FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_profile_education_owner ON core.career_diya_profile_education;
CREATE POLICY cd_profile_education_owner ON core.career_diya_profile_education
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

ALTER TABLE core.career_diya_profile_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_profile_experience FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_profile_experience_owner ON core.career_diya_profile_experience;
CREATE POLICY cd_profile_experience_owner ON core.career_diya_profile_experience
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

ALTER TABLE core.career_diya_exploration ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_exploration FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_exploration_owner ON core.career_diya_exploration;
CREATE POLICY cd_exploration_owner ON core.career_diya_exploration
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cd_exploration_insert_owner ON core.career_diya_exploration
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Leads are anonymous intake. Authenticated users can also submit their own
-- shared_user_id. There is deliberately no client SELECT policy.
ALTER TABLE core.career_diya_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_lead FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_lead_anon_insert ON core.career_diya_lead;
CREATE POLICY cd_lead_anon_insert ON core.career_diya_lead
  FOR INSERT TO anon
  WITH CHECK (
    source IN ('careerdiya','skilldiya')
    AND interest_kind IN ('course','direction','general')
    AND nullif(trim(segment),'') IS NOT NULL
    AND nullif(trim(interest),'') IS NOT NULL
  );
DROP POLICY IF EXISTS cd_lead_auth_insert ON core.career_diya_lead;
CREATE POLICY cd_lead_auth_insert ON core.career_diya_lead
  FOR INSERT TO authenticated
  WITH CHECK (
    source IN ('careerdiya','skilldiya')
    AND interest_kind IN ('course','direction','general')
    AND nullif(trim(segment),'') IS NOT NULL
    AND nullif(trim(interest),'') IS NOT NULL
    AND (shared_user_id IS NULL OR shared_user_id = auth.uid())
  );

ALTER TABLE core.career_diya_pre_application ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_pre_application FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_preapp_anon_insert ON core.career_diya_pre_application;
CREATE POLICY cd_preapp_anon_insert ON core.career_diya_pre_application
  FOR INSERT TO anon
  WITH CHECK (
    source = 'careerdiya'
    AND status = 'pre_application'
    AND shared_user_id IS NULL
  );
DROP POLICY IF EXISTS cd_preapp_auth_insert ON core.career_diya_pre_application;
CREATE POLICY cd_preapp_auth_insert ON core.career_diya_pre_application
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'careerdiya'
    AND status = 'pre_application'
    AND (shared_user_id IS NULL OR shared_user_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON core.profile TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.career_diya_profile_education TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.career_diya_profile_experience TO authenticated;
GRANT SELECT, INSERT ON core.career_diya_exploration TO authenticated;
GRANT INSERT ON core.career_diya_lead TO anon, authenticated;
GRANT INSERT ON core.career_diya_pre_application TO anon, authenticated;

-- Future paid boundary. Payment provider integration will grant rows here;
-- the application never grants access to itself.
CREATE TABLE IF NOT EXISTS core.product_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product text NOT NULL CHECK (product IN ('careerasana')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  source text NOT NULL DEFAULT 'manual',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product)
);

CREATE INDEX IF NOT EXISTS idx_product_access_user_product
  ON core.product_access(user_id, product, status);

ALTER TABLE core.product_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.product_access FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_access_owner ON core.product_access;
CREATE POLICY product_access_owner ON core.product_access
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON core.product_access TO authenticated;
