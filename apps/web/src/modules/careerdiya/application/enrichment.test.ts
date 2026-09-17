import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMessagesMock = vi.fn();

vi.mock('@/lib/ai', () => ({
  AI_MODE: 'live',
  AI_MODEL: 'test-model',
  getAnthropicClient: () => ({ messages: { create: createMessagesMock } }),
}));

// Imported AFTER the mock above so getEnrichment sees the mocked AI_MODE/AI_MODEL/client.
import { getEnrichment } from './enrichment';
import type { BoundedAnswers } from '../domain/types';

const answers: BoundedAnswers = {
  stage: 'mid',
  intent: 'growth',
  work: 'people',
  environment: 'collaborative',
  priority: 'impact',
  learning: 'mentor',
  commitment: 'plan',
};

function textResponse(json: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(json) }] };
}

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

describe('getEnrichment — hostile model output cannot change the rendered direction', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createMessagesMock.mockReset();
  });

  it('deterministic pick is "software"; the model tries to smuggle "people" as both direction and shadowDirection — the returned value has no direction field at all', async () => {
    // Advice text stays on-topic here deliberately — this test isolates the FIELD-leakage
    // guarantee from the prose-screening guarantee (covered separately below, "off-topic
    // prose screen"). If this advice also argued for another direction, the new screen
    // would trigger a retry against the same mocked (still-hostile) response and reject
    // the whole call, which would test the wrong thing here.
    createMessagesMock.mockResolvedValue(
      textResponse({
        advice: 'Build three small backend projects and contribute to one open-source repository this month.',
        courseRecommendations: [{ title: 'Backend fundamentals', provider: 'Coursera', type: 'course' }],
        direction: 'people', // hostile: model tries to override the fixed direction
        shadowDirection: 'people',
      }),
    );

    const result = await getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software');

    // This is the test that would fail if a direction override ever leaked through: the
    // TYPE returned by getEnrichment has no `direction` field, so there is nothing for a
    // caller downstream (the route, then the browser) to accidentally read as "the
    // direction" other than the chosenDirectionId it already had. Asserting the object's
    // own keys — not just that a specific field is absent — catches any future change
    // that re-adds a direction-shaped field under a different name.
    expect(Object.keys(result).sort()).toEqual(['advice', 'courseRecommendations']);
    expect(result).not.toHaveProperty('direction');
    expect(JSON.stringify(result)).not.toContain('"direction"');
  });
});

describe('getEnrichment — off-topic-direction prose screen', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createMessagesMock.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  function loggedEvents(spy: ReturnType<typeof vi.spyOn>): string[] {
    return spy.mock.calls.map((call) => JSON.parse(call[0] as string).event);
  }

  // The exact scenario requested for sign-off: the model returns the CORRECT chosen
  // direction (no field-level override) but writes advice prose that advocates pivoting
  // to a different direction. This must fail if that contradictory prose ever reaches
  // the response — either by self-healing on the one retry (this test) or by falling
  // back to a rejection the route turns into a clean error (the next test).
  it('direction field is correct ("software") but advice advocates pivoting to People/HR — a clean retry replaces it, and the shipped result never contains the contradictory advocacy', async () => {
    createMessagesMock
      .mockResolvedValueOnce(
        textResponse({
          direction: 'software', // correct — the bug this closes is NOT a field override
          advice: 'Your direction is Software Engineering, but given your people-oriented answers, you should really pivot to People, Education & HR instead.',
          courseRecommendations: [{ title: 'HR Fundamentals', provider: 'Coursera', type: 'course' }],
        }),
      )
      .mockResolvedValueOnce(
        textResponse({
          direction: 'software',
          advice: 'Build three small backend projects and contribute to one open-source repository this month.',
          courseRecommendations: [{ title: 'Backend fundamentals', provider: 'Coursera', type: 'course' }],
        }),
      );

    const result = await getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software');

    // The assertion that fails if contradictory prose ever ships: neither the advice nor
    // any course recommendation may reference another direction, in the FINAL shipped
    // result — regardless of what the first (discarded) attempt said.
    const shipped = JSON.stringify(result).toLowerCase();
    expect(shipped).not.toMatch(/\bhr\b/);
    expect(shipped).not.toContain('people, education');
    expect(createMessagesMock).toHaveBeenCalledTimes(2); // proves the retry actually happened, not a lucky first draw

    expect(loggedEvents(errorSpy)).toEqual(['llm_offtopic_direction']); // attempt 1 fired and was logged
    expect(loggedEvents(logSpy)).toEqual(['llm_success']); // the call still succeeds overall, using the clean retry
  });

  it('direction field is correct but advice advocates a different direction on BOTH attempts — getEnrichment rejects rather than shipping contradictory prose', async () => {
    createMessagesMock.mockResolvedValue(
      textResponse({
        direction: 'software',
        advice: 'Your direction is Software Engineering, but you should really pivot to People, Education & HR instead.',
        courseRecommendations: [{ title: 'HR Fundamentals', provider: 'Coursera', type: 'course' }],
      }),
    );

    await expect(getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software')).rejects.toThrow(/references 'people'/);

    expect(createMessagesMock).toHaveBeenCalledTimes(2); // the one retry was used, then given up on
    expect(loggedEvents(errorSpy)).toEqual(['llm_offtopic_direction', 'llm_offtopic_direction']); // attempt 1, then the terminal attempt 2
    expect(logSpy).not.toHaveBeenCalled(); // never logged as a success
  });
});

