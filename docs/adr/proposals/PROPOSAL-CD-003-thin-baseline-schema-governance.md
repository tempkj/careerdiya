# Career Diya Thin Baseline — Contract/Schema Governance Amendment

**Status:** Proposed; not approved  
**Related ADR:** ADR-CD-003 — Thin Career Baseline and Exploration Routing  
**Scope:** Career Diya profile persistence and parent/child context separation

## Gap

The existing `core.profile.audience` field and exploration snapshot `audience` field do not represent the same concept. The first has been used as a persistent profile/journey value, while the second records the audience under which a particular exploration was answered. Reusing either for confirmed career stage would be semantically incorrect. The current profile columns also do not express employment status, education stage versus highest completed qualification, or whether the baseline is sufficient for initial guidance.

A parent exploring for a child must not write the child's education/work history into the parent's personal profile.

## Proposed logical profile fields

- `career_stage`: `pre_first_career | recent_graduate | professional | returning_to_work`
- `employment_status`: `employed | between_jobs | self_employed | not_working_by_choice | not_applicable | unknown`
- `education_stage`: `school | undergraduate | postgraduate | completed_education | other | unknown`
- `highest_completed_qualification`: free-text or governed qualification vocabulary (decision required)
- `field_of_study_or_stream`: free-text or governed taxonomy (decision required)
- `further_education_status`: `not_pursuing | considering | admitted | pursuing | completed | unknown`
- `baseline_completeness`: `thin | extended`

Existing fields such as `current_role_title`, `experience_years`, `education_level`, and `field_of_study` should be reused only when their semantics are genuinely equivalent. Avoid duplicate values that can drift.

## Parent/child separation

Introduce a separately owned child-context record (not a second user account by default) for a parent's exploration. It should be scoped to the authenticated parent, support only the minimum education/work baseline, and use RLS to prevent cross-account access. A child who later creates their own account should have an explicit linking/consent flow; do not silently merge parent-entered data into the child's personal profile.

## API and vocabulary impact

Before implementation of physical schema/API fields:
1. Architecture review this proposal against `contracts/careerasana_openapi_v1.yaml`, `packages/db/vocab.json`, generated API types, and current Supabase schema.
2. Decide whether the thin baseline remains an internal Career Diya persistence capability or is exposed through `/api/v1`. If exposed, amend the contract through the governed version-bump process; do not hand-edit generated types.
3. Approve canonical enum values and update vocabulary parity tests if the values enter shared contracts.
4. Define the profile-write and child-context access policy, including RLS and whether direct browser access to `core.profile` remains supported.
5. Confirm migration/backfill behavior for existing users and null values.

## Acceptance criteria

- Exploration audience remains immutable on each exploration snapshot.
- Career stage is based on confirmed baseline, not entry-point choice or education enrolment alone.
- Being between jobs does not erase professional history; further education does not automatically make a professional a student.
- Parent and child baselines are stored separately.
- Results remain gated until authentication and baseline persistence succeed.
- Migration is additive/backward-compatible; existing users can complete a thin baseline progressively.
- Contract validation, Spectral lint, enum parity, module-boundary checks, and relevant regression tests pass.

## Explicitly not approved by this proposal

This document does not itself authorize a database migration, API contract change, or production rollout. Those require the repository's normal governance approval.