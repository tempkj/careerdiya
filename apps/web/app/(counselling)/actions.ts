'use server';
// Server actions for the counsellor platform (ADR-015). Each one re-checks the caller:
// server actions are reachable directly, not only through our forms. Authorisation itself
// is enforced by RLS and the RPCs; these checks just give clear messages.
import { revalidatePath } from 'next/cache';
import {
  addCertificate,
  addNote,
  addSlots,
  bookSlot,
  buildReportContent,
  buildSlots,
  cancelBooking,
  completeBooking,
  deleteCertificate,
  deleteNote,
  deleteTemplate,
  getBooking,
  getMyCounsellor,
  listTemplates,
  parseList,
  parseTemplateSections,
  removeSlot,
  saveContact,
  saveCounsellorProfile,
  saveReport,
  saveTemplate,
  setCounsellorStatus,
  updateBookingMeetingLink,
  updateNote,
  type CommandResult,
  type SessionMode,
} from '@modules/counselling';
import type { FormState } from '@modules/counselling/ui/ActionForm';
import { getViewer } from './_lib/viewer';

const ok = (message?: string): FormState => ({ status: 'ok', message, at: Date.now() });
const err = (message: string): FormState => ({ status: 'error', message, at: Date.now() });
const fromResult = (r: CommandResult<unknown>): FormState => (r.ok ? ok(r.message) : err(r.error));

const SIGN_IN = 'Please sign in again.';
const NOT_COUNSELLOR = 'Set up your counsellor profile first.';

function text(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}
function optional(fd: FormData, key: string): string | null {
  const v = text(fd, key).trim();
  return v ? v : null;
}
function file(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}
function int(fd: FormData, key: string, fallback = NaN): number {
  const raw = text(fd, key).trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

async function counsellorContext() {
  const { supabase, user } = await getViewer();
  if (!user) return { error: SIGN_IN } as const;
  const counsellor = await getMyCounsellor(supabase, user.id);
  if (!counsellor) return { error: NOT_COUNSELLOR } as const;
  return { supabase, user, counsellor } as const;
}

// ── Counsellor profile ──────────────────────────────────────────────────────

export async function saveProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await getViewer();
  if (!user) return err(SIGN_IN);
  const result = await saveCounsellorProfile(supabase, user.id, {
    display_name: text(fd, 'display_name'),
    headline: optional(fd, 'headline'),
    bio: optional(fd, 'bio'),
    city: optional(fd, 'city'),
    languages: parseList(text(fd, 'languages')),
    specialisations: parseList(text(fd, 'specialisations')),
    session_mode: (text(fd, 'session_mode') || 'online') as SessionMode,
    session_fee_inr: int(fd, 'session_fee_inr', 0),
    session_minutes: int(fd, 'session_minutes', 60),
  });
  revalidatePath('/counsellor', 'layout');
  revalidatePath('/counsellors', 'layout');
  return fromResult(result);
}

export async function saveContactAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await getViewer();
  if (!user) return err(SIGN_IN);
  const result = await saveContact(supabase, user.id, {
    phone: optional(fd, 'phone'),
    whatsappOptIn: fd.get('whatsapp_opt_in') === 'on',
    meetingLink: optional(fd, 'meeting_link'),
  });
  revalidatePath('/counsellor/profile');
  return fromResult(result);
}

export async function addCertificateAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const result = await addCertificate(ctx.supabase, ctx.user.id, ctx.counsellor.id, {
    title: text(fd, 'title'),
    issuer: optional(fd, 'issuer'),
    issuedOn: optional(fd, 'issued_on'),
    file: file(fd, 'file'),
  });
  revalidatePath('/counsellor/profile');
  return fromResult(result);
}

export async function deleteCertificateAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const result = await deleteCertificate(ctx.supabase, text(fd, 'certificate_id'));
  revalidatePath('/counsellor/profile');
  return fromResult(result);
}

// ── Availability ────────────────────────────────────────────────────────────

export async function addSlotsAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const built = buildSlots({
    date: text(fd, 'date'),
    time: text(fd, 'time'),
    minutes: int(fd, 'minutes', ctx.counsellor.session_minutes),
    repeatWeeks: int(fd, 'repeat_weeks', 0),
  });
  if (!built.ok) return err(built.error);
  const result = await addSlots(ctx.supabase, ctx.counsellor.id, built.slots);
  revalidatePath('/counsellor/availability');
  return fromResult(result);
}

export async function removeSlotAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const result = await removeSlot(ctx.supabase, text(fd, 'slot_id'));
  revalidatePath('/counsellor/availability');
  return fromResult(result);
}

// ── Booking (client) ────────────────────────────────────────────────────────

export interface BookResult {
  ok: boolean;
  error?: string;
  bookingId?: string;
  needsPayment?: boolean;
  signIn?: boolean;
}

