-- 002: Schemas + Roles
-- Three-schema layout (ADR-007, D1-rev): core / knowledge / audit.
-- Module isolation inside core is enforced by table-name prefixes + CI boundary lint.

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS knowledge;
CREATE SCHEMA IF NOT EXISTS audit;

-- Application roles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'careerasana_app') THEN
    CREATE ROLE careerasana_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'careerasana_worker') THEN
    CREATE ROLE careerasana_worker NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'careerasana_readonly') THEN
    CREATE ROLE careerasana_readonly NOLOGIN;
  END IF;
END;
$$;

-- Schema USAGE
GRANT USAGE ON SCHEMA core      TO careerasana_app, careerasana_worker, careerasana_readonly, authenticated, anon;
GRANT USAGE ON SCHEMA knowledge TO careerasana_app, careerasana_worker, careerasana_readonly, authenticated, anon;
GRANT USAGE ON SCHEMA audit     TO careerasana_worker, careerasana_readonly;

-- Default privileges for tables created in later migrations
-- core: app = full DML (RLS scopes access); worker = read+write for async processing
ALTER DEFAULT PRIVILEGES IN SCHEMA core
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO careerasana_app, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA core
  GRANT SELECT, INSERT, UPDATE ON TABLES TO careerasana_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA core
  GRANT SELECT ON TABLES TO careerasana_readonly;

-- knowledge: read for all API roles; worker populates
ALTER DEFAULT PRIVILEGES IN SCHEMA knowledge
  GRANT SELECT ON TABLES TO careerasana_app, careerasana_readonly, authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA knowledge
  GRANT SELECT, INSERT, UPDATE ON TABLES TO careerasana_worker;

-- audit: worker inserts fingerprints; readonly can query
ALTER DEFAULT PRIVILEGES IN SCHEMA audit
  GRANT INSERT ON TABLES TO careerasana_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit
  GRANT SELECT ON TABLES TO careerasana_readonly;
