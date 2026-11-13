// Writes for the counsellor platform. All run on the caller's user-scoped client: RLS,
// column grants and the SECURITY DEFINER RPCs in migration 043 enforce who may do what.
import type { SupabaseClient } from '@supabase/supabase-js';
import { friendlyDbError, normalizeMeetingLink, normalizePhone, type SlotDraft } from '../domain/rules';
import type {
  Booking,
  CommandResult,
  Payment,
  ReportSection,
  SessionMode,
  TemplateSection,
} from '../domain/types';
import { CERTIFICATE_BUCKET, REPORT_BUCKET, core } from './db';

type DbError = { code?: string; message?: string } | null;

function fail(error: DbError, label: string): { ok: false; error: string } {
  console.error(`[counselling] ${label} failed`, error);
  return { ok: false, error: friendlyDbError(error) };
}

function safeFileName(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.slice(-60) || 'file';
}

// ── Counsellor profile ──────────────────────────────────────────────────────

export interface ProfileInput {
  display_name: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  languages: string[];
  specialisations: string[];
  session_mode: SessionMode;
  session_fee_inr: number;
  session_minutes: number;
}

export function validateProfile(input: ProfileInput): string | null {
  if (input.display_name.trim().length < 2) return 'Please enter your name as clients should see it.';
  if (!['online', 'in_person', 'both'].includes(input.session_mode)) return 'Choose how you run sessions.';
  if (!Number.isInteger(input.session_fee_inr) || input.session_fee_inr < 0 || input.session_fee_inr > 100000) {
    return 'Session fee must be a whole number of rupees between 0 and 1,00,000.';
  }
  if (input.session_fee_inr > 0 && input.session_fee_inr < 1) return 'Session fee must be at least ₹1.';
  if (!Number.isInteger(input.session_minutes) || input.session_minutes < 15 || input.session_minutes > 240) {
    return 'Session length must be between 15 and 240 minutes.';
  }
  if ((input.headline ?? '').length > 160) return 'Keep your headline under 160 characters.';
  if ((input.bio ?? '').length > 4000) return 'Keep your bio under 4,000 characters.';
  return null;
}

export async function saveCounsellorProfile(
  supabase: SupabaseClient,
  userId: string,
  input: ProfileInput,
): Promise<CommandResult> {
  const invalid = validateProfile(input);
  if (invalid) return { ok: false, error: invalid };

  const db = core(supabase);
  const existing = await db.from('cd_counsellor').select('id').eq('user_id', userId).maybeSingle();
  if (existing.error) return fail(existing.error, 'profile lookup');

  const values = { ...input, display_name: input.display_name.trim() };
  const result = existing.data
    ? await db.from('cd_counsellor').update(values).eq('user_id', userId)
    : await db.from('cd_counsellor').insert({ ...values, user_id: userId });
  if (result.error) return fail(result.error, 'save profile');
  return { ok: true, message: existing.data ? 'Profile saved.' : 'Profile created. An admin will verify it shortly.' };
}

export async function saveContact(
  supabase: SupabaseClient,
  userId: string,
  input: { phone: string | null; whatsappOptIn: boolean; meetingLink: string | null },
): Promise<CommandResult> {
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (input.phone?.trim() && !phone) return { ok: false, error: 'Enter a valid mobile number, e.g. 98765 43210.' };
  const link = normalizeMeetingLink(input.meetingLink);
  if (link === 'invalid') return { ok: false, error: 'Meeting link must be a full https:// link.' };

  const { error } = await core(supabase).from('cd_contact').upsert(
    { user_id: userId, phone_e164: phone, whatsapp_opt_in: input.whatsappOptIn && !!phone, meeting_link: link },
    { onConflict: 'user_id' },
  );
  if (error) return fail(error, 'save contact');
  return { ok: true, message: 'Contact details saved.' };
}

// ── Certificates ────────────────────────────────────────────────────────────

const CERT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

