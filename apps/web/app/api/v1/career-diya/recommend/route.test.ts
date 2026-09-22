import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMessagesMock = vi.fn();

vi.mock('@/lib/ai', () => ({
  AI_MODE: 'live',
  AI_MODEL: 'test-model',
  getAnthropicClient: () => ({ messages: { create: createMessagesMock } }),
}));

function mockSupabase() {
  return {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ supabase: mockSupabase(), user: { id: 'test-user' } }),
}));

// Imported after the mocks above — this exercises the REAL route handler and the REAL
// careerdiya module (getEnrichment, validateAndRepairEnrichment) end to end. Only the
// Anthropic client and the Supabase auth/session lookup are faked.
import { POST } from './route';

const answers = {
  stage: 'mid',
  intent: 'growth',
  work: 'people',
  environment: 'collaborative',
  priority: 'impact',
  learning: 'mentor',
  commitment: 'plan',
};

function postRequest(body: unknown) {
  return new Request('http://localhost/api/v1/career-diya/recommend', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/career-diya/recommend — end-to-end hostile-model proof', () => {
  it('rejects an unbounded role before any model call', async () => {
    const response = await POST(postRequest({ role: 'Chief Happiness Wizard', answers, chosenDirectionId: 'software' }));
    expect(response.status).toBe(422);
    expect(createMessagesMock).not.toHaveBeenCalled();
  });

  it('rejects answer values outside the closed Career Diya vocabulary', async () => {
    const invalidAnswers = { ...answers, intent: 'arbitrary-intent' };
    const response = await POST(postRequest({ role: 'Software Engineer', answers: invalidAnswers, chosenDirectionId: 'software' }));
    expect(response.status).toBe(422);
    expect(createMessagesMock).not.toHaveBeenCalled();
  });


  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createMessagesMock.mockReset();
  });

  it('deterministic pick is "software"; the model insists on "people" — the API response direction is still "software"', async () => {
    // Advice text stays on-topic here deliberately — this test isolates the FIELD-leakage
    // guarantee from the prose-screening guarantee (covered separately below). If this
    // advice also argued for another direction, the off-topic screen would trigger a
    // retry against the same mocked (still-hostile) response and reject the whole call.
    createMessagesMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            advice: 'Build three small backend projects and contribute to one open-source repository this month.',
            courseRecommendations: [{ title: 'Backend fundamentals', provider: 'Coursera', type: 'course' }],
            direction: 'people',
            shadowDirection: 'people',
          }),
        },
      ],
    });

    const response = await POST(postRequest({ role: 'Software Engineer', answers, chosenDirectionId: 'software' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    // This is the assertion that fails if a hostile model's direction claim ever reaches
    // the browser: the response is built from the REQUEST's chosenDirectionId, never
    // from anything the model returned.
    expect(body.direction).toBe('software');
    expect(body.direction).not.toBe('people');
  });

  it('direction field is correct but advice prose advocates pivoting to People/HR — the shipped response never contains that advocacy (self-heals via the one retry)', async () => {
    createMessagesMock
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              direction: 'software',
              advice: 'Your direction is Software Engineering, but given your answers you should really pivot to People, Education & HR instead.',
              courseRecommendations: [{ title: 'HR Fundamentals', provider: 'Coursera', type: 'course' }],
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              direction: 'software',
              advice: 'Build three small backend projects and contribute to one open-source repository this month.',
              courseRecommendations: [{ title: 'Backend fundamentals', provider: 'Coursera', type: 'course' }],
            }),
          },
        ],
      });

    const response = await POST(postRequest({ role: 'Software Engineer', answers, chosenDirectionId: 'software' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.direction).toBe('software');
    // The assertion that fails if contradictory direction advocacy ever reaches the
    // response — checked against the FULL response body, not just the direction field.
    const shipped = JSON.stringify(body).toLowerCase();
    expect(shipped).not.toMatch(/\bhr\b/);
    expect(shipped).not.toContain('people, education');
    expect(createMessagesMock).toHaveBeenCalledTimes(2);
  });

  it('direction field is correct but advice advocates a different direction on BOTH attempts — falls back to a clean 500 rather than shipping contradictory prose', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createMessagesMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            direction: 'software',
            advice: 'Your direction is Software Engineering, but you should really pivot to People, Education & HR instead.',
            courseRecommendations: [{ title: 'HR Fundamentals', provider: 'Coursera', type: 'course' }],
          }),
        },
      ],
    });

    const response = await POST(postRequest({ role: 'Software Engineer', answers, chosenDirectionId: 'software' }));

    expect(response.status).toBe(500);
    expect(createMessagesMock).toHaveBeenCalledTimes(2); // one retry attempted, then given up on
    const events = errorSpy.mock.calls.map((call) => {
      try {
        return JSON.parse(call[0] as string).event;
      } catch {
        return null;
      }
    });
    expect(events.filter((e) => e === 'llm_offtopic_direction')).toHaveLength(2); // attempt 1 and the terminal attempt 2
    expect(events).toContain('llm_fell_back');
    errorSpy.mockRestore();
  });

  it('rejects a chosenDirectionId outside the closed enum before ever calling the model', async () => {
    const response = await POST(postRequest({ role: 'Software Engineer', answers, chosenDirectionId: 'not-a-real-direction' }));

    expect(response.status).toBe(422);
    expect(createMessagesMock).not.toHaveBeenCalled();
  });

  it('logs llm_fell_back and returns a clean 500 (never a fake 200) when enrichment fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createMessagesMock.mockRejectedValue(new Error('connection reset'));

    const response = await POST(postRequest({ role: 'Software Engineer', answers, chosenDirectionId: 'software' }));

    expect(response.status).toBe(500);
    const events = errorSpy.mock.calls.map((call) => {
      try {
        return JSON.parse(call[0] as string).event;
      } catch {
        return null;
      }
    });
    expect(events).toContain('llm_error'); // from getEnrichment
    expect(events).toContain('llm_fell_back'); // from the route's catch
    errorSpy.mockRestore();
  });
});
