import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import { listActivationSessions } from '@modules/activation';
import type { ActivationSessionList } from '@modules/activation';
import ActivationForm from '@modules/activation/ui/ActivationForm';
import CareerAsanaAccessGate from '@modules/identity/ui/AccessGate';

export const metadata = { title: 'CareerAsana — Your personalized path' };

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
    return <CareerAsanaAccessGate desiredRole={desiredRole || null} />;
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
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <ActivationForm
        userEmail={user.email ?? ''}
        sessions={sessionList.data}
        activeGoalSessionId={sessionList.activeGoalSessionId}
        prefill={desiredRole ? { desiredRole, currentRole: currentRole || null } : undefined}
        autoStart={fromCareerDiya && !!desiredRole}
      />
    </main>
  );
}
