-- Repair authenticated access to Career Diya Vault and direction tables.
-- Safe to re-run. RLS remains owner-scoped; grants only enable table operations
-- that are then constrained by the existing owner policies.

GRANT USAGE ON SCHEMA core TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE core.career_diya_vault_item
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE core.career_diya_direction
  TO authenticated;

ALTER TABLE core.career_diya_vault_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.career_diya_direction ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cd_vault_owner ON core.career_diya_vault_item;
CREATE POLICY cd_vault_owner
  ON core.career_diya_vault_item
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS cd_direction_owner ON core.career_diya_direction;
CREATE POLICY cd_direction_owner
  ON core.career_diya_direction
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
