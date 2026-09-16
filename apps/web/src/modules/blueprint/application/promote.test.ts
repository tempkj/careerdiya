import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promoteBlueprint } from './promote';
import type { DerivedPath } from '../domain/types';

vi.mock('@modules/twin', () => ({
  insertSignal: vi.fn().mockResolvedValue({ id: 'signal-1' }),
  deriveTwin: vi.fn().mockResolvedValue(undefined),
}));

import { insertSignal, deriveTwin } from '@modules/twin';

// A minimal two-task DerivedPath: one required (dep-free) + one preferred
// (depends on the required set) — enough to exercise the remap logic without
// pulling in derive.ts.
function makePath(): DerivedPath {
  return {
    strategy: 'optimal',
    basis: 'inferred',
    landingDefinition: 'Land a product manager role.',
    effortTotalHours: 60,
    calendarRange: { minWeeks: 2, maxWeeks: 4 },
    intensityHoursPerWeek: 20,
    probabilityBand: 'medium_high',
    tasks: [
      {
        id: 'optimal-product-strategy',
        libraryTaskId: null,
        title: 'Build expert-level product strategy',
        description: 'required skill',
        evolveCategory: 'learn',
        dependencies: [],
        effortHours: 40,
        basis: 'inferred',
        criticality: 'required',
        targetProficiency: 'expert',
        skillName: 'product strategy',
        taskType: null,
      },
      {
        id: 'optimal-user-research',
        libraryTaskId: null,
        title: 'Build working-level user research',
        description: 'preferred skill',
        evolveCategory: 'learn',
        dependencies: ['optimal-product-strategy'],
        effortHours: 20,
        basis: 'inferred',
        criticality: 'preferred',
        targetProficiency: 'awareness',
        skillName: 'user research',
        taskType: null,
      },
    ],
  };
}

// Table-aware Supabase client stub: 'blueprint' and 'blueprint_task' get
// separate chainable mocks since their terminal call shapes differ (single()
// vs a bare-awaited select() on an array).
function makeClient(opts: {
  activeRow?: { id: string; version: number } | null;
  blueprintRow: Record<string, unknown>;
}) {
  let lastTaskInsertRows: Record<string, unknown>[] = [];
  const updateEq = vi.fn().mockResolvedValue({ error: null });

  const blueprintTable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.activeRow ?? null }),
    update: vi.fn(() => ({ eq: updateEq })),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: opts.blueprintRow, error: null }),
  };

  const blueprintTaskTable = {
    insert: vi.fn((rows: Record<string, unknown>[]) => {
      lastTaskInsertRows = rows;
      return blueprintTaskTable;
    }),
    select: vi.fn(() => Promise.resolve({ data: lastTaskInsertRows, error: null })),
  };

  const schemaObj = {
    from: vi.fn((table: string) => (table === 'blueprint' ? blueprintTable : blueprintTaskTable)),
  };

  const client = { schema: vi.fn().mockReturnValue(schemaObj) };
  return { client: client as unknown as import('@supabase/supabase-js').SupabaseClient, blueprintTable, blueprintTaskTable, updateEq };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('promoteBlueprint — header + task insert', () => {
  it('inserts a version-1 header when no active version exists for the session', async () => {
    const { client, blueprintTable } = makeClient({
      activeRow: null,
      blueprintRow: { id: 'bp-1', user_id: 'user-1', session_id: 'session-1', version: 1, status: 'active', path_strategy: 'optimal', basis: 'inferred', readiness: null, generated_at: 't', generated_by_model: null, prompt_version: null, promoted_at: 't' },
    });

    const result = await promoteBlueprint(client, 'user-1', 'session-1', makePath());

    expect(blueprintTable.update).not.toHaveBeenCalled();
    expect(blueprintTable.insert).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, status: 'active', session_id: 'session-1', user_id: 'user-1' }),
    );
    expect(result.version).toBe(1);
    expect(result.tasks).toHaveLength(2);
  });

  it('snapshots task content with sequence_order and formatted effort_estimate', async () => {
    const { client, blueprintTaskTable } = makeClient({
      activeRow: null,
      blueprintRow: { id: 'bp-1', user_id: 'user-1', session_id: 'session-1', version: 1, status: 'active', path_strategy: 'optimal', basis: 'inferred', readiness: null, generated_at: 't', generated_by_model: null, prompt_version: null, promoted_at: 't' },
    });

    await promoteBlueprint(client, 'user-1', 'session-1', makePath());

    const insertedRows = blueprintTaskTable.insert.mock.calls[0]![0] as Record<string, unknown>[];
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows[0]!['title']).toBe('Build expert-level product strategy');
    expect(insertedRows[0]!['sequence_order']).toBe(0);
    expect(insertedRows[1]!['sequence_order']).toBe(1);
    expect(insertedRows[0]!['effort_estimate']).toBe('40h');
    expect(insertedRows[1]!['effort_estimate']).toBe('20h');
  });
});

