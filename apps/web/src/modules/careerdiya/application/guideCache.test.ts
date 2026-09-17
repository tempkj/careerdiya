import { describe, expect, it, vi } from 'vitest';
import {
  CAREER_DIYA_GUIDE_PROMPT_VERSION,
  CareerDiyaGuideCacheStore,
  computeGuideCacheKeyHash,
  containsVerdictLanguage,
  validateAndRepairGuideOutput,
} from './guideCache';

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const client = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any;
}

describe('computeGuideCacheKeyHash', () => {
  it('is deterministic for identical inputs', () => {
    const a = computeGuideCacheKeyHash(CAREER_DIYA_GUIDE_PROMPT_VERSION, 'haiku', 'Vocational Arts', 'stream_unlisted');
    const b = computeGuideCacheKeyHash(CAREER_DIYA_GUIDE_PROMPT_VERSION, 'haiku', 'Vocational Arts', 'stream_unlisted');
    expect(a).toBe(b);
  });

  it('produces a 64-char lowercase hex sha256 digest', () => {
    const hash = computeGuideCacheKeyHash(CAREER_DIYA_GUIDE_PROMPT_VERSION, 'haiku', 'Vocational Arts', 'stream_unlisted');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the prompt version changes', () => {
    const a = computeGuideCacheKeyHash('career-diya-guide/v1', 'haiku', 'Vocational Arts', 'stream_unlisted');
    const b = computeGuideCacheKeyHash('career-diya-guide/v2', 'haiku', 'Vocational Arts', 'stream_unlisted');
    expect(a).not.toBe(b);
  });

  it('changes when the model changes', () => {
    const a = computeGuideCacheKeyHash(CAREER_DIYA_GUIDE_PROMPT_VERSION, 'claude-haiku-4-5-20251001', 'Vocational Arts', 'stream_unlisted');
    const b = computeGuideCacheKeyHash(CAREER_DIYA_GUIDE_PROMPT_VERSION, 'claude-sonnet-5', 'Vocational Arts', 'stream_unlisted');
    expect(a).not.toBe(b);
  });

  it('changes when streamOrRole changes, and is normalized (case/whitespace-insensitive)', () => {
    const a = computeGuideCacheKeyHash(CAREER_DIYA_GUIDE_PROMPT_VERSION, 'haiku', 'Vocational Arts', 'stream_unlisted');
    const b = computeGuideCacheKeyHash(CAREER_DIYA_GUIDE_PROMPT_VERSION, 'haiku', 'Fine Arts', 'stream_unlisted');
    const c = computeGuideCacheKeyHash(CAREER_DIYA_GUIDE_PROMPT_VERSION, 'haiku', '  vocational   ARTS  ', 'stream_unlisted');
    expect(a).not.toBe(b);
    expect(a).toBe(c);
  });
});

describe('validateAndRepairGuideOutput', () => {
  it('keeps 2-4 usable territories', () => {
    const result = validateAndRepairGuideOutput({ territories: ['Broad area one', 'Broad area two'] });
    expect(result.territories).toEqual(['Broad area one', 'Broad area two']);
  });

  it('caps territories at 4', () => {
    const result = validateAndRepairGuideOutput({ territories: ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => `Territory ${x}`) });
    expect(result.territories).toHaveLength(4);
  });

  it('drops empty entries before checking the minimum', () => {
    const result = validateAndRepairGuideOutput({ territories: ['', 'Real territory one', '   ', 'Real territory two'] });
    expect(result.territories).toEqual(['Real territory one', 'Real territory two']);
  });

  it('throws when fewer than 2 usable territories survive — never caches a degenerate result', () => {
    expect(() => validateAndRepairGuideOutput({ territories: ['Only one'] })).toThrow();
    expect(() => validateAndRepairGuideOutput({ territories: [] })).toThrow();
    expect(() => validateAndRepairGuideOutput('not json')).toThrow();
    expect(() => validateAndRepairGuideOutput(null)).toThrow();
  });

  it('truncates an overlong territory rather than rejecting it', () => {
    const result = validateAndRepairGuideOutput({ territories: ['x'.repeat(500), 'Real territory two'] });
    expect(result.territories[0]?.length).toBeLessThanOrEqual(160);
  });
});

describe('containsVerdictLanguage', () => {
  it('is false for genuinely broad, non-verdict territories', () => {
    expect(
      containsVerdictLanguage({
        territories: [
          'Broad, cross-industry analytical roles',
          'People-facing coordination and communication work',
        ],
      }),
    ).toBe(false);
  });

  it('catches "you should become"', () => {
    expect(containsVerdictLanguage({ territories: ['You should become a data scientist.'] })).toBe(true);
  });

  it('catches "your best fit is"', () => {
    expect(containsVerdictLanguage({ territories: ['Your best fit is software engineering.'] })).toBe(true);
  });

  it('catches "I recommend you"', () => {
    expect(containsVerdictLanguage({ territories: ['I recommend you pursue product management.'] })).toBe(true);
  });

  it('catches "you are best suited to be a"', () => {
    expect(containsVerdictLanguage({ territories: ['You are best suited to be a designer.'] })).toBe(true);
  });
});

describe('CareerDiyaGuideCacheStore', () => {
  it('returns null on cache miss', async () => {
    const store = new CareerDiyaGuideCacheStore(mockSupabase());
    expect(await store.get('a'.repeat(64))).toBeNull();
  });

  it('returns the stored output on cache hit', async () => {
    const output = { territories: ['x', 'y'] };
    const store = new CareerDiyaGuideCacheStore(mockSupabase({ maybeSingle: vi.fn().mockResolvedValue({ data: { output } }) }));
    expect(await store.get('a'.repeat(64))).toEqual(output);
  });

  it('does not throw when the write fails (non-fatal)', async () => {
    const store = new CareerDiyaGuideCacheStore(mockSupabase({ upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }) }));
    await expect(
      store.put({
        keyHash: 'a'.repeat(64),
        promptVersion: CAREER_DIYA_GUIDE_PROMPT_VERSION,
        model: 'haiku',
        streamOrRole: 'Vocational Arts',
        intent: 'stream_unlisted',
        output: { territories: ['x', 'y'] },
      }),
    ).resolves.toBeUndefined();
  });
});
