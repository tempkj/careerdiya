-- 019: Role substrate store — base intelligence layer (ADR-011)
-- Sits in the knowledge schema alongside onet_occupation and skill.
-- No user_id — shared reference data, not user-owned. No RLS needed.

CREATE TABLE knowledge.role_substrate (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Natural key: one substrate per normalized role label + region
  -- role_key = lower(trim(desired_role)), computed by the application before insert
  role_key       text        NOT NULL,
  region         text        NOT NULL DEFAULT 'IN',

  -- Optional O*NET grounding — nullable, same pattern as activation_session.onet_code
  -- Set when a confident O*NET match exists; NULL for modern/novel roles. Never the key.
  onet_code      text        REFERENCES knowledge.onet_occupation(onet_code) ON DELETE SET NULL,

  -- Content (versioned JSONB — shape governed by schema_version)
  payload        jsonb       NOT NULL,

  -- Provenance
  basis          text        NOT NULL CHECK (basis IN ('grounded', 'inferred')),
  source         text        NOT NULL CHECK (source IN ('mock', 'crawl', 'licensed_feed')),
  schema_version text        NOT NULL DEFAULT 'substrate/v1',

  -- Currency
  computed_at    timestamptz NOT NULL DEFAULT now(),
  valid_until    timestamptz,           -- NULL = no structured expiry (v1 acceptable)

  CONSTRAINT role_substrate_natural_key UNIQUE (role_key, region)
);

-- Primary serve path: lookup by normalized role label + region
CREATE INDEX idx_role_substrate_lookup ON knowledge.role_substrate (role_key, region);

-- Grounding queries: find substrate for a known O*NET code
CREATE INDEX idx_role_substrate_onet ON knowledge.role_substrate (onet_code) WHERE onet_code IS NOT NULL;
