-- 023: Blueprint model (ADR-012) — replaces the unused document-blob core.blueprint
-- (migration 007) with a versioned, dependency-ordered roadmap over a task library.
-- ADR-005's Readiness-hosting decision is preserved: `readiness` stays on the row,
-- still written by the standalone ReadinessCalculator, never computed here.
--
-- Confirmed zero consumers of the old shape (ADR-012, "Migration path" section) —
-- this drops and recreates core.blueprint rather than altering columns in place.
--
-- GRANT POLICY: per the lesson from migrations 021/022, ALTER DEFAULT PRIVILEGES
-- proved too session-scoped to trust on cloud (grants silently failed to propagate
-- to tables created in a different apply session). Every table below gets its
-- grants stated explicitly in this migration, not left to inherit from migration 002.
--
-- TABLE ORDER: Blueprint header, then Task Library, then Blueprint Task — in that
-- order because blueprint_task.library_task_id FKs into knowledge.task_library,
-- which must therefore exist first.

DROP TABLE IF EXISTS core.blueprint CASCADE;  -- was: user_id PK, free-form `document` jsonb

-- ── Blueprint (versioned header row; append-only — never edited in place) ─────
-- One row per promoted version. Only one row per goal_id has status = 'active';
-- a refresh inserts a new version and flips the old one to 'superseded' (same
-- pattern as readiness_spec.is_active), never updates the old row's content.
CREATE TABLE core.blueprint (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id             uuid        NOT NULL REFERENCES core.goal(id) ON DELETE CASCADE,
  version             integer     NOT NULL DEFAULT 1,
  status              text        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'superseded')),

  -- Which derived path this was promoted from (VISION.md's three-paths Blueprint,
  -- ADR-012 §1.2) — informational provenance, not a behavior switch.
  path_strategy       text        NOT NULL CHECK (path_strategy IN ('fastest', 'longest', 'optimal', 'custom')),

  -- Provenance (A16) — inherited from the substrate(s) the paths were derived from.
  basis               text        NOT NULL CHECK (basis IN ('grounded', 'inferred')),

  -- Readiness hosting (ADR-005 — unchanged relationship, only the row shape around it changed)
  readiness           jsonb,

  -- Generation provenance for the path-derivation AI step
  generated_at        timestamptz NOT NULL DEFAULT now(),
  generated_by_model  text,
  prompt_version      text,
  params_hash         text,
  input_fingerprint   text,

  -- Set when the user approved this version (the Twin-event moment, ADR-012 §6)
  promoted_at         timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT blueprint_readiness_schema_valid CHECK (
    readiness IS NULL OR extensions.jsonb_matches_schema(
      -- SOURCE: packages/db/schemas/readiness.schema.json (unchanged from migration 007)
      '{"type":"object","required":["careerReadiness","dimensions","specVersion"],"properties":{"careerReadiness":{"type":"integer","minimum":0,"maximum":100},"dimensions":{"type":"object","required":["clarity","capability","execution","opportunity"],"properties":{"clarity":{"type":"integer","minimum":0,"maximum":100},"capability":{"type":"integer","minimum":0,"maximum":100},"execution":{"type":"integer","minimum":0,"maximum":100},"opportunity":{"type":"integer","minimum":0,"maximum":100}}},"specVersion":{"type":"string"}}}'::json,
      readiness
    )
  ),
  CONSTRAINT blueprint_version_per_goal UNIQUE (goal_id, version)
);

