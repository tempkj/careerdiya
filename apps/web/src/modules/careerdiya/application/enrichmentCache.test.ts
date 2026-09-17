import { describe, expect, it, vi } from 'vitest';
import {
  CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
  CareerDiyaLlmCacheStore,
  computeEnrichmentCacheKeyHash,
  extractShadowDirection,
  findOtherDirectionReference,
  normalizeRoleText,
  validateAndRepairEnrichment,
} from './enrichmentCache';
import type { BoundedAnswers } from '../domain/types';

const baseAnswers: BoundedAnswers = {
  stage: 'mid',
  intent: 'growth',
  work: 'analytical',
  environment: 'independent',
  priority: 'stability',
  learning: 'project',
  commitment: 'plan',
};

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

describe('normalizeRoleText', () => {
  it('lowercases, trims, collapses whitespace and strips trailing punctuation', () => {
    expect(normalizeRoleText('  Senior  Software Engineer.  ')).toBe('senior software engineer');
  });
});

describe('computeEnrichmentCacheKeyHash', () => {
  it('is deterministic for identical inputs', () => {
    const a = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', baseAnswers, 'software');
    const b = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', baseAnswers, 'software');
    expect(a).toBe(b);
  });

  it('produces a 64-char lowercase hex sha256 digest', () => {
    const hash = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', baseAnswers, 'software');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the prompt version changes — no stale answer served across a prompt bump', () => {
    const a = computeEnrichmentCacheKeyHash('career-diya-enrichment/v1', 'haiku', 'Software Engineer', baseAnswers, 'software');
    const b = computeEnrichmentCacheKeyHash('career-diya-enrichment/v2', 'haiku', 'Software Engineer', baseAnswers, 'software');
    expect(a).not.toBe(b);
  });

  it('changes when the model changes — no stale answer served across a model swap', () => {
    const a = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'claude-haiku-4-5-20251001', 'Software Engineer', baseAnswers, 'software');
    const b = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'claude-sonnet-5', 'Software Engineer', baseAnswers, 'software');
    expect(a).not.toBe(b);
  });

  it('changes when the role changes', () => {
    const a = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', baseAnswers, 'software');
    const b = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Product Manager', baseAnswers, 'software');
    expect(a).not.toBe(b);
  });

  it('changes when the chosen direction changes, even with identical role/answers', () => {
    const a = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', baseAnswers, 'software');
    const b = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', baseAnswers, 'product');
    expect(a).not.toBe(b);
  });

  it('changes when any answer changes', () => {
    const a = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', baseAnswers, 'software');
    const b = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', { ...baseAnswers, priority: 'impact' }, 'software');
    expect(a).not.toBe(b);
  });

  it('is independent of role casing/whitespace (normalized before hashing)', () => {
    const a = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', 'Software Engineer', baseAnswers, 'software');
    const b = computeEnrichmentCacheKeyHash(CAREER_DIYA_ENRICHMENT_PROMPT_VERSION, 'haiku', '  software engineer  ', baseAnswers, 'software');
    expect(a).toBe(b);
  });
});

describe('validateAndRepairEnrichment', () => {
  it('keeps advice and course recommendations from a well-formed response', () => {
    const result = validateAndRepairEnrichment({
      advice: 'Start with a small project.',
      courseRecommendations: [{ title: 'Intro to X', provider: 'Coursera', type: 'course' }],
    });
    expect(result.advice).toBe('Start with a small project.');
    expect(result.courseRecommendations).toEqual([{ title: 'Intro to X', provider: 'Coursera', type: 'course' }]);
  });

  it('drops a rogue "direction" field — the model cannot leak a direction override through', () => {
    const result = validateAndRepairEnrichment({
      advice: 'Start with a small project.',
      courseRecommendations: [{ title: 'Intro to X', provider: 'Coursera', type: 'course' }],
      direction: 'people',
    });
    expect(result).not.toHaveProperty('direction');
    expect(Object.keys(result).sort()).toEqual(['advice', 'courseRecommendations']);
  });

  it('caps course recommendations at 4 items', () => {
    const result = validateAndRepairEnrichment({
      advice: 'Advice.',
      courseRecommendations: Array.from({ length: 10 }, (_, i) => ({ title: `Course ${i}`, provider: 'X', type: 'course' })),
    });
    expect(result.courseRecommendations).toHaveLength(4);
  });

  it('truncates an overlong advice field rather than rejecting it', () => {
    const result = validateAndRepairEnrichment({ advice: 'x'.repeat(1000), courseRecommendations: [] });
    expect(result.advice.length).toBeLessThanOrEqual(600);
  });

  it('drops course entries missing a title', () => {
    const result = validateAndRepairEnrichment({
      advice: 'Advice.',
      courseRecommendations: [{ provider: 'X', type: 'course' }, { title: 'Real course', provider: 'Y', type: 'course' }],
    });
    expect(result.courseRecommendations).toHaveLength(1);
    expect(result.courseRecommendations[0]?.title).toBe('Real course');
  });

  it('throws on a non-object payload — never caches a degenerate result', () => {
    expect(() => validateAndRepairEnrichment('not json')).toThrow();
    expect(() => validateAndRepairEnrichment(null)).toThrow();
  });

  it('throws when neither advice nor course recommendations survive validation', () => {
    expect(() => validateAndRepairEnrichment({ advice: '', courseRecommendations: [] })).toThrow();
  });
});

