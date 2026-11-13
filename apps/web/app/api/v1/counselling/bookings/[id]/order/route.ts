// POST /api/v1/counselling/bookings/{id}/order
// Creates a Razorpay order for the caller's pending booking and returns what Razorpay
// Checkout needs. Part of the free Career Diya surface (ADR-015), not the CareerAsana
// OpenAPI contract. Confirmation happens only via the signed webhook.
import { createClient } from '@/lib/supabase/server';
import { InternalError, NotFound, Unauthorized } from '@/lib/api-error';
import {
  attachPaymentOrder,
  createRazorpayOrder,
  getBooking,
  inrToPaise,
  isHoldActive,
  razorpayConfig,
} from '@modules/counselling';

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await createClient();
  if (!user || user.is_anonymous) return Unauthorized();

  const { id } = await params;
  const booking = await getBooking(supabase, id);
  if (!booking || booking.client_id !== user.id) return NotFound();

  if (!isHoldActive(booking) || booking.fee_inr <= 0) {
    return error(409, 'conflict', 'This booking can no longer be paid for. Please book again.');
  }

  const config = razorpayConfig();
  if (!config) {
    console.error('[counselling] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set');
    return error(503, 'payments_unavailable', 'Online payment is not available right now. Please try again later.');
  }

  const amountPaise = inrToPaise(booking.fee_inr);
  let orderId: string;
  try {
    const order = await createRazorpayOrder(config, {
      amountPaise,
      receipt: `cd_${booking.id.replace(/-/g, '').slice(0, 30)}`,
      notes: { booking_id: booking.id, counsellor_id: booking.counsellor_id },
    });
    orderId = order.id;
  } catch (e) {
    console.error('[counselling] razorpay order failed', e);
    return error(502, 'payment_provider_error', 'Could not start the payment. Please try again.');
  }

  const attached = await attachPaymentOrder(supabase, booking.id, orderId, amountPaise);
  if (!attached.ok) {
    if (/no longer be paid/i.test(attached.error)) return error(409, 'conflict', attached.error);
    return InternalError();
  }

  return Response.json({
    orderId,
    amount: amountPaise,
    currency: 'INR',
    keyId: config.keyId,
    name: 'Career Diya',
    description: `Counselling session with ${booking.counsellor?.display_name ?? 'your counsellor'}`,
    prefill: {
      name: booking.client_name,
      email: booking.client_email ?? user.email ?? undefined,
      contact: booking.client_phone ?? undefined,
    },
  });
}
