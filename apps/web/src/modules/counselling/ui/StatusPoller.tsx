'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * After payment, the booking is confirmed by the Razorpay webhook a few seconds later.
 * This refreshes the page until that happens (or gives up after ~2 minutes).
 */
export default function StatusPoller({ active, intervalMs = 3000, maxTries = 40 }: {
  active: boolean;
  intervalMs?: number;
  maxTries?: number;
}) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!active || tries >= maxTries) return;
    const timer = setTimeout(() => {
      router.refresh();
      setTries((t) => t + 1);
    }, intervalMs);
    return () => clearTimeout(timer);
  }, [active, tries, maxTries, intervalMs, router]);

  if (!active) return null;
  return (
    <p className="text-sm text-[#687083]" role="status">
      {tries >= maxTries
        ? 'Still waiting for the payment confirmation. If money was taken, it will show here shortly — refresh this page in a few minutes.'
        : 'Confirming your payment…'}
    </p>
  );
}
