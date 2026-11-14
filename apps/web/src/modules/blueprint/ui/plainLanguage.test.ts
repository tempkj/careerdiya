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
    expect(plainText('Almost every candidate skill is netNew.')).toBe('Almost every candidate skill is new to you.');
    expect(plainText('This is cant_practice_alone in spirit.')).toBe(
      "This is something you can't practise alone in spirit.",
    );
    expect(plainText('That part is near-free, but this isn\'t near-free.')).toBe(
      "That part is a quick win, but this isn't a quick win.",
    );
    expect(plainText('the netNew part is interpreting prices')).toBe('the new part is interpreting prices');
    expect(plainText(null)).toBe('');
  });

  it('capitalises acronyms in lower-cased skill names', () => {
    expect(plainText('Build working-level farmer and fpo engagement')).toBe(
      'Build working-level farmer and FPO engagement',
    );
    expect(plainText('Build awareness-level sql and p&l basics')).toBe('Build awareness-level SQL and P&L basics');
    expect(plainText('Interview farmers at two fpos')).toBe('Interview farmers at two FPOs');
  });
});