export async function addCertificate(
  supabase: SupabaseClient,
  userId: string,
  counsellorId: string,
  input: { title: string; issuer: string | null; issuedOn: string | null; file: File | null },
): Promise<CommandResult> {
  const title = input.title.trim();
  if (title.length < 2) return { ok: false, error: 'Give the certificate a title.' };
  if (!input.file || input.file.size === 0) return { ok: false, error: 'Choose a file to upload.' };
  if (!CERT_TYPES.includes(input.file.type)) return { ok: false, error: 'Upload a PDF, PNG or JPG.' };
  if (input.file.size > 5 * 1024 * 1024) return { ok: false, error: 'Files must be 5 MB or smaller.' };
  if (input.issuedOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.issuedOn)) {
    return { ok: false, error: 'Enter the issue date as a date.' };
  }

  const path = `${userId}/${crypto.randomUUID()}-${safeFileName(input.file.name)}`;
  const upload = await supabase.storage.from(CERTIFICATE_BUCKET).upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (upload.error) return fail({ message: upload.error.message }, 'certificate upload');

  const { error } = await core(supabase).from('cd_counsellor_certificate').insert({
    counsellor_id: counsellorId,
    title,
    issuer: input.issuer?.trim() || null,
    issued_on: input.issuedOn || null,
    storage_path: path,
  });
  if (error) {
    await supabase.storage.from(CERTIFICATE_BUCKET).remove([path]);
    return fail(error, 'certificate row');
  }
  return { ok: true, message: 'Certificate uploaded.' };
}

export async function deleteCertificate(supabase: SupabaseClient, certificateId: string): Promise<CommandResult> {
  const db = core(supabase);
  const found = await db.from('cd_counsellor_certificate').select('storage_path').eq('id', certificateId).maybeSingle();
  if (found.error || !found.data) return { ok: false, error: 'Certificate not found.' };
  const { error } = await db.from('cd_counsellor_certificate').delete().eq('id', certificateId);
  if (error) return fail(error, 'delete certificate');
  await supabase.storage.from(CERTIFICATE_BUCKET).remove([found.data.storage_path]);
  return { ok: true, message: 'Certificate removed.' };
}

// ── Availability ────────────────────────────────────────────────────────────

export async function addSlots(
  supabase: SupabaseClient,
  counsellorId: string,
  drafts: SlotDraft[],
): Promise<CommandResult> {
  if (!drafts.length) return { ok: false, error: 'No slots to add.' };
  const { error } = await core(supabase)
    .from('cd_availability_slot')
    .insert(drafts.map((d) => ({ counsellor_id: counsellorId, ...d })));
  if (error) return fail(error, 'add slots');
  return { ok: true, message: drafts.length === 1 ? 'Slot added.' : `${drafts.length} slots added.` };
}

/** Deletes an unbooked slot outright, or cancels it if it has booking history. */
export async function removeSlot(supabase: SupabaseClient, slotId: string): Promise<CommandResult> {
  const db = core(supabase);
  const del = await db.from('cd_availability_slot').delete().eq('id', slotId).select('id');
  if (!del.error && del.data?.length) return { ok: true, message: 'Slot removed.' };
  const cancel = await db
    .from('cd_availability_slot')
    .update({ status: 'cancelled' })
    .eq('id', slotId)
    .eq('status', 'open')
    .select('id');
  if (cancel.error) return fail(cancel.error, 'cancel slot');
  if (!cancel.data?.length) return { ok: false, error: 'Booked slots can only be freed by cancelling the booking.' };
  return { ok: true, message: 'Slot removed.' };
}

// ── Bookings ────────────────────────────────────────────────────────────────

