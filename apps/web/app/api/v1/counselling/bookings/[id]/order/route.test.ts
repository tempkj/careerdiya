import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'client-1', email: 'c@test.in', is_anonymous: false } as
    | { id: string; email: string; is_anonymous: boolean }
    | null,
  booking: null as Record<string, unknown> | null,
  attach: vi.fn(),
  createOrder: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ supabase: {}, user: state.user }),
}));

vi.mock('@modules/counselling', async () => {
  const actual = await vi.importActual<typeof import('@modules/counselling')>('@modules/counselling');
  return {
    ...actual,
    getBooking: async () => state.booking,
    attachPaymentOrder: state.attach,
    createRazorpayOrder: state.createOrder,
  };
});

import { POST } from './route';

const call = () =>
  POST(new Request('http://localhost/api/v1/counselling/bookings/b1/order', { method: 'POST' }), {
    params: Promise.resolve({ id: 'b1' }),
  });

function pendingBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    client_id: 'client-1',
    counsellor_id: 'co-1',
    client_name: 'Asha',
    client_email: 'asha@test.in',
    client_phone: '+919876543210',
    status: 'pending_payment',
    fee_inr: 1500,
    hold_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    counsellor: { id: 'co-1', display_name: 'Counsellor One', headline: null },
    ...overrides,
  };
}

describe('POST /api/v1/counselling/bookings/{id}/order', () => {
  beforeEach(() => {
    state.user = { id: 'client-1', email: 'c@test.in', is_anonymous: false };
    state.booking = pendingBooking();
    state.attach.mockReset().mockResolvedValue({ ok: true, data: {} });
    state.createOrder.mockReset().mockResolvedValue({ id: 'order_9', amount: 150000, currency: 'INR' });
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
  });

  it('requires a signed-in, non-guest user', async () => {
    state.user = null;
    expect((await call()).status).toBe(401);
    state.user = { id: 'client-1', email: '', is_anonymous: true };
    expect((await call()).status).toBe(401);
  });

  it("returns 404 for someone else's booking", async () => {
    state.booking = pendingBooking({ client_id: 'someone-else' });
    expect((await call()).status).toBe(404);
  });

  it('refuses once the hold has expired', async () => {
    state.booking = pendingBooking({ hold_expires_at: new Date(Date.now() - 1000).toISOString() });
    expect((await call()).status).toBe(409);
    expect(state.createOrder).not.toHaveBeenCalled();
  });

  it('reports payments as unavailable when Razorpay keys are missing', async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    expect((await call()).status).toBe(503);
  });

  it('creates the order for the fee in paise and records it', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ orderId: 'order_9', amount: 150000, currency: 'INR', keyId: 'rzp_test_key' });
    expect(body).not.toHaveProperty('keySecret');
    expect(state.createOrder.mock.calls[0]?.[1]).toMatchObject({ amountPaise: 150000 });
    expect(state.attach).toHaveBeenCalledWith({}, '11111111-2222-3333-4444-555555555555', 'order_9', 150000);
  });
});
