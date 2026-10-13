# ADR-CD-003 — Thin Career Baseline and Exploration Routing

**Status:** Accepted for implementation planning  
**Date:** 13 Oct 2026  
**Scope:** Career Diya home-page audience selection, account onboarding, free exploration results, and transition-lens context.

## Context

The home-page choice (Parent, Student, Professional) is an entry journey, not sufficient evidence of a person's actual career stage. The current journey can collect answers under one exploration audience while the user's real education/work-history baseline points to another starting point. Conflating those values can produce an inappropriate result or transition comparison.

Career Diya's career transition lens is a core differentiator and must be shown whenever the result has a meaningful starting point and recommended destination. The user must create an account before seeing the result. Onboarding should establish a thin, reliable baseline—not require completion of the full profile.

This decision refines the context hierarchy in ADR-CD-002. It does not replace the existing recommendation algorithm.

## Decisions

### 1. Preserve three independent concepts

- **Exploration audience**: the journey the user selected at entry and the context under which their exploration answers were collected.
- **Career baseline**: the user's confirmed current education/work-history reality.
- **Recommended destination**: the career direction selected by the recommendation engine from the completed exploration answers.

Never use one field to represent all three. Preserve the original exploration audience and answers as part of the immutable exploration snapshot. Do not silently reinterpret answers collected under a different audience.

### 2. Account creation precedes result reveal

Required sequence:

1. Visitor chooses Parent, Student, or Professional.
2. Visitor completes the relevant exploration questions.
3. The result remains gated until account creation/sign-in.
4. During first-time onboarding, collect the minimum baseline fields needed for a grounded transition lens.
5. Persist the account/profile and baseline successfully.
6. Generate/reveal the result using the saved exploration answers for the destination and the confirmed baseline for the starting point.
7. Save the result as an exploration snapshot.

For email-confirmation flows, preserve the pending exploration and return the user to baseline onboarding after authentication. Do not reveal the result merely because sign-up was submitted; wait until authentication and required baseline persistence succeed. Existing users with a saved baseline should not be forced through first-time onboarding again.

### 3. Canonical context fields

The logical model is:

| Field | Meaning | Requirement |
|---|---|---|
| `exploration_audience` | `parent`, `student`, or `professional` selected for this exploration | Required on each exploration snapshot |
| `career_stage` | `pre_first_career`, `recent_graduate`, `professional`, or `returning_to_work` | Required for a person's baseline when known; otherwise explicitly unknown |
| `employment_status` | `employed`, `between_jobs`, `self_employed`, `not_working_by_choice`, `not_applicable`, or `unknown` | Conditional on career stage; not a proxy for career stage |
| `current_or_most_recent_role` | User's role/designation, preserving the original wording | Required for professional/returning baseline when available; otherwise unknown |
| `total_experience` | Bounded duration bucket, not a falsely precise number | Required for professional/returning baseline when available |
| `education_stage` | School / undergraduate / postgraduate / completed education / other, using controlled values | Required for student and recent-graduate baseline; optional for experienced professionals unless needed |
| `highest_completed_qualification` | Highest qualification already completed | Ask when it helps disambiguate current education from completed education |
| `field_of_study_or_stream` | Stream/major/field of study | Ask when relevant to the user's education stage or transition |
| `further_education_status` | Not pursuing / considering / admitted / pursuing / completed | Conditional follow-up; e.g. an MBA does not change a work-experienced user's `career_stage` |
| `baseline_completeness` | Thin / extended, or an equivalent explicit completeness indicator | Used to distinguish known facts from missing optional detail |

These are the canonical logical names. Before adding physical columns, inspect the existing `core.profile`, education and experience tables. Reuse existing columns when their semantics match. If a new column or enum is needed, amend the frozen DB/API contract and add a migration; do not smuggle new semantics into `audience` or unrelated JSON.

### 4. Conditional thin-baseline questions

