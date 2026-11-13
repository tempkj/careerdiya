// Razorpay webhook helpers shared by edge functions (ADR-015).
// Plain Web Crypto, no Deno or Node APIs, so the same file runs in the edge function and
// in Vitest (razorpay.test.ts).

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/**
 * Verifies the X-Razorpay-Signature header: hex HMAC-SHA256 of the raw request body,
 * keyed with the webhook secret set in the Razorpay dashboard. The raw body must be used
 * exactly as received (no JSON re-serialisation).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return safeEqual(expected, signature.trim().toLowerCase());
}

export interface PaymentEvent {
  eventType: string;
  orderId: string | null;
  paymentId: string | null;
  amountPaise: number | null;
  failureReason: string | null;
}

type Entity = Record<string, unknown> | undefined;

function entity(payload: Record<string, unknown> | undefined, key: string): Entity {
  const wrapper = payload?.[key] as { entity?: Record<string, unknown> } | undefined;
  return wrapper?.entity;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Pulls what we need out of a Razorpay webhook body. Returns null if it is not an event. */
export function parsePaymentEvent(body: unknown): PaymentEvent | null {
  if (!body || typeof body !== 'object') return null;
  const event = body as { event?: unknown; payload?: Record<string, unknown> };
  const eventType = str(event.event);
  if (!eventType) return null;

  const payment = entity(event.payload, 'payment');
  const order = entity(event.payload, 'order');
  const refund = entity(event.payload, 'refund');

  const orderId = str(order?.id) ?? str(payment?.order_id);
  const paymentId = str(payment?.id) ?? str(refund?.payment_id);
  // order.paid carries amount_paid on the order; payment events carry amount on the payment.
  const amountPaise = num(payment?.amount) ?? num(order?.amount_paid) ?? num(order?.amount);
  const failureReason =
    eventType === 'payment.failed'
      ? str(payment?.error_description) ?? str(payment?.error_reason) ?? 'Payment failed'
      : null;

  return { eventType, orderId, paymentId, amountPaise, failureReason };
}

/** Events the platform acts on; anything else is acknowledged and ignored. */
export const HANDLED_EVENTS = new Set([
  'payment.captured',
  'order.paid',
  'payment.failed',
  'refund.processed',
]);
