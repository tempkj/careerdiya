import {
  BOOKING_STATUS_LABEL,
  CERTIFICATE_BUCKET,
  formatInr,
  formatIstDateTime,
  listAllCounsellors,
  listCertificates,
  listRecentBookingsForAdmin,
  signedFileUrl,
  type Counsellor,
} from '@modules/counselling';
import ActionForm, { SubmitButton } from '@modules/counselling/ui/ActionForm';
import { EmptyState, PageHeader, StatusBadge } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { setCounsellorStatusAction } from '../../actions';
import { requireAdmin } from '../../_lib/viewer';

export const metadata = { title: 'Counselling admin — Career Diya' };

const ORDER: Counsellor['status'][] = ['pending', 'verified', 'suspended', 'rejected'];

export default async function CounsellingAdminPage() {
  const { supabase } = await requireAdmin('/admin/counselling');
  const [counsellors, bookings] = await Promise.all([
    listAllCounsellors(supabase),
    listRecentBookingsForAdmin(supabase),
  ]);
  const certificates = await listCertificates(supabase, counsellors.map((c) => c.id));
  const certLinks = new Map(
    await Promise.all(
      certificates.map(async (c) => [c.id, await signedFileUrl(supabase, CERTIFICATE_BUCKET, c.storage_path)] as const),
    ),
  );
  const sorted = [...counsellors].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const refunds = bookings.filter((b) =>
    b.payments.some(
      (p) =>
        p.status === 'paid' &&
        (b.status === 'cancelled' || p.failure_reason === 'paid_after_slot_lost_refund_required'),
    ),
  );

  return (
    <div className={ui.page}>
      <PageHeader title="Counselling admin" subtitle="Verify counsellors and keep an eye on bookings and payments." />

      {refunds.length ? (
        <section className={`${ui.card} mb-6 border-amber-300`}>
          <h2 className={ui.h2}>Refunds to process ({refunds.length})</h2>
          <p className={`mb-3 ${ui.muted}`}>
            Paid bookings that were cancelled, or paid after the slot was lost. Refund them in the Razorpay dashboard;
            the refund webhook updates the payment here.
          </p>
          <ul className="space-y-2 text-sm">
            {refunds.map((b) => {
              const paid = b.payments.find((p) => p.status === 'paid')!;
              return (
                <li key={b.id}>
                  {b.client_name} with {b.counsellor?.display_name ?? 'counsellor'} — {formatInr(paid.amount_paise / 100)} ·
                  payment <code className="text-xs">{paid.provider_payment_id ?? paid.provider_order_id}</code>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mb-10">
        <h2 className={`${ui.h2} mb-3`}>Counsellors</h2>
        {sorted.length === 0 ? (
          <EmptyState title="No counsellors have signed up yet." />
        ) : (
          <ul className="space-y-4">
            {sorted.map((c) => {
              const certs = certificates.filter((x) => x.counsellor_id === c.id);
              return (
                <li key={c.id} className={ui.card}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{c.display_name}</p>
                      <p className={ui.muted}>
                        {c.headline ?? 'No headline'} · {formatInr(c.session_fee_inr)} · joined{' '}
                        {formatIstDateTime(c.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mt-3 text-sm">
                    <p className="font-medium">Certificates</p>
                    {certs.length ? (
                      <ul className="mt-1 list-disc pl-5">
                        {certs.map((x) => (
                          <li key={x.id}>
                            {certLinks.get(x.id) ? (
                              <a className={ui.link} href={certLinks.get(x.id)!} target="_blank" rel="noreferrer">
                                {x.title}
                              </a>
                            ) : (
                              x.title
                            )}
                            {x.issuer ? ` — ${x.issuer}` : ''}
                            {x.issued_on ? ` (${x.issued_on})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={ui.muted}>None uploaded yet.</p>
                    )}
                  </div>
                  <ActionForm action={setCounsellorStatusAction} className="mt-4 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="counsellor_id" value={c.id} />
                    <input
                      name="note"
                      className={`${ui.input} max-w-xs`}
                      placeholder="Note to counsellor (if rejecting/suspending)"
                      maxLength={500}
                    />
                    {c.status !== 'verified' ? (
                      <SubmitButton name="status" value="verified" pendingLabel="Saving…">
                        Verify
                      </SubmitButton>
                    ) : null}
                    {c.status !== 'rejected' && c.status !== 'verified' ? (
                      <SubmitButton name="status" value="rejected" variant="danger" pendingLabel="Saving…">
                        Reject
                      </SubmitButton>
                    ) : null}
                    {c.status === 'verified' ? (
                      <SubmitButton name="status" value="suspended" variant="danger" pendingLabel="Saving…">
                        Suspend
                      </SubmitButton>
                    ) : null}
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className={`${ui.h2} mb-3`}>Recent bookings</h2>
        {bookings.length === 0 ? (
          <EmptyState title="No bookings yet." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#e8e7e2] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#fdf9f1] text-xs uppercase tracking-wide text-[#687083]">
                <tr>
                  <th className="px-4 py-2">Session</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2">Counsellor</th>
                  <th className="px-4 py-2">Fee</th>
                  <th className="px-4 py-2">Booking</th>
                  <th className="px-4 py-2">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e7e2]">
                {bookings.map((b) => {
                  const payment = b.payments.find((p) => p.status === 'paid') ?? b.payments.at(-1);
                  return (
                    <tr key={b.id}>
                      <td className="whitespace-nowrap px-4 py-2">{b.slot ? formatIstDateTime(b.slot.starts_at) : '—'}</td>
                      <td className="px-4 py-2">
                        {b.client_name}
                        <br />
                        <span className="text-xs text-[#687083]">{b.client_email}</span>
                      </td>
                      <td className="px-4 py-2">{b.counsellor?.display_name ?? '—'}</td>
                      <td className="px-4 py-2">{formatInr(b.fee_inr)}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={b.status} label={BOOKING_STATUS_LABEL[b.status]} />
                      </td>
                      <td className="px-4 py-2">
                        {payment ? <StatusBadge status={payment.status} /> : <span className="text-[#9aa0ad]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
