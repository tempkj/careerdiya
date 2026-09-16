import { describe, it, expect } from 'vitest';
import { computeTransition } from './transition';
import type { SubstratePayloadV1, SubstrateSkill } from '../domain/types';

function skill(
  name: string,
  proficiency: SubstrateSkill['proficiency'],
  criticality: SubstrateSkill['criticality'] = 'required',
): SubstrateSkill {
  return { name, proficiency, criticality, basis: 'inferred' };
}

function payload(skills: SubstrateSkill[]): SubstratePayloadV1 {
  return { skills, market: { demand_signal: 'moderate', demand_basis: 'test' } };
}

const META = { fromRoleKey: 'software engineer', toRoleKey: 'product manager' };

// ── Partitioning ───────────────────────────────────────────────────────────────

describe('computeTransition — partitioning', () => {
  it('skill only in to → netNew', () => {
    const from = payload([skill('sql', 'working')]);
    const to   = payload([skill('roadmapping', 'working')]);
    const d = computeTransition(from, to, META);
    expect(d.netNew.map((s) => s.name)).toContain('roadmapping');
    expect(d.transferable).toHaveLength(0);
    expect(d.upskill).toHaveLength(0);
  });

  it('skill only in from → retained (existing asset, not deprecated)', () => {
    const from = payload([skill('sql', 'working'), skill('system design', 'awareness')]);
    const to   = payload([skill('roadmapping', 'working')]);
    const d = computeTransition(from, to, META);
    expect(d.retained.map((s) => s.name)).toContain('sql');
    expect(d.retained.map((s) => s.name)).toContain('system design');
  });

  it('skill in both, from_proficiency >= to_proficiency → transferable', () => {
    const from = payload([skill('sql', 'expert')]);
    const to   = payload([skill('sql', 'working')]);
    const d = computeTransition(from, to, META);
    expect(d.transferable.map((s) => s.name)).toContain('sql');
    expect(d.upskill).toHaveLength(0);
  });

  it('skill in both at equal proficiency → transferable', () => {
    const from = payload([skill('communication', 'working')]);
    const to   = payload([skill('communication', 'working')]);
    const d = computeTransition(from, to, META);
    expect(d.transferable).toHaveLength(1);
    expect(d.upskill).toHaveLength(0);
  });

  it('skill overlaps by name but from_proficiency < to_proficiency → upskill, NOT transferable', () => {
    const from = payload([skill('data analysis', 'awareness')]);
    const to   = payload([skill('data analysis', 'expert')]);
    const d = computeTransition(from, to, META);
    expect(d.upskill.map((s) => s.name)).toContain('data analysis');
    expect(d.transferable).toHaveLength(0);
  });

  it('upskill carries both proficiency values — delta is visible', () => {
    const from = payload([skill('data analysis', 'awareness')]);
    const to   = payload([skill('data analysis', 'expert')]);
    const d = computeTransition(from, to, META);
    const item = d.upskill[0]!;
    expect(item.currentProficiency).toBe('awareness');  // from-role level
    expect(item.proficiency).toBe('expert');             // to-role demand
  });

  it('all four buckets populate correctly in a mixed payload', () => {
    const from = payload([
      skill('sql', 'expert'),           // in both, from >= to → transferable
      skill('python', 'awareness'),     // in both, from < to → upskill
      skill('system design', 'working'), // from only → retained
    ]);
    const to = payload([
      skill('sql', 'working'),          // to requirement (lower)
      skill('python', 'working'),       // to requirement (higher than from)
      skill('roadmapping', 'working'),  // to only → netNew
    ]);
    const d = computeTransition(from, to, META);
    expect(d.transferable.map((s) => s.name)).toEqual(['sql']);
    expect(d.upskill.map((s) => s.name)).toEqual(['python']);
    expect(d.netNew.map((s) => s.name)).toEqual(['roadmapping']);
    expect(d.retained.map((s) => s.name)).toEqual(['system design']);
  });
});

// ── Difficulty ─────────────────────────────────────────────────────────────────

