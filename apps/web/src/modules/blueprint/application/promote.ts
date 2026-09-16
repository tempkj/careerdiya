import type { SupabaseClient } from '@supabase/supabase-js';
import { insertSignal, deriveTwin } from '@modules/twin';
import type {
  DerivedPath,
  DraftTask,
  BlueprintEdits,
  BlueprintTask,
  StoredBlueprint,
  ReadinessSnapshot,
} from '../domain/types';

// ── Edit application (ADR-012 §1.3: reorder, override soft deps, add/remove) ──

function applyEdits(tasks: DraftTask[], edits?: BlueprintEdits): DraftTask[] {
  if (!edits) return tasks;

  let result = tasks;

  if (edits.removedTaskIds?.length) {
    const removed = new Set(edits.removedTaskIds);
    result = result.filter((t) => !removed.has(t.id));
  }

  if (edits.dependencyOverrides) {
    const overrides = edits.dependencyOverrides;
    result = result.map((t) => {
      const override = overrides[t.id];
      return override ? { ...t, dependencies: [...override] } : t;
    });
  }

  if (edits.addedTasks?.length) {
    // User-invented tasks have no substrate grounding.
    const added = edits.addedTasks.map((t) => ({ ...t, libraryTaskId: null, basis: 'inferred' as const }));
    result = [...result, ...added];
  }

  if (edits.taskOrder?.length) {
    const order = edits.taskOrder;
    const byId = new Map(result.map((t) => [t.id, t]));
    const ordered = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    const remaining = result.filter((t) => !order.includes(t.id));
    result = [...ordered, ...remaining];
  }

  return result;
}

// ── Draft id -> real uuid remap ─────────────────────────────────────────────────

function remapDependencies(tasks: DraftTask[]): { task: DraftTask; realId: string }[] {
  const idMap = new Map<string, string>();
  for (const task of tasks) idMap.set(task.id, crypto.randomUUID());

  return tasks.map((task) => {
    // Dangling ids (e.g. a removed task's id) are dropped, not errored — same
    // "dangling accepted" rule as the soft-dependency array itself (ADR-012 §4).
    const dependencies = task.dependencies
      .map((depId) => idMap.get(depId))
      .filter((x): x is string => !!x);
    return { task: { ...task, dependencies }, realId: idMap.get(task.id)! };
  });
}

function formatEffortEstimate(hours: number): string {
  return `${hours}h`;
}

export async function promoteBlueprint(
  client: SupabaseClient,
  userId: string,
  sessionId: string,
  path: DerivedPath,
  edits?: BlueprintEdits,
): Promise<StoredBlueprint> {
  // 1. Resolve current active version for this session (if any) and supersede it.
  const { data: activeRow } = await (client as any)
    .schema('core')
    .from('blueprint')
    .select('id, version')
    .eq('session_id', sessionId)
    .eq('status', 'active')
    .maybeSingle();

  const newVersion = activeRow ? (activeRow.version as number) + 1 : 1;

  if (activeRow) {
    const { error: supersedeErr } = await (client as any)
      .schema('core')
      .from('blueprint')
      .update({ status: 'superseded' })
      .eq('id', activeRow.id);
    if (supersedeErr) throw new Error(`promoteBlueprint: failed to supersede prior version — ${supersedeErr.message}`);
  }

  // 2. Apply edits, then remap draft ids -> real uuids.
  const edited = applyEdits(path.tasks, edits);
  const remapped = remapDependencies(edited);

  // 3. Insert the Blueprint header row.
  const blueprintId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const { data: blueprintRow, error: blueprintErr } = await (client as any)
    .schema('core')
    .from('blueprint')
    .insert({
      id: blueprintId,
      user_id: userId,
      session_id: sessionId,
      version: newVersion,
      status: 'active',
      path_strategy: path.strategy,
      basis: path.basis,
      readiness: null, // hosted, not computed here (ADR-005)
      generated_at: nowIso,
      generated_by_model: null,
      prompt_version: null,
      promoted_at: nowIso,
    })
    .select('*')
    .single();

  if (blueprintErr || !blueprintRow) throw new Error(`promoteBlueprint: header insert failed — ${blueprintErr?.message}`);

  // 4. Insert the task rows (snapshot content, sequence_order, remapped deps).
  const taskRows = remapped.map(({ task, realId }, index) => ({
    id: realId,
    blueprint_id: blueprintId,
    user_id: userId,
    library_task_id: task.libraryTaskId,
    title: task.title,
    description: task.description,
    evolve_category: task.evolveCategory,
    dependencies: task.dependencies,
    sequence_order: index,
    effort_estimate: formatEffortEstimate(task.effortHours),
    status: null,
    basis: task.basis,
  }));

  const { data: insertedTasks, error: tasksErr } = await (client as any)
    .schema('core')
    .from('blueprint_task')
    .insert(taskRows)
    .select('*');

  if (tasksErr || !insertedTasks) throw new Error(`promoteBlueprint: task insert failed — ${tasksErr?.message}`);

  // 5. Twin event (A16 provenance). Recorded but unmapped in fold.ts today —
  // no DerivedTwin "active plan" slot exists yet; by design (see Backlog).
  await insertSignal(client, userId, {
    source: 'system',
    significance: 'major',
    payload: {
      fact: 'blueprint_promoted',
      sessionId,
      blueprintId,
      pathStrategy: path.strategy,
      version: newVersion,
      origin: 'blueprint',
    },
    sourceRef: blueprintId,
  });
  await deriveTwin(client, userId);

  // 6. Assemble the return shape.
  const tasks: BlueprintTask[] = insertedTasks.map((row: Record<string, any>) => ({
    id: row['id'] as string,
    blueprintId: row['blueprint_id'] as string,
    libraryTaskId: (row['library_task_id'] as string | null) ?? null,
    title: row['title'] as string,
    description: (row['description'] as string | null) ?? null,
    evolveCategory: row['evolve_category'] as BlueprintTask['evolveCategory'],
    dependencies: (row['dependencies'] as string[]) ?? [],
    sequenceOrder: row['sequence_order'] as number,
    effortEstimate: (row['effort_estimate'] as string | null) ?? null,
    status: (row['status'] as BlueprintTask['status']) ?? null,
    basis: row['basis'] as BlueprintTask['basis'],
  }));

  return {
    id: blueprintRow['id'] as string,
    userId: blueprintRow['user_id'] as string,
    sessionId: blueprintRow['session_id'] as string,
    version: blueprintRow['version'] as number,
    status: blueprintRow['status'] as StoredBlueprint['status'],
    pathStrategy: blueprintRow['path_strategy'] as StoredBlueprint['pathStrategy'],
    basis: blueprintRow['basis'] as StoredBlueprint['basis'],
    tasks,
    readiness: (blueprintRow['readiness'] as ReadinessSnapshot | null) ?? null,
    generatedAt: blueprintRow['generated_at'] as string,
    generatedByModel: (blueprintRow['generated_by_model'] as string | null) ?? null,
    promptVersion: (blueprintRow['prompt_version'] as string | null) ?? null,
    promotedAt: blueprintRow['promoted_at'] as string,
  };
}