Ask only the relevant branch:

- **Pre-first-career student:** current stage (e.g. Class 11–12 / in college), stream/major where applicable, and whether any meaningful internship/work experience exists.
- **Recent graduate:** highest completed qualification, field of study, and whether any relevant work experience exists.
- **Professional:** current or most recent role and total professional experience. Industry/role family may be reused if already reliably known.
- **Returning to work:** previous/most recent role, total experience, and confirm returning-to-work status.
- **Experienced professional pursuing further education:** keep career stage as professional; optionally capture education status, programme/type, and field/specialization. Do not infer a career-switch intent from enrolment alone.
- **Parent journey:** collect the child's education/career baseline for recommendations. If the parent's own career baseline is collected, store it against a distinct person/profile identity, never as fields on the child's profile.

Ask for previous roles, detailed skills, projects, certifications, institution, graduation year, MBA specialization, and other extended information progressively when it materially improves a specific exploration or assessment.

### 5. Mismatch handling

The exploration audience does not automatically overwrite the career baseline, and the baseline does not erase the exploration answers.

Example: someone selects Professional but confirms they are still studying and have not established a professional work history. Preserve the professional exploration answers, use the confirmed student/education baseline as the transition-lens starting point, and avoid claiming professional experience or transferable workplace capabilities without evidence.

If the selected journey caused questions to be asked under assumptions that are no longer valid, preserve the raw answers and their original meaning. Ask only the minimum clarifying question needed; do not silently remap or discard answers.

### 6. Transition lens rules

For each recommended destination:

- **Starting point** comes from the confirmed baseline.
- **Destination** comes from the completed recommendation algorithm.
- **Transition type, transferable capabilities, gaps, and next sensible step** are derived only from supported baseline and destination data.
- A student baseline may yield an education/stream-to-career lens; a professional baseline may yield an adjacent, lateral, upward, broader, or restart lens as supported by the role mapping.
- Unknown context must be labelled unknown or omitted—not invented.
- Keep directional guidance distinct from a validated match score or proof of proficiency.

### 7. Home-page routing

After onboarding, use the confirmed baseline to set the default home-page journey:

- `pre_first_career` / `recent_graduate` → Student journey by default.
- `professional` / `returning_to_work` → Professional journey by default.
- Parent journey remains independently available to anyone who wants guidance for their child.

A professional pursuing an MBA remains a professional for their own career guidance. A work-experienced person between jobs remains a professional; employment status does not erase work history. A parent selecting the Parent journey should not have their own career stage overwritten by the child's stage.

### 8. Parent/child identity boundary

A parent and child are separate people, with separate career baselines and exploration histories. Model the parent-child relationship explicitly. Do not store the parent's education/work history inside the child's profile. A parent may later create/use a separate personal career profile; the implementation must not require a second account just to keep the two person records distinct.

## Implementation sequence

1. Add/verify regression fixtures for mismatched exploration audience vs. baseline and for experienced professionals pursuing further education.
2. Confirm the existing DB columns and semantics; produce any required contract amendment and migration before using new persisted fields.
3. Implement a reusable baseline resolver and first-time conditional onboarding step after authentication but before result reveal.
4. Persist the pending exploration safely across email confirmation/sign-in; reveal the result only after baseline save succeeds.
5. Route the transition lens using baseline + recommendation destination while preserving the exploration audience in the immutable snapshot.
6. Update home-page defaults only after profile routing is covered by tests.
7. Test Parent/child separation, existing-user return paths, email confirmation, social sign-in, missing/partial baseline, and failed persistence.

## Non-goals

- Do not replace or retune the free recommendation algorithm as part of this context-routing change.
- Do not require a complete CV or every optional profile field during onboarding.
- Do not remove the Parent journey from the home page.
- Do not classify someone as a student merely because they are pursuing further education.
- Do not reveal results before account creation/authentication and successful baseline persistence.
