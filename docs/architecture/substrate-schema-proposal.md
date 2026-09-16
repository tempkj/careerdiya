# Substrate Schema Proposal (pre-review — not yet a migration)

**Status:** Awaiting review. Do not create `019_role_substrate.sql` until this is approved.  
**Governance:** Requires migration under Contract Freeze (ADR-011 is the governing ADR).

---

## Key design — role_key, not onet_code

**The natural key is `(role_key, region)` — a normalized free-text label, not an O*NET code.**

`onet_code` is a nullable grounding attribute, exactly as it is everywhere else in the schema
(`activation_session.onet_code`, `knowledge.skill.onet_code`, Twin aspiration `onetCode`).
Keying on `onet_code` would silently exclude every role O*NET lacks — creator, influencer,
AI-era roles, and any role coined after O*NET's 2018/2019 backbone. This is the coverage gap
VISION.md §4 explicitly designed against.

### Normalization rule

```
role_key = lower(trim(desired_role))
```

Applied at write time by the application layer (SubstrateStore) before insert/lookup.
Same input always produces the same key. Human-readable for debugging. Does not conflate
synonyms ("PM" ≠ "product manager") — synonym resolution is an AI-layer concern at generation
time, not a key concern.

---

## Proposed table: `knowledge.role_substrate`

```sql
-- 019: Role substrate store — base intelligence layer (ADR-011)
-- Sits in the knowledge schema alongside onet_occupation and skill.
-- No user_id — shared reference data, not user-owned. No RLS needed.

CREATE TABLE knowledge.role_substrate (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Natural key: one substrate per normalized role label + region
  -- role_key = lower(trim(desired_role)), computed by the application before insert
  role_key       text        NOT NULL,
  region         text        NOT NULL DEFAULT 'IN',

  -- Optional O*NET grounding — nullable, same pattern as activation_session.onet_code
  -- Set when a confident O*NET match exists; NULL for modern/novel roles. Never the key.
  onet_code      text        REFERENCES knowledge.onet_occupation(onet_code) ON DELETE SET NULL,

  -- Content (versioned JSONB — shape governed by schema_version)
  payload        jsonb       NOT NULL,

  -- Provenance
  basis          text        NOT NULL CHECK (basis IN ('grounded', 'inferred')),
  source         text        NOT NULL CHECK (source IN ('mock', 'crawl', 'licensed_feed')),
  schema_version text        NOT NULL DEFAULT 'substrate/v1',

  -- Currency
  computed_at    timestamptz NOT NULL DEFAULT now(),
  valid_until    timestamptz,           -- NULL = no structured expiry (v1 acceptable)

  CONSTRAINT role_substrate_natural_key UNIQUE (role_key, region)
);

-- Primary serve path: lookup by normalized role label + region
CREATE INDEX idx_role_substrate_lookup ON knowledge.role_substrate (role_key, region);

-- Optional: find substrate for a known O*NET code (grounding queries, not serve path)
CREATE INDEX idx_role_substrate_onet ON knowledge.role_substrate (onet_code) WHERE onet_code IS NOT NULL;

-- Staleness monitoring query (not a trigger — run from observability/cron):
-- SELECT role_key, region, onet_code, computed_at, valid_until
-- FROM knowledge.role_substrate
-- WHERE valid_until IS NOT NULL AND valid_until < now();
```

---

## Payload shape — `substrate/v1`

Enforced at the application layer (not `pg_jsonschema` in v1 — defer DB-level validation until
the field set stabilises in v2).

```typescript
interface SubstratePayloadV1 {
  // Core skill profile
  skills: Array<{
    name: string;
    canonical_name?: string;
    onet_skill_id?: string;      // links to knowledge.skill if available; absent for novel skills
    proficiency: 'awareness' | 'working' | 'expert';
    criticality: 'required' | 'preferred' | 'differentiating';
    basis: 'grounded' | 'inferred'; // per-skill provenance, not just at substrate level
  }>;

  // Market context (currency-critical — refreshed by crawl/feed)
  market: {
    demand_signal: 'high' | 'moderate' | 'low';
    demand_basis: string;        // e.g. "MoSDE Q1-2026 bulletin" or "AI-inferred, no live signal"
    typical_yoe_range?: [number, number];
    common_entry_paths?: string[];
  };

  // Adjacency hints (used by transition computation — role_key references, not onet_code)
  adjacent_roles?: Array<{
    role_key: string;            // normalized label of adjacent role
    onet_code?: string;          // optional grounding only
    direction: 'lateral' | 'step_up' | 'step_down';
  }>;
}
```

### Adjacency uses role_key, not onet_code

Adjacent role references inside `payload.adjacent_roles` use `role_key` (normalized label),
not `onet_code` — for the same reason: the adjacent role may itself be a novel role O*NET
doesn't have. `onet_code` is an optional hint for grounding queries, not the reference.

### What's NOT in payload
- User gap data — always computed as `userFacts ∩ substrate.skills`, never stored here.
- Transition deltas — always computed on-the-fly from two substrate payloads.
- Salary or compensation — legally sensitive, deferred to licensed feed (Phase 2+).

---

## Mock fixture shape (deterministic, structurally identical to live)

```typescript
// Keyed on role_key (normalized label) — not onet_code
// Mirrors how activation mock keys on lower(desiredRole) keyword
const MOCK_SUBSTRATES: Record<string, SubstratePayloadV1> = {
  'default':          { ... },   // fallback when role_key not in fixture map
  'product manager':  { ... },
  'data scientist':   { ... },
  'ux designer':      { ... },
  'software engineer':{ ... },
  'ai content creator': { ... }, // example novel role with no O*NET code
};
```

Key insight: mock fixtures for novel roles (no O*NET match) are first-class entries, not
edge-case fallbacks. This validates that the store and transition service work correctly for
`onet_code = NULL` substrates before live mode is enabled.

---

## Governance checklist before migration

- [ ] ADR-011 reviewed and approved (including this corrected key design)
- [ ] `pg_jsonschema` validation decision confirmed (app-layer only for v1 — see above)
- [ ] Confirmed no FK from `role_substrate.onet_code` → `onet_occupation` blocks insert for novel roles (`ON DELETE SET NULL` handles occupation row deletion; NULL on insert is fine)
- [ ] `pnpm governance` green after migration file is added
- [ ] Contract tests cover: get/upsert round-trip for a known role, get/upsert for a novel role (onet_code NULL), lazy-fill path (mock mode)
