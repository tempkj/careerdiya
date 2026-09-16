-- 004: Anchors — profile, consent, activation_session (A17), idempotency_key, job, audit_log
-- These are the cross-cutting tables that almost every module references.

-- ── Profile ──────────────────────────────────────────────────────────────────
-- One row per auth user. PII lives in auth.users; this holds preferences only.
CREATE TABLE core.profile (
  user_id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     text,
  region           text        NOT NULL DEFAULT 'IN',
  locale           text        NOT NULL DEFAULT 'en-IN',
  onboarding_state text        NOT NULL DEFAULT 'registered'
                               CHECK (onboarding_state IN ('registered', 'activated')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Consent ───────────────────────────────────────────────────────────────────
-- Append-only (no UPDATE/DELETE). Every consent change is a new row. (DPDP)
CREATE TABLE core.consent (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose        text        NOT NULL CHECK (purpose IN ('processing','ai_personalization','marketing','research')),
  state          text        NOT NULL CHECK (state IN ('granted','revoked')),
  policy_version text        NOT NULL,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Activation Session ────────────────────────────────────────────────────────
-- Immutable onboarding artifact (invariant A17 — history, not source of truth).
-- journey JSONB records the ordered steps; completedAt is set once and never changed.
CREATE TABLE core.activation_session (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "current_role" text,
  desired_role   text,
  onet_code    text,
  gap          jsonb,
  first_action text,
  journey      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Idempotency Keys ──────────────────────────────────────────────────────────
-- 24-hour replay store. key_hash = SHA-256(Idempotency-Key header), not cleartext.
CREATE TABLE core.idempotency_key (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash        text        NOT NULL,
  endpoint        text        NOT NULL,
  response_status integer,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT now() + INTERVAL '24 hours',
  UNIQUE (user_id, key_hash, endpoint)
);

-- ── Async Job ─────────────────────────────────────────────────────────────────
-- Poll target for every 202 response (GET /jobs/{jobId}).
CREATE TABLE core.job (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           text        NOT NULL CHECK (kind IN ('signal_application','blueprint_regeneration','reflection_processing')),
  status         text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  entity_type    text        CHECK (entity_type IN ('blueprint','twin','none')),
  entity_id      uuid,
  entity_href    text,
  progress       jsonb,
  failure_reason text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

-- ── Audit Log ─────────────────────────────────────────────────────────────────
-- Fingerprint only — no PII. Sensitive ops write here; user_id is nullable
-- to accommodate system operations that have no auth context.
CREATE TABLE audit.audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid,
  operation     text        NOT NULL,
  resource_type text        NOT NULL,
  resource_id   uuid,
  metadata      jsonb,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
