export interface SubstrateSkill {
  name: string;
  canonical_name?: string;
  onet_skill_id?: string;          // links to knowledge.skill if available; absent for novel skills
  proficiency: 'awareness' | 'working' | 'expert';
  criticality: 'required' | 'preferred' | 'differentiating';
  basis: 'grounded' | 'inferred';  // per-skill provenance
}

export interface SubstrateMarket {
  demand_signal: 'high' | 'moderate' | 'low';
  demand_basis: string;            // e.g. "MoSDE Q1-2026 bulletin" | "AI-inferred, no live signal"
  typical_yoe_range?: [number, number];
  common_entry_paths?: string[];
}

export interface SubstrateAdjacentRole {
  role_key: string;                // normalized label — never onet_code (coverage gap risk)
  onet_code?: string;              // optional grounding hint only
  direction: 'lateral' | 'step_up' | 'step_down';
}

// Versioned payload stored in knowledge.role_substrate.payload (schema_version = 'substrate/v1')
export interface SubstratePayloadV1 {
  skills: SubstrateSkill[];
  market: SubstrateMarket;
  adjacent_roles?: SubstrateAdjacentRole[];
}

// Domain representation of a knowledge.role_substrate row
export interface RoleSubstrate {
  id: string;
  roleKey: string;
  region: string;
  onetCode: string | null;
  payload: SubstratePayloadV1;
  basis: 'grounded' | 'inferred';
  source: 'mock' | 'crawl' | 'licensed_feed' | 'ai_generated';
  schemaVersion: string;
  computedAt: string;
  validUntil: string | null;
}

// What a SubstrateGenerator returns — SubstrateStore handles the DB write
export interface GeneratedSubstrate {
  payload: SubstratePayloadV1;
  basis: 'grounded' | 'inferred';
  source: 'mock' | 'crawl' | 'licensed_feed' | 'ai_generated';
  onetCode: string | null;
  validUntil: string | null;
}

export interface SubstrateGenerator {
  generate(roleKey: string, region: string): Promise<GeneratedSubstrate>;
}

// ── Transition types ───────────────────────────────────────────────────────────

export type Proficiency = 'awareness' | 'working' | 'expert';

// Skill present in both substrates where the from-role develops it below the to-role's demand.
// proficiency (inherited from SubstrateSkill) = required level (to-role's demand)
// currentProficiency = what the from-role develops — the delta is (currentProficiency → proficiency)
export interface UpskillSkill extends SubstrateSkill {
  currentProficiency: Proficiency;
}

export interface TransitionDelta {
  fromRoleKey: string;
  toRoleKey: string;
  transferable: SubstrateSkill[]; // in both; from_proficiency >= to_proficiency → free
  upskill:      UpskillSkill[];   // in both; from_proficiency < to_proficiency → depth gap visible
  netNew:       SubstrateSkill[]; // in to only → acquire from scratch
  retained:     SubstrateSkill[]; // in from only → existing assets outside target's core
  difficulty:   'low' | 'moderate' | 'high';
  computedAt:   string;
}
