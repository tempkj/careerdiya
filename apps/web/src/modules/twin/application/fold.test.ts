import { describe, it, expect } from 'vitest';
import { foldSignals, explainPath } from './fold';
import type { Signal } from '../domain/types';

function makeSignal(
  id: string,
  payload: Record<string, unknown>,
  occurredAt: string,
  overrides: Partial<Signal> = {},
): Signal {
  return {
    id,
    userId: 'user-1',
    source: 'system',
    significance: 'major',
    payload,
    applied: false,
    occurredAt,
    ...overrides,
  };
}

describe('foldSignals', () => {
  it('empty signal log yields base Twin with all empty sections', () => {
    const { derived, unmappedSignalIds } = foldSignals([]);
    expect(derived.schemaVersion).toBe('twin/v1');
    expect(derived.identity).toEqual({});
    expect(derived.capability).toEqual({ gaps: {} });
    expect(derived.aspiration).toEqual({});
    expect(derived.constraints).toEqual({});
    expect(derived.growth).toEqual({});
    expect(unmappedSignalIds).toEqual([]);
  });

  it('desired_role signal writes aspiration.targetRole with provenance', () => {
    const s = makeSignal('sig-1', { fact: 'desired_role', role: 'Product Manager', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:00Z');
    const { derived, unmappedSignalIds } = foldSignals([s]);
    expect(derived.aspiration['targetRole']).toMatchObject({
      value: 'Product Manager',
      confidence: { value: 0.9, basis: 'stated' },
      source: 'sig-1',
      capturedAt: '2026-06-28T10:00:00Z',
    });
    expect(unmappedSignalIds).toEqual([]);
  });

  it('current_role signal writes identity.currentRole', () => {
    const s = makeSignal('sig-2', { fact: 'current_role', role: 'Software Engineer', sessionId: 's1', origin: 'activation' }, '2026-06-28T10:00:00Z');
    const { derived } = foldSignals([s]);
    expect(derived.identity['currentRole']).toMatchObject({
      value: 'Software Engineer',
      source: 'sig-2',
    });
  });

  it('last-write-wins: newer desired_role overwrites older at aspiration.targetRole', () => {
    const older = makeSignal('sig-old', { fact: 'desired_role', role: 'Data Analyst', origin: 'activation', sessionId: 's1' }, '2026-06-28T09:00:00Z');
    const newer = makeSignal('sig-new', { fact: 'desired_role', role: 'Product Manager', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:00Z');
    const { derived } = foldSignals([older, newer]);
    expect(derived.aspiration['targetRole']).toMatchObject({
      value: 'Product Manager',
      source: 'sig-new',
    });
  });

  it('desired_role and current_role write to independent sections', () => {
    const desired = makeSignal('sig-d', { fact: 'desired_role', role: 'Product Manager', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:00Z');
    const current = makeSignal('sig-c', { fact: 'current_role', role: 'Engineer', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:01Z');
    const { derived } = foldSignals([desired, current]);
    expect(derived.aspiration['targetRole']?.value).toBe('Product Manager');
    expect(derived.identity['currentRole']?.value).toBe('Engineer');
  });

  it('two gap_item signals for different skills create separate capability.gaps keys', () => {
    const s1 = makeSignal('sig-g1', { fact: 'gap_item', skill: 'Figma', have: false, confidence: { value: 0.8, basis: 'inferred' }, origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:00Z');
    const s2 = makeSignal('sig-g2', { fact: 'gap_item', skill: 'User Research', have: false, confidence: { value: 0.7, basis: 'inferred' }, origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:01Z');
    const { derived } = foldSignals([s1, s2]);
    expect(derived.capability.gaps['Figma']).toBeDefined();
    expect(derived.capability.gaps['User Research']).toBeDefined();
    expect(Object.keys(derived.capability.gaps)).toHaveLength(2);
  });

  it('last-write-wins: newer gap_item overwrites older for the same skill', () => {
    const older = makeSignal('sig-g-old', { fact: 'gap_item', skill: 'Figma', have: false, confidence: { value: 0.5, basis: 'inferred' }, origin: 'activation', sessionId: 's1' }, '2026-06-28T09:00:00Z');
    const newer = makeSignal('sig-g-new', { fact: 'gap_item', skill: 'Figma', have: true, confidence: { value: 0.9, basis: 'stated' }, origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:00Z');
    const { derived } = foldSignals([older, newer]);
    expect(derived.capability.gaps['Figma']).toMatchObject({
      source: 'sig-g-new',
      value: { skill: 'Figma', have: true },
      confidence: { value: 0.9, basis: 'stated' },
    });
  });

  it('unknown payload.fact is in unmappedSignalIds and does not affect Twin', () => {
    const s = makeSignal('sig-u', { fact: 'future_kind', someData: 'x' }, '2026-06-28T10:00:00Z');
    const { derived, unmappedSignalIds } = foldSignals([s]);
    expect(unmappedSignalIds).toContain('sig-u');
    expect(derived.aspiration).toEqual({});
    expect(derived.identity).toEqual({});
  });

  it('missing payload.fact is in unmappedSignalIds', () => {
    const s = makeSignal('sig-n', { note: 'Realized I love discovery phases.' }, '2026-06-28T10:00:00Z');
    const { unmappedSignalIds } = foldSignals([s]);
    expect(unmappedSignalIds).toContain('sig-n');
  });

  it('re-derivability: folding same signals twice yields identical result', () => {
    const signals: Signal[] = [
      makeSignal('sig-1', { fact: 'desired_role', role: 'PM', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:00Z'),
      makeSignal('sig-2', { fact: 'current_role', role: 'Engineer', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:01Z'),
      makeSignal('sig-3', { fact: 'gap_item', skill: 'Figma', have: false, confidence: { value: 0.8, basis: 'inferred' }, origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:02Z'),
    ];
    const first = foldSignals(signals);
    const second = foldSignals(signals);
    expect(first.derived).toEqual(second.derived);
    expect(first.unmappedSignalIds).toEqual(second.unmappedSignalIds);
  });

  it('mixed known and unknown signals: only known contribute; all unknowns listed', () => {
    const known = makeSignal('sig-k', { fact: 'desired_role', role: 'Designer', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:00Z');
    const unknown = makeSignal('sig-u', { fact: 'mystery_event', data: 42 }, '2026-06-28T10:00:01Z');
    const { derived, unmappedSignalIds } = foldSignals([known, unknown]);
    expect(derived.aspiration['targetRole']?.value).toBe('Designer');
    expect(unmappedSignalIds).toEqual(['sig-u']);
  });
});

describe('explainPath', () => {
  const { derived } = foldSignals([
    makeSignal('sig-role', { fact: 'desired_role', role: 'Product Manager', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:00Z'),
    makeSignal('sig-curr', { fact: 'current_role', role: 'Engineer', origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:01Z'),
    makeSignal('sig-gap', { fact: 'gap_item', skill: 'Figma', have: false, confidence: { value: 0.8, basis: 'inferred' }, origin: 'activation', sessionId: 's1' }, '2026-06-28T10:00:02Z'),
  ]);

  it('resolves aspiration.targetRole to its TwinFact', () => {
    const fact = explainPath(derived, 'aspiration.targetRole');
    expect(fact).not.toBeNull();
    expect(fact?.source).toBe('sig-role');
    expect(fact?.value).toBe('Product Manager');
    expect(fact?.capturedAt).toBe('2026-06-28T10:00:00Z');
  });

  it('resolves capability.gaps.Figma to its TwinFact', () => {
    const fact = explainPath(derived, 'capability.gaps.Figma');
    expect(fact).not.toBeNull();
    expect(fact?.source).toBe('sig-gap');
    expect((fact?.value as { skill: string }).skill).toBe('Figma');
  });

  it('returns null for a non-existent path', () => {
    expect(explainPath(derived, 'identity.nonExistent')).toBeNull();
    expect(explainPath(derived, 'growth.something')).toBeNull();
  });
});
