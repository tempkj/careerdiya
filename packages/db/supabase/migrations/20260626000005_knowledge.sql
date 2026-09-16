-- 005: Knowledge schema — O*NET taxonomy, skills, prompt registry
-- No user_id — these are shared reference tables, not user-owned.

-- ── O*NET Occupations ─────────────────────────────────────────────────────────
CREATE TABLE knowledge.onet_occupation (
  onet_code   text        PRIMARY KEY,
  title       text        NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Skills ────────────────────────────────────────────────────────────────────
CREATE TABLE knowledge.skill (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  canonical_name text,
  onet_code      text        REFERENCES knowledge.onet_occupation(onet_code) ON DELETE SET NULL,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Prompt Registry ───────────────────────────────────────────────────────────
-- Versioned prompt references (ADR-003). template_ref is the stable FK used by
-- coach_turn.prompt_version, blueprint.prompt_version, etc.
-- template_hash guards against silent in-place edits (content-addressed).
CREATE TABLE knowledge.prompt_registry (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_ref   text        NOT NULL UNIQUE,
  template_hash  text        NOT NULL,
  prompt_version text        NOT NULL,
  is_active      boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
