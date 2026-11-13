import { notFound } from 'next/navigation';
import {
  BOOKING_STATUS_LABEL,
  REPORT_BUCKET,
  clientActions,
  formatInr,
  formatIstDateTime,
  formatIstTime,
  getBooking,
  getReport,
  signedFileUrl,
} from '@modules/counselling';
import ActionForm, { SubmitButton } from '@modules/counselling/ui/ActionForm';
import { Notice, StatusBadge } from '@modules/counselling/ui/Bits';
import PayButton from '@modules/counselling/ui/PayButton';
import StatusPoller from '@modules/counselling/ui/StatusPoller';
import { ui } from '@modules/counselling/ui/styles';
import { cancelBookingAction } from '../../actions';
import { requireUser } from '../../_lib/viewer';

export const metadata = { title: 'Session — Career Diya' };

export default async function MySessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; payError?: string }>;
}) {
  const { id } = await params;
  const { paid, payError } = await searchParams;
  const { supabase, user } = await requireUser(`/my-sessions/${id}`);
  const booking = await getBooking(supabase, id);
  if (!booking || booking.client_id !== user.id) notFound();

  const report = await getReport(supabase, booking.id); // RLS: only once shared
  const attachmentUrl = report?.attachment_path
    ? await signedFileUrl(supabase, REPORT_BUCKET, report.attachment_path)
    : null;
  const actions = clientActions(booking);
  const waitingForWebhook = booking.status === 'pending_payment' && paid === '1';

  return (
    <div className={`${ui.page} max-w-3xl`}>
      <a href="/my-sessions" className={`${ui.link} text-sm`}>
        ← My sessions
      </a>

      <section className={`${ui.card} mt-4 space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={ui.h1}>Session with {booking.counsellor?.display_name ?? 'your counsellor'}</h1>
            {booking.slot ? (
              <p className={`mt-1 ${ui.muted}`}>
                {formatIstDateTime(booking.slot.starts_at)} – {formatIstTime(booking.slot.ends_at)}
              </p>
            ) : null}
          </div>
          <StatusBadge status={booking.status} label={BOOKING_STATUS_LABEL[booking.status]} />
        </div>

        {payError ? <Notice tone="error">{payError}</Notice> : null}
        <StatusPoller active={waitingForWebhook} />

        {booking.status === 'confirmed' ? (
          <Notice tone="success">
            You&apos;re booked.{' '}
            {booking.meeting_link ? (
              <>
                Join at{' '}
                <a className="font-semibold underline" href={booking.meeting_link} target="_blank" rel="noreferrer">
                  {booking.meeting_link}
                </a>{' '}
                at the time above.
              </>
            ) : (
              'Your counsellor will share the meeting link before the session.'
            )}{' '}
            We&apos;ll also send you a reminder a day before.
          </Notice>
        ) : null}

        {booking.status === 'pending_payment' && !waitingForWebhook ? (
          <div className="space-y-3">
            {actions.canPay ? (
              <>
                <Notice tone="warn">
                  This slot is held for you until {formatIstTime(booking.hold_expires_at!)}. Complete the payment to
                  confirm it.
                </Notice>
                <PayButton bookingId={booking.id} label={`Pay ${formatInr(booking.fee_inr)}`} />
              </>
            ) : (
              <Notice tone="warn">
                The payment window has closed. If you paid, this page will update shortly; otherwise please book again.
              </Notice>
            )}
          </div>
        ) : null}

        {booking.status === 'expired' ? (
          <Notice tone="info">
            This booking expired because payment wasn&apos;t completed in time.{' '}
            <a className="font-semibold underline" href={`/counsellors/${booking.counsellor_id}`}>
              Book again
            </a>
          </Notice>
        ) : null}

        {booking.status === 'cancelled' ? (
          <Notice tone="info">
            Cancelled{booking.cancelled_by ? ` by the ${booking.cancelled_by}` : ''}
            {booking.cancel_reason ? `: ${booking.cancel_reason}` : '.'}{' '}
            {booking.confirmed_at && booking.fee_inr > 0
              ? 'If you paid for this session, Career Diya will arrange your refund.'
              : null}
          </Notice>
        ) : null}

        <dl className="grid grid-cols-2 gap-4 border-t border-[#e8e7e2] pt-4 text-sm">
          <div>
            <dt className={ui.muted}>Attending</dt>
            <dd className="font-medium">{booking.client_name}</dd>
          </div>
          <div>
            <dt className={ui.muted}>Fee</dt>
            <dd className="font-medium">{formatInr(booking.fee_inr)}</dd>
          </div>
          {booking.purpose ? (
            <div className="col-span-2">
              <dt className={ui.muted}>Your note to the counsellor</dt>
              <dd className="whitespace-pre-line">{booking.purpose}</dd>
            </div>
          ) : null}
        </dl>

        {actions.canCancel ? (
          <ActionForm action={cancelBookingAction} confirm="Cancel this booking?" className="space-y-2">
            <input type="hidden" name="booking_id" value={booking.id} />
            <SubmitButton variant="danger" pendingLabel="Cancelling…">
              Cancel booking
            </SubmitButton>
          </ActionForm>
        ) : null}
        {booking.status === 'confirmed' ? (
          <p className="text-xs text-[#687083]">Need to reschedule or cancel? Please contact your counsellor.</p>
        ) : null}
      </section>

      {report ? (
        <section className={`${ui.card} mt-6`}>
          <h2 className={ui.h2}>{report.title}</h2>
          {report.shared_at ? <p className={ui.muted}>Shared {formatIstDateTime(report.shared_at)}</p> : null}
          <div className="mt-4 space-y-5">
            {report.content
              .filter((s) => s.body)
              .map((s) => (
                <div key={s.key}>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#2c3142]">{s.body}</p>
                </div>
              ))}
          </div>
          {attachmentUrl ? (
            <a className={`${ui.btnSecondary} mt-5`} href={attachmentUrl} target="_blank" rel="noreferrer">
              Download PDF report
            </a>
          ) : null}
        </section>
      ) : booking.status === 'completed' ? (
        <p className={`mt-6 ${ui.muted}`}>Your counsellor will share a written report here when it&apos;s ready.</p>
      ) : null}
    </div>
  );
}
