'use client';
import { useEffect, useRef, useState } from 'react';
import type { AdjacentRoleSuggestion, ActivationResult, ActivationSession } from '../domain/types';

// Chip label / form-prefill display only — roleKey is stored normalized (lowercase),
// same convention as the "e.g. Product Manager" placeholders elsewhere in this form.
function titleCase(roleKey: string): string {
  return roleKey.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Escape-hatch CTA — placeholder for the not-yet-shipped career-advice intent ──
//
// Copy constraint: must read as an offer of help ("we can help with the harder
// question"), never as a nag ("are you sure?"). See the "intents don't overlap"
// principle in planning/Backlog.md — this is the one-way door out of the switch
// intent for a user who's actually unsure of their destination, not a doubt
// planted on a decision the product just helped them make. Placed on
// pre-commitment screens only (input form, gap-analysis result, compare grid) —
// never past Set-as-Goal. Inert until the advice intent ships: no destination,
// no signal collection, just a coming-soon marker so it doesn't read as broken.
// Hidden until the advisor conversation exists: a disabled "coming soon" box on every screen
// reads as unfinished. Call sites are kept so it can be switched back on in one place.
const SHOW_COMING_SOON = false;

function NeedAdviceCTA({ label }: { label: string }) {
  if (!SHOW_COMING_SOON) return null;
  return (
    <button
      type="button"
      disabled
      title="Coming soon — talk it through with a career advisor"
      className="w-full py-2 px-3 border border-dashed border-gray-300 text-gray-400 text-xs rounded-lg cursor-not-allowed"
    >
      {label} <span className="text-gray-300">· coming soon</span>
    </button>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

// Plain-language source of each gap line. No percentages: the model's confidence is not a
// measured probability, so showing "85%" would be false precision (honesty gate).
const BASIS_LABEL: Record<string, string> = {
  grounded: 'Based on job-market data',
  inferred: 'Our estimate',
  stated: 'From what you told us',
};

function GapCard({ item }: { item: ActivationResult['gap'][number] }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{item.skill}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {BASIS_LABEL[item.confidence.basis] ?? item.confidence.basis}
        </p>
      </div>
      <span
        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold shrink-0 ${
          item.have ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'
        }`}
      >
        {item.have ? 'You have this' : 'To build'}
      </span>
    </div>
  );
}

function GapSection({ gap }: { gap: ActivationResult['gap'] }) {
  if (gap.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold text-blue-700 uppercase tracking-[.14em] mb-2">What you&apos;ll need</p>
      <div className="bg-white border border-gray-200 rounded-xl px-4 divide-y divide-gray-100">
        {gap.map((item) => (
          <GapCard key={item.skill} item={item} />
        ))}
      </div>
    </div>
  );
}

function FirstActionCard({ text }: { text: string }) {
  return (
    <div className="bg-blue-700 text-white rounded-2xl p-5">
      <p className="text-xs font-bold text-[#f2c75a] uppercase tracking-[.14em] mb-1">
        First action this week
      </p>
      <p className="text-sm font-medium leading-relaxed">{text}</p>
    </div>
  );
}

// ── Exploration list (returning-user view) ───────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SessionCard({
  session,
  isActiveGoal,
  hasAnyGoal,
  onPromote,
  promoting,
  selected,
  selectionDisabled,
  onToggleSelect,
}: {
  session: ActivationSession;
  isActiveGoal: boolean;
  hasAnyGoal: boolean;
  onPromote: (s: ActivationSession) => void;
  promoting: string | null;
  selected: boolean;
  selectionDisabled: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const isPromoting = promoting === session.id;

  const meta = [
    session.currentRole ? `from ${session.currentRole}` : null,
    fmt(session.createdAt),
    session.gap.length > 0 ? `${session.gap.length} ${session.gap.length === 1 ? 'skill' : 'skills'} to build` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // One compact row per exploration: role and a single meta line on the left, actions on
  // the right (stacking under the text on phones).
  return (
    <div
      className={`bg-white border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${
        isActiveGoal ? 'border-blue-700 ring-1 ring-blue-700' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <input
          type="checkbox"
          checked={selected}
          disabled={selectionDisabled}
          onChange={() => onToggleSelect(session.id)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-700 focus:ring-blue-700 disabled:opacity-40"
          aria-label={`Select ${session.desiredRole ?? 'exploration'} to compare`}
          title={selectionDisabled ? 'Up to 3 explorations at a time' : 'Select to compare'}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
            <span className="truncate">{session.desiredRole ?? 'Unknown role'}</span>
            {isActiveGoal && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-700 text-white">
                Your goal
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 sm:justify-end">
        {isActiveGoal && (
          // Gated to the active-goal card only — it isn't a parallel entry
          // point for any non-goal exploration.
          <a href={`/blueprint?sessionId=${session.id}`} className="btn btn-primary btn-small">
            Build roadmap
          </a>
        )}
        <button
          onClick={() => onPromote(session)}
          disabled={isPromoting}
          className={`btn ${!hasAnyGoal ? 'btn-primary' : 'btn-secondary'} btn-small disabled:opacity-50`}
        >
          {isPromoting
            ? 'Saving…'
            : isActiveGoal
            ? 'Refresh goal'
            : hasAnyGoal
            ? 'Make this my goal'
            : 'Set as my goal'}
        </button>
      </div>
    </div>
  );
}

const MAX_COMPARE_SELECTION = 3;

function ExplorationListView({
  sessions,
  activeGoalSessionId,
  onStartNew,
  onPromote,
  promoting,
  promoteError,
  selectedForCompare,
  onToggleSelect,
  onCompare,
}: {
  sessions: ActivationSession[];
  activeGoalSessionId: string | null;
  onStartNew: () => void;
  onPromote: (s: ActivationSession) => void;
  promoting: string | null;
  promoteError: string | null;
  selectedForCompare: string[];
  onToggleSelect: (id: string) => void;
  onCompare: () => void;
}) {
  const hasAnyGoal = activeGoalSessionId !== null;

  const byDate = (a: ActivationSession, b: ActivationSession) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  const tiers: { label: string; items: ActivationSession[] }[] = [
    {
      label: 'Your goal',
      items: sessions.filter((s) => s.id === activeGoalSessionId),
    },
    {
      label: 'Saved',
      items: sessions.filter((s) => s.id !== activeGoalSessionId).sort(byDate),
    },
  ].filter((t) => t.items.length > 0);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Your explorations</h2>
        <button
          onClick={onStartNew}
          className="btn btn-secondary btn-small"
        >
          New exploration
        </button>
      </div>

      {promoteError && (
        <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
          {promoteError}
        </p>
      )}

      {selectedForCompare.length > 0 && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-xs text-gray-500">
            {selectedForCompare.length} selected
            {selectedForCompare.length >= MAX_COMPARE_SELECTION ? ' (max)' : ''}
          </span>
          <button
            onClick={onCompare}
            disabled={selectedForCompare.length < 2}
            className="btn btn-primary btn-small disabled:opacity-40"
          >
            Compare selected ({selectedForCompare.length})
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No explorations yet.</p>
      ) : (
        <div className="space-y-5">
          {tiers.map(({ label, items }) => (
            <div key={label} className="space-y-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-[.14em]">{label}</p>
              {items.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isActiveGoal={s.id === activeGoalSessionId}
                  hasAnyGoal={hasAnyGoal}
                  onPromote={onPromote}
                  promoting={promoting}
                  selected={selectedForCompare.includes(s.id)}
                  selectionDisabled={
                    !selectedForCompare.includes(s.id) &&
                    selectedForCompare.length >= MAX_COMPARE_SELECTION
                  }
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Compare view (side-by-side, up to MAX_COMPARE_SELECTION explorations) ────

// Bridges a persisted ActivationSession into the ActivationResult shape ResultView
// expects, for the compare view's "view full detail" drill-in. topSkills is always
// [] here — current_position (AI-derived strengths) isn't persisted on
// activation_session yet (see planning/Backlog.md), so the chips row renders empty
// rather than fabricating content; everything else (gap, firstAction, role) is real.
function sessionToResult(session: ActivationSession): ActivationResult {
  return {
    sessionId: session.id,
    desiredPosition: { role: session.desiredRole ?? 'Unknown role', onetCode: session.onetCode },
    gap: session.gap,
    firstAction: session.firstAction ?? '',
    completed: session.completedAt !== null,
    ...(session.currentRole
      ? { currentPosition: { role: session.currentRole, topSkills: [] } }
      : {}),
  };
}

// Static class strings (not interpolated) so Tailwind's scanner picks them up.
function compareContainerWidthClass(count: number): string {
  if (count <= 1) return 'max-w-md';
  if (count === 2) return 'max-w-3xl';
  return 'max-w-5xl';
}

function compareGridColsClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
}

function CompareColumn({
  session,
  onDrillIn,
}: {
  session: ActivationSession;
  onDrillIn: (s: ActivationSession) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4">
      <div>
        <p className="text-xs font-bold text-blue-700 uppercase tracking-[.14em] mb-1">Target role</p>
        <h3 className="text-base font-semibold text-gray-900">{session.desiredRole ?? 'Unknown role'}</h3>
        {session.currentRole && (
          <p className="text-xs text-gray-400 mt-0.5">from {session.currentRole}</p>
        )}
      </div>

      {session.gap.length > 0 && (
        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-[.14em] mb-2">What you&apos;ll need</p>
          <div className="bg-gray-50 border border-gray-100 rounded-lg divide-y divide-gray-100">
            {session.gap.map((item) => (
              <div key={item.skill} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm text-gray-800">{item.skill}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                  item.have ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'
                }`}>
                  {item.have ? 'Have' : 'To build'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {session.firstAction && (
        <div className="bg-blue-700 text-white rounded-xl p-4">
          <p className="text-xs font-bold text-[#f2c75a] uppercase tracking-[.14em] mb-1">First action</p>
          <p className="text-sm leading-relaxed">{session.firstAction}</p>
        </div>
      )}

      <button
        onClick={() => onDrillIn(session)}
        className="btn btn-secondary btn-small w-full mt-auto"
      >
        View full detail
      </button>
    </div>
  );
}

function CompareView({
  sessions,
  onDrillIn,
  onBack,
}: {
  sessions: ActivationSession[];
  onDrillIn: (s: ActivationSession) => void;
  onBack: () => void;
}) {
  return (
    <div className={`w-full mx-auto ${compareContainerWidthClass(sessions.length)} space-y-4`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Compare explorations</h2>
        <button
          onClick={onBack}
          className="btn btn-secondary btn-small"
        >
          Back to list
        </button>
      </div>

      <div className={`grid ${compareGridColsClass(sessions.length)} gap-4`}>
        {sessions.map((s) => (
          <CompareColumn key={s.id} session={s} onDrillIn={onDrillIn} />
        ))}
      </div>

      <div className="max-w-sm mx-auto">
        <NeedAdviceCTA label="Still weighing these? Talk it through." />
      </div>
    </div>
  );
}

// ── Result view (after start or after resume) ────────────────────────────────

function ResultView({
  result,
  onSetGoal,
  settingGoal,
  setGoalError,
  onBack,
  onBackToComparison,
  onExplore,
}: {
  result: ActivationResult;
  onSetGoal: () => void;
  settingGoal: boolean;
  setGoalError: string | null;
  onBack: () => void;
  onBackToComparison?: () => void;
  onExplore: (suggestion: AdjacentRoleSuggestion) => void;
}) {
  return (
    <div className="ca-panel w-full max-w-3xl mx-auto space-y-6">
      {onBackToComparison && (
        <button
          onClick={onBackToComparison}
          className="btn btn-secondary btn-small"
        >
          ← Back to comparison
        </button>
      )}

      <div>
        <p className="text-xs font-bold text-blue-700 uppercase tracking-[.14em] mb-1">Target role</p>
        <h2 className="text-2xl font-bold text-gray-900">{result.desiredPosition.role}</h2>
      </div>

      {result.currentPosition && (
        <div>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-[.14em] mb-1">
            Current strengths
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.currentPosition.topSkills.map((s) => (
              <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <GapSection gap={result.gap} />
      {result.firstAction && <FirstActionCard text={result.firstAction} />}

      {setGoalError && (
        <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
          {setGoalError}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSetGoal}
          disabled={settingGoal}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {settingGoal ? 'Setting goal…' : 'Set as Goal'}
        </button>
        <button
          onClick={onBack}
          className="btn btn-secondary"
        >
          Try a different role
        </button>
      </div>

      <NeedAdviceCTA label="Not sure this is the right target?" />
    </div>
  );
}

// ── Replace-goal confirmation dialog ─────────────────────────────────────────

function ReplaceGoalDialog({
  currentGoalRole,
  nextRole,
  onConfirm,
  onCancel,
  confirming,
}: {
  currentGoalRole: string;
  nextRole: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  // Same role as the current goal (e.g. re-explored from Career Diya): the choice is which
  // exploration backs the goal, not which role — say so instead of "replace X with X".
  const sameRole = currentGoalRole.trim().toLowerCase() === nextRole.trim().toLowerCase();
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">
          {sameRole ? 'Use this newer exploration?' : 'Replace your current goal?'}
        </h3>
        {sameRole ? (
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{currentGoalRole}</span> is already your goal,
            from an earlier exploration. Use this newer gap analysis for it instead? The earlier one
            stays saved.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            Your current goal is{' '}
            <span className="font-medium text-gray-900">{currentGoalRole}</span>. Making{' '}
            <span className="font-medium text-gray-900">{nextRole}</span> your goal will replace it.
            Your other explorations stay saved.
          </p>
        )}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="btn btn-secondary flex-1"
          >
            {sameRole ? 'Keep earlier' : 'Keep current'}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="btn btn-primary flex-1 disabled:opacity-50"
          >
            {confirming ? 'Saving…' : sameRole ? 'Use this one' : 'Replace goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ActivationForm({
  sessions: initialSessions,
  activeGoalSessionId: initialActiveGoalSessionId,
  prefill,
  autoStart = false,
}: {
  userEmail: string;
  sessions: ActivationSession[];
  activeGoalSessionId: string | null;
  prefill?: { currentRole?: string | null; desiredRole?: string | null };
  /** Career Diya supplies both roles; in that handoff we skip the manual role form. */
  autoStart?: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [activeGoalSessionId, setActiveGoalSessionId] = useState(initialActiveGoalSessionId);

  const [view, setView] = useState<'list' | 'form' | 'result' | 'compare'>(
    prefill?.desiredRole ? 'form' : initialSessions.length > 0 ? 'list' : 'form',
  );
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  function toggleCompareSelection(id: string) {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE_SELECTION) return prev;
      return [...prev, id];
    });
  }

  const [currentRole, setCurrentRole] = useState(prefill?.currentRole ?? '');
  const [desiredRole, setDesiredRole] = useState(prefill?.desiredRole ?? '');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [result, setResult] = useState<ActivationResult | null>(null);
  const [activeSession, setActiveSession] = useState<ActivationSession | null>(null);
  // Which flow produced the current 'result' view — a fresh gap analysis
  // (handleSubmit) vs. a drill-in from CompareView. Only 'compare' shows the
  // "Back to comparison" action; 'fresh' leaves ResultView unchanged.
  const [resultOrigin, setResultOrigin] = useState<'fresh' | 'compare'>('fresh');

  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const autoStartedRef = useRef(false);

  const [pendingPromote, setPendingPromote] = useState<{
    session: ActivationSession;
    navigate: boolean;
  } | null>(null);

  async function runActivation(
    currentRoleValue: string,
    desiredRoleValue: string,
  ) {
    const cleanDesiredRole = desiredRoleValue.trim();
    if (!cleanDesiredRole) return;

    const cleanCurrentRole = currentRoleValue.trim();
    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/v1/activation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRole: cleanCurrentRole || undefined,
          desiredRole: cleanDesiredRole,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as ActivationResult;

      // Auto-save: every exploration is saved immediately — there is no
      // user-visible draft state.
      const completeRes = await fetch('/api/v1/activation/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: data.sessionId,
          acceptedFirstAction: true,
        }),
      });

      if (!completeRes.ok) {
        const errData = (await completeRes.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(errData?.error?.message ?? `Failed to save exploration (${completeRes.status})`);
      }

      const saved = (await completeRes.json()) as ActivationSession;
      setSessions((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
      setActiveSession(saved);
      setResult(data);
      setResultOrigin('fresh');
      setView('result');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runActivation(currentRole, desiredRole);
  }

  // Career Diya already supplied the complete transition. Do not make the user
  // re-enter From/To roles in CareerAsana; immediately run the existing activation
  // pipeline so its result screen is the gap-analysis screen.
  useEffect(() => {
    if (!autoStart || !prefill?.desiredRole?.trim() || autoStartedRef.current) return;

    autoStartedRef.current = true;

    // Do not submit a form ref here. The auto-start view intentionally does not
    // render the manual form, so there is no form element to attach a ref to.
    // Calling the activation pipeline directly is deterministic and also means
    // Career Diya → CareerAsana never flashes a redundant role-entry form.
    void runActivation(
      prefill.currentRole ?? '',
      prefill.desiredRole,
    );
  }, [autoStart, prefill?.currentRole, prefill?.desiredRole]);

  // navigate=true (gap-analysis "Set as Goal" — a decision, go build the
  // roadmap) vs navigate=false (Compare Explorations list — a comparison
  // surface; set/replace/re-apply the goal and stay put, re-render in place).
  function handlePromoteRequest(session: ActivationSession, options: { navigate: boolean }) {
    if (activeGoalSessionId !== null && activeGoalSessionId !== session.id) {
      setPendingPromote({ session, navigate: options.navigate });
      return;
    }
    void executePromote(session, options);
  }

  async function executePromote(session: ActivationSession, options: { navigate: boolean }) {
    setPendingPromote(null);
    setPromoting(session.id);
    setPromoteError(null);
    try {
      const res = await fetch(`/api/v1/activation/${session.id}/promote`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Failed to promote');
      }
      if (options.navigate) {
        // Decision made — go straight to the checklist screen.
        window.location.href = `/blueprint?sessionId=${session.id}`;
        return;
      }
      setActiveGoalSessionId(session.id);
      setPromoting(null);
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : 'Unknown error');
      setPromoting(null);
    }
  }

  const currentGoalSession = sessions.find((s) => s.id === activeGoalSessionId);

  function renderBody() {
    if (view === 'result' && result) {
      return (
        <ResultView
          result={result}
          onSetGoal={() =>
            activeSession && handlePromoteRequest(activeSession, { navigate: true })
          }
          settingGoal={activeSession !== null && promoting === activeSession.id}
          setGoalError={promoteError}
          onBackToComparison={
            resultOrigin === 'compare' ? () => setView('compare') : undefined
          }
          onBack={() => {
            // Already auto-saved (Slice 1) — no unsaved work to protect,
            // so this always goes straight back to exploring another role.
            setResult(null);
            setActiveSession(null);
            setDesiredRole('');
            setCurrentRole('');
            setView('form');
          }}
          onExplore={(suggestion) => {
            // currentRole must stay the user's real position (result.currentPosition),
            // never the hypothetical role they were viewing (result.desiredPosition) —
            // looking at a destination doesn't change where you actually stand.
            // Currently unreachable (ResultView no longer renders an onExplore trigger —
            // Item 2); kept correct rather than deleted since a future reuse of this
            // chaining logic shouldn't inherit a known-wrong implementation.
            setResult(null);
            setActiveSession(null);
            setCurrentRole(result.currentPosition?.role ?? '');
            setDesiredRole(titleCase(suggestion.roleKey));
            setFormError(null);
            setView('form');
          }}
        />
      );
    }

    if (view === 'compare') {
      const compareSessions = selectedForCompare
        .map((id) => sessions.find((s) => s.id === id))
        .filter((s): s is ActivationSession => s !== undefined);
      return (
        <CompareView
          sessions={compareSessions}
          onDrillIn={(session) => {
            setResult(sessionToResult(session));
            setActiveSession(session);
            setResultOrigin('compare');
            setView('result');
          }}
          onBack={() => {
            setSelectedForCompare([]);
            setView('list');
          }}
        />
      );
    }

    if (view === 'list') {
      return (
        <ExplorationListView
          sessions={sessions}
          activeGoalSessionId={activeGoalSessionId}
          onStartNew={() => {
            setCurrentRole('');
            setDesiredRole('');
            setFormError(null);
            setView('form');
          }}
          onPromote={(session) => handlePromoteRequest(session, { navigate: false })}
          promoting={promoting}
          promoteError={promoteError}
          selectedForCompare={selectedForCompare}
          onToggleSelect={toggleCompareSelection}
          onCompare={() => setView('compare')}
        />
      );
    }

    if (autoStart && prefill?.desiredRole?.trim() && !result && !formError) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Career Diya already captured your starting point and the career you chose.
            We&apos;re analysing the preparation gap between them now.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-[.14em] mb-2">
              Career transition
            </p>
            <p className="text-sm text-gray-800">
              <span className="font-medium">{currentRole || 'No current role'}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-medium">{desiredRole}</span>
            </p>
            <p className="text-xs text-gray-400 mt-3">
              {loading ? 'Analysing your preparation gap…' : 'Preparing your gap analysis…'}
            </p>
          </div>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="ca-panel space-y-5">
        <p className="text-sm text-gray-600">
          Tell us where you are now and the role you want. We&apos;ll show what stands between
          the two and one concrete step to take this week.
        </p>

        <div>
          <label htmlFor="currentRole" className="block text-sm font-medium text-gray-700 mb-1">
            Current role <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="currentRole"
            type="text"
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value)}
            className="input"
            placeholder="e.g. Software Engineer, Marketing Manager"
          />
        </div>

        <div>
          <label htmlFor="desiredRole" className="block text-sm font-medium text-gray-700 mb-1">
            Desired role <span className="text-red-400">*</span>
          </label>
          <input
            id="desiredRole"
            type="text"
            required
            value={desiredRole}
            onChange={(e) => setDesiredRole(e.target.value)}
            className="input"
            placeholder="e.g. Product Manager, Data Scientist, UX Designer"
          />
        </div>

        {formError && (
          <p className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || !desiredRole.trim()}
            className="btn btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? 'Analysing…' : 'Show my gap analysis'}
          </button>
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={() => setView('list')}
              className="btn btn-secondary"
            >
              Back
            </button>
          )}
        </div>

        <NeedAdviceCTA label="Not sure what to put here?" />
      </form>
    );
  }

  return (
    <>
      {pendingPromote && currentGoalSession && (
        <ReplaceGoalDialog
          currentGoalRole={currentGoalSession.desiredRole ?? 'current goal'}
          nextRole={pendingPromote.session.desiredRole ?? 'this exploration'}
          onConfirm={() =>
            void executePromote(pendingPromote.session, { navigate: pendingPromote.navigate })
          }
          onCancel={() => setPendingPromote(null)}
          confirming={promoting === pendingPromote.session.id}
        />
      )}

      <div className={`w-full mx-auto ${view === 'compare' ? 'max-w-6xl' : 'max-w-3xl'}`}>
        {sessions.length >= 2 && view !== 'list' && view !== 'compare' && (
        <div className="flex items-center justify-end gap-3 mb-5">
          <div className="flex items-center gap-3 shrink-0">
            {(
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setActiveSession(null);
                  setSelectedForCompare([]);
                  setView('list');
                }}
                className="btn btn-secondary btn-small"
              >
                Compare explorations
              </button>
            )}
          </div>
        </div>
        )}

        {renderBody()}
      </div>
    </>
  );
}
