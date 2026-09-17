-- Fix B (state-contamination) data remediation — UNAPPLIED, pending sign-off.
-- Do not run against any environment, local or hosted, without explicit approval.
--
-- ── Background ──────────────────────────────────────────────────────────────────────
-- Before the code fix (commit b441da1), setCurrentRole() was called unconditionally by
-- renderResults() for every audience, with:
--     isOther = !!effectiveCurrentRole && !isBoundedRole
--   where
--     isBoundedRole = !!(effectiveCurrentRole && audience === 'professional' && isBoundedRoleValue(...))
--
-- isBoundedRole can only be true when audience === 'professional'. So for ANY
-- parent/student render that picked up a leaked role (via the removed
-- 'careerdiya_current_role' localStorage fallback), isBoundedRole was always false,
-- which made isOther always true — meaning a leaked write ALWAYS landed in
-- core.profile.current_role_other, and current_role_title was architecturally
-- unreachable by this leak (it is only ever written when isBoundedRole is true, which
-- requires audience === 'professional'). current_role_title therefore needs no
-- remediation from this specific bug. This script targets current_role_other only.
--
-- ── Predicate ───────────────────────────────────────────────────────────────────────
-- A row is flagged when ALL of:
--   1. current_role_other IS NOT NULL (something to remove)
--   2. The account has NEVER logged a professional-audience exploration
--      (core.career_diya_exploration.audience = 'professional') — conservative: any
--      account with genuine professional history is left alone entirely, since we
--      cannot cleanly separate "professional wrote this via Other" from "a later
--      non-professional render leaked into it" for a mixed-history account.
--   3. profile.updated_at falls within 60 seconds of SOME non-professional exploration's
--      completed_at for that same account — this is the actual evidentiary link: it
--      reproduces the fact that setCurrentRole's upsert (which sets updated_at) and
--      saveExploration's insert (which sets completed_at) fire from the same
--      renderResults() call, moments apart. A manual, legitimate edit via profile.html's
--      saveProfile() would have an updated_at uncorrelated with any exploration's
--      completed_at, and should NOT match this window.
--
-- ── Known risk (explicitly flagged, not resolved) ──────────────────────────────────
-- The schema has no column recording WHICH code path last wrote current_role_other, so
-- this predicate is inference, not certainty. A student/parent account that has NEVER
-- had a professional exploration AND happened to manually type something into
-- profile.html's "Other" field within 60 seconds of finishing an exploration (e.g. saved
-- their profile right after completing the free explorer, in the same sitting) would be
-- indistinguishable from a genuinely leaked row and would be incorrectly nulled. I
-- believe this is rare in practice (profile.html is a separate, deliberate page visit,
-- not a step in the explore.html flow), but it is a real false-positive path, not a
-- theoretical one. Widen or narrow the time window below if you want a different
-- precision/recall tradeoff before approving.

-- ── Step 1: PREVIEW (read-only) — run this first, review the rows/count, before anyone
-- considers step 2. ─────────────────────────────────────────────────────────────────
SELECT
  p.user_id,
  p.current_role_other,
  p.audience            AS profile_signup_audience,
  p.updated_at           AS profile_updated_at,
  matched.audience       AS matched_exploration_audience,
  matched.completed_at   AS matched_exploration_completed_at,
  abs(extract(epoch FROM (p.updated_at - matched.completed_at))) AS seconds_apart
FROM core.profile p
JOIN LATERAL (
  SELECT e.audience, e.completed_at
  FROM core.career_diya_exploration e
  WHERE e.user_id = p.user_id
    AND e.audience <> 'professional'
    AND abs(extract(epoch FROM (p.updated_at - e.completed_at))) < 60
  ORDER BY abs(extract(epoch FROM (p.updated_at - e.completed_at))) ASC
  LIMIT 1
) matched ON true
WHERE p.current_role_other IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM core.career_diya_exploration pe
    WHERE pe.user_id = p.user_id AND pe.audience = 'professional'
  )
ORDER BY seconds_apart ASC;

-- Row count only, for a quick headline number:
-- SELECT count(*) FROM ( <same query as above> ) t;

-- ── Step 2: REMEDIATION (destructive — do not run without sign-off) ────────────────
-- Nulls current_role_other only. Never attempts to re-derive/guess a "correct" value —
-- per instruction, absence is the safe state, not a fabricated replacement.
--
-- UPDATE core.profile p
-- SET current_role_other = NULL,
--     updated_at = now()
-- FROM (
--   SELECT p2.user_id
--   FROM core.profile p2
--   JOIN LATERAL (
--     SELECT e.completed_at
--     FROM core.career_diya_exploration e
--     WHERE e.user_id = p2.user_id
--       AND e.audience <> 'professional'
--       AND abs(extract(epoch FROM (p2.updated_at - e.completed_at))) < 60
--     ORDER BY abs(extract(epoch FROM (p2.updated_at - e.completed_at))) ASC
--     LIMIT 1
--   ) matched ON true
--   WHERE p2.current_role_other IS NOT NULL
--     AND NOT EXISTS (
--       SELECT 1 FROM core.career_diya_exploration pe
--       WHERE pe.user_id = p2.user_id AND pe.audience = 'professional'
--     )
-- ) affected
-- WHERE p.user_id = affected.user_id;
