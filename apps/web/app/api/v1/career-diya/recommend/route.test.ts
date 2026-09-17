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
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createMessagesMock.mockReset();
  });

  it('deterministic pick is "software"; the model insists on "people" — the API response direction is still "software"', async () => {
    createMessagesMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            advice: 'You should really pivot to People, Education & HR.',
            courseRecommendations: [{ title: 'HR fundamentals', provider: 'Coursera', type: 'course' }],
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