describe('promoteBlueprint — versioning and supersede', () => {
  it('increments version and flips the prior active row to superseded when one exists', async () => {
    const { client, blueprintTable, updateEq } = makeClient({
      activeRow: { id: 'bp-old', version: 2 },
      blueprintRow: { id: 'bp-new', user_id: 'user-1', session_id: 'session-1', version: 3, status: 'active', path_strategy: 'optimal', basis: 'inferred', readiness: null, generated_at: 't', generated_by_model: null, prompt_version: null, promoted_at: 't' },
    });

    const result = await promoteBlueprint(client, 'user-1', 'session-1', makePath());

    expect(blueprintTable.update).toHaveBeenCalledWith({ status: 'superseded' });
    expect(updateEq).toHaveBeenCalledWith('id', 'bp-old');
    expect(blueprintTable.insert).toHaveBeenCalledWith(expect.objectContaining({ version: 3 }));
    expect(result.version).toBe(3);
  });

  it('re-promote: save, then save again for the same session -> version 2, version 1 superseded', async () => {
    // First save: no active version exists yet for this session.
    const first = makeClient({
      activeRow: null,
      blueprintRow: { id: 'bp-v1', user_id: 'user-1', session_id: 'session-1', version: 1, status: 'active', path_strategy: 'optimal', basis: 'inferred', readiness: null, generated_at: 't', generated_by_model: null, prompt_version: null, promoted_at: 't' },
    });
    const firstResult = await promoteBlueprint(first.client, 'user-1', 'session-1', makePath());
    expect(first.blueprintTable.update).not.toHaveBeenCalled();
    expect(firstResult.version).toBe(1);

    // Second save (an edit, then re-save): the version-1 row from the first
    // save is now the active row a fresh request would find.
    const second = makeClient({
      activeRow: { id: firstResult.id, version: firstResult.version },
      blueprintRow: { id: 'bp-v2', user_id: 'user-1', session_id: 'session-1', version: 2, status: 'active', path_strategy: 'optimal', basis: 'inferred', readiness: null, generated_at: 't', generated_by_model: null, prompt_version: null, promoted_at: 't' },
    });
    const secondResult = await promoteBlueprint(second.client, 'user-1', 'session-1', makePath());

    expect(second.blueprintTable.update).toHaveBeenCalledWith({ status: 'superseded' });
    expect(second.updateEq).toHaveBeenCalledWith('id', firstResult.id);
    expect(secondResult.version).toBe(2);
  });
});

describe('promoteBlueprint — dependency remap', () => {
  it('remaps DraftTask ids to real uuids in the inserted dependencies array', async () => {
    const { client, blueprintTaskTable } = makeClient({
      activeRow: null,
      blueprintRow: { id: 'bp-1', user_id: 'user-1', session_id: 'session-1', version: 1, status: 'active', path_strategy: 'optimal', basis: 'inferred', readiness: null, generated_at: 't', generated_by_model: null, prompt_version: null, promoted_at: 't' },
    });

    await promoteBlueprint(client, 'user-1', 'session-1', makePath());

    const insertedRows = blueprintTaskTable.insert.mock.calls[0]![0] as Record<string, unknown>[];
    const requiredRow = insertedRows.find((r) => r['title'] === 'Build expert-level product strategy')!;
    const preferredRow = insertedRows.find((r) => r['title'] === 'Build working-level user research')!;

    // No longer the draft-local id ('optimal-product-strategy') — a real uuid instead.
    expect(preferredRow['dependencies']).toEqual([requiredRow['id']]);
    expect(preferredRow['dependencies']).not.toContain('optimal-product-strategy');
    expect(requiredRow['id']).not.toBe('optimal-product-strategy');
  });
});

describe('promoteBlueprint — Twin event', () => {
  it('emits a blueprint_promoted signal with provenance and calls deriveTwin', async () => {
    // blueprintRow is what the mocked select-back returns; it is NOT what the
    // code uses for sourceRef — promote.ts generates its own uuid client-side
    // and uses that for both the insert and the signal, so we capture it from
    // the actual insert call rather than asserting against the mock fixture.
    const { client, blueprintTable } = makeClient({
      activeRow: null,
      blueprintRow: { id: 'bp-1', user_id: 'user-1', session_id: 'session-1', version: 1, status: 'active', path_strategy: 'optimal', basis: 'inferred', readiness: null, generated_at: 't', generated_by_model: null, prompt_version: null, promoted_at: 't' },
    });

    await promoteBlueprint(client, 'user-1', 'session-1', makePath());

    const insertedHeader = blueprintTable.insert.mock.calls[0]![0] as Record<string, unknown>;
    const generatedBlueprintId = insertedHeader['id'] as string;

    expect(insertSignal).toHaveBeenCalledWith(
      client,
      'user-1',
      expect.objectContaining({
        source: 'system',
        significance: 'major',
        payload: expect.objectContaining({ fact: 'blueprint_promoted', sessionId: 'session-1', version: 1 }),
        sourceRef: generatedBlueprintId,
      }),
    );
    expect(deriveTwin).toHaveBeenCalledWith(client, 'user-1');
  });
});
