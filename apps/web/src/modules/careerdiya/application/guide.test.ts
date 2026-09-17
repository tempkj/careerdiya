import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMessagesMock = vi.fn();

vi.mock('@/lib/ai', () => ({
  AI_MODE: 'live',
  AI_MODEL: 'test-model',
  getAnthropicClient: () => ({ messages: { create: createMessagesMock } }),
}));

import { getGuide } from './guide';

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

describe('getGuide — never ships a personalised career verdict', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createMessagesMock.mockReset();
  });

  // The exact scenario requested for sign-off: the model is asked for broad territory
  // (no direction/career-choosing authority exists on this path at all — it's the SAME
  // "guides, never verdicts" bug class ADR-CAREERDIY-0015 closed for the enrichment
  // path) but writes a personalised verdict anyway. Must fail if that verdict ever ships.
  it('model writes a personalised verdict ("you should become a data scientist") — a clean retry replaces it, and the shipped result never contains verdict language', async () => {
    createMessagesMock
      .mockResolvedValueOnce(
        textResponse({ territories: ['You should become a data scientist — it is clearly your best fit.', 'Some other broad area'] }),
      )
      .mockResolvedValueOnce(
        textResponse({
          territories: ['Broad, cross-industry analytical roles', 'Research-adjacent work across several fields'],
        }),
      );

    const result = await getGuide(mockSupabase(), 'Vocational Arts', 'stream_unlisted');

    const shipped = JSON.stringify(result).toLowerCase();
    expect(shipped).not.toMatch(/you should become/);
    expect(shipped).not.toMatch(/best fit/);
    expect(createMessagesMock).toHaveBeenCalledTimes(2); // proves the retry actually happened
  });

  it('model writes a verdict on BOTH attempts — getGuide rejects rather than shipping it', async () => {
    createMessagesMock.mockResolvedValue(
      textResponse({ territories: ['I recommend you pursue product management specifically.', 'Some other broad area'] }),
    );

    await expect(getGuide(mockSupabase(), 'Vocational Arts', 'stream_unlisted')).rejects.toThrow(/verdict/);
    expect(createMessagesMock).toHaveBeenCalledTimes(2);
  });

  it('the output type itself has no field for a single named career or a fit score, regardless of what the model returns', async () => {
    createMessagesMock.mockResolvedValue(
      textResponse({
        territories: ['Broad, cross-industry analytical roles', 'Research-adjacent work across several fields'],
        // hostile extras a model might add despite the schema — must be dropped, not surfaced
        recommendedCareer: 'Data Scientist',
        fitScore: 0.93,
        confidence: 'high',
      }),
    );

    const result = await getGuide(mockSupabase(), 'Vocational Arts', 'stream_unlisted');

    expect(Object.keys(result).sort()).toEqual(['territories']);
    expect(result).not.toHaveProperty('recommendedCareer');
    expect(result).not.toHaveProperty('fitScore');
  });
});

describe('getGuide — outcome logging (guide_cache_hit / guide_success / guide_timeout / guide_invalid / guide_offtopic_verdict / guide_error)', () => {
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

  it('logs guide_cache_hit and never calls the model on a cache hit', async () => {
    const cachedOutput = { territories: ['cached one', 'cached two'] };
    const client = mockSupabase({ maybeSingle: vi.fn().mockResolvedValue({ data: { output: cachedOutput } }) });

    const result = await getGuide(client, 'Vocational Arts', 'stream_unlisted');

    expect(result).toEqual(cachedOutput);
    expect(createMessagesMock).not.toHaveBeenCalled();
    expect(loggedEvents(logSpy)).toEqual(['guide_cache_hit']);
  });

  it('logs guide_success on a fresh, valid, verdict-free response', async () => {
    createMessagesMock.mockResolvedValue(textResponse({ territories: ['Broad area one', 'Broad area two'] }));

    await getGuide(mockSupabase(), 'Vocational Arts', 'stream_unlisted');

    expect(loggedEvents(logSpy)).toEqual(['guide_success']);
  });

  it('logs guide_timeout when the model call exceeds the timeout budget', async () => {
    vi.useFakeTimers();
    createMessagesMock.mockImplementation((_params, { signal }: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    const pending = getGuide(mockSupabase(), 'Vocational Arts', 'stream_unlisted');
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;

    expect(loggedEvents(errorSpy)).toEqual(['guide_timeout']);
    vi.useRealTimers();
  });

  it('logs guide_invalid when the model response is not valid JSON', async () => {
    createMessagesMock.mockResolvedValue({ content: [{ type: 'text', text: 'not json at all' }] });

    await expect(getGuide(mockSupabase(), 'Vocational Arts', 'stream_unlisted')).rejects.toThrow();
    expect(loggedEvents(errorSpy)).toEqual(['guide_invalid']);
  });

  it('logs guide_offtopic_verdict (attempt 1 then attempt 2) when both attempts read as a verdict', async () => {
    createMessagesMock.mockResolvedValue(textResponse({ territories: ['Your path is clearly law.', 'Some other broad area'] }));

    await expect(getGuide(mockSupabase(), 'Vocational Arts', 'stream_unlisted')).rejects.toThrow();
    expect(loggedEvents(errorSpy)).toEqual(['guide_offtopic_verdict', 'guide_offtopic_verdict']);
  });

  it('logs guide_error for a non-timeout failure', async () => {
    createMessagesMock.mockRejectedValue(new Error('connection reset'));

    await expect(getGuide(mockSupabase(), 'Vocational Arts', 'stream_unlisted')).rejects.toThrow('connection reset');
    expect(loggedEvents(errorSpy)).toEqual(['guide_error']);
  });
});
