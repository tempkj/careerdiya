-- 003: Shared functions
-- Must precede all table migrations — triggers in 015 reference these.

-- Auto-stamp updated_at on every mutable table.
CREATE OR REPLACE FUNCTION core.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Bootstrap profile + twin rows when a new auth.users row is inserted.
-- SECURITY DEFINER so it runs as the defining role (postgres), not the caller.
-- Twin is seeded with the minimum valid JSON so the pg_jsonschema CHECK passes
-- from day 0 (schemaVersion is the only required field in twin/v1).
CREATE OR REPLACE FUNCTION core.handle_new_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO core.profile (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO core.twin (user_id, twin, schema_version, version)
  VALUES (NEW.id, '{"schemaVersion":"twin/v1"}'::jsonb, 'twin/v1', 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Immutability guard for activation_session (invariant A17).
-- Raised by the trigger in 015; defined here so it compiles independently.
CREATE OR REPLACE FUNCTION core.prevent_activation_session_mutation()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'activation_session is immutable once completed (invariant A17)';
  END IF;
  RETURN NEW;
END;
$$;

-- Enqueue a readiness-recompute job when a twin_signal transitions to applied = true.
-- Defined here; wired to the table by trigger in 015.
CREATE OR REPLACE FUNCTION core.enqueue_readiness_on_signal_applied()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.applied = true AND (OLD.applied IS DISTINCT FROM true) THEN
    INSERT INTO core.job (user_id, kind, status)
    VALUES (NEW.user_id, 'signal_application', 'queued');
  END IF;
  RETURN NEW;
END;
$$;
