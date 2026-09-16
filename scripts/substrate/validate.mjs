#!/usr/bin/env node
// Shared validation for SubstratePayloadV1.
// Zero external dependencies — structural checks only.

const PROFICIENCY = new Set(['awareness', 'working', 'expert']);
const CRITICALITY = new Set(['required', 'preferred', 'differentiating']);
const BASIS       = new Set(['grounded', 'inferred']);
const DEMAND      = new Set(['high', 'moderate', 'low']);
const DIRECTION   = new Set(['lateral', 'step_up', 'step_down']);

/**
 * Validates and sanitises a raw parsed object as SubstratePayloadV1.
 *
 * Sanitisation rules (fix 1 from plan review):
 *   - Any top-level 'onet_code' field on the raw object is stripped — onet_code is a seed
 *     attribute, never a model-generated field.
 *   - 'onet_skill_id' inside skill entries is stripped — the prompt omits it; if the model
 *     invents one we don't want unverified O*NET references in the base table.
 *
 * Returns { valid: true, payload } or { valid: false, errors: string[] }.
 */
export function validateAndSanitise(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['payload must be a JSON object'] };
  }

  // Strip model-invented onet_code at the payload root (should not be there, but guard it)
  const { onet_code: _stripped, ...rest } = raw;

  // ── skills ────────────────────────────────────────────────────────────────────

  if (!Array.isArray(rest.skills) || rest.skills.length === 0) {
    errors.push('skills must be a non-empty array');
  } else {
    rest.skills = rest.skills.map((s, i) => {
      const prefix = `skills[${i}]`;
      if (typeof s.name !== 'string' || !s.name.trim()) {
        errors.push(`${prefix}.name must be a non-empty string`);
      }
      if (!PROFICIENCY.has(s.proficiency)) {
        errors.push(`${prefix}.proficiency must be awareness|working|expert, got ${JSON.stringify(s.proficiency)}`);
      }
      if (!CRITICALITY.has(s.criticality)) {
        errors.push(`${prefix}.criticality must be required|preferred|differentiating, got ${JSON.stringify(s.criticality)}`);
      }
      if (!BASIS.has(s.basis)) {
        errors.push(`${prefix}.basis must be grounded|inferred, got ${JSON.stringify(s.basis)}`);
      }
      // Strip onet_skill_id — prompt excludes it; don't store unverified O*NET refs
      const { onet_skill_id: _omit, ...clean } = s;
      return clean;
    });

    if (rest.skills.length < 4) {
      errors.push(`skills must have at least 4 entries, got ${rest.skills.length}`);
    }
  }

  // ── market ────────────────────────────────────────────────────────────────────

  if (!rest.market || typeof rest.market !== 'object') {
    errors.push('market must be an object');
  } else {
    if (!DEMAND.has(rest.market.demand_signal)) {
      errors.push(`market.demand_signal must be high|moderate|low, got ${JSON.stringify(rest.market.demand_signal)}`);
    }
    if (typeof rest.market.demand_basis !== 'string' || !rest.market.demand_basis.trim()) {
      errors.push('market.demand_basis must be a non-empty string');
    }
    if (rest.market.typical_yoe_range !== undefined) {
      const r = rest.market.typical_yoe_range;
      if (!Array.isArray(r) || r.length !== 2 || typeof r[0] !== 'number' || typeof r[1] !== 'number') {
        errors.push('market.typical_yoe_range must be [number, number]');
      }
    }
    if (rest.market.common_entry_paths !== undefined) {
      if (!Array.isArray(rest.market.common_entry_paths) ||
          rest.market.common_entry_paths.some((p) => typeof p !== 'string')) {
        errors.push('market.common_entry_paths must be an array of strings');
      }
    }
  }

  // ── adjacent_roles ────────────────────────────────────────────────────────────

  if (rest.adjacent_roles !== undefined) {
    if (!Array.isArray(rest.adjacent_roles)) {
      errors.push('adjacent_roles must be an array');
    } else {
      rest.adjacent_roles.forEach((r, i) => {
        const prefix = `adjacent_roles[${i}]`;
        if (typeof r.role_key !== 'string' || !r.role_key.trim()) {
          errors.push(`${prefix}.role_key must be a non-empty string`);
        } else {
          // Enforce normalization: role_key must already be lowercase+trimmed
          const normalized = r.role_key.trim().toLowerCase();
          if (r.role_key !== normalized) {
            errors.push(`${prefix}.role_key must be normalized lowercase (got "${r.role_key}", expected "${normalized}")`);
          }
        }
        if (!DIRECTION.has(r.direction)) {
          errors.push(`${prefix}.direction must be lateral|step_up|step_down, got ${JSON.stringify(r.direction)}`);
        }
      });
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, payload: rest };
}
