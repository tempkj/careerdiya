import { describe, expect, it } from 'vitest';
import {
  buildReportContent,
  buildSlots,
  clientActions,
  counsellorActions,
  formatInr,
  friendlyDbError,
  groupByIstDay,
  isBookable,
  istToUtcIso,
  normalizeMeetingLink,
  normalizePhone,
  parseList,
  parseTemplateSections,
  sectionsToText,
} from './rules';

describe('normalizePhone', () => {
  it('turns Indian mobiles into E.164', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('098765-43210')).toBe('+919876543210');
    expect(normalizePhone('919876543210')).toBe('+919876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
  });

  it('keeps other countries already in E.164', () => {
    expect(normalizePhone('+447700900123')).toBe('+447700900123');
  });

  it('rejects junk', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5876543210')).toBeNull(); // Indian mobiles start 6-9
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe('parseList', () => {
  it('splits, trims and de-duplicates', () => {
    expect(parseList('English, Hindi,\nbengali , english')).toEqual(['English', 'Hindi', 'bengali']);
  });
  it('caps the list', () => {
    expect(parseList('a,b,c,d', 2)).toEqual(['a', 'b']);
  });
});

describe('normalizeMeetingLink', () => {
  it('accepts https links', () => {
    expect(normalizeMeetingLink('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
  });
  it('treats blank as no link', () => {
    expect(normalizeMeetingLink('  ')).toBeNull();
  });
  it('rejects http and non-urls', () => {
    expect(normalizeMeetingLink('http://zoom.us/j/1')).toBe('invalid');
    expect(normalizeMeetingLink('meet.google.com/abc')).toBe('invalid');
  });
});

describe('istToUtcIso', () => {
  it('converts India time to UTC', () => {
    expect(istToUtcIso('2026-12-01', '10:30')).toBe('2026-12-01T05:00:00.000Z');
  });
  it('rejects invalid dates and times', () => {
    expect(istToUtcIso('2026-02-31', '10:00')).toBeNull();
    expect(istToUtcIso('2026-12-01', '25:00')).toBeNull();
    expect(istToUtcIso('01/12/2026', '10:00')).toBeNull();
  });
});

describe('buildSlots', () => {
  const now = new Date('2026-11-13T00:00:00Z');

  it('builds one slot', () => {
    const r = buildSlots({ date: '2026-11-20', time: '18:00', minutes: 60, repeatWeeks: 0, now });
    expect(r).toEqual({
      ok: true,
      slots: [{ starts_at: '2026-11-20T12:30:00.000Z', ends_at: '2026-11-20T13:30:00.000Z' }],
    });
  });

  it('repeats weekly', () => {
    const r = buildSlots({ date: '2026-11-20', time: '18:00', minutes: 45, repeatWeeks: 2, now });
    expect(r.ok && r.slots.map((s) => s.starts_at)).toEqual([
      '2026-11-20T12:30:00.000Z',
      '2026-11-27T12:30:00.000Z',
      '2026-12-04T12:30:00.000Z',
    ]);
    expect(r.ok && r.slots[0]?.ends_at).toBe('2026-11-20T13:15:00.000Z');
  });

  it('rejects the past, bad lengths and long repeats', () => {
    expect(buildSlots({ date: '2026-11-01', time: '10:00', minutes: 60, repeatWeeks: 0, now }).ok).toBe(false);
    expect(buildSlots({ date: '2026-11-20', time: '10:00', minutes: 10, repeatWeeks: 0, now }).ok).toBe(false);
    expect(buildSlots({ date: '2026-11-20', time: '10:00', minutes: 60, repeatWeeks: 13, now }).ok).toBe(false);
  });
});

describe('isBookable', () => {
  const now = new Date('2026-11-13T10:00:00Z');
  it('needs an open slot at least an hour away', () => {
    expect(isBookable({ status: 'open', starts_at: '2026-11-13T12:00:00Z' }, now)).toBe(true);
    expect(isBookable({ status: 'open', starts_at: '2026-11-13T10:30:00Z' }, now)).toBe(false);
    expect(isBookable({ status: 'held', starts_at: '2026-11-14T10:00:00Z' }, now)).toBe(false);
  });
});

describe('groupByIstDay', () => {
  it('groups by the India calendar day, not UTC', () => {
    const groups = groupByIstDay([
      { starts_at: '2026-11-20T19:00:00Z' }, // 21 Nov 00:30 IST
      { starts_at: '2026-11-20T12:30:00Z' }, // 20 Nov 18:00 IST
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-11-20', '2026-11-21']);
  });
});

describe('booking actions', () => {
  const now = new Date('2026-11-13T10:00:00Z');

  it('lets a client pay only while the hold is active', () => {
    expect(clientActions({ status: 'pending_payment', fee_inr: 1500, hold_expires_at: '2026-11-13T10:10:00Z' }, now))
      .toEqual({ canPay: true, canCancel: true });
    expect(clientActions({ status: 'pending_payment', fee_inr: 1500, hold_expires_at: '2026-11-13T09:50:00Z' }, now).canPay)
      .toBe(false);
    expect(clientActions({ status: 'confirmed', fee_inr: 1500, hold_expires_at: null }, now))
      .toEqual({ canPay: false, canCancel: false });
  });

  it('lets a counsellor complete only after the start time', () => {
    expect(counsellorActions({ status: 'confirmed' }, '2026-11-13T11:00:00Z', now).canComplete).toBe(false);
    expect(counsellorActions({ status: 'confirmed' }, '2026-11-13T09:00:00Z', now).canComplete).toBe(true);
    expect(counsellorActions({ status: 'cancelled' }, '2026-11-13T09:00:00Z', now).canCancel).toBe(false);
  });
});

describe('templates and reports', () => {
  it('parses sections with hints and unique keys', () => {
    const sections = parseTemplateSections('Next steps | What to do\n\nNext steps\nStrengths');
    expect(sections).toEqual([
      { key: 'next_steps', title: 'Next steps', hint: 'What to do' },
      { key: 'next_steps_2', title: 'Next steps' },
      { key: 'strengths', title: 'Strengths' },
    ]);
    expect(sectionsToText(sections)).toBe('Next steps | What to do\nNext steps\nStrengths');
  });

  it('builds report content in template order', () => {
    expect(
      buildReportContent([{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }], { b: ' text ', x: 'ignored' }),
    ).toEqual([
      { key: 'a', title: 'A', body: '' },
      { key: 'b', title: 'B', body: 'text' },
    ]);
  });
});

describe('formatInr', () => {
  it('formats rupees, and zero as Free', () => {
    expect(formatInr(1500)).toBe('₹1,500');
    expect(formatInr(0)).toBe('Free');
  });
});

describe('friendlyDbError', () => {
  it('passes through messages our RPCs raise on purpose', () => {
    expect(friendlyDbError({ code: 'P0001', message: 'That slot is no longer available.' })).toBe(
      'That slot is no longer available.',
    );
  });
  it('hides internal errors', () => {
    expect(friendlyDbError({ code: 'XX000', message: 'relation core.x does not exist' })).toBe(
      'Something went wrong. Please try again.',
    );
    expect(friendlyDbError({ code: '42501', message: 'permission denied for table cd_booking' })).toBe(
      'You are not allowed to do that.',
    );
  });
});
