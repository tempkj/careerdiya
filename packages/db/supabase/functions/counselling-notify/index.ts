// Sends queued counselling notifications by email and WhatsApp, and releases expired
// payment holds (ADR-015 §8). Run it every 5 minutes (Supabase scheduled function / pg_cron);
// the payment webhook also calls it right after a booking is confirmed.
//
// Secrets (all optional; a channel without its secrets marks messages "skipped"):
//   APP_BASE_URL                      e.g. https://careerdiya.in
//   RESEND_API_KEY, NOTIFY_FROM_EMAIL e.g. "Career Diya <sessions@careerdiya.in>"
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_LANG (default "en")
//   WHATSAPP_TEMPLATE_BOOKING_CONFIRMED / _BOOKING_CANCELLED / _REMINDER_24H
//     Approved Meta templates whose body takes 4 parameters:
//     {{1}} recipient name, {{2}} other person, {{3}} session time, {{4}} link to the session page.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildMessage,
  type NotificationTemplate,
  type RecipientRole,
} from '../_shared/counselling-messages.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? 'https://careerdiya.in';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_FROM_EMAIL = Deno.env.get('NOTIFY_FROM_EMAIL') ?? '';
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') ?? '';
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
const WHATSAPP_TEMPLATE_LANG = Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'en';
const WHATSAPP_TEMPLATES: Record<NotificationTemplate, string> = {
  booking_confirmed: Deno.env.get('WHATSAPP_TEMPLATE_BOOKING_CONFIRMED') ?? '',
  booking_cancelled: Deno.env.get('WHATSAPP_TEMPLATE_BOOKING_CANCELLED') ?? '',
  reminder_24h: Deno.env.get('WHATSAPP_TEMPLATE_REMINDER_24H') ?? '',
};

const MAX_ATTEMPTS = 5;
const BATCH = 50;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = admin.schema('core');

interface DueNotification {
  id: string;
  recipient_user_id: string;
  recipient_role: RecipientRole;
  channel: 'email' | 'whatsapp';
  template: NotificationTemplate;
  attempts: number;
  booking: {
    id: string;
    status: string;
    client_name: string;
    client_phone: string | null;
    cancel_reason: string | null;
    meeting_link: string | null;
    counsellor: { display_name: string; user_id: string } | null;
    slot: { starts_at: string } | null;
  } | null;
}

type SendResult = { status: 'sent' } | { status: 'skipped'; reason: string };

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<SendResult> {
  if (!RESEND_API_KEY || !NOTIFY_FROM_EMAIL) return { status: 'skipped', reason: 'email not configured' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: NOTIFY_FROM_EMAIL, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { status: 'sent' };
}

async function sendWhatsApp(
  phoneE164: string,
  template: NotificationTemplate,
  params: string[],
): Promise<SendResult> {
  const name = WHATSAPP_TEMPLATES[template];
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !name) {
    return { status: 'skipped', reason: 'whatsapp not configured' };
  }
  const res = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneE164.replace(/^\+/, ''),
      type: 'template',
      template: {
        name,
        language: { code: WHATSAPP_TEMPLATE_LANG },
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { status: 'sent' };
}

async function counsellorPhone(userId: string): Promise<string | null> {
  const { data } = await db
    .from('cd_contact')
    .select('phone_e164, whatsapp_opt_in')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.whatsapp_opt_in ? data.phone_e164 : null;
}

async function deliver(n: DueNotification): Promise<SendResult> {
  const b = n.booking;
  if (!b || !b.slot || !b.counsellor) return { status: 'skipped', reason: 'booking missing' };
  if (n.template !== 'booking_cancelled' && b.status !== 'confirmed') {
    return { status: 'skipped', reason: `booking is ${b.status}` };
  }

  const isClient = n.recipient_role === 'client';
  const message = buildMessage({
    template: n.template,
    role: n.recipient_role,
    recipientName: isClient ? b.client_name : b.counsellor.display_name,
    otherPartyName: isClient ? b.counsellor.display_name : b.client_name,
    startsAt: b.slot.starts_at,
    meetingLink: b.meeting_link,
    bookingId: b.id,
    baseUrl: APP_BASE_URL,
    cancelReason: b.cancel_reason,
  });

  if (n.channel === 'email') {
    const { data, error } = await admin.auth.admin.getUserById(n.recipient_user_id);
    if (error) throw error;
    const email = data.user?.email;
    if (!email) return { status: 'skipped', reason: 'no email' };
    return sendEmail(email, message.subject, message.text, message.html);
  }

  // Clients gave their number on the booking form for reminders; counsellors opt in.
  const phone = isClient ? b.client_phone : await counsellorPhone(n.recipient_user_id);
  if (!phone) return { status: 'skipped', reason: 'no whatsapp number' };
  return sendWhatsApp(phone, n.template, message.whatsappParams);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const released = await db.rpc('cd_release_expired_holds');
  if (released.error) console.error('[counselling-notify] release holds failed', released.error);

  const { data, error } = await db
    .from('cd_notification')
    .select(
      'id, recipient_user_id, recipient_role, channel, template, attempts, booking:cd_booking(id, status, client_name, client_phone, cancel_reason, meeting_link, counsellor:cd_counsellor(display_name, user_id), slot:cd_availability_slot(starts_at))',
    )
    .eq('status', 'queued')
    .lte('send_after', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('send_after')
    .limit(BATCH);
  if (error) {
    console.error('[counselling-notify] load failed', error);
    return Response.json({ error: 'Could not load notifications' }, { status: 500 });
  }

  const summary = { released: released.data ?? 0, sent: 0, skipped: 0, failed: 0, retrying: 0 };
  for (const n of (data ?? []) as unknown as DueNotification[]) {
    const attempts = n.attempts + 1;
    try {
      const result = await deliver(n);
      await db
        .from('cd_notification')
        .update({
          status: result.status,
          attempts,
          sent_at: result.status === 'sent' ? new Date().toISOString() : null,
          last_error: result.status === 'skipped' ? result.reason : null,
        })
        .eq('id', n.id);
      summary[result.status === 'sent' ? 'sent' : 'skipped']++;
    } catch (e) {
      const giveUp = attempts >= MAX_ATTEMPTS;
      await db
        .from('cd_notification')
        .update({
          status: giveUp ? 'failed' : 'queued',
          attempts,
          last_error: String((e as Error).message ?? e).slice(0, 500),
          send_after: new Date(Date.now() + attempts * 5 * 60 * 1000).toISOString(),
        })
        .eq('id', n.id);
      summary[giveUp ? 'failed' : 'retrying']++;
    }
  }

  return Response.json(summary);
});
