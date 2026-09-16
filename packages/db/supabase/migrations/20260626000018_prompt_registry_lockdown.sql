-- 018: Lock down knowledge.prompt_registry — revoke public read access
--
-- The prompt_registry contains internal AI prompt templates (IP).
-- It was inadvertently readable by all authenticated and anon users because:
--   - migration 002 granted SELECT on all knowledge.* tables to authenticated + anon
--   - migration 014 added a prompt_read policy with USING (true)
--
-- The server reads prompt_registry exclusively via the service role (which bypasses
-- both privileges and RLS), so removing public access does not break any app path.
-- This mirrors the audit_log lockdown (privilege-level block, not just RLS).

-- Step 1: revoke table-level SELECT privilege (first gate — hits before RLS)
REVOKE SELECT ON knowledge.prompt_registry FROM authenticated, anon;

-- Step 2: drop the open SELECT policy (now redundant, but explicit is better)
DROP POLICY IF EXISTS prompt_read ON knowledge.prompt_registry;

-- careerasana_worker retains full access via the existing prompt_worker policy.
-- careerasana_readonly retains SELECT via its schema-level grant (internal tooling).
