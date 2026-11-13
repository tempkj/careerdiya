import { BOOKING_STATUS_LABEL, formatIstDateTime, listCounsellorBookings, type BookingView } from '@modules/counselling';
import { EmptyState, PageHeader, StatusBadge } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { requireCounsellor } from '../../_lib/viewer';
import { CounsellorNav } from '../_components';

export const metadata = { title: 'Clients — Counsellor portal' };

interface ClientRow {
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  sessions: BookingView[];
}

export default async function ClientsPage() {
  const { supabase, counsellor } = await requireCounsellor('/counsellor/clients');
  const bookings = await listCounsellorBookings(supabase, counsellor.id);

  const byClient = new Map<string, ClientRow>();
  for (const b of bookings) {
    if (b.status === 'expired') continue;
    const row = byClient.get(b.client_id) ?? {
      clientId: b.client_id,
      name: b.client_name,
      email: b.client_email,
      phone: b.client_phone,
      sessions: [],
    };
    row.sessions.push(b);
    row.phone = row.phone ?? b.client_phone;
    byClient.set(b.client_id, row);
  }
  const clients = [...byClient.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={ui.page}>
      <PageHeader title="Clients" subtitle="Everyone who has booked with you." />
      <CounsellorNav current="/counsellor/clients" />
      {clients.length === 0 ? (
        <EmptyState title="No clients yet.">Clients appear here once they book a session.</EmptyState>
      ) : (
        <ul className="space-y-4">
          {clients.map((c) => (
            <li key={c.clientId} className={ui.card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className={ui.muted}>{[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details'}</p>
                </div>
                <span className={ui.muted}>
                  {c.sessions.length} session{c.sessions.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="mt-3 divide-y divide-[#e8e7e2] border-t border-[#e8e7e2]">
                {c.sessions
                  .sort((a, b) => (a.slot?.starts_at ?? '') < (b.slot?.starts_at ?? '') ? 1 : -1)
                  .map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <a className={ui.link} href={`/counsellor/sessions/${s.id}`}>
                        {s.slot ? formatIstDateTime(s.slot.starts_at) : 'Session'}
                      </a>
                      <StatusBadge status={s.status} label={BOOKING_STATUS_LABEL[s.status]} />
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
