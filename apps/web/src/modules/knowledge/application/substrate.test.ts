import { describe, it, expect, vi } from 'vitest';
import { normalizeRoleKey, MockSubstrateGenerator, SubstrateStore } from './substrate';

// Minimal Supabase client stub — same pattern as promote.test.ts. SubstrateStore now reads
// via maybeSingle() at every step (the initial cache check AND the post-upsert re-select) —
// no .single() call remains, matching the ignoreDuplicates: true write pattern (see
// substrate.ts's SubstrateStore.get()).
function makeClient(overrides: Partial<Record<string, unknown>> = {}) {
  const base: Record<string, unknown> = {
    schema: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    upsert: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return base as unknown;
}

function makeStoredRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sub-001',
    role_key: 'product manager',
    region: 'IN',
    onet_code: null,
    payload: {
      skills: [{ name: 'product strategy', proficiency: 'expert', criticality: 'required', basis: 'inferred' }],
      market: { demand_signal: 'high', demand_basis: 'AI-inferred, no live signal' },
    },
    basis: 'inferred',
    source: 'mock',
    schema_version: 'substrate/v1',
    computed_at: new Date().toISOString(),
    valid_until: null,
    ...overrides,
  };
}

// ── normalizeRoleKey ───────────────────────────────────────────────────────────

describe('normalizeRoleKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeRoleKey('  Product Manager  ')).toBe('product manager');
    expect(normalizeRoleKey('UX Designer')).toBe('ux designer');
    expect(normalizeRoleKey('AI Content Creator')).toBe('ai content creator');
  });

  it('is idempotent', () => {
    const key = 'data scientist';
    expect(normalizeRoleKey(key)).toBe(key);
  });
});

// ── MockSubstrateGenerator ─────────────────────────────────────────────────────

describe('MockSubstrateGenerator', () => {
  const gen = new MockSubstrateGenerator();

  it('returns deterministic fixture for a known role', async () => {
    const result = await gen.generate('product manager', 'IN');
    expect(result.source).toBe('mock');
    expect(result.basis).toBe('inferred');
    expect(result.onetCode).toBeNull();
    expect(result.payload.skills.length).toBeGreaterThan(0);
    expect(result.payload.market.demand_signal).toBeDefined();
  });

  it('returns default fixture for an unknown role (novel role with no fixture)', async () => {
    const result = await gen.generate('quantum choreographer', 'IN');
    expect(result.source).toBe('mock');
    expect(result.onetCode).toBeNull();
    expect(result.payload.skills.length).toBeGreaterThan(0);
  });

  it('novel role (ai content creator) is a first-class fixture, not the default', async () => {
    const novel = await gen.generate('ai content creator', 'IN');
    const fallback = await gen.generate('quantum choreographer', 'IN');
    const novelSkillNames = novel.payload.skills.map((s) => s.name);
    const fallbackSkillNames = fallback.payload.skills.map((s) => s.name);
    expect(novelSkillNames).toContain('prompt engineering');
    expect(fallbackSkillNames).not.toContain('prompt engineering');
  });

  it('same role key always returns same payload (deterministic)', async () => {
    const a = await gen.generate('software engineer', 'IN');
    const b = await gen.generate('software engineer', 'IN');
    expect(a.payload).toEqual(b.payload);
  });

  it('payload shape matches SubstratePayloadV1 — skills have required fields', async () => {
    const result = await gen.generate('data scientist', 'IN');
    for (const skill of result.payload.skills) {
      expect(skill.name).toBeDefined();
      expect(['awareness', 'working', 'expert']).toContain(skill.proficiency);
      expect(['required', 'preferred', 'differentiating']).toContain(skill.criticality);
      expect(['grounded', 'inferred']).toContain(skill.basis);
    }
  });
});

// ── SubstrateStore ─────────────────────────────────────────────────────────────

