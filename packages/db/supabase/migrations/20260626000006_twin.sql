-- 006: Twin — core.twin + core.twin_signal
-- The Twin changes ONLY via signals (ADR-001, invariant A2/A16).
-- There is intentionally no PUT/PATCH on twin; the signal log is the write path.

-- ── Twin ─────────────────────────────────────────────────────────────────────
-- One row per user. Seeded with {"schemaVersion":"twin/v1"} by handle_new_user().
-- The pg_jsonschema CHECK is MANDATORY (D6).
--
-- SOURCE: packages/db/schemas/twin.schema.json
-- If you update twin.schema.json you MUST update this inline copy to match.
CREATE TABLE core.twin (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  twin           jsonb       NOT NULL DEFAULT '{"schemaVersion":"twin/v1"}'::jsonb,
  schema_version text        NOT NULL DEFAULT 'twin/v1',
  version        integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT twin_schema_valid CHECK (
    extensions.jsonb_matches_schema(
      -- SOURCE: packages/db/schemas/twin.schema.json ($schema/$id stripped — pg_jsonschema 0.3.x requires absolute $id)
      '{"type":"object","required":["schemaVersion"],"properties":{"schemaVersion":{"const":"twin/v1"},"identity":{"type":"object"},"capability":{"type":"object"},"aspiration":{"type":"object"},"constraints":{"type":"object"},"growth":{"type":"object"}}}'::json,
      twin
    )
  )
);

-- ── Twin Signal ───────────────────────────────────────────────────────────────
-- Immutable append-only log (ADR-001). applied flips true once the worker processes
-- the signal. source_ref points to the originating entity (conversation turn, etc.).
CREATE TABLE core.twin_signal (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source       text        NOT NULL CHECK (source IN ('conversation','reflection','task_completion','outcome','system')),
  significance text        NOT NULL CHECK (significance IN ('minor','major')),
  source_ref   uuid,
  payload      jsonb       NOT NULL,
  applied      boolean     NOT NULL DEFAULT false,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);