export async function bookSlot(
  supabase: SupabaseClient,
  input: { slotId: string; clientName: string; phone: string | null; purpose: string | null },
): Promise<CommandResult<Booking>> {
  const name = input.clientName.trim();
  if (!name) return { ok: false, error: 'Please tell us your name.' };
  if (name.length > 120) return { ok: false, error: 'Please shorten your name.' };
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (input.phone?.trim() && !phone) return { ok: false, error: 'Enter a valid mobile number, e.g. 98765 43210.' };
  if ((input.purpose ?? '').length > 1000) return { ok: false, error: 'Keep the note under 1,000 characters.' };

  const { data, error } = await core(supabase).rpc('cd_book_slot', {
    p_slot_id: input.slotId,
    p_client_name: name,
    p_client_phone: phone,
    p_purpose: input.purpose?.trim() || null,
  });
  if (error) return fail(error, 'book slot');
  return { ok: true, data: data as Booking };
}

export async function cancelBooking(
  supabase: SupabaseClient,
  bookingId: string,
  reason: string | null,
): Promise<CommandResult> {
  const { error } = await core(supabase).rpc('cd_cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason?.trim().slice(0, 500) || null,
  });
  if (error) return fail(error, 'cancel booking');
  return { ok: true, message: 'Booking cancelled.' };
}

export async function completeBooking(supabase: SupabaseClient, bookingId: string): Promise<CommandResult> {
  const { error } = await core(supabase).rpc('cd_complete_booking', { p_booking_id: bookingId });
  if (error) return fail(error, 'complete booking');
  return { ok: true, message: 'Session marked as completed.' };
}

export async function updateBookingMeetingLink(
  supabase: SupabaseClient,
  bookingId: string,
  meetingLink: string | null,
): Promise<CommandResult> {
  const link = normalizeMeetingLink(meetingLink);
  if (link === 'invalid') return { ok: false, error: 'Meeting link must be a full https:// link.' };
  const { data, error } = await core(supabase)
    .from('cd_booking')
    .update({ meeting_link: link })
    .eq('id', bookingId)
    .select('id');
  if (error) return fail(error, 'meeting link');
  if (!data?.length) return { ok: false, error: 'This booking can no longer be changed.' };
  return { ok: true, message: 'Meeting link updated.' };
}

export async function attachPaymentOrder(
  supabase: SupabaseClient,
  bookingId: string,
  orderId: string,
  amountPaise: number,
): Promise<CommandResult<Payment>> {
  const { data, error } = await core(supabase).rpc('cd_attach_payment_order', {
    p_booking_id: bookingId,
    p_order_id: orderId,
    p_amount_paise: amountPaise,
  });
  if (error) return fail(error, 'attach order');
  return { ok: true, data: data as Payment };
}

// ── Notes ───────────────────────────────────────────────────────────────────

export async function addNote(
  supabase: SupabaseClient,
  counsellorId: string,
  bookingId: string,
  body: string,
): Promise<CommandResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: 'Write something first.' };
  if (text.length > 20000) return { ok: false, error: 'Notes are limited to 20,000 characters.' };
  const { error } = await core(supabase)
    .from('cd_session_note')
    .insert({ booking_id: bookingId, counsellor_id: counsellorId, body: text });
  if (error) return fail(error, 'add note');
  return { ok: true, message: 'Note saved.' };
}

export async function updateNote(supabase: SupabaseClient, noteId: string, body: string): Promise<CommandResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: 'A note cannot be empty. Delete it instead.' };
  if (text.length > 20000) return { ok: false, error: 'Notes are limited to 20,000 characters.' };
  const { error } = await core(supabase).from('cd_session_note').update({ body: text }).eq('id', noteId);
  if (error) return fail(error, 'update note');
  return { ok: true, message: 'Note updated.' };
}

export async function deleteNote(supabase: SupabaseClient, noteId: string): Promise<CommandResult> {
  const { error } = await core(supabase).from('cd_session_note').delete().eq('id', noteId);
  if (error) return fail(error, 'delete note');
  return { ok: true, message: 'Note deleted.' };
}

// ── Reports ─────────────────────────────────────────────────────────────────

