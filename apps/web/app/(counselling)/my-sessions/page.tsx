import {
  BOOKING_STATUS_LABEL,
  formatInr,
  formatIstDateTime,
  listClientBookings,
  listSharedReportsForClient,
} from '@modules/counselling';
import { EmptyState, PageHeader, StatusBadge } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { requireUser } from '../_lib/viewer';

export const metadata = { title: 'My sessions — Career Diya' };

export default async function MySessionsPage() {
  const { supabase, user } = await requireUser('/my-sessions');
  const [bookings, reports] = await Promise.all([
    listClientBookings(supabase, user.id),
    listSharedReportsForClient(supabase, user.id),
  ]);
  const reportFor = new Set(reports.map((r) => r.booking_id));
  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => ['pending_payment', 'confirmed'].includes(b.status) && b.slot && new Date(b.slot.ends_at).getTime() > now,
  );
  const past = bookings.filter((b) => !upcoming.includes(b));

  const list = (items: typeof bookings) => (
    <ul className="space-y-3">
      {items.map((b) => (
        <li key={b.id}>
          <a href={`/my-sessions/${b.id}`} className={`${ui.card} flex flex-wrap items-center justify-between gap-3 hover:border-[#213a8f]`}>
            <div>
              <p className="font-semibold">{b.counsellor?.display_name ?? 'Counsellor'}</p>
              <p className={ui.muted}>
                {b.slot ? formatIstDateTime(b.slot.starts_at) : '—'} · {formatInr(b.fee_inr)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {reportFor.has(b.id) ? <StatusBadge status="shared" label="Report ready" /> : null}
              <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
            </div>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={ui.page}>
      <PageHeader
        title="My sessions"
        subtitle="Your bookings, meeting links and reports from your counsellor."
        actions={
          <a className={ui.btn} href="/counsellors">
            Book a session
          </a>
        }
      />
      {bookings.length === 0 ? (
        <EmptyState title="You have no sessions yet.">
          <a className={ui.link} href="/counsellors">
            Find a counsellor
          </a>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className={`${ui.h2} mb-3`}>Upcoming</h2>
            {upcoming.length ? list(upcoming) : <p className={ui.muted}>Nothing coming up.</p>}
          </section>
          {past.length ? (
            <section>
              <h2 className={`${ui.h2} mb-3`}>Past and cancelled</h2>
              {list(past)}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
