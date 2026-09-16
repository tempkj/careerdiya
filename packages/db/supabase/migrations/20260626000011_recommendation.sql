-- 011: Recommendation
-- Personalized opportunities driven by Goal + Gap + O*NET taxonomy.
-- Lifecycle: suggested → viewed → saved → started → completed → dismissed.
-- Status transitions are engagement signals; 'completed' may create a soft outcome.

CREATE TABLE core.recommendation (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   text        NOT NULL CHECK (category IN ('course','certification','project','role','community')),
  title      text        NOT NULL,
  score      numeric     NOT NULL CHECK (score >= 0 AND score <= 1),
  confidence jsonb,
  status     text        NOT NULL DEFAULT 'suggested'
                         CHECK (status IN ('suggested','viewed','saved','started','completed','dismissed')),
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