export async function saveReport(
  supabase: SupabaseClient,
  userId: string,
  input: {
    bookingId: string;
    counsellorId: string;
    clientId: string;
    templateId: string | null;
    title: string;
    content: ReportSection[];
    share: boolean;
    attachment: File | null;
    removeAttachment: boolean;
    existingAttachment: string | null;
  },
): Promise<CommandResult> {
  const title = input.title.trim();
  if (title.length < 2) return { ok: false, error: 'Give the report a title.' };
  if (input.share && input.content.every((s) => !s.body) && !input.attachment && !input.existingAttachment) {
    return { ok: false, error: 'Add some content before sharing the report.' };
  }

  let attachmentPath = input.removeAttachment ? null : input.existingAttachment;
  let uploaded: string | null = null;
  if (input.attachment && input.attachment.size > 0) {
    if (input.attachment.type !== 'application/pdf') return { ok: false, error: 'Attach the report as a PDF.' };
    if (input.attachment.size > 10 * 1024 * 1024) return { ok: false, error: 'PDFs must be 10 MB or smaller.' };
    uploaded = `${userId}/${input.bookingId}/${crypto.randomUUID()}-${safeFileName(input.attachment.name)}`;
    const upload = await supabase.storage
      .from(REPORT_BUCKET)
      .upload(uploaded, input.attachment, { contentType: 'application/pdf', upsert: false });
    if (upload.error) return fail({ message: upload.error.message }, 'report upload');
    attachmentPath = uploaded;
  }

  const { error } = await core(supabase).from('cd_report').upsert(
    {
      booking_id: input.bookingId,
      counsellor_id: input.counsellorId,
      client_id: input.clientId,
      template_id: input.templateId,
      title,
      content: input.content,
      attachment_path: attachmentPath,
      status: input.share ? 'shared' : 'draft',
    },
    { onConflict: 'booking_id' },
  );
  if (error) {
    if (uploaded) await supabase.storage.from(REPORT_BUCKET).remove([uploaded]);
    return fail(error, 'save report');
  }
  if (input.existingAttachment && input.existingAttachment !== attachmentPath) {
    await supabase.storage.from(REPORT_BUCKET).remove([input.existingAttachment]);
  }
  return { ok: true, message: input.share ? 'Report shared with your client.' : 'Draft saved.' };
}

// ── Templates ───────────────────────────────────────────────────────────────

export async function saveTemplate(
  supabase: SupabaseClient,
  counsellorId: string,
  input: { id: string | null; name: string; description: string | null; sections: TemplateSection[] },
): Promise<CommandResult> {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'Give the template a name.' };
  if (!input.sections.length) return { ok: false, error: 'Add at least one section.' };
  const values = {
    counsellor_id: counsellorId,
    name,
    description: input.description?.trim() || null,
    sections: input.sections,
  };
  const db = core(supabase);
  const { error } = input.id
    ? await db.from('cd_report_template').update(values).eq('id', input.id)
    : await db.from('cd_report_template').insert(values);
  if (error) return fail(error, 'save template');
  return { ok: true, message: 'Template saved.' };
}

export async function deleteTemplate(supabase: SupabaseClient, templateId: string): Promise<CommandResult> {
  const { error } = await core(supabase).from('cd_report_template').delete().eq('id', templateId);
  if (error) return fail(error, 'delete template');
  return { ok: true, message: 'Template deleted.' };
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function setCounsellorStatus(
  supabase: SupabaseClient,
  counsellorId: string,
  status: 'pending' | 'verified' | 'suspended' | 'rejected',
  note: string | null,
): Promise<CommandResult> {
  const { error } = await core(supabase).rpc('cd_set_counsellor_status', {
    p_counsellor_id: counsellorId,
    p_status: status,
    p_note: note?.trim() || null,
  });
  if (error) return fail(error, 'set counsellor status');
  return { ok: true, message: `Counsellor marked ${status}.` };
}