-- Exactly one active version per goal (mirrors readiness_spec's single-is_active pattern)
CREATE UNIQUE INDEX idx_blueprint_one_active_per_goal
  ON core.blueprint (goal_id) WHERE status = 'active';
CREATE INDEX idx_blueprint_user ON core.blueprint (user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON core.blueprint
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

ALTER TABLE core.blueprint ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.blueprint FORCE ROW LEVEL SECURITY;
CREATE POLICY blueprint_owner ON core.blueprint
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY blueprint_worker ON core.blueprint
  TO careerasana_worker USING (true) WITH CHECK (true);

-- Explicit grants (user-owned table; RLS does the row-scoping, this does the table-access gate)
GRANT SELECT, INSERT, UPDATE, DELETE ON core.blueprint TO authenticated, careerasana_app;
GRANT SELECT, INSERT, UPDATE          ON core.blueprint TO careerasana_worker;
GRANT SELECT                          ON core.blueprint TO careerasana_readonly;

-- ── Task Library (shared reference data — mirrors knowledge.role_substrate, ADR-011) ──
-- No user_id — shared reference data, not user-owned. Created before blueprint_task
-- below, which FKs into it.
CREATE TABLE knowledge.task_library (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                    text        NOT NULL,
  description              text,
  evolve_category          text        NOT NULL CHECK (evolve_category IN
                                       ('engage', 'visualize', 'organize', 'learn', 'venture', 'elevate')),
  typical_effort_estimate  text,

  -- Recommended default ordering when composing a Blueprint from library tasks —
  -- soft, same non-enforced-array pattern as blueprint_task.dependencies below.
  default_dependencies     uuid[]      NOT NULL DEFAULT '{}',

  basis                    text        NOT NULL CHECK (basis IN ('grounded', 'inferred')),
  source                   text        NOT NULL CHECK (source IN ('mock', 'curated', 'ai_generated')),
  schema_version           text        NOT NULL DEFAULT 'task_library/v1',

  computed_at              timestamptz NOT NULL DEFAULT now(),
  valid_until              timestamptz
);

CREATE INDEX idx_task_library_category ON knowledge.task_library (evolve_category);

ALTER TABLE knowledge.task_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.task_library FORCE ROW LEVEL SECURITY;
CREATE POLICY task_library_read   ON knowledge.task_library FOR SELECT USING (true);
CREATE POLICY task_library_worker ON knowledge.task_library TO careerasana_worker USING (true) WITH CHECK (true);

-- Shared reference data: public read (same as role_substrate/onet_occupation/skill post-022
-- fix — anon/authenticated get SELECT only, never DML). Worker + service_role get DML for
-- the seed loop (in-chat generated, reviewed, SQL-written) and future generate-on-miss writes.
GRANT SELECT                          ON knowledge.task_library TO anon, authenticated, careerasana_app, careerasana_readonly;
GRANT SELECT, INSERT, UPDATE          ON knowledge.task_library TO careerasana_worker;
GRANT SELECT, INSERT, UPDATE, DELETE  ON knowledge.task_library TO service_role;

-- ── Blueprint Task (dependency-graph nodes belonging to one stored Blueprint) ──
-- Snapshot content (title/description copied at promotion time), not a live join
-- to the library — a stored Blueprint must not silently change if the library
-- task it came from is later edited. library_task_id is provenance only.
--
-- Distinct from core.task (migration 008, Planner) — that is the execution-
-- tracking task under a goal. This is a Blueprint dependency-graph node. The two
-- are NOT merged (ADR-012 §4, open question: how they connect is a later epic,
-- and must be designed deliberately before the Planner epic starts — the two
-- task schemas must not drift apart in ways that make joining them hard).
CREATE TABLE core.blueprint_task (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id      uuid        NOT NULL REFERENCES core.blueprint(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized from blueprint.user_id for RLS, same pattern as core.task.user_id from core.goal

  library_task_id   uuid        REFERENCES knowledge.task_library(id) ON DELETE SET NULL,

  title             text        NOT NULL,
  description       text,
  evolve_category   text        NOT NULL CHECK (evolve_category IN
                                ('engage', 'visualize', 'organize', 'learn', 'venture', 'elevate')),

  -- Soft dependencies within the same blueprint — recommended ordering, user-
  -- overridable, never a hard gate (ADR-012 §4). A plain array, not a join table:
  -- a join table would impose enforced referential integrity on a relationship
  -- defined as deliberately soft/advisory. No FK on array elements; dangling ids
  -- (e.g. after the user removes a task) are accepted, same trade-off already
  -- made for substrate adjacency data (ADR-011).
  dependencies      uuid[]      NOT NULL DEFAULT '{}',
  sequence_order    integer     NOT NULL,
  effort_estimate   text,

  -- Reserved for the later Execution/Planner epic. NOT read or written by
  -- Blueprint itself (ADR-012 §4). May turn out redundant with core.task.status
  -- once the blueprint_task <-> core.task relationship is designed — do not
  -- build any logic against this column yet.
  status            text        CHECK (status IS NULL OR status IN ('todo', 'in_progress', 'done', 'skipped')),

  basis             text        NOT NULL CHECK (basis IN ('grounded', 'inferred')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blueprint_task_blueprint ON core.blueprint_task (blueprint_id, sequence_order);
CREATE INDEX idx_blueprint_task_user      ON core.blueprint_task (user_id);

ALTER TABLE core.blueprint_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.blueprint_task FORCE ROW LEVEL SECURITY;
CREATE POLICY blueprint_task_owner ON core.blueprint_task
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY blueprint_task_worker ON core.blueprint_task
  TO careerasana_worker USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON core.blueprint_task TO authenticated, careerasana_app;
GRANT SELECT, INSERT, UPDATE          ON core.blueprint_task TO careerasana_worker;
GRANT SELECT                          ON core.blueprint_task TO careerasana_readonly;
