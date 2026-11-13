import {
  BOOKING_STATUS_LABEL,
  formatIstDateTime,
  getMyContact,
  getMyCounsellor,
  listCertificates,
  listCounsellorBookings,
  listMySlots,
} from '@modules/counselling';
import { EmptyState, PageHeader, StatusBadge } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { requireUser } from '../_lib/viewer';
import { CounsellorNav, ProfileForm, StatusNotice } from './_components';

export const metadata = { title: 'Counsellor portal — Career Diya' };

export default async function CounsellorHome() {
  const { supabase, user } = await requireUser('/counsellor');
  const counsellor = await getMyCounsellor(supabase, user.id);

  if (!counsellor) {
    return (
      <div className={`${ui.page} max-w-3xl`}>
        <PageHeader
          title="Run your counselling practice on Career Diya"
          subtitle="Free for clients you bring yourself: a profile page, online booking and payments, session notes and written reports."
        />
        <ul className={`mb-6 grid gap-3 sm:grid-cols-3 ${ui.muted}`}>
          <li className={ui.card}>
            <p className="font-semibold text-[#151827]">1. Create your profile</p>
            Tell clients who you help and set your fee.
          </li>
          <li className={ui.card}>
            <p className="font-semibold text-[#151827]">2. Get verified</p>
            Upload your certificates. We check them before you&apos;re listed.
          </li>
          <li className={ui.card}>
            <p className="font-semibold text-[#151827]">3. Open your calendar</p>
            Add time slots. Clients book and pay online.
          </li>
        </ul>
        <section className={ui.card}>
          <ProfileForm counsellor={null} />
        </section>
      </div>
    );
  }

  const [bookings, slots, contact, certificates] = await Promise.all([
    listCounsellorBookings(supabase, counsellor.id),
    listMySlots(supabase, counsellor.id),
    getMyContact(supabase, user.id),
    listCertificates(supabase, [counsellor.id]),
  ]);
  const now = Date.now();
  const upcoming = bookings
    .filter((b) => b.status === 'confirmed' && b.slot && new Date(b.slot.ends_at).getTime() > now)
    .sort((a, b) => (a.slot!.starts_at < b.slot!.starts_at ? -1 : 1));
  const needsAction = bookings.filter(
    (b) => b.status === 'confirmed' && b.slot && new Date(b.slot.ends_at).getTime() <= now,
  );
  const openSlots = slots.filter((s) => s.status === 'open' && new Date(s.starts_at).getTime() > now);

  const checklist = [
    { done: !!counsellor.bio, label: 'Write your "About" section', href: '/counsellor/profile' },
    { done: certificates.length > 0, label: 'Upload a certificate for verification', href: '/counsellor/profile' },
    { done: !!contact?.meeting_link, label: 'Add your Google Meet / Zoom link', href: '/counsellor/profile' },
    { done: openSlots.length > 0, label: 'Add available time slots', href: '/counsellor/availability' },
  ];

  return (
    <div className={ui.page}>
      <PageHeader title={`Hello, ${counsellor.display_name}`} subtitle="Your counselling practice at a glance." />
      <CounsellorNav current="/counsellor" />
      <div className="space-y-6">
        <StatusNotice counsellor={counsellor} />

        {checklist.some((c) => !c.done) ? (
          <section className={ui.card}>
            <h2 className={ui.h2}>Finish setting up</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  <span aria-hidden className={c.done ? 'text-emerald-600' : 'text-[#c2c0b8]'}>
                    {c.done ? '✓' : '○'}
                  </span>
                  {c.done ? (
                    <span className="text-[#687083] line-through">{c.label}</span>
                  ) : (
                    <a className={ui.link} href={c.href}>
                      {c.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className={ui.card}>
            <p className={ui.muted}>Upcoming sessions</p>
            <p className="mt-1 text-2xl font-bold">{upcoming.length}</p>
          </div>
          <div className={ui.card}>
            <p className={ui.muted}>Open slots</p>
            <p className="mt-1 text-2xl font-bold">{openSlots.length}</p>
          </div>
          <div className={ui.card}>
            <p className={ui.muted}>Sessions to wrap up</p>
            <p className="mt-1 text-2xl font-bold">{needsAction.length}</p>
          </div>
        </div>

        <section>
          <h2 className={`${ui.h2} mb-3`}>Upcoming sessions</h2>
          {upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.map((b) => (
                <li key={b.id}>
                  <a
                    href={`/counsellor/sessions/${b.id}`}
                    className={`${ui.card} flex flex-wrap items-center justify-between gap-3 hover:border-[#213a8f]`}
                  >
                    <div>
                      <p className="font-semibold">{b.client_name}</p>
                      <p className={ui.muted}>{formatIstDateTime(b.slot!.starts_at)}</p>
                    </div>
                    <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No upcoming sessions.">
              {openSlots.length ? 'Share your profile link with clients so they can book.' : 'Add some availability to start taking bookings.'}
            </EmptyState>
          )}
        </section>

        {needsAction.length ? (
          <section>
            <h2 className={`${ui.h2} mb-3`}>Wrap up past sessions</h2>
            <p className={`mb-3 ${ui.muted}`}>Mark them completed and share a report with the client.</p>
            <ul className="space-y-2">
              {needsAction.map((b) => (
                <li key={b.id}>
                  <a className={ui.link} href={`/counsellor/sessions/${b.id}`}>
                    {b.client_name} — {formatIstDateTime(b.slot!.starts_at)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
