-- 012: Feedback
-- Thumbs up/down on coach turns and recommendations.
-- Upserts — one rating per (user, target_type, target_id) enforced by UNIQUE.
-- rating is −1 or 1 only (checked against vocab.json feedback.rating).

CREATE TABLE core.feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text        NOT NULL CHECK (target_type IN ('coach_turn','recommendation')),
  target_id   uuid        NOT NULL,
  rating      integer     NOT NULL CHECK (rating IN (-1, 1)),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);
