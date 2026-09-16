import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promoteExploration, PreconditionError } from './promote';

// Minimal Supabase client stub
function makeClient(overrides: Record<string, unknown> = {}) {
  const query: Record<string, unknown> = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return query as unknown;
}

// Shared gap data
const gapItems = [
  { skill: 'Product Strategy', have: false, confidence: { value: 0.7, basis: 'inferred' } },
  { skill: 'Data Analysis', have: true, confidence: { value: 0.8, basis: 'stated' } },
];

// A saved session row (completed_at set)
const savedSessionRow = {
  id: 'sess-001',
  user_id: 'user-1',
  desired_role: 'Product Manager',
  current_role: 'Software Engineer',
  onet_code: '11-2021.00',
  gap: gapItems,
  first_action: 'Take a PM course',
  journey: [],
  completed_at: '2026-06-29T10:00:00Z',
  created_at: '2026-06-29T09:00:00Z',
};

// A draft session row (completed_at null)
const draftSessionRow = {
  ...savedSessionRow,
  id: 'sess-draft',
  completed_at: null,
};

describe('promoteExploration', () => {
  it('throws PreconditionError (409) when session is a draft (completedAt null)', async () => {
    let callCount = 0;
    const client = makeClient({
      single: vi.fn().mockImplementation(() => {
        callCount++;
        // Return draft session on first fetch
        return Promise.resolve({ data: draftSessionRow, error: null });
      }),
    });

    await expect(
      promoteExploration(client as any, 'user-1', 'sess-draft'),
    ).rejects.toThrow(PreconditionError);
  });

  it('PreconditionError message instructs user to save first', async () => {
    const client = makeClient({
      single: vi.fn().mockResolvedValue({ data: draftSessionRow, error: null }),
    });

    try {
      await promoteExploration(client as any, 'user-1', 'sess-draft');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PreconditionError);
      expect((err as PreconditionError).message).toMatch(/save/i);
      expect((err as PreconditionError).status).toBe(409);
    }
  });

  it('throws if session not found', async () => {
    const client = makeClient({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });

    await expect(
      promoteExploration(client as any, 'user-1', 'no-such-session'),
    ).rejects.toThrow('Session not found');
  });
});

describe('listActivationSessions — activeGoalSessionId resolution', () => {
  it('returns activeGoalSessionId null when Twin has no aspiration', async () => {
    // Import here to avoid circular at module level
    const { listActivationSessions } = await import('./get');

    const client = {
      schema: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    } as unknown;

    const result = await listActivationSessions(client as any);
    expect(result.activeGoalSessionId).toBeNull();
    expect(result.data).toEqual([]);
  });

  it('returns activeGoalSessionId null when Twin aspiration has no targetRole', async () => {
    const { listActivationSessions } = await import('./get');

    let callCount = 0;
    const client = {
      schema: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // activation_session list (none)
          return Promise.resolve({ data: null });
        }
        // twin row — has aspiration but no targetRole
        return Promise.resolve({ data: { twin: { schemaVersion: 'twin/v1', aspiration: {} } } });
      }),
    } as unknown;

    const result = await listActivationSessions(client as any);
    expect(result.activeGoalSessionId).toBeNull();
  });
});
