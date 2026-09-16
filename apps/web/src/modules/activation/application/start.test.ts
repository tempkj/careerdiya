import { describe, it, expect } from 'vitest';
import { toAdjacentRoleSuggestions } from './start';

describe('toAdjacentRoleSuggestions', () => {
  it('maps lateral/step_up entries to {roleKey, direction}, several-entries case', () => {
    const result = toAdjacentRoleSuggestions([
      { role_key: 'product manager', direction: 'lateral' },
      { role_key: 'senior software engineer', direction: 'step_up' },
      { role_key: 'devops engineer', direction: 'lateral' },
    ]);
    expect(result).toEqual([
      { roleKey: 'product manager', direction: 'lateral' },
      { roleKey: 'senior software engineer', direction: 'step_up' },
      { roleKey: 'devops engineer', direction: 'lateral' },
    ]);
  });

  it('never surfaces step_down entries', () => {
    const result = toAdjacentRoleSuggestions([
      { role_key: 'data analyst', direction: 'step_down' },
      { role_key: 'ml engineer', direction: 'lateral' },
      { role_key: 'ai researcher', direction: 'step_up' },
    ]);
    expect(result).toEqual([
      { roleKey: 'ml engineer', direction: 'lateral' },
      { roleKey: 'ai researcher', direction: 'step_up' },
    ]);
    expect(result.some((r) => (r as { direction: string }).direction === 'step_down')).toBe(false);
  });

  it('handles the thin case — a single adjacent entry — gracefully', () => {
    const result = toAdjacentRoleSuggestions([{ role_key: 'ai product manager', direction: 'step_up' }]);
    expect(result).toEqual([{ roleKey: 'ai product manager', direction: 'step_up' }]);
  });

  it('returns an empty array for an empty adjacent_roles list', () => {
    expect(toAdjacentRoleSuggestions([])).toEqual([]);
  });

  it('returns an empty array when adjacent_roles is undefined (older/thin substrate)', () => {
    expect(toAdjacentRoleSuggestions(undefined)).toEqual([]);
  });

  it('drops entries entirely when every direction is step_down', () => {
    const result = toAdjacentRoleSuggestions([{ role_key: 'data analyst', direction: 'step_down' }]);
    expect(result).toEqual([]);
  });
});
