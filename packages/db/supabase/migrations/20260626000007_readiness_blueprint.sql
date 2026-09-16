-- 007: Readiness spec, Blueprint, Readiness history
-- Readiness is versioned (A13) and historized (A14) — never edited in place.
-- Blueprint is the single living career document regenerated from the Twin.

-- ── Readiness Spec ────────────────────────────────────────────────────────────
-- Governs the scoring formula. Exactly one row has is_active = true at any time.
-- A new spec version is a new row (like a migration); never UPDATE an existing spec.
CREATE TABLE core.readiness_spec (
  spec_version text        PRIMARY KEY,
  weights      jsonb       NOT NULL,
  description  text,
  is_active    boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Blueprint ─────────────────────────────────────────────────────────────────
-- Single living document per user. Regenerated asynchronously on major signals.
-- readiness stores the snapshot at generation time; validated by pg_jsonschema (D6).
--
-- SOURCE (readiness column): packages/db/schemas/readiness.schema.json
-- If you update readiness.schema.json you MUST update this inline copy to match.
CREATE TABLE core.blueprint (
  user_id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  document            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  readiness           jsonb,
  generated_at        timestamptz NOT NULL DEFAULT now(),
  generated_by_model  text,
  prompt_version      text,
  params_hash         text,
  input_fingerprint   text,
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT blueprint_readiness_schema_valid CHECK (
    readiness IS NULL OR extensions.jsonb_matches_schema(
      -- SOURCE: packages/db/schemas/readiness.schema.json ($schema/$id stripped — pg_jsonschema 0.3.x requires absolute $id)
      '{"type":"object","required":["careerReadiness","dimensions","specVersion"],"properties":{"careerReadiness":{"type":"integer","minimum":0,"maximum":100},"dimensions":{"type":"object","required":["clarity","capability","execution","opportunity"],"properties":{"clarity":{"type":"integer","minimum":0,"maximum":100},"capability":{"type":"integer","minimum":0,"maximum":100},"execution":{"type":"integer","minimum":0,"maximum":100},"opportunity":{"type":"integer","minimum":0,"maximum":100}}},"specVersion":{"type":"string"}}}'::json,
      readiness
    )
  )
);

-- ── Readiness History ─────────────────────────────────────────────────────────
-- Append-only score history (A14). Each row is a point in the trend line.
-- The pg_jsonschema CHECK reconstructs the canonical readiness object from columns
-- so the DB enforces the same schema contract as the API (D6).
--
-- SOURCE: packages/db/schemas/readiness.schema.json
-- If you update readiness.schema.json you MUST update this inline copy to match.
CREATE TABLE core.readiness_history (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  composite    integer     NOT NULL CHECK (composite >= 0 AND composite <= 100),
  dimensions   jsonb       NOT NULL,
  spec_version text        NOT NULL REFERENCES core.readiness_spec(spec_version),
  confidence   jsonb,
  as_of        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT readiness_history_schema_valid CHECK (
    extensions.jsonb_matches_schema(
      -- SOURCE: packages/db/schemas/readiness.schema.json ($schema/$id stripped — pg_jsonschema 0.3.x requires absolute $id)
      '{"type":"object","required":["careerReadiness","dimensions","specVersion"],"properties":{"careerReadiness":{"type":"integer","minimum":0,"maximum":100},"dimensions":{"type":"object","required":["clarity","capability","execution","opportunity"],"properties":{"clarity":{"type":"integer","minimum":0,"maximum":100},"capability":{"type":"integer","minimum":0,"maximum":100},"execution":{"type":"integer","minimum":0,"maximum":100},"opportunity":{"type":"integer","minimum":0,"maximum":100}}},"specVersion":{"type":"string"}}}'::json,
      jsonb_build_object(
        'careerReadiness', composite,
        'dimensions',      dimensions,
        'specVersion',     spec_version
      )
    )
  )
);
