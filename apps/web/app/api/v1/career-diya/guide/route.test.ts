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

import { POST } from './route';

function postRequest(body: unknown) {
  return new Request('http://localhost/api/v1/career-diya/guide', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/v1/career-diya/guide', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createMessagesMock.mockReset();
  });

  it('rejects an unknown intent before ever calling the model', async () => {
    const response = await POST(postRequest({ streamOrRole: 'Vocational Arts', intent: 'not-a-real-intent' }));
    expect(response.status).toBe(422);
    expect(createMessagesMock).not.toHaveBeenCalled();
  });

  it('rejects a missing streamOrRole', async () => {
    const response = await POST(postRequest({ intent: 'stream_unlisted' }));
    expect(response.status).toBe(422);
  });

  it('end-to-end: model writes a verdict, response ships clean after the retry (real getGuide, only the Anthropic client + auth are mocked)', async () => {
    createMessagesMock
      .mockResolvedValueOnce(textResponse({ territories: ['You should become a data scientist.', 'Some other broad area'] }))
      .mockResolvedValueOnce(
        textResponse({ territories: ['Broad, cross-industry analytical roles', 'Research-adjacent work'] }),
      );

    const response = await POST(postRequest({ streamOrRole: 'Vocational Arts', intent: 'stream_unlisted' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(/you should become/);
  });

  it('logs guide_fell_back and returns a clean 500 (never a fake 200) when the guide fails on both attempts', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createMessagesMock.mockRejectedValue(new Error('connection reset'));

    const response = await POST(postRequest({ streamOrRole: 'Vocational Arts', intent: 'stream_unlisted' }));

    expect(response.status).toBe(500);
    const events = errorSpy.mock.calls.map((call) => {
      try {
        return JSON.parse(call[0] as string).event;
      } catch {
        return null;
      }
    });
    expect(events).toContain('guide_error');
    expect(events).toContain('guide_fell_back');
    errorSpy.mockRestore();
  });
});

function textResponse(json: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(json) }] };
}
