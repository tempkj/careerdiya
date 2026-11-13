// Razorpay webhook → confirms counselling bookings (ADR-015 §6).
//
// The ONLY path that marks a payment paid and a booking confirmed. Every request must carry a
// valid X-Razorpay-Signature (HMAC-SHA256 of the raw body with RAZORPAY_WEBHOOK_SECRET).
// Service role is used here because this is a server-to-server call with no user session.
//
// Razorpay dashboard → Webhooks: URL https://<project>.supabase.co/functions/v1/counselling-razorpay-webhook
// Events: payment.captured, order.paid, payment.failed, refund.processed
// Secrets: RAZORPAY_WEBHOOK_SECRET (plus SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, set by Supabase)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HANDLED_EVENTS, hmacSha256Hex, parsePaymentEvent, verifyWebhookSignature } from '../_shared/razorpay.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** Kick the notifier so confirmation messages go out now rather than on the next schedule. */
async function nudgeNotifier() {
  try {
    await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/counselling-notify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.warn('[razorpay-webhook] could not nudge notifier', error);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!WEBHOOK_SECRET) {
    console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set');
    return json({ error: 'Webhook not configured' }, 500);
  }

  const raw = await req.text();
  const valid = await verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature'), WEBHOOK_SECRET);
  if (!valid) return json({ error: 'Invalid signature' }, 401);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const event = parsePaymentEvent(body);
  if (!event || !HANDLED_EVENTS.has(event.eventType)) return json({ outcome: 'ignored' });
  if (!event.orderId) return json({ outcome: 'no_order' });

  // Razorpay sends a unique id per event (and repeats it on retries). Fall back to a hash of
  // the body so replays are still idempotent.
  const eventId = req.headers.get('x-razorpay-event-id') ?? `body_${await hmacSha256Hex('event', raw)}`;

  const { data, error } = await admin.schema('core').rpc('cd_apply_payment_event', {
    p_event_id: eventId,
    p_event_type: event.eventType,
    p_order_id: event.orderId,
    p_payment_id: event.paymentId,
    p_amount_paise: event.amountPaise,
    p_failure_reason: event.failureReason,
    p_payload: body,
  });
  if (error) {
    console.error('[razorpay-webhook] apply failed', error);
    // 5xx makes Razorpay retry; the event id keeps the retry idempotent.
    return json({ error: 'Could not apply event' }, 500);
  }

  const outcome = String(data);
  if (outcome === 'confirmed' || outcome === 'confirmed_late') await nudgeNotifier();
  if (outcome === 'amount_mismatch' || outcome === 'refund_required' || outcome === 'unknown_order') {
    console.warn('[razorpay-webhook] needs attention', { eventId, outcome, orderId: event.orderId });
  }
  return json({ outcome });
});
