# ADR-014: Defer the Gap-Analysis + Blueprint Merge

**Status:** Accepted (deferral, not a rejection)
**Date:** 2026-09-17
**Author:** Kunal (via Claude Code)
**Supersedes:** Nothing
**Governance impact:** None — this ADR authorizes no code change. It records why a
previously-scoped change is *not* being made in this slice, so the gap doesn't read as an
oversight.

## Context

`POST /activation/start` (`start.ts`) and `POST /blueprint/identify` (`taskIdentifier.ts`)
each make their own Anthropic call — gap analysis (~2-4¢) and task identification. Both are
free today, so merging them into one call was proposed as a cost optimization (roughly
halving this flow's inference cost and removing a round-trip).

Inspection found a structural blocker: gap analysis fires at `/activation/start`, **before**
the user has answered anything gate-related. Task identification fires later, at
`/blueprint/identify`, and specifically consumes `gateAnswers` — a skill checklist
(`checkedSkills`, sourced from `GET /blueprint/substrate-skills`) plus optional
`relevantExperienceText`, both collected on the **blueprint page**
(`BlueprintForm.tsx:188-286`), which the user only reaches after reviewing the gap-analysis
result on a separate screen.

`gateAnswers` is optional — `{}` is a valid, complete submission (`route.ts` comment,
`blueprint/identify/route.ts:21-23`) — so a naive merge that always fires with empty gate
answers would be harmless for users who skip that step. But for users who *do* fill it in,
that data genuinely does not exist yet at gap-analysis time under the current page flow. A
merge can only use real gate answers if their collection moves earlier in the activation
flow — a UI change to `ActivationForm.tsx` (fetch the substrate-skills checklist, show it,
collect answers), not a pure backend/prompt change.

## Decision

**Defer the merge.** Do now, in this slice:

- Fix the unrelated hardcoded model in `taskIdentifier.ts` (`'claude-opus-4-8'` literal →
  `AI_TASK_IDENTIFICATION_MODEL` env var, `src/lib/ai.ts`, same default) — isolated,
  low-risk, and was bundled with the merge proposal but doesn't depend on it.

Do not do now:

- Move gate-answer collection into `ActivationForm.tsx`.
- Merge `callGapAnalysisModel` + `callTaskIdentificationModel` into one call.

**Reason:** CareerĀsanā is the paid/deeper execution layer (both calls are gated behind
`hasCareerAsanaAccess`), not the cost-sensitive free surface this quarter's effort is
targeted at (see the parallel CareerDiya free-tier work, ADR-CAREERDIY-0015). A UX change to
the activation flow, plus the regression risk of a merged prompt that must still hold both
calls' existing invariants (fail-loud-on-empty, gap analysis's simpler cache key becoming a
subset of identification's gate-answer-aware key, `desiredPosition.role` staying
user-supplied-authoritative), is not worth taking on for a saving that only matters once
CareerĀsanā's paid volume is large enough for the per-call cost to be a meaningful line
item. Revisit when that volume materializes, or when the activation flow gets a UX pass for
an unrelated reason that could absorb the gate-answer-earlier change at no extra cost.
