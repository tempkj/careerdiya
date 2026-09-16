import type {
  SubstratePayloadV1,
  SubstrateSkill,
  SubstrateMarket,
  SubstrateAdjacentRole,
} from '../domain/types';

// Ports and hardens scripts/substrate/validate.mjs's validateAndSanitise for the on-demand
// (in-request) generation path. That script validates offline, human-reviewed batch output;
// this validates untrusted live model output written straight into shared reference data
// (knowledge.role_substrate) with no human in the loop — every gap here is a gap a future
// user's transition computation inherits silently. Hardened to the same standard as
// identificationCache.ts's validateAndRepairIdentification/Assessment: enum-coerce where a
// safe default exists, drop what can't be trusted, throw rather than persist a degenerate
// result.

const PROFICIENCY = new Set<SubstrateSkill['proficiency']>(['awareness', 'working', 'expert']);
const CRITICALITY = new Set<SubstrateSkill['criticality']>(['required', 'preferred', 'differentiating']);
const DEMAND = new Set<SubstrateMarket['demand_signal']>(['high', 'moderate', 'low']);
const DIRECTION = new Set<SubstrateAdjacentRole['direction']>(['lateral', 'step_up', 'step_down']);

const NAME_MAX_LEN = 200;
const DEMAND_BASIS_MAX_LEN = 300;
const ENTRY_PATH_MAX_LEN = 200;
const MAX_ENTRY_PATHS = 6;
const MAX_ADJACENT_ROLES = 8;

// Real seeded substrates run 8-9 skills; the generation prompt asks for 6-12. Bound to that
// range rather than the old offline validator's floor-of-4 — a live-generated substrate this
// thin or this bloated is more likely a bad generation than a genuinely sparse/rich role, and
// this is shared reference data, not a one-off — worth rejecting and retrying over accepting.
const MIN_SKILLS = 6;
const MAX_SKILLS = 12;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function boundedString(value: unknown, maxLen: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLen) : '';
}

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

function repairSkill(raw: unknown): SubstrateSkill | null {
  const row = asRecord(raw);
  const name = boundedString(row?.['name'], NAME_MAX_LEN);
  if (!name) return null; // no name to ground against — drop, same rule as identification's skillName check

  const canonicalRaw = boundedString(row?.['canonical_name'], NAME_MAX_LEN);

  const proficiency = PROFICIENCY.has(row?.['proficiency'] as SubstrateSkill['proficiency'])
    ? (row!['proficiency'] as SubstrateSkill['proficiency'])
    : 'working';
  const criticality = CRITICALITY.has(row?.['criticality'] as SubstrateSkill['criticality'])
    ? (row!['criticality'] as SubstrateSkill['criticality'])
    : 'preferred';

  return {
    name,
    ...(canonicalRaw ? { canonical_name: canonicalRaw } : {}),
    proficiency,
    criticality,
    // FORCED, never taken from model output — v1 is knowledge-only generation, not O*NET
    // crawl-anchored. A model claiming 'grounded' here would be an unverified, uncheckable
    // lie stamped as fact into shared reference data. onet_skill_id is dropped entirely
    // (not just defaulted) — same reasoning: an invented skill-level O*NET reference is
    // worse than none, since it carries false authority downstream.
    basis: 'inferred',
  };
}

function repairMarket(raw: unknown): SubstrateMarket {
  const row = asRecord(raw);
  if (!row) throw new Error('validateAndRepairSubstrate: market must be an object');

  const demand_basis = boundedString(row['demand_basis'], DEMAND_BASIS_MAX_LEN);
  if (!demand_basis) throw new Error('validateAndRepairSubstrate: market.demand_basis is required');

  const demand_signal = DEMAND.has(row['demand_signal'] as SubstrateMarket['demand_signal'])
    ? (row['demand_signal'] as SubstrateMarket['demand_signal'])
    : 'moderate';

  const market: SubstrateMarket = { demand_signal, demand_basis };

  const yoe = row['typical_yoe_range'];
  if (Array.isArray(yoe) && yoe.length === 2 && typeof yoe[0] === 'number' && typeof yoe[1] === 'number') {
    market.typical_yoe_range = [yoe[0], yoe[1]];
  }

  const paths = row['common_entry_paths'];
  if (Array.isArray(paths)) {
    const clean = paths
      .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      .map((p) => p.trim().slice(0, ENTRY_PATH_MAX_LEN))
      .slice(0, MAX_ENTRY_PATHS);
    if (clean.length > 0) market.common_entry_paths = clean;
  }

  return market;
}

