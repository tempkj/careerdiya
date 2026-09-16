-- 020: Extend knowledge.role_substrate.source CHECK to include 'ai_generated'
-- Governing artifact: ADR-011 (substrate design extension — no new ADR needed)
--
-- 'ai_generated' = substrate produced by model reasoning, no live signal.
-- basis: 'inferred' always. Distinct from 'crawl'/'licensed_feed' (basis: 'grounded').
-- Source progression: mock → ai_generated → crawl/licensed_feed mirrors §4 inferred→grounded.

ALTER TABLE knowledge.role_substrate
  DROP CONSTRAINT role_substrate_source_check,
  ADD CONSTRAINT role_substrate_source_check
    CHECK (source IN ('mock', 'crawl', 'licensed_feed', 'ai_generated'));
