import { describe, expect, it } from 'vitest';
import { validateAndRepairGapAnalysis } from './gapAnalysisCache';

describe('validateAndRepairGapAnalysis', () => {
  it('keeps the Career Diya-selected destination authoritative', () => {
    const result = validateAndRepairGapAnalysis(
      {
        desiredPosition: { role: 'Software Engineer', onetCode: '15-1252.00' },
        currentTopSkills: ['communication'],
        gap: [{ skill: 'domain knowledge', have: false, confidence: { value: 0.6, basis: 'inferred' } }],
        firstAction: 'Review three job postings.',
      },
      'Renewable Energy Engineering',
      'Renewable Energy Engineering',
    );

    expect(result.desiredPosition.role).toBe('Renewable Energy Engineering');
    expect(result.desiredPosition.onetCode).toBe('15-1252.00');
  });

  it('falls back to the requested role when the model omits desiredPosition.role', () => {
    const result = validateAndRepairGapAnalysis(
      {
        desiredPosition: { onetCode: null },
        gap: [{ skill: 'domain knowledge', have: false, confidence: { value: 0.5, basis: 'inferred' } }],
        firstAction: 'Review three job postings.',
      },
      'Backend Developer',
    );

    expect(result.desiredPosition.role).toBe('Backend Developer');
  });
});
