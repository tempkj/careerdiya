'use client';
import { useEffect, useState } from 'react';
import { categoryLabel, plainText, taskMetaLine } from './plainLanguage';
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

// Path tasks are titled "Build <depth>-level <skill>" (ADR-013: the depth is what differs
// between Fastest / Optimal / Thorough). On screen we show the task the user actually agreed
// to on the review step, with the depth as a label underneath. Display only: the stored
// title is unchanged.
const DEPTH_LABEL: Record<string, string> = {
  awareness: 'Awareness level',
  working: 'Working level',
  expert: 'Expert level',
};

function depthOf(title: string): string | null {
  const m = title.match(/^Build (awareness|working|expert)-level /);
  return m ? DEPTH_LABEL[m[1]!] ?? null : null;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function TaskRow({
  task,
  agreedTitle,
  index,
  total,
  editing,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  task: DraftTask;
  agreedTitle: string | null;
  index: number;
  total: number;
  editing: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const depth = depthOf(task.title);
  const meta = [
    depth,
    categoryLabel(task.evolveCategory),
    `${task.effortHours}h`,
    task.dependencies.length > 0 ? `after ${plural(task.dependencies.length, 'other task', 'other tasks')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-200 last:border-0">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold grid place-items-center">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-gray-900">{plainText(agreedTitle ?? task.title)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
        </div>
      </div>
      {editing && (
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:border-blue-300 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:border-blue-300 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="px-2.5 py-1 text-xs bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
        >
          Remove
        </button>
      </div>
      )}
    </div>
  );
}

// ── Task-review row (plan row, grouped under a counsellor section + per-task dispute) ──

function ReviewTaskRow({ task, onDispute }: { task: DraftTask; onDispute: () => void }) {
  // Titles first; the long explanation is one tap away, so the list scans quickly.
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-200 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{plainText(task.title)}</p>
        <p className="text-xs text-blue-700 mt-0.5">
          {taskMetaLine(task)}
          {task.description && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="underline text-gray-500 hover:text-gray-800"
                aria-expanded={open}
              >
                {open ? 'Less' : 'Why this task'}
              </button>
            </>
          )}
        </p>
        {open && task.description && (
          <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{plainText(task.description)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDispute}
        className="btn btn-secondary btn-small shrink-0"
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
  agreedTitles,
  onSelect,
}: {
  path: DerivedPath;
  recommended: boolean;
  agreedTitles: Map<string, string>;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-white border rounded-2xl p-5 flex flex-col gap-2 ${
        recommended ? 'border-blue-700 ring-1 ring-blue-700' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-bold text-gray-900">{STRATEGY_LABEL[path.strategy]}</p>
        {recommended && (
          <span className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-blue-700 text-white">Recommended</span>
        )}
      </div>

      <p className="text-2xl font-bold text-gray-900 leading-tight">
        {path.calendarRange.minWeeks}–{path.calendarRange.maxWeeks} weeks
      </p>
      <p className="text-xs text-gray-500">
        at {path.intensityHoursPerWeek}h a week · {path.effortTotalHours}h in total
      </p>
      <p className="text-sm text-gray-700 leading-relaxed">{path.landingDefinition}</p>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="self-start text-xs text-gray-500 underline"
        aria-expanded={expanded}
      >
        {expanded ? 'Hide tasks' : `See the ${path.tasks.length} tasks`}
      </button>

      {expanded && (
        <div className="space-y-1">
          <ol className="divide-y divide-gray-100">
            {path.tasks.map((t, i) => (
              <li key={t.id} className="py-1.5 text-sm text-gray-700">
                {i + 1}. {plainText(agreedTitles.get(t.id) ?? t.title)}{' '}
                <span className="text-xs text-gray-500">({t.effortHours}h)</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <button
        type="button"
        onClick={onSelect}
        className={`btn ${recommended ? 'btn-primary' : 'btn-secondary'} w-full mt-auto`}
      >
        Choose {STRATEGY_LABEL[path.strategy]}
      </button>
    </div>
  );
}

// ── Step indicator ──────────────────────────────────────────────────────────

const STEPS = ['Your starting point', 'Review tasks', 'Choose a path', 'Save your roadmap'] as const;

function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center gap-2 text-xs mb-5" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < current ? 'done' : n === current ? 'now' : 'next';
        return (
          <li key={label} className="flex items-center gap-2 min-w-0" aria-current={state === 'now' ? 'step' : undefined}>
            <span
              className={`shrink-0 w-6 h-6 rounded-full grid place-items-center font-semibold ${
                state === 'now'
                  ? 'bg-blue-700 text-white'
                  : state === 'done'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {state === 'done' ? '✓' : n}
            </span>
            <span className={`max-sm:hidden truncate ${state === 'now' ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
              {label}
            </span>
            {n < STEPS.length && <span className="w-4 sm:w-6 h-px bg-gray-300 shrink-0" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
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
  const [editingOrder, setEditingOrder] = useState(false);
  const [framingOpen, setFramingOpen] = useState(false);
  // The tasks the user agreed to on the review step, by id — shown in place of the
  // depth-qualified path titles (see TaskRow).
  const agreedTitles = new Map(identifiedTasks.map((t) => [t.id, t.title] as const));

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
    setEditingOrder(false);
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
      setEditingOrder(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  if (view === 'gates') {
    return (
      <div className="ca-panel w-full max-w-3xl mx-auto">
        <StepIndicator current={1} />
        <a href="/activate" className="text-xs text-gray-500 underline">
          ← Back to your explorations
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-2">Before we build your plan</h1>
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
              className="input"
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <p className="block text-sm text-gray-700 mb-1">
              Anything you&apos;ve done that connects to this role?{' '}
              <span className="text-gray-400">(optional)</span>
            </p>

            {skillsLoading && (
              <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2">
                {skillsLoadingSlow
                  ? `Still working — gathering the skill list for ${sessionContext.desiredRole} for the first time can take up to 20 seconds…`
                  : 'Loading relevant-experience options…'}
              </p>
            )}

            {!skillsLoading && skillsError && (
              <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2">
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
              className="input"
              placeholder="anything else about your background that might be relevant, even if it seems unrelated"
            />
          </div>
          {gatesError && <p className="text-sm text-red-700">{gatesError}</p>}
          <button
            type="submit"
            disabled={identifying}
            className="btn btn-primary w-full disabled:opacity-50"
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
      <div className="ca-panel w-full max-w-3xl mx-auto space-y-5">
        <StepIndicator current={2} />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Here&apos;s what we think you need to work on</h1>
          <p className="text-sm text-gray-500">
            {plural(identifiedTasks.length, 'task', 'tasks')}
            {visibleGroups.length > 1 ? ` in ${visibleGroups.length} areas` : ''}. Open an area to see its
            tasks, and dispute anything that doesn&apos;t fit.
          </p>
        </div>

        {/* Framing: the counsellor's opening read, shortened to three lines until asked for. */}
        {assessment.framing && (
          <div>
            <p className={`text-[15px] leading-relaxed text-gray-800 ${framingOpen ? '' : 'line-clamp-3'}`}>
              {plainText(assessment.framing)}
            </p>
            <button
              type="button"
              onClick={() => setFramingOpen((o) => !o)}
              className="text-xs text-gray-500 underline mt-1"
              aria-expanded={framingOpen}
            >
              {framingOpen ? 'Show less' : 'Read more'}
            </button>
          </div>
        )}

        <div className="space-y-3">
          {visibleGroups.map((group, gi) =>
            group.title ? (
              <details
                key={gi}
                open={gi === 0}
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden"
              >
                <summary className="flex items-start justify-between gap-3 cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-gray-900">{plainText(group.title)}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {plural(group.tasks.length, 'task', 'tasks')}
                    </span>
                  </span>
                  <span className="text-blue-700 text-sm mt-1 transition-transform group-open:rotate-180" aria-hidden="true">
                    ⌄
                  </span>
                </summary>
                <div className="px-5 pb-4">
                  {group.rationale && (
                    <p className="text-sm text-gray-600 leading-relaxed mb-2">{plainText(group.rationale)}</p>
                  )}
                  {group.tasks.map((task) => (
                    <ReviewTaskRow key={task.id} task={task} onDispute={() => openDispute(task)} />
                  ))}
                </div>
              </details>
            ) : (
              // Mock mode's single untitled group: a plain list, no empty header.
              <div key={gi} className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
                {group.tasks.map((task) => (
                  <ReviewTaskRow key={task.id} task={task} onDispute={() => openDispute(task)} />
                ))}
              </div>
            ),
          )}
          {visibleGroups.length === 0 && <p className="text-sm text-gray-500">No tasks left.</p>}
        </div>

        {/* Through-line: the counsellor's closing read. */}
        {assessment.throughLine && (
          <div className="rounded-2xl bg-blue-50 px-5 py-4">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-[.14em] mb-1">How it fits together</p>
            <p className="text-sm leading-relaxed text-gray-800">{plainText(assessment.throughLine)}</p>
          </div>
        )}

        {deriveError && <p className="text-sm text-red-700">{deriveError}</p>}

        {/* Kept in view while scrolling a long plan. */}
        <div className="sticky bottom-0 z-10 -mx-5 px-5 sm:-mx-7 sm:px-7 py-3 bg-white/95 backdrop-blur border-t border-gray-200">
          <button
            type="button"
            onClick={handleAgree}
            disabled={derivingPaths || identifiedTasks.length === 0}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {derivingPaths ? 'Building paths…' : 'Agree & see paths'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'dispute' && disputeTask) {
    return (
      <div className="ca-panel w-full max-w-3xl mx-auto space-y-4">
        <StepIndicator current={2} />
        <h1 className="text-2xl font-bold text-gray-900">Dispute a task</h1>
        <div className="border border-gray-200 rounded-xl p-3 text-sm text-gray-700">{plainText(disputeTask.title)}</div>

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
                className="input"
                rows={3}
                placeholder="e.g. I already have years of experience with this"
              />
            </div>
            {disputeError && <p className="text-sm text-red-700">{disputeError}</p>}
            <button
              type="submit"
              disabled={disputing || !disputeReason.trim()}
              className="btn btn-primary w-full disabled:opacity-50"
            >
              {disputing ? 'Sending…' : 'Send'}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-xl p-3">{disputeResult.message}</p>
            {disputeResult.disposition === 'agreed' ? (
              <button
                type="button"
                onClick={() => resolveDispute(false)}
                className="btn btn-primary w-full"
              >
                Continue
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => resolveDispute(true)}
                  className="btn btn-secondary flex-1"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => resolveDispute(false)}
                  className="btn btn-primary flex-1"
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
      <div className="ca-panel w-full max-w-5xl mx-auto space-y-4">
        <StepIndicator current={3} />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Choose a path</h1>
          <p className="text-sm text-gray-500">
            Same tasks, different depth. Optimal is a good default; you can change the order or drop
            tasks next.
          </p>
        </div>

        {assumedFreshStart && (
          <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl p-3">
            Assuming you&apos;re starting fresh in this field — if you already have some of these
            skills, you&apos;ll move faster than shown; we&apos;ll factor that in once
            skill-assessment is added.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-3 items-stretch">
          {paths.map((path) => (
            <PathCard
              key={path.strategy}
              path={path}
              recommended={path.strategy === 'optimal'}
              agreedTitles={agreedTitles}
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

  const pathName = selectedPath ? STRATEGY_LABEL[selectedPath.strategy] : '';
  return (
    <div className="ca-panel w-full max-w-3xl mx-auto space-y-4">
      <StepIndicator current={4} />

      {saved && (
        <div className="rounded-2xl bg-blue-50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-900">
            <span className="font-semibold">Roadmap saved.</span> You can come back to it from your goal.
          </p>
          <a href="/activate" className="btn btn-secondary btn-small">
            Back to your goal
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {saved ? `Your ${pathName} roadmap` : `Your ${pathName} path`}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {plural(editedTasks.length, 'task', 'tasks')} · {liveTotals.calendarRange.minWeeks}–
            {liveTotals.calendarRange.maxWeeks} weeks at {selectedPath?.intensityHoursPerWeek}h a week ·{' '}
            {liveTotals.effortTotalHours}h in total
          </p>
        </div>
        {!saved && (
          <button
            type="button"
            onClick={() => setEditingOrder((e) => !e)}
            className="btn btn-secondary btn-small"
            aria-pressed={editingOrder}
          >
            {editingOrder ? 'Done editing' : 'Change order or remove'}
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
        {editedTasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            agreedTitle={agreedTitles.get(task.id) ?? null}
            index={i}
            total={editedTasks.length}
            editing={editingOrder && !saved}
            onMoveUp={() => moveTask(i, -1)}
            onMoveDown={() => moveTask(i, 1)}
            onRemove={() => removeTask(i)}
          />
        ))}
        {editedTasks.length === 0 && <p className="text-sm text-gray-500 py-2">No tasks left.</p>}
      </div>

      {saved ? (
        <button type="button" onClick={() => setSaved(null)} className="text-xs text-gray-500 underline">
          Make changes
        </button>
      ) : (
        <>
          {saveError && <p className="text-sm text-red-700">{saveError}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || editedTasks.length === 0}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save this roadmap'}
          </button>
          <button type="button" onClick={() => setView('paths')} className="text-xs text-gray-500 underline">
            Back to paths
          </button>
        </>
      )}
    </div>
  );
}