describe('getEnrichment — outcome logging (llm_cache_hit / llm_success / llm_timeout / llm_invalid / llm_error)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createMessagesMock.mockReset();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  function loggedEvents(spy: ReturnType<typeof vi.spyOn>): string[] {
    return spy.mock.calls.map((call) => JSON.parse(call[0] as string).event);
  }

  it('logs llm_cache_hit and never calls the model on a cache hit', async () => {
    const cachedOutput = { advice: 'cached advice', courseRecommendations: [] };
    const client = mockSupabase({ maybeSingle: vi.fn().mockResolvedValue({ data: { output: cachedOutput } }) });

    const result = await getEnrichment(client, 'Software Engineer', answers, 'software');

    expect(result).toEqual(cachedOutput);
    expect(createMessagesMock).not.toHaveBeenCalled();
    expect(loggedEvents(logSpy)).toEqual(['llm_cache_hit']);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs llm_success on a fresh, valid model response', async () => {
    createMessagesMock.mockResolvedValue(
      textResponse({ advice: 'Good advice.', courseRecommendations: [{ title: 'X', provider: 'Y', type: 'course' }] }),
    );

    await getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software');

    expect(loggedEvents(logSpy)).toEqual(['llm_success']);
  });

  it('logs llm_timeout and rejects when the model call exceeds the timeout budget', async () => {
    vi.useFakeTimers();
    createMessagesMock.mockImplementation((_params, { signal }: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    const pending = getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software');
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;

    expect(loggedEvents(errorSpy)).toEqual(['llm_timeout']);
    vi.useRealTimers();
  });

  it('logs llm_invalid when the model response has no text content block', async () => {
    createMessagesMock.mockResolvedValue({ content: [{ type: 'thinking' }] });

    await expect(getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software')).rejects.toThrow(/no text content block/);

    expect(loggedEvents(errorSpy)).toEqual(['llm_invalid']);
  });

  it('logs llm_invalid when the model response is not valid JSON', async () => {
    createMessagesMock.mockResolvedValue({ content: [{ type: 'text', text: 'not json at all' }] });

    await expect(getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software')).rejects.toThrow();

    expect(loggedEvents(errorSpy)).toEqual(['llm_invalid']);
  });

  it('logs llm_invalid when the parsed JSON fails content validation (e.g. empty advice and no courses)', async () => {
    createMessagesMock.mockResolvedValue(textResponse({ advice: '', courseRecommendations: [] }));

    await expect(getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software')).rejects.toThrow();

    expect(loggedEvents(errorSpy)).toEqual(['llm_invalid']);
  });

  it('logs llm_error for a non-timeout failure (e.g. a network/API error)', async () => {
    createMessagesMock.mockRejectedValue(new Error('connection reset'));

    await expect(getEnrichment(mockSupabase(), 'Software Engineer', answers, 'software')).rejects.toThrow('connection reset');

    expect(loggedEvents(errorSpy)).toEqual(['llm_error']);
  });
});
