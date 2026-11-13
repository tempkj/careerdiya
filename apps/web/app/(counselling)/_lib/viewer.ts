import type { Route } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getMyCounsellor, isAdmin, type Counsellor } from '@modules/counselling';

export interface Viewer {
  supabase: SupabaseClient;
  /** Signed-in, non-guest user, or null. Guest (anonymous) sessions cannot book or counsel. */
  user: User | null;
}

export async function getViewer(): Promise<Viewer> {
  const { supabase, user } = await createClient();
  return { supabase, user: user && !user.is_anonymous ? user : null };
}

export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

export async function requireUser(next: string): Promise<{ supabase: SupabaseClient; user: User }> {
  const viewer = await getViewer();
  if (!viewer.user) redirect(loginUrl(next) as Route);
  return { supabase: viewer.supabase, user: viewer.user };
}

/** Signed-in counsellor with a profile; otherwise sends them to onboarding. */
export async function requireCounsellor(
  next: string,
): Promise<{ supabase: SupabaseClient; user: User; counsellor: Counsellor }> {
  const { supabase, user } = await requireUser(next);
  const counsellor = await getMyCounsellor(supabase, user.id);
  if (!counsellor) redirect('/counsellor');
  return { supabase, user, counsellor };
}

export async function requireAdmin(next: string): Promise<{ supabase: SupabaseClient; user: User }> {
  const { supabase, user } = await requireUser(next);
  if (!(await isAdmin(supabase, user.id))) notFound();
  return { supabase, user };
}
