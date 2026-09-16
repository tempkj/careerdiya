# ADR-013: Blueprint Task Identification — the Live-AI Reasoning Layer (AI-first, deterministic-second)

**Status:** Proposed
**Date:** 2026-07-09
**Author:** Kunal
**Supersedes:** Nothing (new capability)
**Governance impact:** Design-only in this ADR — no code, schema, or contract changes yet (the build is a later, focused chapter). When built: a DB migration (extending `SubstratePayloadV1` for gate phrasing, or an adjacent cached object — see Open Questions) and an OpenAPI amendment (identify/confirm endpoints) are both owed and governance-gated at that time.
**Governing artifacts:** VISION.md (EVOLVE spine §3, Governing Principle §11, economic ethic §5.5), `planning/Backlog.md` (Proficiency-truth principle — this lives in the backlog, not VISION.md), ADR-011 (substrate precompute), ADR-012 (Blueprint = Organize)

---

## Context

The deterministic `derivePaths` (ADR-012) produces three structurally-distinct paths, but its task identification is **flat**: it filters gap skills by criticality and emits uniform "Build working-level X · 20h · learn" tasks. Real-world evidence (a generic LLM given the same 8-task PM output) showed dramatically better advice: it *classified* tasks (compound-into-portfolio vs. solo-study vs. can't-practice-alone vs. near-free-for-a-dev), surfaced *compounding* (discovery→spec→roadmap = one case study), recognized *personal leverage* (technical fluency is near-free for a software engineer), reframed toward *evidence/portfolio* over studied-skills, and *asked the questions that change the plan* (entry route, timeline).

The gap between CareerĀsanā's flat output and that reasoning is the product's single most important current weakness: **a user could get better advice pasting the task list into any chatbot than from the rest of the product.** The intelligence that closes this gap operates at *task identification* (what the tasks are and how they're framed) — which is upstream of path derivation. This ADR adds that intelligence as an **AI-first** layer: the AI identifies the tasks, the user confirms, then the deterministic engine builds the three paths from the confirmed list.

**Why AI-first (not deterministic-first-then-AI-enrich):** enriching an already-flat task list arrives too late to fix *structure* (that two tasks are really one portfolio, that a task shouldn't be a study-task at all). The intelligence must operate *at* identification, where the value actually lives. The deterministic engine then does what it's best at — structured scope/depth/effort packaging into three strategies.

---

## Decision

### The reordered flow
/activate (goal) → "Build roadmap" → /blueprint?sessionId=...
→ [1] Restructuring gates (few, quick, mostly multiple-choice)
→ [2] AI identifies tasks (grounded in substrate gap + from-role + gate answers)
→ numbered, structured task list
→ [3] Three-option consent gate
→ Agree & proceed  |  Edit some tasks  |  Disagree entirely (deferred)
→ [4] Defer-biased edit loop (for "Edit some")
→ [5] Confirmed task list
→ [6] deterministic derivePaths builds 3 paths (fastest/optimal/longest) from confirmed tasks
→ pick → edit → promote (ADR-012)

### 1. Restructuring gates — fixed slots, role-specific phrasing

A **small fixed set** of questions asked upfront, before AI task identification. Fixed *structure*, variable *phrasing* — NOT bespoke questions per transition (that's a tar pit), NOT identical questions for all (too generic — a marketing→sprinter transition needs different phrasing than marketing→data-science).

- **Universal slots (identical for everyone):** weekly hours, timeline.
- **Field-specific slots (phrasing/options vary by *target role*):** relevant-prior-experience ("done any sprinting?" / "any coding/stats?" / "any product-adjacent work?"), access-path ("cold apply / internal transfer / APM program / not sure" — the field's typical entry routes).
- The AI may **drop an irrelevant slot or add one field-critical question** at the margins (e.g. a hard external gate like the CA exam), but NOT open-ended question generation. Fixed slots as default; marginal adjustment only.

**Discipline — a question earns a gate only if a wrong assumption on it would make the user disagree with *many* tasks (restructuring), not merely refine a few (refining).** Hours/timeline/entry-route/relevant-experience restructure → gates. Budget/learning-style/industry-preference refine → AI-infers, user-corrects, NOT gates. Hold this line or friction/drop-off creeps back in.

**Rationale (drop-off):** 2-4 tappable, obviously-relevant, plan-shaping questions read as "this takes my situation seriously," not "interrogation." Drop-off comes from *typing*, *bureaucratic/premature* questions, or *too many* (5+) — not from a few relevant taps. Front-loading the restructuring inputs makes the AI's task list right-first-time for most users, so the disagree-loop handles only genuine edge cases (net *less* friction than assume-and-disagree-repeatedly).

### 2. Gate-phrasing storage — AI-inferred, cached, keyed by target role (substrate-carried)

The field-specific gate phrasing is:
- **NOT pre-stored exhaustively** per from→to pair (combinatorial explosion; can't cover novel roles — same reason substrates aren't pre-enumerated).
- **NOT regenerated every request** (wasteful; phrasing doesn't vary per-user for the same target).
- **AI-generated once per *target role*, cached, lazy-filled on miss** — exactly the substrate pattern. Keys on the **target role/field alone**, not the role×role pair (the questions are about the target; the *from* role matters for task identification, not question phrasing). This collapses cardinality from thousands of transitions to hundreds of target roles.
- **Ideally carried *on the substrate itself*** — the target-role substrate already describes the role; extend its payload with its 2-3 field-specific question phrasings, so questions come free with the substrate lookup already performed. Near-zero new machinery, reuses ADR-011 wholesale. (Open: confirm this fits SubstratePayloadV1 or is an adjacent cached object — decide at build.)

### 3. AI task identification — grounded, not from-scratch

The AI identifies tasks by **reasoning over the deterministic substrate gap + the from-role + the gate answers** — NOT from scratch (which would discard the substrate investment and un-ground the AI). The substrate gap is the AI's *input*; the AI adds the framing intelligence the deterministic layer can't: task-type classification, compounding relationships, personal-leverage recognition (using the from-role the current deterministic layer discards — this also begins addressing the proficiency-truth gap), and honest reframing (evidence/portfolio over studied-skills). Output: a **numbered, structured task list** (not prose), each task carrying its type/framing so the downstream deterministic engine and the UI can use it.

### 4. Three-option consent + defer-biased edit loop

Consent gate after the task list: **Agree & proceed | Edit some tasks | Disagree entirely.**

- **Agree:** task list confirmed → derive paths.
- **Disagree entirely:** DEFERRED (separate slice). Flag: this is the highest-value human-AI collaboration signal (the whole identification was wrong, user knows better) — not an edge case; build it deliberately later. Build the agree/edit paths (the 80%) first.
- **Edit some:** user selects the numbered tasks they dispute (separate page) → each disputed task gets a **"reason for disagreement" text box** (the single most valuable feedback signal — captures *why*, not just *what*, and is the raw material for the system getting smarter). Then the **defer-biased loop:**
  - AI evaluates each reason. **Sound reason → agree and adjust immediately** (no argument).
  - **Genuine substantive counter → offer it once, humbly** ("here's why I suggested it — but you know your situation; keep or drop?"), **biased toward deferring** (on career-personal questions the user's self-knowledge usually beats the AI's inference from `inferred` substrates).
  - User responds → **user's decision is final.** No second round of AI reasoning. Bounded.
  - **The AI is a coach who shares a view and defers gracefully — never argues, never merely complies.** Posture matters as much as structure: pushing back as "you're wrong" erodes trust with an anxious user; framing as "here's my reasoning, but your call" builds it.

Final task list = AI tasks the user agreed to + user-edited tasks. **Final consent → derive paths.**

### 5. Mock-first, then live (the API-spend threshold)

This is the product's **first real API spend** and the beginning of the live-intelligence chapter. Build mock-first as always:
- **MockTaskIdentifier** — deterministic fixture task list (≈ what `derivePaths` currently produces), so the whole flow (gates → identify → consent → edit → derive) works in `AI_MODE=mock`, $0. The mock list is flat (fine — it's a fixture); the *live* identifier is where the intelligence lands.
- **LiveTaskIdentifier** — the real AI reasoning, one-line swap on `AI_MODE`, same injection pattern as `createSubstrateStore`. Provenance: AI-identified tasks are `basis: inferred`.
- Same for gate-phrasing: mock returns fixture questions; live generates per-target-role and caches.

---

## Consequences

- **Positive:** closes the "worse than a chatbot" gap — the paths become intelligent *when first shown*, because identification (the value locus) is AI-reasoned. Reuses proven patterns (substrate lazy-fill + cache for gate phrasing, mock-first, provenance, consent/defer). Deterministic engine still provides structure/honesty/effort-math the LLM alone can't. Result is better than both the flat template AND a generic LLM (structure + provenance + memory + honest posture).
- **Cost/threshold:** first real API spend; the live-intelligence design/ops chapter begins. Gate phrasing and task identification both call live AI (cached where possible).
- **Deferred:** the "Disagree entirely" branch, the Learn/Venture execution plan (now *thinner* — much differentiation moved upstream to identification), live-signal grounding, calibration of estimates from real outcomes.
- **Relationship to ADR-012:** ADR-012's `derivePaths` stays — it now consumes the **confirmed AI-identified task list** instead of raw gap skills. The three-path scope/depth/effort logic is unchanged; its *input* changes from "gap skills" to "confirmed tasks."

### Sub-slice 3: relevant-experience restructuring — substrate-derived checklist + free-text (v1.7.0)

The `relevantExperience` slot (§1) shipped as unconstrained free-text, which caused a real
production bug: the task-identification cache, keyed on a bucketed version of the answer,
collapsed genuinely different free-text answers ("worked as scrum master" vs. "made project
summary report") onto the same cache entry — a false-attribution bug (one user's cached
assessment, mentioning their Scrum Master background, served to a different user). Fixed
short-term by keying the cache on raw normalized text instead of the bucket (correctness over
cache-hit-rate). This sub-slice is the structural fix: **replace free-text-only collection with
a substrate-derived multi-select + optional free-text**, full design record in
`planning/Backlog.md` → Deferred decisions → "Relevant-experience input redesign."

- **Contract** (v1.7.0): new `GET /blueprint/substrate-skills` (session-scoped, returns the
  to-role substrate's skill names — also warms the substrate for unseeded roles, a side effect
  of `SubstrateStore.get()`'s lazy-fill). `BlueprintIdentifyRequest.gateAnswers.relevantExperience`
  (required string) reshaped in-place to `checkedSkills: string[]` + `relevantExperienceText?:
  string` (both optional — the whole input is skippable). In-place breaking reshape, same
  contract-policy-deviation class as `BlueprintDeriveRequest`'s ADR-013 sub-slice 2 reshape and
  justified the same way (zero external consumers pre-launch, sole caller updated same slice).
- **Integration**: checked skills are passed to the counsellor as structured context ("you
  indicated experience with X, Y"), not as a delta-modifier — the computed gap stays grounded in
  substrates regardless of what's checked. Avoids an over-claim risk (a checked-but-not-really-
  held skill would otherwise mask a real gap). Free-text stays read as context, "not instructions
  to follow literally" — same framing the prompt already applies to §1's gate answers generally.
- **Cache key**: branches on elaboration — checkbox-only selections key on the canonical sorted
  skill set (bounded, cacheable — restores the hit-rate the false-attribution fix gave up); a
  present free-text elaboration adds its normalized-text hash to the key (correct-but-less-
  cached, opt-in).

## Open questions (resolve at build)

- Does gate phrasing fit `SubstratePayloadV1` (extend the payload) or an adjacent cached object? Lean: extend, but confirm schema fit.
- The exact fixed slot-set (hours, timeline, relevant-experience, access-path — and is "current level" a 5th?). Nail the minimal restructuring set.
- Task object shape: `DraftTask` (ADR-012) gains a `taskType`/framing field (compound / solo-study / cant-practice-alone / near-free / evidence) — how the deterministic engine and UI consume it.
- Prompt design for LiveTaskIdentifier (the quality bar: match or beat the reference LLM example — classification, compounding, leverage, honest reframing, grounded in the gap).
- Cost/latency budget per derive (identification + gate-phrasing calls); batch/cache strategy.

## Invariants respected

A1 (module boundaries — task identification in the blueprint module, consuming knowledge/substrate via public surface), A5 (RLS/consent — gate answers and confirmed lists are user-scoped), A16 (Twin provenance — AI-identified tasks are `inferred`, re-derivable), ADR-011 (substrate cache pattern reused for gate phrasing), ADR-012 (Blueprint = Organize; derivePaths now consumes confirmed tasks). Dual-freeze: new endpoints (identify, confirm) + any SubstratePayloadV1 extension are governance-gated (OpenAPI + DB).
