-- 009: Outcome — hard and soft career outcomes
-- Hard outcomes (promotion, job_change, …) are user-reported.
-- Soft outcomes (confidence_increase, …) may be reported or inferred.
-- Inferred soft outcomes follow a confirm/decay lifecycle via corroborated_at / decays_at.

CREATE TABLE core.outcome (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome_class  text        NOT NULL CHECK (outcome_class IN ('hard','soft')),
  type           text        NOT NULL,
  capture        text        NOT NULL DEFAULT 'reported' CHECK (capture IN ('reported','inferred')),
  value          jsonb,
  confidence     jsonb,
  corroborated_at timestamptz,
  decays_at      timestamptz,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
