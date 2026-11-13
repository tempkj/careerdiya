'use client';
import { useState } from 'react';
import { payForBooking } from './payment';
import { ui } from './styles';

export default function PayButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const outcome = await payForBooking(bookingId);
      if (outcome === 'submitted') window.location.assign(`/my-sessions/${bookingId}?paid=1`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className={ui.btn} onClick={pay} disabled={busy}>
        {busy ? 'Opening payment…' : label}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
