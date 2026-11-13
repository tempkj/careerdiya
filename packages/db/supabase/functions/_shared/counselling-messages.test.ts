import { describe, expect, it } from 'vitest';
import { buildMessage, formatIst } from './counselling-messages';

const base = {
  recipientName: 'Asha',
  otherPartyName: 'Counsellor One',
  startsAt: '2026-11-20T12:30:00Z',
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  bookingId: 'b-1',
  baseUrl: 'https://careerdiya.in/',
};

describe('formatIst', () => {
  it('shows India time', () => {
    expect(formatIst('2026-11-20T12:30:00Z')).toMatch(/20 Nov.*6:00\s?pm IST/i);
  });
});

describe('buildMessage', () => {
  it('confirms a session for the client with the meeting link and their page', () => {
    const m = buildMessage({ ...base, template: 'booking_confirmed', role: 'client' });
    expect(m.subject).toMatch(/^Session confirmed/);
    expect(m.text).toContain('with Counsellor One is confirmed');
    expect(m.text).toContain('https://meet.google.com/abc-defg-hij');
    expect(m.text).toContain('https://careerdiya.in/my-sessions/b-1');
    expect(m.whatsappParams[3]).toBe('https://careerdiya.in/my-sessions/b-1');
  });

  it('links counsellors to their portal', () => {
    const m = buildMessage({ ...base, otherPartyName: 'Asha', recipientName: 'Ravi', template: 'reminder_24h', role: 'counsellor' });
    expect(m.text).toContain('with Asha (client)');
    expect(m.text).toContain('/counsellor/sessions/b-1');
  });

  it('mentions refunds to clients on cancellation, not the meeting link', () => {
    const m = buildMessage({ ...base, template: 'booking_cancelled', role: 'client', cancelReason: 'Unwell' });
    expect(m.text).toContain('Reason: Unwell');
    expect(m.text).toContain('refund');
    expect(m.text).not.toContain('Join here');
  });

  it('escapes HTML in names', () => {
    const m = buildMessage({ ...base, recipientName: '<b>x</b>', template: 'booking_confirmed', role: 'client' });
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
