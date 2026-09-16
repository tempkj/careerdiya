import { describe, it, expect } from 'vitest';
import { validateAndRepairSubstrate } from './substrateValidation';

function validSkill(name: string, overrides: Record<string, unknown> = {}) {
  return { name, proficiency: 'working', criticality: 'required', basis: 'inferred', ...overrides };
}

function validRaw(overrides: Record<string, unknown> = {}) {
  return {
    skills: [
      validSkill('skill one'),
      validSkill('skill two'),
      validSkill('skill three'),
      validSkill('skill four'),
      validSkill('skill five'),
      validSkill('skill six'),
    ],
    market: { demand_signal: 'high', demand_basis: 'AI-inferred, India market, no live signal' },
    ...overrides,
  };
}

describe('validateAndRepairSubstrate', () => {
  it('accepts a well-formed payload unchanged in shape', () => {
    const result = validateAndRepairSubstrate(validRaw());
    expect(result.skills).toHaveLength(6);
    expect(result.market.demand_signal).toBe('high');
  });

  it('throws on a non-object root', () => {
    expect(() => validateAndRepairSubstrate('not an object')).toThrow(/expected a JSON object/);
    expect(() => validateAndRepairSubstrate(null)).toThrow();
    expect(() => validateAndRepairSubstrate([1, 2, 3])).toThrow();
  });

  // ── skills ──────────────────────────────────────────────────────────────────

  it('forces basis: inferred on every skill regardless of model claim', () => {
    const raw = validRaw({
      skills: [
        validSkill('a', { basis: 'grounded' }),
        validSkill('b'),
        validSkill('c'),
        validSkill('d'),
        validSkill('e'),
        validSkill('f'),
      ],
    });
    const result = validateAndRepairSubstrate(raw);
    expect(result.skills.every((s) => s.basis === 'inferred')).toBe(true);
  });

  it('strips onet_skill_id even if the model invents one', () => {
    const raw = validRaw({
      skills: [
        validSkill('a', { onet_skill_id: '15-1252.00-1' }),
        validSkill('b'),
        validSkill('c'),
        validSkill('d'),
        validSkill('e'),
        validSkill('f'),
      ],
    });
    const result = validateAndRepairSubstrate(raw);
    expect(result.skills[0]).not.toHaveProperty('onet_skill_id');
  });

  it('drops a skill with no name', () => {
    const raw = validRaw({
      skills: [
        { proficiency: 'working', criticality: 'required', basis: 'inferred' }, // no name
        validSkill('b'),
        validSkill('c'),
        validSkill('d'),
        validSkill('e'),
        validSkill('f'),
        validSkill('g'),
      ],
    });
    const result = validateAndRepairSubstrate(raw);
    expect(result.skills).toHaveLength(6);
    expect(result.skills.some((s) => s.name === 'b')).toBe(true);
  });

  it('enum-coerces an invalid proficiency/criticality to a safe default', () => {
    const raw = validRaw({
      skills: [
        validSkill('a', { proficiency: 'guru', criticality: 'vital' }),
        validSkill('b'),
        validSkill('c'),
        validSkill('d'),
        validSkill('e'),
        validSkill('f'),
      ],
    });
    const result = validateAndRepairSubstrate(raw);
    expect(result.skills[0]!.proficiency).toBe('working');
    expect(result.skills[0]!.criticality).toBe('preferred');
  });

  it('dedups skills by normalized name, first occurrence wins', () => {
    const raw = validRaw({
      skills: [
        validSkill('Python', { proficiency: 'expert' }),
        validSkill('  python  ', { proficiency: 'awareness' }), // same name, different case/whitespace
        validSkill('b'),
        validSkill('c'),
        validSkill('d'),
        validSkill('e'),
        validSkill('f'),
      ],
    });
    const result = validateAndRepairSubstrate(raw);
    const pythonSkills = result.skills.filter((s) => s.name.trim().toLowerCase() === 'python');
    expect(pythonSkills).toHaveLength(1);
    expect(pythonSkills[0]!.proficiency).toBe('expert'); // first occurrence wins
  });

  it('throws when skill count is below the minimum (6) after dedup', () => {
    const raw = validRaw({ skills: [validSkill('a'), validSkill('b'), validSkill('c')] });
    expect(() => validateAndRepairSubstrate(raw)).toThrow(/skills count out of bounds/);
  });

  it('throws when skill count exceeds the maximum (12)', () => {
    const skills = Array.from({ length: 13 }, (_, i) => validSkill(`skill ${i}`));
    expect(() => validateAndRepairSubstrate(validRaw({ skills }))).toThrow(/skills count out of bounds/);
  });

  it('throws when dedup collapses the count below the minimum', () => {
    // 8 raw entries but only 3 unique names — must throw, not silently accept a thin result
    const raw = validRaw({
      skills: [
        validSkill('a'), validSkill('a'), validSkill('a'),
        validSkill('b'), validSkill('b'), validSkill('b'),
        validSkill('c'), validSkill('c'),
      ],
    });
    expect(() => validateAndRepairSubstrate(raw)).toThrow(/skills count out of bounds/);
  });

  // ── market ──────────────────────────────────────────────────────────────────

  it('throws when market is missing entirely', () => {
    const raw = validRaw();
    delete (raw as Record<string, unknown>)['market'];
    expect(() => validateAndRepairSubstrate(raw)).toThrow(/market must be an object/);
  });

  it('throws when market.demand_basis is missing', () => {
    const raw = validRaw({ market: { demand_signal: 'high' } });
    expect(() => validateAndRepairSubstrate(raw)).toThrow(/demand_basis is required/);
  });

  it('enum-coerces an invalid demand_signal to moderate', () => {
    const raw = validRaw({ market: { demand_signal: 'extreme', demand_basis: 'some basis' } });
    const result = validateAndRepairSubstrate(raw);
    expect(result.market.demand_signal).toBe('moderate');
  });

  it('keeps well-formed typical_yoe_range and common_entry_paths, drops malformed ones', () => {
    const raw = validRaw({
      market: {
        demand_signal: 'high',
        demand_basis: 'basis',
        typical_yoe_range: [1, 5],
        common_entry_paths: ['path a', 'path b', 123, null],
      },
    });
    const result = validateAndRepairSubstrate(raw);
    expect(result.market.typical_yoe_range).toEqual([1, 5]);
    expect(result.market.common_entry_paths).toEqual(['path a', 'path b']);
  });

  // ── adjacent_roles ──────────────────────────────────────────────────────────

  it('omits adjacent_roles entirely when absent', () => {
    const result = validateAndRepairSubstrate(validRaw());
    expect(result.adjacent_roles).toBeUndefined();
  });

  it('normalizes a non-lowercase role_key rather than rejecting it', () => {
    const raw = validRaw({ adjacent_roles: [{ role_key: '  Data Analyst  ', direction: 'lateral' }] });
    const result = validateAndRepairSubstrate(raw);
    expect(result.adjacent_roles).toEqual([{ role_key: 'data analyst', direction: 'lateral' }]);
  });

  it('drops an adjacent_roles entry with an invalid direction', () => {
    const raw = validRaw({
      adjacent_roles: [
        { role_key: 'data analyst', direction: 'sideways' },
        { role_key: 'data scientist', direction: 'step_up' },
      ],
    });
    const result = validateAndRepairSubstrate(raw);
    expect(result.adjacent_roles).toEqual([{ role_key: 'data scientist', direction: 'step_up' }]);
  });

  it('strips a model-invented onet_code on adjacent_roles', () => {
    const raw = validRaw({
      adjacent_roles: [{ role_key: 'data analyst', direction: 'lateral', onet_code: '15-2041.00' }],
    });
    const result = validateAndRepairSubstrate(raw);
    expect(result.adjacent_roles![0]).not.toHaveProperty('onet_code');
  });

  // ── degenerate root-level onet_code (payload has no such field) ────────────────

  it('never surfaces a model-invented top-level onet_code (payload type has no such field)', () => {
    const raw = validRaw({ onet_code: '15-1252.00' });
    const result = validateAndRepairSubstrate(raw) as unknown as Record<string, unknown>;
    expect(result['onet_code']).toBeUndefined();
  });
});
