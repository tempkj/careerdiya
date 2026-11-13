import { describe, expect, it, vi } from 'vitest';
import { createRazorpayOrder, razorpayConfig } from './razorpay';

describe('razorpayConfig', () => {
  it('needs both keys', () => {
    expect(razorpayConfig({ RAZORPAY_KEY_ID: 'rzp_test_1' })).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_ID: 'rzp_test_1', RAZORPAY_KEY_SECRET: 's' })).toEqual({
      keyId: 'rzp_test_1',
      keySecret: 's',
    });
  });
});

describe('createRazorpayOrder', () => {
  const config = { keyId: 'rzp_test_1', keySecret: 'secret' };

  it('creates an INR order with basic auth', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'order_1', amount: 150000, currency: 'INR', receipt: 'r', status: 'created' }), {
        status: 200,
      }),
    );
    const order = await createRazorpayOrder(
      config,
      { amountPaise: 150000, receipt: 'booking-123', notes: { booking_id: '123' } },
      fetchImpl as unknown as typeof fetch,
    );
    expect(order.id).toBe('order_1');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('rzp_test_1:secret').toString('base64')}`,
    );
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 150000,
      currency: 'INR',
      receipt: 'booking-123',
      notes: { booking_id: '123' },
    });
  });

  it('surfaces Razorpay errors', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { description: 'Authentication failed' } }), { status: 401 }),
    );
    await expect(
      createRazorpayOrder(config, { amountPaise: 100, receipt: 'r' }, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow('Authentication failed');
  });

  it('refuses amounts under ₹1', async () => {
    await expect(createRazorpayOrder(config, { amountPaise: 50, receipt: 'r' }, vi.fn())).rejects.toThrow();
  });
});
