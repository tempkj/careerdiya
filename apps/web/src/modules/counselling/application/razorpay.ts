// Creates Razorpay orders server-side (ADR-015 §6). The key secret never reaches the browser;
// the browser only gets the order id and the public key id to open Razorpay Checkout.
// Payment confirmation is NOT done here: only the signed webhook confirms a booking.

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

export function razorpayConfig(env: Record<string, string | undefined> = process.env): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
}

export async function createRazorpayOrder(
  config: RazorpayConfig,
  input: { amountPaise: number; receipt: string; notes?: Record<string, string> },
  fetchImpl: typeof fetch = fetch,
): Promise<RazorpayOrder> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
    throw new Error('Razorpay orders must be at least ₹1.');
  }
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
  const res = await fetchImpl('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    // Receipts are limited to 40 characters by Razorpay.
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as Partial<RazorpayOrder> & {
    error?: { description?: string };
  };
  if (!res.ok || !payload.id) {
    throw new Error(payload.error?.description || `Razorpay order failed (${res.status}).`);
  }
  return {
    id: payload.id,
    amount: payload.amount ?? input.amountPaise,
    currency: payload.currency ?? 'INR',
    receipt: payload.receipt ?? null,
    status: payload.status ?? 'created',
  };
}
