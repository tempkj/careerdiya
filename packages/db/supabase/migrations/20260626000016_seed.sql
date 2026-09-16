-- 016: Seed — static reference data required before any feature code runs
-- No user data. Superuser (postgres) bypasses FORCE RLS so these inserts work.

-- ── Readiness Spec v1 ─────────────────────────────────────────────────────────
-- Sprint-0 baseline: simple weighted average. The weights are hypotheses;
-- they evolve through the Founder-Learning loop via new spec versions (A13).
-- Required before any readiness_history row can be inserted (FK).
INSERT INTO core.readiness_spec (spec_version, weights, description, is_active)
VALUES (
  'readiness-spec/v1',
  '{
    "clarity":     0.25,
    "capability":  0.30,
    "execution":   0.25,
    "opportunity": 0.20,
    "formula":     "weighted_average"
  }'::jsonb,
  'Sprint-0 baseline spec — proves the pipeline. Formula and weights are unvalidated hypotheses.',
  true
);

-- ── Prompt Registry ───────────────────────────────────────────────────────────
-- Seed the four prompt versions that ship with the scaffold (packages/prompts/).
-- template_hash is a placeholder; the CI prompt-governance step replaces it with
-- the real SHA-256 of the prompt file content before production deploy.
INSERT INTO knowledge.prompt_registry (template_ref, template_hash, prompt_version, is_active)
VALUES
  ('activation/v1',    'sha256:scaffold-placeholder', 'activation/v1',    true),
  ('blueprint/v2',     'sha256:scaffold-placeholder', 'blueprint/v2',     true),
  ('coach/v3',         'sha256:scaffold-placeholder', 'coach/v3',         true),
  ('recommendation/v1','sha256:scaffold-placeholder', 'recommendation/v1',true);
