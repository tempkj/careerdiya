-- 010: Coach — conversation + coach_turn
-- The single Coach agent reads TwinContext and emits signals; it never writes the
-- Twin directly (ADR-006, invariant A2). coach_turn records every message including
-- tool calls, citations, and the prompt version that produced AI turns.

-- ── Conversation ──────────────────────────────────────────────────────────────
CREATE TABLE core.conversation (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz
);

-- ── Coach Turn ────────────────────────────────────────────────────────────────
-- user_id denormalized from conversation for RLS efficiency.
CREATE TABLE core.coach_turn (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid        NOT NULL REFERENCES core.conversation(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role              text        NOT NULL CHECK (role IN ('user','assistant','tool')),
  content           text,
  tool_calls        jsonb,
  citations         jsonb,
  generated_by_model text,
  prompt_version    text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
