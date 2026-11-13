'use client';
import { useMemo, useState } from 'react';
import { formatInr, formatIstDate, formatIstTime, groupByIstDay } from '../domain/rules';
import type { Slot } from '../domain/types';
import { payForBooking } from './payment';
import { ui } from './styles';

type BookAction = (input: {
  slotId: string;
  clientName: string;
  phone: string;
  purpose: string;
}) => Promise<{ ok: boolean; error?: string; bookingId?: string; needsPayment?: boolean; signIn?: boolean }>;

export default function BookingPanel({
  slots,
  fee,
  signedIn,
  loginHref,
  defaultName,
  bookAction,
}: {
  slots: Slot[];
  fee: number;
  signedIn: boolean;
  loginHref: string;
  defaultName: string;
  bookAction: BookAction;
}) {
  const days = useMemo(() => groupByIstDay(slots), [slots]);
  const [day, setDay] = useState(days[0]?.day ?? '');
  const [slotId, setSlotId] = useState('');
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daySlots = days.find((d) => d.day === day)?.items ?? [];

  if (!slots.length) {
    return <p className={ui.muted}>No open slots in the next few weeks. Please check back later.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotId) {
      setError('Pick a time first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await bookAction({ slotId, clientName: name, phone, purpose });
      if (!result.ok || !result.bookingId) {
        if (result.signIn) window.location.assign(loginHref);
        setError(result.error ?? 'Could not book that slot.');
        return;
      }
      if (result.needsPayment) {
        try {
          const outcome = await payForBooking(result.bookingId);
          window.location.assign(`/my-sessions/${result.bookingId}${outcome === 'submitted' ? '?paid=1' : ''}`);
        } catch (payError) {
          // The slot stays held for 15 minutes; the booking page lets them try again.
          window.location.assign(
            `/my-sessions/${result.bookingId}?payError=${encodeURIComponent((payError as Error).message)}`,
          );
        }
        return;
      }
      window.location.assign(`/my-sessions/${result.bookingId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <p className={ui.label}>1. Choose a day</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => {
                setDay(d.day);
                setSlotId('');
              }}
              className={`whitespace-nowrap rounded-lg border px-3 py-2 text-sm ${
                d.day === day
                  ? 'border-[#213a8f] bg-[#213a8f] text-white'
                  : 'border-[#d9d8d2] bg-white text-[#151827] hover:border-[#213a8f]'
              }`}
            >
              {d.items[0] ? formatIstDate(d.items[0].starts_at) : d.day}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={ui.label}>2. Choose a time (India time)</p>
        <div className="flex flex-wrap gap-2">
          {daySlots.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSlotId(s.id)}
              aria-pressed={slotId === s.id}
              className={`rounded-lg border px-3 py-2 text-sm ${
                slotId === s.id
                  ? 'border-[#213a8f] bg-[#eef1fb] font-semibold text-[#213a8f]'
                  : 'border-[#d9d8d2] bg-white hover:border-[#213a8f]'
              }`}
            >
              {formatIstTime(s.starts_at)}
            </button>
          ))}
        </div>
      </div>

      {signedIn ? (
        <div className="space-y-3">
          <p className={ui.label}>3. Your details</p>
          <div>
            <label className="sr-only" htmlFor="client_name">
              Name
            </label>
            <input
              id="client_name"
              className={ui.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name of the person attending"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="client_phone">
              Mobile (optional)
            </label>
            <input
              id="client_phone"
              className={ui.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile, for WhatsApp reminders (optional)"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="purpose">
              What would you like help with?
            </label>
            <textarea
              id="purpose"
              className={ui.input}
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What would you like help with? (optional, only your counsellor sees this)"
              maxLength={1000}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button className={`${ui.btn} w-full`} type="submit" disabled={busy || !slotId}>
            {busy ? 'Please wait…' : fee > 0 ? `Book and pay ${formatInr(fee)}` : 'Book free session'}
          </button>
          {fee > 0 ? (
            <p className="text-xs text-[#687083]">
              Your slot is held for 15 minutes while you pay. Payments are handled securely by Razorpay.
            </p>
          ) : null}
        </div>
      ) : (
        <a className={`${ui.btn} w-full`} href={loginHref}>
          Sign in to book
        </a>
      )}
    </form>
  );
}
