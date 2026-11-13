// Career Diya counsellor platform — domain types (ADR-015).
// Row shapes mirror the core.cd_* tables from migration 043.

export type PlatformRole = 'anonymous' | 'client' | 'counsellor' | 'admin';

export type CounsellorStatus = 'pending' | 'verified' | 'suspended' | 'rejected';
export type SessionMode = 'online' | 'in_person' | 'both';
export type SlotStatus = 'open' | 'held' | 'booked' | 'cancelled';
export type BookingStatus = 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'expired';
export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';
export type ReportStatus = 'draft' | 'shared';

export interface Counsellor {
  id: string;
  user_id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  languages: string[];
  specialisations: string[];
  session_mode: SessionMode;
  session_fee_inr: number;
  session_minutes: number;
  status: CounsellorStatus;
  status_note?: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface Contact {
  user_id: string;
  phone_e164: string | null;
  whatsapp_opt_in: boolean;
  meeting_link: string | null;
}

export interface Certificate {
  id: string;
  counsellor_id: string;
  title: string;
  issuer: string | null;
  issued_on: string | null;
  storage_path: string;
  created_at: string;
}

export interface Slot {
  id: string;
  counsellor_id: string;
  starts_at: string;
  ends_at: string;
  status: SlotStatus;
}

export interface Booking {
  id: string;
  slot_id: string;
  counsellor_id: string;
  client_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  purpose: string | null;
  status: BookingStatus;
  fee_inr: number;
  hold_expires_at: string | null;
  meeting_link: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: 'client' | 'counsellor' | 'admin' | 'system' | null;
  cancel_reason: string | null;
  completed_at: string | null;
  created_at: string;
}

/** A booking joined with its slot times (and, where readable, the counsellor). */
export interface BookingView extends Booking {
  slot: Pick<Slot, 'starts_at' | 'ends_at'> | null;
  counsellor?: Pick<Counsellor, 'id' | 'display_name' | 'headline'> | null;
}

export interface Payment {
  id: string;
  booking_id: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  amount_paise: number;
  currency: string;
  status: PaymentStatus;
  failure_reason: string | null;
  created_at: string;
}

export interface SessionNote {
  id: string;
  booking_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateSection {
  key: string;
  title: string;
  hint?: string;
}

export interface ReportTemplate {
  id: string;
  counsellor_id: string | null;
  name: string;
  description: string | null;
  sections: TemplateSection[];
}

export interface ReportSection {
  key: string;
  title: string;
  body: string;
}

export interface Report {
  id: string;
  booking_id: string;
  counsellor_id: string;
  client_id: string;
  template_id: string | null;
  title: string;
  content: ReportSection[];
  attachment_path: string | null;
  status: ReportStatus;
  shared_at: string | null;
  updated_at: string;
}

/** Result of a command, for forms. */
export type CommandResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };
