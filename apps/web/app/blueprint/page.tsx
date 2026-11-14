import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasCareerAsanaAccess } from '@modules/identity';
import CareerAsanaAccessGate from '@modules/identity/ui/AccessGate';
import { getActivationSession } from '@modules/activation';
import BlueprintForm from '@modules/blueprint/ui/BlueprintForm';
import CareerDiyaShell from '../_components/CareerDiyaShell';

export const metadata = { title: 'Your roadmap — CareerĀsanā | Career Diya' };

// Blueprint is canonically reached from a goal (/activate -> "Build roadmap").
// A session is required — /blueprint/identify is session-scoped (roles live
// on the session) and /blueprint/derive no longer accepts raw roles, so there
// is no coherent standalone entry any more (retired, ADR-013 sub-slice 2).
export default async function BlueprintPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { supabase, user } = await createClient();
  if (!user) redirect('/login?next=/blueprint');
  if (!(await hasCareerAsanaAccess(supabase, user.id))) {
    return (
      <CareerDiyaShell
        eyebrow="CareerĀsanā · early access"
        title="Turn your chosen direction into a plan"
        intro="CareerĀsanā is Career Diya's deeper planning layer for people who already know the role they want."
        userEmail={user.email ?? null}
      >
        <CareerAsanaAccessGate />
      </CareerDiyaShell>
    );
  }

  const { sessionId } = await searchParams;
  if (!sessionId) { redirect('/activate'); return null; }
  const resolvedSessionId = sessionId;

  // redirect() throws internally (a Next.js control-flow signal) — it must not
  // be called inside this try, or an unqualified catch would swallow it. Only
  // the session fetch itself is guarded; the desiredRole check runs after.
  let session: Awaited<ReturnType<typeof getActivationSession>> | null = null;
  try {
    session = await getActivationSession(supabase, resolvedSessionId);
  } catch {
    // Session not found / not accessible (RLS) — no coherent Blueprint entry without one.
  }
  if (!session?.desiredRole) { redirect('/activate'); return null; }

  const sessionContext = {
    sessionId: session.id,
    currentRole: session.currentRole,
    desiredRole: session.desiredRole,
  };

  return (
    <CareerDiyaShell
      eyebrow="CareerĀsanā · your roadmap"
      title={`From ${session.currentRole ? session.currentRole : 'where you are'} to ${session.desiredRole}`}
      intro="Tell us your starting point, review what you need to work on, then choose a path that fits the time you have."
      userEmail={user.email ?? null}
    >
      <BlueprintForm sessionContext={sessionContext} />
    </CareerDiyaShell>
  );
}