function repairAdjacentRoles(raw: unknown): SubstrateAdjacentRole[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const repaired = raw
    .map((item): SubstrateAdjacentRole | null => {
      const row = asRecord(item);
      const roleKeyRaw = boundedString(row?.['role_key'], NAME_MAX_LEN);
      if (!roleKeyRaw) return null;
      if (!DIRECTION.has(row?.['direction'] as SubstrateAdjacentRole['direction'])) return null;

      return {
        // Normalize rather than reject — the offline validator rejected non-normalized
        // role_key outright; hardened here to repair it instead, since a capitalization
        // slip is not a reason to drop an otherwise-good adjacency.
        role_key: normalizeSkillName(roleKeyRaw),
        direction: row!['direction'] as SubstrateAdjacentRole['direction'],
        // onet_code deliberately omitted — same v1-knowledge-only-no-invented-O*NET-refs
        // stance as skills[].onet_skill_id above.
      };
    })
    .filter((r): r is SubstrateAdjacentRole => r !== null)
    .slice(0, MAX_ADJACENT_ROLES);

  return repaired.length > 0 ? repaired : undefined;
}

// Throws (does not return a degenerate payload) if nothing usable survives — this table is
// shared reference data read by every future transition involving this role; a substrate
// silently repaired down to near-nothing would be a worse outcome than a loud failure the
// caller can retry or surface.
export function validateAndRepairSubstrate(raw: unknown): SubstratePayloadV1 {
  const root = asRecord(raw);
  if (!root) throw new Error('validateAndRepairSubstrate: expected a JSON object');

  const rawSkills = Array.isArray(root['skills']) ? root['skills'] : [];
  const repairedSkills = rawSkills.map(repairSkill).filter((s): s is SubstrateSkill => s !== null);

  // Dedup by normalized name, first occurrence wins. Doing this HERE — at generation-validation
  // time — means computeTransition's from/to skill maps (transition.ts) can never receive a
  // substrate with duplicate names in the first place; addresses the "computeTransition
  // duplicate skill names — silent last-write-wins" backlog item at the source rather than
  // papering over it downstream.
  const seen = new Set<string>();
  const dedupedSkills: SubstrateSkill[] = [];
  for (const skill of repairedSkills) {
    const key = normalizeSkillName(skill.name);
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedSkills.push(skill);
  }

  if (dedupedSkills.length < MIN_SKILLS || dedupedSkills.length > MAX_SKILLS) {
    throw new Error(
      `validateAndRepairSubstrate: skills count out of bounds — got ${dedupedSkills.length} (after dedup), expected ${MIN_SKILLS}-${MAX_SKILLS}`,
    );
  }

  const market = repairMarket(root['market']);
  const adjacent_roles = repairAdjacentRoles(root['adjacent_roles']);

  return {
    skills: dedupedSkills,
    market,
    ...(adjacent_roles ? { adjacent_roles } : {}),
  };
  // Note: no top-level onet_code ever appears here even if the model invented one —
  // SubstratePayloadV1 has no onet_code field at all (it lives on the DB row, sourced from
  // the seed/caller, never from payload), so a model-invented root-level onet_code is
  // naturally dropped simply by never reading root['onet_code']. Explicit strip, not implicit
  // luck: this comment documents that omission as intentional, matching the offline
  // validator's explicit `const { onet_code: _stripped, ...rest } = raw` stance.
}
