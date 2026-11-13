// Reads for the counsellor platform. Every query runs on the caller's user-scoped client,
// so RLS (migration 043) decides what comes back.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BookingView,
  Certificate,
  Contact,
  Counsellor,
  Payment,
  PlatformRole,
  Report,
  ReportTemplate,
  SessionNote,
  Slot,
} from '../domain/types';
import { CERTIFICATE_BUCKET, PUBLIC_COUNSELLOR_COLUMNS, REPORT_BUCKET, core } from './db';

const BOOKING_SELECT =
  '*, slot:cd_availability_slot(starts_at, ends_at), counsellor:cd_counsellor(id, display_name, headline)';

function rows<T>(result: { data: unknown; error: unknown }, label: string): T[] {
  if (result.error) {
    console.error(`[counselling] ${label} failed`, result.error);
    return [];
  }
  return (result.data ?? []) as T[];
}

function one<T>(result: { data: unknown; error: unknown }, label: string): T | null {
  if (result.error) {
    console.error(`[counselling] ${label} failed`, result.error);
    return null;
  }
  return (result.data ?? null) as T | null;
}

// ── Viewer ──────────────────────────────────────────────────────────────────

export async function getPlatformRole(supabase: SupabaseClient): Promise<PlatformRole> {
  const { data, error } = await core(supabase).rpc('cd_user_role');
  if (error) {
    console.error('[counselling] cd_user_role failed', error);
    return 'client';
  }
  return (data as PlatformRole) ?? 'client';
}

export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const row = one<{ user_id: string }>(
    await core(supabase).from('cd_admin').select('user_id').eq('user_id', userId).maybeSingle(),
    'admin lookup',
  );
  return !!row;
}

// ── Public directory ────────────────────────────────────────────────────────

export interface DirectoryEntry extends Counsellor {
  next_slot: string | null;
  open_slots: number;
}

export async function listVerifiedCounsellors(supabase: SupabaseClient): Promise<DirectoryEntry[]> {
  const db = core(supabase);
  const counsellors = rows<Counsellor>(
    await db
      .from('cd_counsellor')
      .select(PUBLIC_COUNSELLOR_COLUMNS)
      .eq('status', 'verified')
      .order('display_name'),
    'directory',
  );
  if (!counsellors.length) return [];

  const slots = rows<Pick<Slot, 'counsellor_id' | 'starts_at'>>(
    await db
      .from('cd_availability_slot')
      .select('counsellor_id, starts_at')
      .eq('status', 'open')
      .gt('starts_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())
      .in('counsellor_id', counsellors.map((c) => c.id))
      .order('starts_at')
      .limit(1000),
    'directory slots',
  );

  return counsellors.map((c) => {
    const mine = slots.filter((s) => s.counsellor_id === c.id);
    return { ...c, next_slot: mine[0]?.starts_at ?? null, open_slots: mine.length };
  });
}

export async function getPublicCounsellor(supabase: SupabaseClient, id: string): Promise<Counsellor | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return one<Counsellor>(
    await core(supabase)
      .from('cd_counsellor')
      .select(PUBLIC_COUNSELLOR_COLUMNS)
      .eq('id', id)
      .eq('status', 'verified')
      .maybeSingle(),
    'counsellor profile',
  );
}

export async function listOpenSlots(supabase: SupabaseClient, counsellorId: string): Promise<Slot[]> {
  const from = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  return rows<Slot>(
    await core(supabase)
      .from('cd_availability_slot')
      .select('id, counsellor_id, starts_at, ends_at, status')
      .eq('counsellor_id', counsellorId)
      .eq('status', 'open')
      .gt('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at')
      .limit(200),
    'open slots',
  );
}

// ── Counsellor's own data ───────────────────────────────────────────────────

export async function getMyCounsellor(supabase: SupabaseClient, userId: string): Promise<Counsellor | null> {
  return one<Counsellor>(
    await core(supabase).from('cd_counsellor').select('*').eq('user_id', userId).maybeSingle(),
    'my counsellor',
  );
}

export async function getMyContact(supabase: SupabaseClient, userId: string): Promise<Contact | null> {
  return one<Contact>(
    await core(supabase)
      .from('cd_contact')
      .select('user_id, phone_e164, whatsapp_opt_in, meeting_link')
      .eq('user_id', userId)
      .maybeSingle(),
    'my contact',
  );
}

