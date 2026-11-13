'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import CareerDiyaShell from '../../_components/CareerDiyaShell';

export default function CareerDiyaHandoffPage() {
  const [message, setMessage] = useState('Connecting your Career Diya profile…');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const requestedNext = params.get('next') || '/activate?source=careerdiya';
        // The handoff fragment is constructed client-side but is still user-controlled
        // input. Only follow same-origin relative paths after the session is established.
        const next =
          requestedNext.startsWith('/') &&
          !requestedNext.startsWith('//') &&
          !requestedNext.includes('\\')
            ? requestedNext
            : '/activate?source=careerdiya';

        if (!accessToken || !refreshToken) {
          throw new Error('The Career Diya session handoff is missing its session data.');
        }

        const supabase = createClient();
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;

        // Remove tokens from the visible URL before continuing.
        window.history.replaceState({}, document.title, '/auth/handoff');
        if (!cancelled) window.location.replace(next);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Could not connect the two experiences.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <CareerDiyaShell eyebrow="Career Diya → CareerĀsanā" title="Opening your planning workspace">
      <section className="ca-panel max-w-xl mx-auto">
        <p className="text-sm text-gray-600">{message}</p>
        <a href="/dashboard.html" className="btn btn-secondary mt-5">
          Back to Career Diya
        </a>
      </section>
    </CareerDiyaShell>
  );
}