describe('computeTransition — difficulty', () => {
  it('0 required work → low', () => {
    const from = payload([skill('sql', 'expert')]);
    const to   = payload([skill('sql', 'working')]);
    expect(computeTransition(from, to, META).difficulty).toBe('low');
  });

  it('1 required netNew → low', () => {
    const from = payload([]);
    const to   = payload([skill('roadmapping', 'working', 'required')]);
    expect(computeTransition(from, to, META).difficulty).toBe('low');
  });

  it('2 required items (netNew + upskill) → moderate', () => {
    const from = payload([skill('sql', 'awareness')]);
    const to   = payload([
      skill('sql', 'expert', 'required'),      // upskill (required)
      skill('roadmapping', 'working', 'required'), // netNew (required)
    ]);
    expect(computeTransition(from, to, META).difficulty).toBe('moderate');
  });

  it('required upskill counts toward difficulty — awareness→expert on 3 required skills → high', () => {
    // All skill names match (no netNew), but all below target proficiency
    const from = payload([
      skill('product strategy', 'awareness'),
      skill('stakeholder management', 'awareness'),
      skill('data analysis', 'awareness'),
      skill('roadmapping', 'awareness'),
    ]);
    const to = payload([
      skill('product strategy', 'expert', 'required'),
      skill('stakeholder management', 'working', 'required'),
      skill('data analysis', 'working', 'required'),
      skill('roadmapping', 'working', 'required'),
    ]);
    const d = computeTransition(from, to, META);
    expect(d.netNew).toHaveLength(0);           // no netNew — all names match
    expect(d.upskill).toHaveLength(4);           // all below target
    expect(d.difficulty).toBe('high');           // 4 required upskills
  });

  it('preferred-only gaps do not inflate difficulty', () => {
    const from = payload([]);
    const to   = payload([
      skill('nice-to-have-a', 'awareness', 'preferred'),
      skill('nice-to-have-b', 'awareness', 'preferred'),
      skill('nice-to-have-c', 'awareness', 'preferred'),
      skill('nice-to-have-d', 'awareness', 'preferred'),
      skill('nice-to-have-e', 'awareness', 'preferred'),
    ]);
    expect(computeTransition(from, to, META).difficulty).toBe('low');
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────────

describe('computeTransition — edge cases', () => {
  it('empty from and to → all empty, difficulty low', () => {
    const d = computeTransition(payload([]), payload([]), META);
    expect(d.transferable).toHaveLength(0);
    expect(d.upskill).toHaveLength(0);
    expect(d.netNew).toHaveLength(0);
    expect(d.retained).toHaveLength(0);
    expect(d.difficulty).toBe('low');
  });

  it('empty from (no current role supplied) with a multi-skill to → every skill is netNew, no crash', () => {
    // Exercises the blueprint/derive route's stand-in payload for a blank currentRole:
    // an empty-skills `from` must not crash computeTransition, and every to-skill —
    // regardless of criticality — must land in netNew, not silently drop or misclassify.
    const from = payload([]);
    const to = payload([
      skill('product strategy', 'expert', 'required'),
      skill('stakeholder management', 'working', 'required'),
      skill('user research', 'awareness', 'preferred'),
    ]);
    const d = computeTransition(from, to, META);
    expect(d.netNew.map((s) => s.name).sort()).toEqual(
      ['product strategy', 'stakeholder management', 'user research'].sort(),
    );
    expect(d.transferable).toHaveLength(0);
    expect(d.upskill).toHaveLength(0);
    expect(d.retained).toHaveLength(0);
  });

  it('skill name matching is case-insensitive and trims whitespace', () => {
    const from = payload([skill('  Figma  ', 'expert')]);
    const to   = payload([skill('figma', 'working')]);
    const d = computeTransition(from, to, META);
    expect(d.transferable).toHaveLength(1);
    expect(d.netNew).toHaveLength(0);
  });

  it('novel role (no onet_skill_id on any skill) partitions correctly', () => {
    // Simulates a novel role like 'ai content creator' with no O*NET grounding
    const from = payload([
      { name: 'copywriting', proficiency: 'working', criticality: 'required', basis: 'inferred' },
    ]);
    const to = payload([
      { name: 'prompt engineering', proficiency: 'working', criticality: 'required', basis: 'inferred' },
      { name: 'copywriting', proficiency: 'expert', criticality: 'preferred', basis: 'inferred' },
    ]);
    const d = computeTransition(from, to, META);
    expect(d.netNew.map((s) => s.name)).toContain('prompt engineering');
    expect(d.upskill.map((s) => s.name)).toContain('copywriting');
    expect(d.retained).toHaveLength(0);
  });

  it('meta fields are passed through', () => {
    const d = computeTransition(payload([]), payload([]), META);
    expect(d.fromRoleKey).toBe('software engineer');
    expect(d.toRoleKey).toBe('product manager');
    expect(d.computedAt).toBeDefined();
  });
});
