# ADR-003: Prompts are governed, versioned assets

**Status:** Accepted

## Context
This is an AI product; prompts materially determine output quality and behavior. Untracked, in-place
prompt edits make quality changes unattributable ("why did Blueprints get worse in March?") and
un-rollback-able — the same failure mode we eliminated for the readiness formula.

## Decision
- Prompts are first-class artifacts in `packages/prompts/`, versioned like migrations.
- A prompt change is a **new version** (e.g. `coach/v3.md` -> `coach/v4.md`), never an in-place edit
  — comparable to a `readiness_spec` version bump (A13).
- `prompt_registry` (DB) records version -> purpose -> model -> file (`template_ref`) -> `template_hash`,
  and every AI artifact stamps the `promptVersion` (and model) that produced it (`generation_meta`).
- **Scope:** this ADR governs prompt *versioning and provenance* only. Prompt **evaluation** (quality
  metrics, A/B experiments, rollback policy) is intentionally kept out of this ADR and evolves
  independently — so experimentation policy doesn't ossify here.
- **Scope boundary:** this ADR governs prompts as *versioned assets* only. Prompt **evaluation**
  (quality metrics, A/B experiments, rollback policy) is intentionally kept out of this ADR and evolves
  independently, so experimentation policy never ossifies inside a governance decision.

## Consequences
- AI output is attributable and reproducible; prompt diffs are reviewed like schema diffs.
- Prompt experimentation pairs with feature flags; lineage (`derived_from`) is an additive future field.
- Prompt changes are part of the Contract Freeze, not the Design Layer.

## Enforced by
Prompt review process; `prompt_registry` FK from AI artifacts; CONTRIBUTING "Add/change a prompt".
