-- Career Diya Career Vault foundation
-- Branch: feat/career-diya-career-vault
-- The Vault is an open repository for user-dumped career-related pursuits.
-- A Vault item is NOT automatically a career goal. Career relationship is contextual.

CREATE TABLE IF NOT EXISTS core.career_diya_direction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  career_id text NOT NULL,
  career_name_snapshot text NOT NULL,
  status text NOT NULL DEFAULT 'considering'
    CHECK (status IN ('considering','exploring','active','paused','rejected','achieved')),
  reason text,
  source text NOT NULL DEFAULT 'careerdiya'
    CHECK (source IN ('careerdiya','vault','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cd_direction_active_career
  ON core.career_diya_direction(user_id, career_id)
  WHERE status IN ('considering','exploring','active','paused');

CREATE INDEX IF NOT EXISTS idx_cd_direction_user_updated
  ON core.career_diya_direction(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS core.career_diya_vault_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  item_type text NOT NULL DEFAULT 'other'
    CHECK (item_type IN ('learning','workshop','certification','project','activity','experience','hobby','experiment','aspiration','other')),
  career_relationship text NOT NULL DEFAULT 'undecided'
    CHECK (career_relationship IN (
      'direct_career_pursuit',
      'career_enabler',
      'career_exploration',
      'side_income',
      'future_full_time_career',
      'personal_hobby',
      'general_learning',
      'undecided'
    )),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','completed','converted','archived')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high')),
  context_note text,
  linked_career_id text,
  linked_direction_id uuid REFERENCES core.career_diya_direction(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_vault_user_updated
  ON core.career_diya_vault_item(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cd_vault_user_relationship
  ON core.career_diya_vault_item(user_id, career_relationship);

ALTER TABLE core.career_diya_direction ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_direction FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_direction_owner ON core.career_diya_direction;
CREATE POLICY cd_direction_owner ON core.career_diya_direction
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE core.career_diya_vault_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_vault_item FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cd_vault_owner ON core.career_diya_vault_item;
CREATE POLICY cd_vault_owner ON core.career_diya_vault_item
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON core.career_diya_direction TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.career_diya_vault_item TO authenticated;