describe('SubstrateStore', () => {
  const gen = new MockSubstrateGenerator();

  // Minimal non-mock generator — simulates live generation (source ≠ 'mock') so upsert path runs.
  const liveGen = {
    generate: vi.fn().mockResolvedValue({
      payload: {
        skills: [{ name: 'stakeholder management', proficiency: 'working', criticality: 'required', basis: 'inferred' }],
        market: { demand_signal: 'high', demand_basis: 'AI-inferred, no live signal' },
      },
      basis: 'inferred' as const,
      source: 'crawl' as const,
      onetCode: null,
      validUntil: null,
    }),
  };

  it('mock cache miss: returns ephemeral stub without upserting (mock content is never persisted)', async () => {
    const upsertSpy = vi.fn().mockReturnThis();
    const client = makeClient({
      maybeSingle: vi.fn().mockResolvedValue({ data: null }), // DB miss
      upsert: upsertSpy,
    });

    const store = new SubstrateStore(client as any, gen);
    const result = await store.get('Product Manager');

    expect(upsertSpy).not.toHaveBeenCalled();
    expect(result.roleKey).toBe('product manager');
    expect(result.source).toBe('mock');
    expect(result.onetCode).toBeNull();
    expect(result.schemaVersion).toBe('substrate/v1');
    expect(result.payload.skills.length).toBeGreaterThan(0);
  });

  it('live cache miss: generates, upserts to DB, and returns mapped row', async () => {
    const row = makeStoredRow({ source: 'crawl' });
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: null })  // initial DB-first check: miss
      .mockResolvedValueOnce({ data: row, error: null }); // post-upsert re-select: row
    const client = makeClient({ maybeSingle });

    const store = new SubstrateStore(client as any, liveGen);
    const result = await store.get('Product Manager');

    expect((client as any).upsert).toHaveBeenCalled();
    expect(result.roleKey).toBe('product manager');
    expect(result.source).toBe('crawl');
    expect(result.onetCode).toBeNull();
    expect(result.schemaVersion).toBe('substrate/v1');
  });

  it('cache hit: returns DB row without calling generator', async () => {
    const generateSpy = vi.spyOn(gen, 'generate');
    const row = makeStoredRow({ role_key: 'data scientist' });

    const client = makeClient({
      maybeSingle: vi.fn().mockResolvedValue({ data: row }),  // cache hit
    });

    const store = new SubstrateStore(client as any, gen);
    const result = await store.get('data scientist');

    expect(result.roleKey).toBe('data scientist');
    expect(generateSpy).not.toHaveBeenCalled();
    generateSpy.mockRestore();
  });

  it('stale row: re-generates and upserts when valid_until is in the past', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const staleRow = makeStoredRow({ role_key: 'ux designer', valid_until: pastDate });
    const freshRow = makeStoredRow({ role_key: 'ux designer', valid_until: null, source: 'crawl' });

    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: staleRow })                    // initial check: stale hit
      .mockResolvedValueOnce({ data: freshRow, error: null });      // post-upsert re-select
    const client = makeClient({ maybeSingle });

    const store = new SubstrateStore(client as any, liveGen);
    const result = await store.get('ux designer');

    expect(result.roleKey).toBe('ux designer');
    expect((client as any).upsert).toHaveBeenCalled();
  });

  it('normalizes input before DB lookup', async () => {
    const eqSpy = vi.fn().mockReturnThis();
    const row = makeStoredRow({ role_key: 'software engineer' });

    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: row, error: null });
    const client = makeClient({ eq: eqSpy, maybeSingle });

    const store = new SubstrateStore(client as any, gen);
    await store.get('  Software Engineer  ');

    expect(eqSpy).toHaveBeenCalledWith('role_key', 'software engineer');
  });

  it('throws if upsert fails (live source only — mock never reaches upsert)', async () => {
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: null })                                    // initial: miss
      .mockResolvedValueOnce({ data: null, error: { message: 'db error' } });   // post-upsert: real error
    const client = makeClient({ maybeSingle });

    const store = new SubstrateStore(client as any, liveGen);
    await expect(store.get('product manager')).rejects.toThrow('SubstrateStore: upsert failed');
  });

  it('upsert conflicts (ignoreDuplicates no-op) but re-read finds the row — returns it, does not throw', async () => {
    const row = makeStoredRow({ source: 'crawl' });
    const maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: null })            // initial check: miss
      .mockResolvedValueOnce({ data: null, error: null })  // upsert: DO NOTHING raced, no row returned
      .mockResolvedValueOnce({ data: row, error: null });  // re-read: the conflicting row
    const client = makeClient({ maybeSingle });

    const store = new SubstrateStore(client as any, liveGen);
    const result = await store.get('product manager');

    expect(result.roleKey).toBe('product manager');
    expect(maybeSingle).toHaveBeenCalledTimes(3);
  });
});
