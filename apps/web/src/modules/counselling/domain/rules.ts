// Pure rules for the counsellor platform. No I/O here, so everything is unit-tested.
import type {
  Booking,
  BookingStatus,
  ReportSection,
  Slot,
  TemplateSection,
} from './types';

export const IST_TIME_ZONE = 'Asia/Kolkata';
export const MIN_BOOKING_LEAD_MINUTES = 60; // matches cd_book_slot
export const MAX_REPEAT_WEEKS = 12;

// ── Phone numbers ───────────────────────────────────────────────────────────

/**
 * Normalises a phone number to E.164. Bare 10-digit numbers are treated as Indian
 * mobiles. Returns null for anything that is not a plausible number.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[\s\-().]/g, '');

  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9]\d{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

// ── Lists (languages, specialisations) ──────────────────────────────────────

/** Splits comma/newline separated text into a short, de-duplicated list. */
export function parseList(text: string | null | undefined, max = 12): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const item = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

// ── Links ───────────────────────────────────────────────────────────────────

export function normalizeMeetingLink(input: string | null | undefined): string | null | 'invalid' {
  const value = input?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return 'invalid';
    return url.toString();
  } catch {
    return 'invalid';
  }
}

// ── Time ────────────────────────────────────────────────────────────────────

/** Converts a date (YYYY-MM-DD) and time (HH:MM) in India time to a UTC ISO string. */
export function istToUtcIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject impossible dates that Date silently rolls over (e.g. 2026-02-31).
  const [y = 0, m = 0, d = 0] = date.split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  const [hh = 99, mm = 99] = time.split(':').map(Number);
  if (hh > 23 || mm > 59) return null;
  return parsed.toISOString();
}

export interface SlotDraft {
  starts_at: string;
  ends_at: string;
}

/**
 * Builds the slots a counsellor asked for: one at the given India date/time, optionally
 * repeated weekly. Returns an error message instead of slots when the input is invalid.
 */
export function buildSlots(input: {
  date: string;
  time: string;
  minutes: number;
  repeatWeeks: number;
  now?: Date;
}): { ok: true; slots: SlotDraft[] } | { ok: false; error: string } {
  const now = input.now ?? new Date();
  const minutes = Math.round(input.minutes);
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 240) {
    return { ok: false, error: 'Session length must be between 15 and 240 minutes.' };
  }
  const repeat = Math.round(input.repeatWeeks || 0);
  if (repeat < 0 || repeat > MAX_REPEAT_WEEKS) {
    return { ok: false, error: `You can repeat a slot for up to ${MAX_REPEAT_WEEKS} weeks.` };
  }
  const first = istToUtcIso(input.date, input.time);
  if (!first) return { ok: false, error: 'Please enter a valid date and time.' };

  const start = new Date(first);
  if (start.getTime() <= now.getTime()) {
    return { ok: false, error: 'Pick a time in the future.' };
  }

  const slots: SlotDraft[] = [];
  for (let week = 0; week <= repeat; week++) {
    const s = new Date(start.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    const e = new Date(s.getTime() + minutes * 60 * 1000);
    slots.push({ starts_at: s.toISOString(), ends_at: e.toISOString() });
  }
  return { ok: true, slots };
}

/** True when a slot can still be booked by a client (cd_book_slot's lead-time rule). */
export function isBookable(slot: Pick<Slot, 'status' | 'starts_at'>, now = new Date()): boolean {
  return (
    slot.status === 'open' &&
    new Date(slot.starts_at).getTime() > now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60 * 1000
  );
}

/** India-time date key (YYYY-MM-DD) for grouping. */
export function istDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function groupByIstDay<T extends { starts_at: string }>(items: T[]): { day: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const key = istDateKey(item.starts_at);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()].map(([day, list]) => ({ day, items: list }));
}

export function formatIstDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatIstTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export function formatIstDateTime(iso: string): string {
  return `${formatIstDate(iso)}, ${formatIstTime(iso)} IST`;
}

// ── Money ───────────────────────────────────────────────────────────────────

export function formatInr(amount: number): string {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function inrToPaise(amount: number): number {
  return Math.round(amount * 100);
}

// ── Bookings ────────────────────────────────────────────────────────────────

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Payment window expired',
};

export function isHoldActive(
  booking: Pick<Booking, 'status' | 'hold_expires_at'>,
  now = new Date(),
): boolean {
  return (
    booking.status === 'pending_payment' &&
    !!booking.hold_expires_at &&
    new Date(booking.hold_expires_at).getTime() > now.getTime()
  );
}

/** A client may pay while their hold is active, and cancel only before paying. */
export function clientActions(booking: Pick<Booking, 'status' | 'hold_expires_at' | 'fee_inr'>, now = new Date()) {
  const holding = isHoldActive(booking, now);
  return {
    canPay: holding && booking.fee_inr > 0,
    canCancel: booking.status === 'pending_payment',
  };
}

export function counsellorActions(
  booking: Pick<Booking, 'status'>,
  slotStartsAt: string | null,
  now = new Date(),
) {
  const started = !!slotStartsAt && new Date(slotStartsAt).getTime() <= now.getTime();
  return {
    canComplete: booking.status === 'confirmed' && started,
    canCancel: booking.status === 'pending_payment' || booking.status === 'confirmed',
    canWriteReport: booking.status === 'confirmed' || booking.status === 'completed',
  };
}

// ── Report templates ────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'section'
  );
}

/**
 * Parses template sections typed one per line as "Title" or "Title | hint".
 * Keys are slugs of the titles, made unique.
 */
export function parseTemplateSections(text: string): TemplateSection[] {
  const sections: TemplateSection[] = [];
  const used = new Set<string>();
  for (const line of text.split('\n')) {
    const [rawTitle = '', ...rest] = line.split('|');
    const title = rawTitle.trim().slice(0, 120);
    if (!title) continue;
    let key = slugify(title);
    let n = 2;
    while (used.has(key)) key = `${slugify(title)}_${n++}`;
    used.add(key);
    const hint = rest.join('|').trim().slice(0, 300);
    sections.push(hint ? { key, title, hint } : { key, title });
    if (sections.length >= 15) break;
  }
  return sections;
}

export function sectionsToText(sections: TemplateSection[]): string {
  return sections.map((s) => (s.hint ? `${s.title} | ${s.hint}` : s.title)).join('\n');
}

/** Builds report content from a template's sections and submitted section bodies. */
export function buildReportContent(
  sections: TemplateSection[],
  bodies: Record<string, string | undefined>,
): ReportSection[] {
  return sections.map((s) => ({
    key: s.key,
    title: s.title,
    body: (bodies[s.key] ?? '').trim().slice(0, 8000),
  }));
}

// ── Database errors ─────────────────────────────────────────────────────────

/**
 * Turns a PostgREST/Postgres error into something safe to show. Messages raised on purpose
 * by our RPCs (P0001/P0002/42501/23P01) are already user-facing; anything else is generic.
 */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.';
  const code = error.code ?? '';
  if (['P0001', 'P0002', '23P01'].includes(code) && error.message) return error.message;
  if (code === '42501') {
    return error.message && !/permission denied/i.test(error.message)
      ? error.message
      : 'You are not allowed to do that.';
  }
  if (code === '23505') return 'That already exists.';
  if (code === '23514') return 'Some of the details are not valid. Please check and try again.';
  return 'Something went wrong. Please try again.';
}
