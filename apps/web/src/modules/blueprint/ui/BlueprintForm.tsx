'use client';
import { useEffect, useState } from 'react';
import type { DerivedPath, DraftTask, PathStrategy, StoredBlueprint } from '../domain/types';
import { computePathTotals } from '../application/pathTotals';
import type { DisputeResult } from '../application/dispute';
import type { CounsellorAssessment } from '../application/identificationCache';

const EMPTY_ASSESSMENT: CounsellorAssessment = { framing: '', taskGroups: [], throughLine: '' };

const STRATEGY_LABEL: Record<PathStrategy, string> = {
  fastest: 'Fastest',
  optimal: 'Optimal',
  longest: 'Thorough',
  custom: 'Custom',
};

// ── Edit view row ────────────────────────────────────────────────────────────

function TaskRow({
  task,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  task: DraftTask;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-200 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">{task.title}</p>
        <p className="text-xs text-gray-500">
          {task.evolveCategory} · {task.effortHours}h
          {task.dependencies.length > 0 ? ` · depends on ${task.dependencies.length} task(s)` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Task-review row (plan row, grouped under a counsellor section + per-task dispute) ──

function ReviewTaskRow({ task, onDispute }: { task: DraftTask; onDispute: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-200 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">{task.title}</p>
        {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
        <p className="text-xs text-gray-400 mt-0.5">
          {task.evolveCategory} · {task.criticality ?? 'system-added'} · {task.taskType ?? 'unclassified'}
        </p>
      </div>
      <button
        type="button"
        onClick={onDispute}
        className="shrink-0 px-2 py-1 text-xs border border-gray-300 rounded"
      >
        Dispute
      </button>
    </div>
  );
}

// ── Path card (collapsed summary + expandable detail) ───────────────────────

function PathCard({
  path,
  recommended,
  onSelect,
}: {
  path: DerivedPath;
  recommended: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-300 rounded p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {STRATEGY_LABEL[path.strategy]}
          {recommended && (
            <span className="ml-2 text-xs border border-gray-400 rounded px-1.5 py-0.5">Recommended</span>
          )}
        </p>
        <button type="button" onClick={() => setExpanded((e) => !e)} className="text-xs text-gray-500 underline">
          {expanded ? 'Hide detail' : 'Show detail'}
        </button>
      </div>

      <p className="text-sm text-gray-700">{path.landingDefinition}</p>
      <p className="text-xs text-gray-500">
        {path.calendarRange.minWeeks}–{path.calendarRange.maxWeeks} weeks at {path.intensityHoursPerWeek}h/week
      </p>

      {recommended && (
        <p className="text-xs text-gray-400 italic">
          Balances speed and depth — a good default starting point. (Placeholder reasoning; real
          per-user recommendation logic is live-mode work, not yet built.)
        </p>
      )}

      {expanded && (
        <div className="pt-2 space-y-1">
          <p className="text-xs text-gray-500">
            Total effort: {path.effortTotalHours}h · Probability: {path.probabilityBand} · Basis: {path.basis}
          </p>
          <div className="divide-y divide-gray-100">
            {path.tasks.map((t) => (
              <div key={t.id} className="py-1.5 text-sm text-gray-700">
                {t.title} <span className="text-xs text-gray-400">({t.evolveCategory}, {t.effortHours}h)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={onSelect} className="w-full mt-2 py-2 px-3 bg-gray-900 text-white text-sm rounded">
        Select this path
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export interface SessionContext {
  sessionId: string;
  currentRole: string | null;
  desiredRole: string;
}

// Blueprint is canonically reached from a goal (/activate -> "Build roadmap") —
// sessionContext is required, not optional. The standalone/no-session entry
// was retired: /blueprint/identify is session-scoped (roles live on the
// session, not re-entered) and /blueprint/derive no longer accepts raw roles
// at all, so there is no coherent flow without a session.
export default function BlueprintForm({ sessionContext }: { sessionContext: SessionContext }) {
  const [view, setView] = useState<'gates' | 'task-review' | 'dispute' | 'paths' | 'edit'>('gates');

  // gates — timeline deliberately not collected: the mock identifier ignores
  // gateAnswers entirely, so asking for an answer the UI can't act on is a
  // small trust cost for no benefit (backlogged; field stays optional in the
  // contract for when the live identifier consumes it).
  const [weeklyHours, setWeeklyHours] = useState('');

  // Relevant-experience input (ADR-013 sub-slice 3) — substrate-derived checklist +
  // optional free-text, entirely skippable. substrateSkills populates from GET
  // /blueprint/substrate-skills on mount; checkedSkills is user selection state, not
  // derived from substrateSkills, so it survives a skills-list refetch.
  const [substrateSkills, setSubstrateSkills] = useState<{ name: string; canonical_name?: string }[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  // Flips true only after a real wait (see the useEffect below) — distinct from
  // skillsLoading so the copy can escalate without a layout jump on the common fast path.
  const [skillsLoadingSlow, setSkillsLoadingSlow] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [checkedSkills, setCheckedSkills] = useState<Set<string>>(new Set());
  const [relevantExperienceText, setRelevantExperienceText] = useState('');

  const [identifying, setIdentifying] = useState(false);
  const [gatesError, setGatesError] = useState<string | null>(null);

  // Fetches the to-role substrate's skills for the checklist. Runs once per session (role is
  // fixed on the session — ADR-013 §1). For an unseeded role this triggers on-demand substrate
  // generation server-side (~15-20s) — skillsLoadingSlow escalates the copy after a real wait
  // rather than assuming slow on every load, so the common (seeded, fast) case stays quiet.
  useEffect(() => {
    let cancelled = false;
    setSkillsLoading(true);
    setSkillsLoadingSlow(false);
    setSkillsError(null);

    const slowTimer = setTimeout(() => {
      if (!cancelled) setSkillsLoadingSlow(true);
    }, 4000);

    (async () => {
      try {
        const res = await fetch(
          `/api/v1/blueprint/substrate-skills?sessionId=${encodeURIComponent(sessionContext.sessionId)}`,
        );
        if (!res.ok) {
          const data = (await res.json()) as { error?: { message?: string } };
          throw new Error(data.error?.message ?? 'Could not load relevant-experience options.');
        }
        const data = (await res.json()) as { skills: { name: string; canonical_name?: string }[] };
        if (!cancelled) setSubstrateSkills(data.skills);
      } catch (err) {
        // Non-fatal — the checklist just won't render; free-text and skipping still work
        // (see the gates view below), matching the "graceful degradation, visibly" theme
        // used elsewhere (never silently look successful while empty, but also never let
        // an optional enrichment block the core flow).
        if (!cancelled) setSkillsError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setSkillsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [sessionContext.sessionId]);

  function toggleCheckedSkill(name: string) {
    setCheckedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // task-review
  const [toRoleKey, setToRoleKey] = useState('');
  const [identifiedTasks, setIdentifiedTasks] = useState<DraftTask[]>([]);
  const [assessment, setAssessment] = useState<CounsellorAssessment>(EMPTY_ASSESSMENT);
  const [derivingPaths, setDerivingPaths] = useState(false);
  const [deriveError, setDeriveError] = useState<string | null>(null);

  // dispute
  const [disputeTask, setDisputeTask] = useState<DraftTask | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [disputeResult, setDisputeResult] = useState<DisputeResult | null>(null);

  // paths
  const [paths, setPaths] = useState<DerivedPath[]>([]);
  const [assumedFreshStart, setAssumedFreshStart] = useState(false);

  // edit / promote
  const [selectedPath, setSelectedPath] = useState<DerivedPath | null>(null);
  const [editedTasks, setEditedTasks] = useState<DraftTask[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<StoredBlueprint | null>(null);

  async function handleGatesSubmit(e: React.FormEvent) {
    e.preventDefault();
    // No required-field guard — the whole relevant-experience input is optional/skippable
    // (ADR-013 sub-slice 3). An empty gateAnswers is a valid, complete submission.
    setIdentifying(true);
    setGatesError(null);
    try {
      const trimmedText = relevantExperienceText.trim();
      const res = await fetch('/api/v1/blueprint/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionContext.sessionId,
          weeklyHours: weeklyHours.trim() ? Number(weeklyHours) : undefined,
          gateAnswers: {
            checkedSkills: [...checkedSkills],
            ...(trimmedText ? { relevantExperienceText: trimmedText } : {}),
          },
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Request failed');
      }
      const data = (await res.json()) as { toRoleKey: string; tasks: DraftTask[]; assessment: CounsellorAssessment };
      setToRoleKey(data.toRoleKey);
      setIdentifiedTasks(data.tasks);
      setAssessment(data.assessment);
      setView('task-review');
    } catch (err) {
      setGatesError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIdentifying(false);
    }
  }

  function openDispute(task: DraftTask) {
    setDisputeTask(task);
    setDisputeReason('');
    setDisputeResult(null);
    setDisputeError(null);
    setView('dispute');
  }

  async function handleDisputeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!disputeTask || !disputeReason.trim()) return;
    setDisputing(true);
    setDisputeError(null);
    try {
      const res = await fetch('/api/v1/blueprint/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: disputeTask, reason: disputeReason.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Request failed');
      }
      const data = (await res.json()) as DisputeResult;
      setDisputeResult(data);
      // Sound reason -> the system agrees and drops the task immediately.
      // A countered dispute leaves the task in place until the user decides
      // (their decision is final — see the Keep/Drop buttons in the render).
      if (data.disposition === 'agreed') {
        setIdentifiedTasks((prev) => prev.filter((t) => t.id !== disputeTask.id));
      }
    } catch (err) {
      setDisputeError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDisputing(false);
    }
  }

  function resolveDispute(keep: boolean) {
    if (!keep && disputeTask) {
      setIdentifiedTasks((prev) => prev.filter((t) => t.id !== disputeTask.id));
    }
    setDisputeTask(null);
    setView('task-review');
  }

  async function handleAgree() {
    setDerivingPaths(true);
    setDeriveError(null);
    try {
      const res = await fetch('/api/v1/blueprint/derive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: identifiedTasks,
          toRoleKey,
          weeklyHours: weeklyHours.trim() ? Number(weeklyHours) : undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Request failed');
      }
      const data = (await res.json()) as { paths: DerivedPath[] };
      setPaths(data.paths);
      setAssumedFreshStart(!sessionContext.currentRole);
      setView('paths');
    } catch (err) {
      setDeriveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDerivingPaths(false);
    }
  }

  function handleSelectPath(path: DerivedPath) {
    setSelectedPath(path);
    setEditedTasks(path.tasks.map((t) => ({ ...t })));
    setSaved(null);
    setSaveError(null);
    setView('edit');
  }

  function moveTask(index: number, direction: -1 | 1) {
    setEditedTasks((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function removeTask(index: number) {
    setEditedTasks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!selectedPath) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/v1/blueprint/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionContext.sessionId,
          // effortTotalHours/calendarRange are whatever was last derived — the
          // server never reads them (they're not persisted; see pathTotals.ts),
          // so stale values here are harmless. tasks is the authoritative part.
          path: { ...selectedPath, tasks: editedTasks },
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Failed to save');
      }
      const data = (await res.json()) as StoredBlueprint;
      setSaved(data);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  if (view === 'gates') {
    return (
      <div className="w-full max-w-lg">
        <a href="/activate" className="text-xs text-gray-500 underline">
          ← Back to your explorations
        </a>
        <h1 className="text-xl font-semibold text-gray-900 mb-4 mt-2">Before we build your plan</h1>
        <div className="bg-white border border-gray-200 rounded p-3 text-sm text-gray-700 mb-4">
          <p>
            From <span className="font-medium">{sessionContext.currentRole || 'not specified'}</span> to{' '}
            <span className="font-medium">{sessionContext.desiredRole}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">From your goal — not editable here.</p>
        </div>
        <form onSubmit={handleGatesSubmit} className="space-y-4">
          <div>
            <label htmlFor="weeklyHours" className="block text-sm text-gray-700 mb-1">
              Weekly hours available <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="weeklyHours"
              type="number"
              min={0}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <p className="block text-sm text-gray-700 mb-1">
              Anything you&apos;ve done that connects to this role?{' '}
              <span className="text-gray-400">(optional)</span>
            </p>

            {skillsLoading && (
              <p className="text-sm text-gray-500 border border-gray-200 rounded px-3 py-2">
                {skillsLoadingSlow
                  ? `Still working — gathering the skill list for ${sessionContext.desiredRole} for the first time can take up to 20 seconds…`
                  : 'Loading relevant-experience options…'}
              </p>
            )}

            {!skillsLoading && skillsError && (
              <p className="text-sm text-gray-500 border border-gray-200 rounded px-3 py-2">
                Couldn&apos;t load a checklist for this role — no problem, describe it below instead, or skip.
              </p>
            )}

            {!skillsLoading && !skillsError && substrateSkills.length > 0 && (
              <fieldset className="border border-gray-200 rounded p-3 mb-2">
                <legend className="text-xs text-gray-500 px-1">
                  Which of these do you already have experience with?
                </legend>
                <div className="space-y-1.5 mt-1">
                  {substrateSkills.map((skill) => (
                    <label key={skill.name} className="flex items-start gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={checkedSkills.has(skill.name)}
                        onChange={() => toggleCheckedSkill(skill.name)}
                        className="mt-0.5"
                        title={skill.canonical_name}
                      />
                      <span>{skill.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <label htmlFor="relevantExperienceText" className="block text-xs text-gray-500 mb-1 mt-2">
              Or tell us about other relevant experience
            </label>
            <input
              id="relevantExperienceText"
              type="text"
              value={relevantExperienceText}
              onChange={(e) => setRelevantExperienceText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="anything else about your background that might be relevant, even if it seems unrelated"
            />
          </div>
          {gatesError && <p className="text-sm text-red-700">{gatesError}</p>}
          <button
            type="submit"
            disabled={identifying}
            className="w-full py-2 px-4 bg-gray-900 text-white text-sm rounded disabled:opacity-50"
          >
            {identifying ? 'Identifying tasks…' : 'Continue'}
          </button>
        </form>
      </div>
    );
  }

  if (view === 'task-review') {
    // identifiedTasks (mutated by dispute — see handleDisputeSubmit/resolveDispute) stays
    // the single source of truth for what's still active and what flows to /blueprint/derive
    // via handleAgree, unchanged from before this view. The grouped render below is a pure
    // derived view over it: filter each group's tasks down to the still-active id set, and
    // drop any group that loses all of its tasks. No new state to keep in sync, no change to
    // the dispute handlers.
    const activeTaskIds = new Set(identifiedTasks.map((t) => t.id));
    const visibleGroups = assessment.taskGroups
      .map((group) => ({ ...group, tasks: group.tasks.filter((t) => activeTaskIds.has(t.id)) }))
      .filter((group) => group.tasks.length > 0);

    return (
      <div className="w-full max-w-lg space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-gray-900">Here&apos;s what we think you need to work on</h1>
          <p className="text-xs text-gray-500">
            Review the plan below. Dispute anything that doesn&apos;t fit before agreeing.
          </p>
        </div>

        {/* Framing — the counsellor's opening read. Prose, not a boxed card: distinct from
            the task list below by typography alone (larger, relaxed line-height), not by
            introducing a new visual container the rest of the app doesn't use. Renders
            nothing in mock mode (empty framing) — no empty box. */}
        {assessment.framing && (
          <p className="text-[15px] leading-relaxed text-gray-800">{assessment.framing}</p>
        )}

        <div className="space-y-5">
          {visibleGroups.map((group, gi) => (
            <div key={gi} className="space-y-2">
              {/* Empty title (mock mode's single placeholder group) -> no header at all,
                  so mock mode degrades to a plain headerless task list, not a broken/empty
                  section header. */}
              {group.title && (
                <div className="space-y-0.5">
                  <h2 className="text-sm font-semibold text-gray-900">{group.title}</h2>
                  {group.rationale && <p className="text-xs text-gray-500">{group.rationale}</p>}
                </div>
              )}
              <div className="border border-gray-300 rounded p-4">
                {group.tasks.map((task) => (
                  <ReviewTaskRow key={task.id} task={task} onDispute={() => openDispute(task)} />
                ))}
              </div>
            </div>
          ))}
          {visibleGroups.length === 0 && <p className="text-sm text-gray-400">No tasks left.</p>}
        </div>

        {/* Through-line — the counsellor's closing read. Same prose treatment as framing;
            a top rule separates it from the plan without boxing it like a card. */}
        {assessment.throughLine && (
          <p className="text-[15px] leading-relaxed text-gray-800 border-t border-gray-200 pt-4">
            {assessment.throughLine}
          </p>
        )}

        {deriveError && <p className="text-sm text-red-700">{deriveError}</p>}

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAgree}
            disabled={derivingPaths || identifiedTasks.length === 0}
            className="w-full py-2 px-4 bg-gray-900 text-white text-sm rounded disabled:opacity-50"
          >
            {derivingPaths ? 'Building paths…' : 'Agree & proceed'}
          </button>
          <button
            type="button"
            disabled
            className="w-full py-2 px-4 border border-dashed border-gray-400 text-gray-400 text-sm rounded cursor-not-allowed"
            title="Deferred per ADR-013 — not built yet"
          >
            Disagree entirely (coming soon)
          </button>
        </div>
      </div>
    );
  }

  if (view === 'dispute' && disputeTask) {
    return (
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Dispute a task</h1>
        <div className="border border-gray-300 rounded p-3 text-sm text-gray-700">{disputeTask.title}</div>

        {!disputeResult ? (
          <form onSubmit={handleDisputeSubmit} className="space-y-4">
            <div>
              <label htmlFor="reason" className="block text-sm text-gray-700 mb-1">
                Why doesn&apos;t this fit?
              </label>
              <textarea
                id="reason"
                required
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                rows={3}
                placeholder="e.g. I already have years of experience with this"
              />
            </div>
            {disputeError && <p className="text-sm text-red-700">{disputeError}</p>}
            <button
              type="submit"
              disabled={disputing || !disputeReason.trim()}
              className="w-full py-2 px-4 bg-gray-900 text-white text-sm rounded disabled:opacity-50"
            >
              {disputing ? 'Sending…' : 'Send'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 border border-gray-300 rounded p-3">{disputeResult.message}</p>
            {disputeResult.disposition === 'agreed' ? (
              <button
                type="button"
                onClick={() => resolveDispute(false)}
                className="w-full py-2 px-4 bg-gray-900 text-white text-sm rounded"
              >
                Continue
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => resolveDispute(true)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-sm rounded"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => resolveDispute(false)}
                  className="flex-1 py-2 px-4 bg-gray-900 text-white text-sm rounded"
                >
                  Drop it anyway
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setDisputeTask(null);
            setView('task-review');
          }}
          className="text-xs text-gray-500 underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (view === 'paths') {
    return (
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Choose a path</h1>

        {assumedFreshStart && (
          <p className="text-sm text-gray-600 border border-gray-300 rounded p-3">
            Assuming you&apos;re starting fresh in this field — if you already have some of these
            skills, you&apos;ll move faster than shown; we&apos;ll factor that in once
            skill-assessment is added.
          </p>
        )}

        <div className="space-y-3">
          {paths.map((path) => (
            <PathCard
              key={path.strategy}
              path={path}
              recommended={path.strategy === 'optimal'}
              onSelect={() => handleSelectPath(path)}
            />
          ))}
        </div>

        <button type="button" onClick={() => setView('task-review')} className="text-xs text-gray-500 underline">
          Back to task review
        </button>
      </div>
    );
  }

  // view === 'edit'
  // Recomputed live from the current edited task set — not the stale totals
  // captured when the path was first derived (pathTotals.ts is the one
  // source of truth derivePathsFromTasks and this view both use).
  const liveTotals = selectedPath
    ? computePathTotals(editedTasks, selectedPath.intensityHoursPerWeek)
    : { effortTotalHours: 0, calendarRange: { minWeeks: 0, maxWeeks: 0 } };

  return (
    <div className="w-full max-w-lg space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">
        Edit your {selectedPath ? STRATEGY_LABEL[selectedPath.strategy] : ''} path
      </h1>

      <p className="text-xs text-gray-500">
        {liveTotals.effortTotalHours}h total · {liveTotals.calendarRange.minWeeks}–
        {liveTotals.calendarRange.maxWeeks} weeks at {selectedPath?.intensityHoursPerWeek}h/week
      </p>

      <div className="border border-gray-300 rounded p-4">
        {editedTasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            index={i}
            total={editedTasks.length}
            onMoveUp={() => moveTask(i, -1)}
            onMoveDown={() => moveTask(i, 1)}
            onRemove={() => removeTask(i)}
          />
        ))}
        {editedTasks.length === 0 && <p className="text-sm text-gray-400">No tasks left.</p>}
      </div>

      {saved ? (
        <div className="border border-gray-300 rounded p-4 space-y-2">
          <p className="text-sm text-gray-900">Roadmap saved (version {saved.version}).</p>
          <a href="/activate" className="text-sm text-gray-700 underline">
            Back to your goal
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {saveError && <p className="text-sm text-red-700">{saveError}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || editedTasks.length === 0}
            className="w-full py-2 px-4 bg-gray-900 text-white text-sm rounded disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save this roadmap'}
          </button>
        </div>
      )}

      <button type="button" onClick={() => setView('paths')} className="text-xs text-gray-500 underline">
        Back to paths
      </button>
    </div>
  );
}
