'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function CareerDiyaHandoffPage() {
  const [message, setMessage] = useState('Connecting your Career Diya profile…');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const next = params.get('next') || '/activate?source=careerdiya';

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
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          Career Diya → CareerAsana
        </p>
        <h1 className="text-lg font-semibold text-gray-900">Opening your deeper planning layer</h1>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <a href="/" className="mt-5 inline-block text-sm text-gray-700 underline">
          Back to Career Diya
        </a>
      </section>
    </main>
  );
}