describe('findOtherDirectionReference', () => {
  it('returns null when the advice stays on the chosen direction', () => {
    const result = findOtherDirectionReference(
      { advice: 'Start with a small Software Engineering project this week.', courseRecommendations: [] },
      'software',
    );
    expect(result).toBeNull();
  });

  it('catches the full direction label ("pivot to People, Education & HR")', () => {
    const result = findOtherDirectionReference(
      { advice: 'Your direction is Software Engineering — but consider pivoting to People, Education & HR instead.', courseRecommendations: [] },
      'software',
    );
    expect(result).toBe('people');
  });

  it('catches the bare acronym ("HR")', () => {
    const result = findOtherDirectionReference(
      { advice: 'You should really pivot to HR given your people-oriented answers.', courseRecommendations: [] },
      'software',
    );
    expect(result).toBe('people');
  });

  it('catches an off-topic reference inside a course recommendation, not just advice', () => {
    const result = findOtherDirectionReference(
      { advice: 'Keep building your Software Engineering fundamentals.', courseRecommendations: [{ title: 'HR Fundamentals', provider: 'Coursera', type: 'course' }] },
      'software',
    );
    expect(result).toBe('people');
  });

  it('does not false-positive on common English words that happen to be part of another label (Research, Care, Service, Business, Policy)', () => {
    const result = findOtherDirectionReference(
      {
        advice: 'Do some research on system design, take care to test your code, and think about how your work provides business value under company policy — this is a service-oriented approach to Software Engineering.',
        courseRecommendations: [],
      },
      'software',
    );
    expect(result).toBeNull();
  });

  it('is case-insensitive and word-boundary-safe (does not match "hr" inside another word)', () => {
    const clean = findOtherDirectionReference(
      { advice: 'Explore chromatic color theory as part of your visual design polish.', courseRecommendations: [] }, // "chromatic" contains the substring "hr", but not as a standalone word
      'software',
    );
    expect(clean).toBeNull();

    const dirty = findOtherDirectionReference(
      { advice: 'Consider a move into hr instead.', courseRecommendations: [] },
      'software',
    );
    expect(dirty).toBe('people');
  });
});

describe('extractShadowDirection', () => {
  it('extracts a valid direction id', () => {
    expect(extractShadowDirection({ shadowDirection: 'product' })).toBe('product');
  });

  it('returns null for an invalid or missing direction id — never throws', () => {
    expect(extractShadowDirection({ shadowDirection: 'not-a-real-direction' })).toBeNull();
    expect(extractShadowDirection({})).toBeNull();
    expect(extractShadowDirection(null)).toBeNull();
  });
});

describe('CareerDiyaLlmCacheStore', () => {
  it('returns null on cache miss', async () => {
    const store = new CareerDiyaLlmCacheStore(mockSupabase());
    expect(await store.get('a'.repeat(64))).toBeNull();
  });

  it('returns the stored output on cache hit', async () => {
    const output = { advice: 'x', courseRecommendations: [] };
    const store = new CareerDiyaLlmCacheStore(mockSupabase({ maybeSingle: vi.fn().mockResolvedValue({ data: { output } }) }));
    expect(await store.get('a'.repeat(64))).toEqual(output);
  });

  it('does not throw when the write fails (non-fatal)', async () => {
    const store = new CareerDiyaLlmCacheStore(mockSupabase({ upsert: vi.fn().mockResolvedValue({ error: { message: 'boom' } }) }));
    await expect(
      store.put({
        keyHash: 'a'.repeat(64),
        promptVersion: CAREER_DIYA_ENRICHMENT_PROMPT_VERSION,
        model: 'haiku',
        roleNormalized: 'software engineer',
        directionId: 'software',
        output: { advice: 'x', courseRecommendations: [] },
        shadowLlmDirection: null,
      }),
    ).resolves.toBeUndefined();
  });
});
