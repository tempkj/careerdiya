-- 008: Planner — goal, task, reflection
-- Tasks are direct children of goals (no milestones in v1).
-- Completing a task emits a twin_signal and may infer a soft outcome (application layer).

-- ── Goal ──────────────────────────────────────────────────────────────────────
CREATE TABLE core.goal (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  priority    integer     NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  target_date date,
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','paused','achieved','dropped')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Task ──────────────────────────────────────────────────────────────────────
-- user_id is denormalized from goal for RLS; always mirrors goal.user_id.
CREATE TABLE core.task (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      uuid        NOT NULL REFERENCES core.goal(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'todo'
                           CHECK (status IN ('todo','scheduled','completed','skipped')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Reflection ────────────────────────────────────────────────────────────────
-- Reflections emit a twin_signal (tracked via twin_signal_id).
-- goal_id is optional — a reflection can be free-form or goal-linked.
CREATE TABLE core.reflection (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id         uuid        REFERENCES core.goal(id) ON DELETE SET NULL,
  went_well       text,
  difficult       text,
  learned         text,
  twin_signal_id  uuid        REFERENCES core.twin_signal(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
