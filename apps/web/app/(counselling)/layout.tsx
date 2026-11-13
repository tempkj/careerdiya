import type { ReactNode } from 'react';
import { getMyCounsellor, isAdmin } from '@modules/counselling';
import { getViewer } from './_lib/viewer';

export const metadata = {
  title: 'Counselling — Career Diya',
  description: 'Find a verified career counsellor and book a session.',
};

// Signed-in state differs per visitor; never cache these pages.
export const dynamic = 'force-dynamic';

export default async function CounsellingLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await getViewer();
  const [counsellor, admin] = user
    ? await Promise.all([getMyCounsellor(supabase, user.id), isAdmin(supabase, user.id)])
    : [null, false];

  const links = [
    { href: '/counsellors', label: 'Find a counsellor' },
    ...(user ? [{ href: '/my-sessions', label: 'My sessions' }] : []),
    { href: '/counsellor', label: counsellor ? 'Counsellor portal' : 'For counsellors' },
    ...(admin ? [{ href: '/admin/counselling', label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#fbfbf8] text-[#151827]">
      <header className="border-b border-[#e8e7e2] bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <a href="/index.html" aria-label="Career Diya home">
            <img src="/assets/careerdiya-horizontal-lockup.svg" alt="Career Diya" className="h-8 w-auto" />
          </a>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-[#687083]">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-[#213a8f]">
                {l.label}
              </a>
            ))}
            {user ? (
              <span className="hidden text-xs text-[#9aa0ad] sm:inline">{user.email}</span>
            ) : (
              <a href="/login?next=/my-sessions" className="text-[#213a8f]">
                Sign in
              </a>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 border-t border-[#e8e7e2] py-6 text-center text-xs text-[#9aa0ad]">
        Career Diya · <a href="/privacy.html" className="hover:underline">Privacy</a> ·{' '}
        <a href="/terms.html" className="hover:underline">Terms</a>
      </footer>
    </div>
  );
}
