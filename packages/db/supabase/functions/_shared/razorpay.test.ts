import { describe, expect, it } from 'vitest';
import {
  hmacSha256Hex,
  parsePaymentEvent,
  safeEqual,
  verifyWebhookSignature,
} from './razorpay';

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const body = '{"event":"payment.captured","payload":{}}';

  it('accepts the HMAC-SHA256 of the raw body', async () => {
    const signature = await hmacSha256Hex(secret, body);
    expect(await verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('matches a known vector', async () => {
    // printf %s 'hello' | openssl dgst -sha256 -hmac key
    expect(await hmacSha256Hex('key', 'hello')).toBe(
      '9307b3b915efb5171ff14d8cb55fbcc798c6c0ef1456d66ded1a6aa723a58b7b',
    );
  });

  it('rejects a signature for a different body', async () => {
    const signature = await hmacSha256Hex(secret, body);
    expect(await verifyWebhookSignature(body + ' ', signature, secret)).toBe(false);
  });

  it('rejects a wrong secret, a missing signature and a missing secret', async () => {
    const signature = await hmacSha256Hex('other', body);
    expect(await verifyWebhookSignature(body, signature, secret)).toBe(false);
    expect(await verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(await verifyWebhookSignature(body, signature, '')).toBe(false);
  });
});

describe('safeEqual', () => {
  it('compares strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('parsePaymentEvent', () => {
  it('reads payment.captured', () => {
    expect(
      parsePaymentEvent({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1', amount: 150000 } } },
      }),
    ).toEqual({
      eventType: 'payment.captured',
      orderId: 'order_1',
      paymentId: 'pay_1',
      amountPaise: 150000,
      failureReason: null,
    });
  });

  it('reads order.paid', () => {
    expect(
      parsePaymentEvent({
        event: 'order.paid',
        payload: {
          order: { entity: { id: 'order_2', amount: 99900, amount_paid: 99900 } },
          payment: { entity: { id: 'pay_2', order_id: 'order_2', amount: 99900 } },
        },
      }),
    ).toMatchObject({ orderId: 'order_2', paymentId: 'pay_2', amountPaise: 99900 });
  });

  it('carries the failure reason on payment.failed', () => {
    expect(
      parsePaymentEvent({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: { id: 'pay_3', order_id: 'order_3', amount: 100, error_description: 'Card declined' },
          },
        },
      })?.failureReason,
    ).toBe('Card declined');
  });

  it('reads refund.processed', () => {
    expect(
      parsePaymentEvent({
        event: 'refund.processed',
        payload: {
          refund: { entity: { id: 'rfnd_1', payment_id: 'pay_4', amount: 500 } },
          payment: { entity: { id: 'pay_4', order_id: 'order_4', amount: 500 } },
        },
      }),
    ).toMatchObject({ eventType: 'refund.processed', orderId: 'order_4', paymentId: 'pay_4' });
  });

  it('returns null for things that are not events', () => {
    expect(parsePaymentEvent(null)).toBeNull();
    expect(parsePaymentEvent('x')).toBeNull();
    expect(parsePaymentEvent({ payload: {} })).toBeNull();
  });
});
