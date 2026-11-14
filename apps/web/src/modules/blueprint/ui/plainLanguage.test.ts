import { describe, expect, it } from 'vitest';
import { categoryLabel, plainText, taskMetaLine } from './plainLanguage';

describe('plainLanguage', () => {
  it('turns task codes into readable labels', () => {
    expect(taskMetaLine({ evolveCategory: 'engage', criticality: 'preferred', taskType: 'cant_practice_alone' })).toBe(
      'Engage · Nice to have · Needs real-world practice',
    );
    expect(taskMetaLine({ evolveCategory: 'learn', criticality: 'required', taskType: 'solo_study' })).toBe(
      'Learn · Required · Study on your own',
    );
  });

  it('never shows raw placeholders for missing values', () => {
    const line = taskMetaLine({ evolveCategory: 'venture', criticality: null, taskType: null });
    expect(line).toBe('Venture · Added to round out the plan');
    expect(line).not.toMatch(/system-added|unclassified/);
  });

  it('labels categories', () => {
    expect(categoryLabel('visualize')).toBe('Visualise');
    expect(categoryLabel('organize')).toBe('Organise');
  });

  it('removes internal code words from AI explanations', () => {
    const out = plainText(
      'Almost every candidate skill is netNew. This is cant_practice_alone in spirit; the tooling part is near-free.',
    );
    expect(out).toBe(
      "Almost every candidate skill is new to you. This is can't be practised alone in spirit; the tooling part is almost free.",
    );
    expect(plainText(null)).toBe('');
  });
});
