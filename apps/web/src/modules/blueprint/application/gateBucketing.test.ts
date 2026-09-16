import { describe, it, expect } from 'vitest';
import { bucketGateProfile } from './gateBucketing';

describe('bucketGateProfile — timeline', () => {
  it('buckets sub-3-month mentions as urgent', () => {
    expect(bucketGateProfile({ timeline: '2 months', relevantExperienceText: 'some' }).timeline).toBe('urgent');
    expect(bucketGateProfile({ timeline: '6 weeks', relevantExperienceText: 'some' }).timeline).toBe('urgent');
  });

  it('buckets 3-9 month mentions as moderate', () => {
    expect(bucketGateProfile({ timeline: '3 months', relevantExperienceText: 'some' }).timeline).toBe('moderate');
    expect(bucketGateProfile({ timeline: '6 months', relevantExperienceText: 'some' }).timeline).toBe('moderate');
  });

  it('buckets 9+ month mentions as relaxed', () => {
    expect(bucketGateProfile({ timeline: '9 months', relevantExperienceText: 'some' }).timeline).toBe('relaxed');
    expect(bucketGateProfile({ timeline: '2 years', relevantExperienceText: 'some' }).timeline).toBe('relaxed');
  });

  it('buckets absent or unparseable timeline as unspecified', () => {
    expect(bucketGateProfile({ relevantExperienceText: 'some' }).timeline).toBe('unspecified');
    expect(bucketGateProfile({ timeline: '', relevantExperienceText: 'some' }).timeline).toBe('unspecified');
    expect(bucketGateProfile({ timeline: 'whenever works', relevantExperienceText: 'some' }).timeline).toBe(
      'unspecified',
    );
  });
});

describe('bucketGateProfile — relevantExperience (free-text path)', () => {
  it('buckets negation language as none', () => {
    expect(
      bucketGateProfile({ relevantExperienceText: 'I have no experience with this' }).relevantExperience,
    ).toBe('none');
    expect(bucketGateProfile({ relevantExperienceText: 'never done this before' }).relevantExperience).toBe('none');
  });

  it('buckets multi-year/professional language as substantial', () => {
    expect(
      bucketGateProfile({ relevantExperienceText: '5 years of professional experience' }).relevantExperience,
    ).toBe('substantial');
    expect(
      bucketGateProfile({ relevantExperienceText: 'extensive background in this' }).relevantExperience,
    ).toBe('substantial');
  });

  it('defaults ambiguous free text to some', () => {
    expect(bucketGateProfile({ relevantExperienceText: 'a bit here and there' }).relevantExperience).toBe('some');
  });

  it('prefers a concrete duration over an incidental negation clause (regression — found via real harness output)', () => {
    // "never owned a roadmap myself" is a negation about ONE sub-task, not a statement
    // of zero relevant experience — the "4 years" duration should win.
    expect(
      bucketGateProfile({
        relevantExperienceText:
          "I've been a backend engineer for 4 years, working closely with our PM on roadmap and specs, but never owned a roadmap myself.",
      }).relevantExperience,
    ).toBe('substantial');
  });
});

describe('bucketGateProfile — relevantExperience (checkbox path, no free text)', () => {
  it('buckets any checked skills as some', () => {
    expect(bucketGateProfile({ checkedSkills: ['stakeholder management'] }).relevantExperience).toBe('some');
    expect(bucketGateProfile({ checkedSkills: ['a', 'b', 'c'] }).relevantExperience).toBe('some');
  });

  it('buckets no checked skills and no free text as none (the skip case)', () => {
    expect(bucketGateProfile({}).relevantExperience).toBe('none');
    expect(bucketGateProfile({ checkedSkills: [] }).relevantExperience).toBe('none');
    // Whitespace-only free text is treated the same as absent — falls through to the
    // checkedSkills check, not bucketExperience's own empty-string default.
    expect(bucketGateProfile({ relevantExperienceText: '   ' }).relevantExperience).toBe('none');
  });

  it('prefers free text over checkedSkills when both are present', () => {
    expect(
      bucketGateProfile({
        checkedSkills: ['stakeholder management'],
        relevantExperienceText: 'never done this before',
      }).relevantExperience,
    ).toBe('none'); // free text wins, even though a skill was also checked
  });
});

describe('bucketGateProfile — determinism', () => {
  it('is stable across repeated calls with the same input', () => {
    const input = { timeline: '4 months', relevantExperienceText: 'some prior exposure' };
    expect(bucketGateProfile(input)).toEqual(bucketGateProfile(input));
  });
});
