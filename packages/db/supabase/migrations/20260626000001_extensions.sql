-- 001: Extensions
-- pg_jsonschema is MANDATORY (D6) — twin and readiness CHECKs depend on it.
-- Must be migration 001 so every later migration can reference validate_json_schema.

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pg_jsonschema WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto     WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm      WITH SCHEMA extensions;
