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
function NeedAdviceCTA({ label }: { label: string }) {
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

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gray-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

function GapCard({ item }: { item: ActivationResult['gap'][number] }) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{item.skill}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          item.have ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {item.have ? 'Have it' : 'Gap'}
        </span>
      </div>
      <ConfidenceBar value={item.confidence.value} />
      <span className="text-xs text-gray-400 capitalize">{item.confidence.basis}</span>
    </div>
  );
}

function GapSection({ gap }: { gap: ActivationResult['gap'] }) {
  if (gap.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Gap analysis</p>
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
    <div className="bg-gray-900 text-white rounded-xl p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
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

  return (
    <div className={`bg-white border rounded-xl p-4 space-y-3 ${
      isActiveGoal ? 'border-gray-900' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            disabled={selectionDisabled}
            onChange={() => onToggleSelect(session.id)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-900 disabled:opacity-40"
            aria-label={`Select ${session.desiredRole ?? 'exploration'} to compare`}
            title={selectionDisabled ? 'Up to 3 explorations at a time' : 'Select to compare'}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {session.desiredRole ?? 'Unknown role'}
            </p>
            {session.currentRole && (
              <p className="text-xs text-gray-400 mt-0.5">from {session.currentRole}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isActiveGoal && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-900 text-white">
              Your goal
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-400 space-y-0.5">
        <div className="flex justify-between">
          <span>Created</span>
          <span className="text-gray-600">{fmt(session.createdAt)}</span>
        </div>
        {session.gap.length > 0 && (
          <div className="flex justify-between">
            <span>Gaps identified</span>
            <span className="text-gray-600">{session.gap.length}</span>
          </div>
        )}
      </div>

      <div className="pt-1 space-y-2">
        <button
          onClick={() => onPromote(session)}
          disabled={isPromoting}
          className="w-full py-1.5 px-3 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPromoting
            ? 'Updating Twin…'
            : isActiveGoal
            ? 'Re-apply to Twin'
            : hasAnyGoal
            ? 'Replace goal'
            : 'Set as my goal'}
        </button>
        {isActiveGoal && (
          // Gated to the active-goal card only — it isn't a parallel entry
          // point for any non-goal exploration.
          <a
            href={`/blueprint?sessionId=${session.id}`}
            className="block w-full text-center py-1.5 px-3 border border-gray-300 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Build roadmap
          </a>
        )}
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
    <div className="w-full max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Compare Explorations</h2>
        <button
          onClick={onStartNew}
          className="text-xs text-gray-500 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
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
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
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
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Target role</p>
        <h3 className="text-base font-semibold text-gray-900">{session.desiredRole ?? 'Unknown role'}</h3>
        {session.currentRole && (
          <p className="text-xs text-gray-400 mt-0.5">from {session.currentRole}</p>
        )}
      </div>

      {session.gap.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Gap analysis</p>
          <div className="bg-gray-50 border border-gray-100 rounded-lg divide-y divide-gray-100">
            {session.gap.map((item) => (
              <div key={item.skill} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm text-gray-800 truncate">{item.skill}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  item.have ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {item.have ? 'Have it' : 'Gap'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {session.firstAction && (
        <div className="bg-gray-900 text-white rounded-xl p-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">First action</p>
          <p className="text-sm leading-relaxed">{session.firstAction}</p>
        </div>
      )}

      <button
        onClick={() => onDrillIn(session)}
        className="mt-auto w-full text-center py-1.5 px-3 border border-gray-300 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
    <div className={`w-full ${compareContainerWidthClass(sessions.length)} space-y-4`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Compare Explorations</h2>
        <button
          onClick={onBack}
          className="text-xs text-gray-500 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
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
    <div className="w-full max-w-lg space-y-6">
      {onBackToComparison && (
        <button
          onClick={onBackToComparison}
          className="text-xs text-gray-500 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          ← Back to comparison
        </button>
      )}

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Target role</p>
        <h2 className="text-xl font-semibold text-gray-900">{result.desiredPosition.role}</h2>
        {result.desiredPosition.onetCode && (
          <p className="text-xs text-gray-400 mt-0.5">O*NET {result.desiredPosition.onetCode}</p>
        )}
      </div>

      {result.currentPosition && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
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

      <div className="flex gap-3">
        <button
          onClick={onSetGoal}
          disabled={settingGoal}
          className="flex-1 py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {settingGoal ? 'Setting goal…' : 'Set as Goal'}
        </button>
        <button
          onClick={onBack}
          className="py-2.5 px-4 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Replace your current goal?</h3>
        <p className="text-sm text-gray-600">
          Your Twin currently targets{' '}
          <span className="font-medium text-gray-900">{currentGoalRole}</span>. Setting{' '}
          <span className="font-medium text-gray-900">{nextRole}</span> as your goal will replace
          it in the Twin (last-write-wins).
        </p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="flex-1 py-2 px-4 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Keep current
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 py-2 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {confirming ? 'Replacing…' : 'Replace goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ActivationForm({
  userEmail,
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

  async function handleSignOut() {
    const { createClient } = await import('@/lib/supabase/client');
    await createClient().auth.signOut();
    window.location.href = '/login';
  }

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
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
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
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-gray-600">
          Career Diya brought you here because you chose this direction. We&apos;ll now build the
          deeper preparation plan around your actual starting point.
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
            className="flex-1 py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Analysing…' : 'Show my gap analysis'}
          </button>
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={() => setView('list')}
              className="py-2.5 px-4 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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

      <div className={`w-full ${view === 'compare' ? 'max-w-5xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">CareerĀsanā</h1>
            <p className="text-sm text-gray-500">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>

        {renderBody()}
      </div>
    </>
  );
}
