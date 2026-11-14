import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { listActivationSessions } from '@modules/activation';
import type { ActivationSessionList } from '@modules/activation';
import ActivationForm from '@modules/activation/ui/ActivationForm';
import CareerAsanaAccessGate from '@modules/identity/ui/AccessGate';
import CareerDiyaShell from '../_components/CareerDiyaShell';

export const metadata = { title: 'Plan your move — Career Plan | Career Diya' };

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    desiredRole?: string;
    currentRole?: string;
    careerId?: string;
  }>;
}) {
  const { supabase, user } = await createClient();
  if (!user) redirect('/login?next=/activate');

  const params = await searchParams;
  const desiredRole = params.desiredRole?.trim() || '';
  const currentRole = params.currentRole?.trim() || '';
  const fromCareerDiya = params.source === 'careerdiya';

  // CareerAsana is the paid/deeper execution layer. Keep the access check
  // server-side so a hidden/disabled button cannot bypass the commercial boundary.
  if (!(await hasCareerAsanaAccess(supabase, user.id))) {
    return (
      <CareerDiyaShell
        eyebrow="Career Plan · early access"
        title="Turn your chosen career into a plan"
        intro="Personal career plans are in early access, for people who already know the role they want."
        userEmail={user.email ?? null}
        userName={(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? null) as string | null}
      >
        <CareerAsanaAccessGate desiredRole={desiredRole || null} />
      </CareerDiyaShell>
    );
  }

  const empty: ActivationSessionList = {
    data: [],
    activeGoalSessionId: null,
    page: { nextCursor: null, hasMore: false, limit: 50 },
  };
  let sessionList = empty;
  try {
    sessionList = await listActivationSessions(supabase);
  } catch {
    // no sessions or DB error — show blank form
  }

  return (
    <CareerDiyaShell
      compact
      title="Plan your move to a new role"
      intro="See what you'll need for the role you want, compare options, then turn your choice into a roadmap."
      userEmail={user.email ?? null}
        userName={(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? null) as string | null}
    >
      <ActivationForm
        userEmail={user.email ?? ''}
        sessions={sessionList.data}
        activeGoalSessionId={sessionList.activeGoalSessionId}
        prefill={desiredRole ? { desiredRole, currentRole: currentRole || null } : undefined}
        autoStart={fromCareerDiya && !!desiredRole}
      />
    </CareerDiyaShell>
  );
}
