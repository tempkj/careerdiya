# ADR-010 — Decouple Activation Save from Twin Signal Flush

**Status:** Accepted  
**Date:** 2026-06-29  
**Author:** Kunal  
**Supersedes:** Partial behavior of `POST /activation/complete` as described in ADR-001 (signals-only Twin write path)

---

## Context

`POST /activation/complete` was originally implemented to do two things in a single call:

1. Set `completed_at` on the `activation_session` row (immutable once set — invariant A17).
2. Flush the session's facts into the Twin as signals (`desired_role`, `current_role`, each `gap_item`) by calling `insertSignal × N` and then `deriveTwin`.

This conflation created two problems as the product moved toward a three-layer exploration model:

**Problem 1 — No exploration library.** A user had one activation path: answer questions → get gap analysis → press complete → Twin updated. There was no way to save an exploration for later, compare multiple role targets, or choose which one to promote. Every completion immediately overwrote the Twin.

**Problem 2 — Contradictory UI state.** A "completed" session showed a "Twin restored" badge, implying the Twin always reflected the session. With multiple sessions this became incorrect: completing session B would silently overwrite the Twin facts from session A with no indication in the UI.

---

## Decision

Split `POST /activation/complete` into two separate, sequenced actions:

### Action 1 — Save exploration (`POST /activation/complete`)
Sets `completedAt` only. Does **not** touch the Twin. The session becomes a frozen exploration artifact (A17 immutability applies from this point). The journey records steps up to `first_action`; the `signals_created` step is no longer emitted for new sessions (it remains in the enum for backward compatibility with pre-v1.2.0 sessions).

### Action 2 — Promote to goal (`POST /activation/{sessionId}/promote`)
The **only** action that flushes activation facts into the Twin. Reads the frozen session, calls `insertSignal` for each fact (with `sourceRef = sessionId` for provenance), then calls `deriveTwin`. Can be called only on a saved session (`completedAt IS NOT NULL`); returns 409 on a draft. Idempotent — re-promoting the same session emits newer signals that win via last-write-wins fold (no state check needed).

This preserves all Twin invariants from ADR-001:
- Twin changes **only** via signals → `deriveTwin`. No direct write.
- Promote reads (never writes) the frozen session row — A17 is not violated.
- The fold is unchanged: `aspiration.targetRole` remains one scalar, last-write-wins by `occurred_at`.

---

## Three-Layer Model

| Layer | What it is | Cardinality | Touches Twin? |
|---|---|---|---|
| Draft | `activation_session` with `completedAt = null` | Many per user | Never |
| Saved exploration | `activation_session` with `completedAt` set | Many per user | Never (until promoted) |
| The Twin | One coherent self-model (`core.twin`) | One per user | Only via `promote` → signals |

---

## Provenance Trace (active goal indicator)

When promote runs, each signal is inserted with `source_ref = sessionId`. This makes the active goal resolvable without any new state:

```
twin.aspiration.targetRole.source  →  signal UUID
core.twin_signal WHERE id = signal  →  source_ref = session UUID
```

`GET /activation` resolves this chain server-side and returns `activeGoalSessionId: string | null` alongside the session list. Clients use it to badge the active goal and show a "Replace goal" confirmation before promoting a different session.

### Existing-data caveat

The five signals created by the pre-v1.2.0 `completeActivation` have `source_ref = null` (the field was not passed). For existing users, `activeGoalSessionId` will be `null` even though the Twin has an aspiration. No migration is needed: users re-promote any saved session via the new endpoint, which restores provenance. Zero production users are affected at this stage.

---

## Resume behavior for drafts

A draft stores `desired_role`, `current_role`, `onet_code`, `gap[]`, `first_action` in the DB. The UI reconstructs the result view from this data without a new AI call or a new session. The only field absent on resume is `topSkills` (AI-derived current-role skills), which is not persisted — the "Current strengths" chips do not render on resumed drafts. This is tracked in the backlog for a future schema amendment.

---

## Contract impact

**`contracts/careerasana_openapi_v1.yaml` amended from v1.1.1 → v1.2.0:**
- `POST /activation/start` description: remove "seeds the Twin via signals" (it never did).
- `POST /activation/complete` description: remove "flushing captured facts into the Twin as signals"; document new save-only semantics.
- New: `GET /activation` — list drafts + saved explorations, returns `ActivationSessionList` (includes `activeGoalSessionId`).
- New: `POST /activation/{sessionId}/promote` — the promotion action.
- New schemas: `ActivationSessionList`, `PromoteAck`.

---

## Consequences

**Positive:**
- Users can explore multiple role targets before committing one to the Twin.
- The Twin is only updated by deliberate "set as goal" actions, not incidentally by saving a session.
- Provenance is complete: every Twin fact traces to the signal that set it, which traces to the session that produced it.
- The fold, RLS, and all other invariants are untouched.

**Negative / accepted:**
- The `signals_created` journey step is now a legacy value — new sessions will not have it.
- Drafts resumed via the UI do not show "Current strengths" (topSkills not stored).
- Pre-v1.2.0 sessions have `source_ref = null` on their signals; `activeGoalSessionId` is null for those users until they re-promote.

---

## Alternatives Considered

**Keep flush in complete, add separate promote:** Would leave two code paths that both flush, making last-write-wins behavior depend on call order in the client. Rejected.

**Add a `is_active_goal` boolean to `activation_session`:** Schema change (requires DB migration + governance). Also violates A17 spirit — it would make the session mutable post-completion (to unset the flag). Rejected in favor of the provenance trace, which is derivable without new state.