/** Called directly by the booking panel, which then starts payment if needed. */
export async function bookSlotAction(input: {
  slotId: string;
  clientName: string;
  phone: string;
  purpose: string;
}): Promise<BookResult> {
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, signIn: true, error: 'Please sign in to book a session.' };
  const result = await bookSlot(supabase, {
    slotId: input.slotId,
    clientName: input.clientName,
    phone: input.phone || null,
    purpose: input.purpose || null,
  });
  if (!result.ok) return { ok: false, error: result.error };
  const booking = result.data!;
  revalidatePath('/my-sessions');
  return { ok: true, bookingId: booking.id, needsPayment: booking.status === 'pending_payment' };
}

export async function cancelBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await getViewer();
  if (!user) return err(SIGN_IN);
  const id = text(fd, 'booking_id');
  const result = await cancelBooking(supabase, id, optional(fd, 'reason'));
  revalidatePath(`/my-sessions/${id}`);
  revalidatePath('/my-sessions');
  revalidatePath(`/counsellor/sessions/${id}`);
  revalidatePath('/counsellor', 'layout');
  return fromResult(result);
}

// ── Session management (counsellor) ────────────────────────────────────────

export async function completeBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const id = text(fd, 'booking_id');
  const result = await completeBooking(ctx.supabase, id);
  revalidatePath(`/counsellor/sessions/${id}`);
  return fromResult(result);
}

export async function updateMeetingLinkAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const id = text(fd, 'booking_id');
  const result = await updateBookingMeetingLink(ctx.supabase, id, optional(fd, 'meeting_link'));
  revalidatePath(`/counsellor/sessions/${id}`);
  return fromResult(result);
}

export async function addNoteAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const id = text(fd, 'booking_id');
  const result = await addNote(ctx.supabase, ctx.counsellor.id, id, text(fd, 'body'));
  revalidatePath(`/counsellor/sessions/${id}`);
  return fromResult(result);
}

export async function updateNoteAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const result = await updateNote(ctx.supabase, text(fd, 'note_id'), text(fd, 'body'));
  revalidatePath(`/counsellor/sessions/${text(fd, 'booking_id')}`);
  return fromResult(result);
}

export async function deleteNoteAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const result = await deleteNote(ctx.supabase, text(fd, 'note_id'));
  revalidatePath(`/counsellor/sessions/${text(fd, 'booking_id')}`);
  return fromResult(result);
}

export async function saveReportAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const bookingId = text(fd, 'booking_id');
  const booking = await getBooking(ctx.supabase, bookingId);
  if (!booking || booking.counsellor_id !== ctx.counsellor.id) return err('Booking not found.');

  const templateId = optional(fd, 'template_id');
  const templates = await listTemplates(ctx.supabase);
  const template = templates.find((t) => t.id === templateId) ?? null;
  // Section titles come from the template the counsellor picked, or from the submitted form
  // when editing a report whose template has since been deleted.
  const keys = fd.getAll('section_key').map(String);
  const titles = fd.getAll('section_title').map(String);
  const sections = template?.sections ?? keys.map((key, i) => ({ key, title: titles[i] ?? key }));
  const bodies = Object.fromEntries(sections.map((s) => [s.key, text(fd, `section_${s.key}`)]));

  const result = await saveReport(ctx.supabase, ctx.user.id, {
    bookingId,
    counsellorId: ctx.counsellor.id,
    clientId: booking.client_id,
    templateId: template?.id ?? null,
    title: text(fd, 'title'),
    content: buildReportContent(sections, bodies),
    share: text(fd, 'intent') === 'share',
    attachment: file(fd, 'attachment'),
    removeAttachment: fd.get('remove_attachment') === 'on',
    existingAttachment: optional(fd, 'existing_attachment'),
  });
  revalidatePath(`/counsellor/sessions/${bookingId}`);
  revalidatePath(`/my-sessions/${bookingId}`);
  return fromResult(result);
}

// ── Templates ───────────────────────────────────────────────────────────────

export async function saveTemplateAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const result = await saveTemplate(ctx.supabase, ctx.counsellor.id, {
    id: optional(fd, 'template_id'),
    name: text(fd, 'name'),
    description: optional(fd, 'description'),
    sections: parseTemplateSections(text(fd, 'sections')),
  });
  revalidatePath('/counsellor/templates');
  return fromResult(result);
}

export async function deleteTemplateAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await counsellorContext();
  if ('error' in ctx) return err(ctx.error ?? SIGN_IN);
  const result = await deleteTemplate(ctx.supabase, text(fd, 'template_id'));
  revalidatePath('/counsellor/templates');
  return fromResult(result);
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function setCounsellorStatusAction(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user } = await getViewer();
  if (!user) return err(SIGN_IN);
  const status = text(fd, 'status');
  if (!['pending', 'verified', 'suspended', 'rejected'].includes(status)) return err('Unknown status.');
  const result = await setCounsellorStatus(
    supabase,
    text(fd, 'counsellor_id'),
    status as 'pending' | 'verified' | 'suspended' | 'rejected',
    optional(fd, 'note'),
  );
  revalidatePath('/admin/counselling');
  revalidatePath('/counsellors', 'layout');
  return fromResult(result);
}