export async function listCertificates(supabase: SupabaseClient, counsellorIds: string[]): Promise<Certificate[]> {
  if (!counsellorIds.length) return [];
  return rows<Certificate>(
    await core(supabase)
      .from('cd_counsellor_certificate')
      .select('*')
      .in('counsellor_id', counsellorIds)
      .order('created_at'),
    'certificates',
  );
}

export async function listMySlots(supabase: SupabaseClient, counsellorId: string): Promise<Slot[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return rows<Slot>(
    await core(supabase)
      .from('cd_availability_slot')
      .select('id, counsellor_id, starts_at, ends_at, status')
      .eq('counsellor_id', counsellorId)
      .neq('status', 'cancelled')
      .gt('starts_at', since)
      .order('starts_at')
      .limit(500),
    'my slots',
  );
}

export async function listCounsellorBookings(
  supabase: SupabaseClient,
  counsellorId: string,
): Promise<BookingView[]> {
  return rows<BookingView>(
    await core(supabase)
      .from('cd_booking')
      .select(BOOKING_SELECT)
      .eq('counsellor_id', counsellorId)
      .order('created_at', { ascending: false })
      .limit(500),
    'counsellor bookings',
  );
}

export async function getBooking(supabase: SupabaseClient, bookingId: string): Promise<BookingView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  return one<BookingView>(
    await core(supabase).from('cd_booking').select(BOOKING_SELECT).eq('id', bookingId).maybeSingle(),
    'booking',
  );
}

export async function listNotes(supabase: SupabaseClient, bookingId: string): Promise<SessionNote[]> {
  return rows<SessionNote>(
    await core(supabase)
      .from('cd_session_note')
      .select('id, booking_id, body, created_at, updated_at')
      .eq('booking_id', bookingId)
      .order('created_at'),
    'notes',
  );
}

export async function getReport(supabase: SupabaseClient, bookingId: string): Promise<Report | null> {
  return one<Report>(
    await core(supabase).from('cd_report').select('*').eq('booking_id', bookingId).maybeSingle(),
    'report',
  );
}

export async function listTemplates(supabase: SupabaseClient): Promise<ReportTemplate[]> {
  return rows<ReportTemplate>(
    await core(supabase)
      .from('cd_report_template')
      .select('id, counsellor_id, name, description, sections')
      .order('counsellor_id', { ascending: true, nullsFirst: true })
      .order('name'),
    'templates',
  );
}

// ── Client's own data ───────────────────────────────────────────────────────

export async function listClientBookings(supabase: SupabaseClient, userId: string): Promise<BookingView[]> {
  return rows<BookingView>(
    await core(supabase)
      .from('cd_booking')
      .select(BOOKING_SELECT)
      .eq('client_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    'client bookings',
  );
}

export async function listSharedReportsForClient(
  supabase: SupabaseClient,
  userId: string,
): Promise<Pick<Report, 'id' | 'booking_id' | 'title' | 'shared_at'>[]> {
  return rows(
    await core(supabase)
      .from('cd_report')
      .select('id, booking_id, title, shared_at')
      .eq('client_id', userId)
      .eq('status', 'shared')
      .order('shared_at', { ascending: false }),
    'shared reports',
  );
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function listAllCounsellors(supabase: SupabaseClient): Promise<Counsellor[]> {
  return rows<Counsellor>(
    await core(supabase).from('cd_counsellor').select('*').order('created_at', { ascending: false }),
    'admin counsellors',
  );
}

export interface AdminBooking extends BookingView {
  payments: Payment[];
}

export async function listRecentBookingsForAdmin(supabase: SupabaseClient): Promise<AdminBooking[]> {
  return rows<AdminBooking>(
    await core(supabase)
      .from('cd_booking')
      .select(`${BOOKING_SELECT}, payments:cd_payment(*)`)
      .order('created_at', { ascending: false })
      .limit(200),
    'admin bookings',
  );
}

// ── Files ───────────────────────────────────────────────────────────────────

/** Short-lived download link; storage policies decide whether the caller may read it. */
export async function signedFileUrl(
  supabase: SupabaseClient,
  bucket: typeof CERTIFICATE_BUCKET | typeof REPORT_BUCKET,
  path: string,
  seconds = 300,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) {
    console.error('[counselling] signed url failed', error);
    return null;
  }
  return data?.signedUrl ?? null;
}
