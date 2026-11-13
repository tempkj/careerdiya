'use client';
// Opens Razorpay Checkout for a booking. The server creates the order (with the secret key)
// and returns only what Checkout needs. Success here is NOT treated as payment: the booking
// page waits for the signed webhook to confirm it (ADR-015 §6).

interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Could not load the payment window. Check your connection.')));
    if (!existing) {
      script.src = CHECKOUT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

/**
 * Starts payment for a booking. Resolves 'submitted' when Razorpay reports success
 * (confirmation still comes from the webhook), 'dismissed' if the user closes the window.
 */
export async function payForBooking(bookingId: string): Promise<'submitted' | 'dismissed'> {
  const res = await fetch(`/api/v1/counselling/bookings/${bookingId}/order`, { method: 'POST' });
  const body = (await res.json().catch(() => ({}))) as Partial<OrderResponse> & {
    error?: { message?: string };
  };
  if (!res.ok || !body.orderId) {
    throw new Error(body.error?.message ?? 'Could not start the payment. Please try again.');
  }
  await loadCheckout();
  if (!window.Razorpay) throw new Error('Could not load the payment window.');

  return new Promise((resolve) => {
    const checkout = new window.Razorpay!({
      key: body.keyId,
      order_id: body.orderId,
      amount: body.amount,
      currency: body.currency,
      name: body.name,
      description: body.description,
      prefill: body.prefill,
      theme: { color: '#213a8f' },
      handler: () => resolve('submitted'),
      modal: { ondismiss: () => resolve('dismissed') },
    });
    // On a failed attempt Razorpay keeps its window open so the user can retry with another
    // method; closing it resolves 'dismissed'. The webhook records the failure.
    checkout.on('payment.failed', () => undefined);
    checkout.open();
  });
}
