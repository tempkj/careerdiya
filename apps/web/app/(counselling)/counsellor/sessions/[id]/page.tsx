import { notFound } from 'next/navigation';
import {
  BOOKING_STATUS_LABEL,
  REPORT_BUCKET,
  counsellorActions,
  formatInr,
  formatIstDateTime,
  formatIstTime,
  getBooking,
  getReport,
  listNotes,
  listTemplates,
  signedFileUrl,
} from '@modules/counselling';
import ActionForm, { SubmitButton } from '@modules/counselling/ui/ActionForm';
import { Notice, StatusBadge } from '@modules/counselling/ui/Bits';
import ReportEditor from '@modules/counselling/ui/ReportEditor';
import { ui } from '@modules/counselling/ui/styles';
import {
  addNoteAction,
  cancelBookingAction,
  completeBookingAction,
  deleteNoteAction,
  saveReportAction,
  updateMeetingLinkAction,
  updateNoteAction,
} from '../../../actions';
import { requireCounsellor } from '../../../_lib/viewer';
import { CounsellorNav } from '../../_components';

export const metadata = { title: 'Session — Counsellor portal' };

export default async function CounsellorSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, counsellor } = await requireCounsellor(`/counsellor/sessions/${id}`);
  const booking = await getBooking(supabase, id);
  if (!booking || booking.counsellor_id !== counsellor.id) notFound();

  const [notes, report, templates] = await Promise.all([
    listNotes(supabase, booking.id),
    getReport(supabase, booking.id),
    listTemplates(supabase),
  ]);
  const attachmentUrl = report?.attachment_path
    ? await signedFileUrl(supabase, REPORT_BUCKET, report.attachment_path)
    : null;
  const actions = counsellorActions(booking, booking.slot?.starts_at ?? null);

  return (
    <div className={ui.page}>
      <CounsellorNav current="/counsellor/clients" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className={`${ui.card} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className={ui.h1}>{booking.client_name}</h1>
                {booking.slot ? (
                  <p className={`mt-1 ${ui.muted}`}>
                    {formatIstDateTime(booking.slot.starts_at)} – {formatIstTime(booking.slot.ends_at)}
                  </p>
                ) : null}
              </div>
              <StatusBadge status={booking.status} label={BOOKING_STATUS_LABEL[booking.status]} />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className={ui.muted}>Email</dt>
                <dd>{booking.client_email ?? '—'}</dd>
              </div>
              <div>
                <dt className={ui.muted}>Mobile</dt>
                <dd>{booking.client_phone ?? '—'}</dd>
              </div>
              <div>
                <dt className={ui.muted}>Fee</dt>
                <dd>{formatInr(booking.fee_inr)}</dd>
              </div>
              {booking.purpose ? (
                <div className="col-span-2">
                  <dt className={ui.muted}>What they want help with</dt>
                  <dd className="whitespace-pre-line">{booking.purpose}</dd>
                </div>
              ) : null}
            </dl>
            {booking.status === 'cancelled' ? (
              <Notice tone="info">
                Cancelled by the {booking.cancelled_by}
                {booking.cancel_reason ? `: ${booking.cancel_reason}` : '.'}
                {booking.confirmed_at && booking.fee_inr > 0
                  ? ' This session was paid for; Career Diya will process the refund.'
                  : ''}
              </Notice>
            ) : null}
          </section>

          <section className={ui.card}>
            <h2 className={ui.h2}>Session notes</h2>
            <p className={`mb-4 ${ui.muted}`}>Private to you. Your client and Career Diya admins cannot see these.</p>
            {notes.length ? (
              <ul className="mb-5 space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-[#e8e7e2] p-3">
                    <p className="mb-2 text-xs text-[#687083]">{formatIstDateTime(n.created_at)}</p>
                    <ActionForm action={updateNoteAction} className="space-y-2">
                      <input type="hidden" name="note_id" value={n.id} />
                      <input type="hidden" name="booking_id" value={booking.id} />
                      <textarea name="body" rows={3} className={ui.input} defaultValue={n.body} maxLength={20000} />
                      <SubmitButton variant="secondary">Update</SubmitButton>
                    </ActionForm>
                    <ActionForm action={deleteNoteAction} confirm="Delete this note?" className="mt-2">
                      <input type="hidden" name="note_id" value={n.id} />
                      <input type="hidden" name="booking_id" value={booking.id} />
                      <SubmitButton variant="danger" pendingLabel="Deleting…">
                        Delete
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            ) : null}
            <ActionForm action={addNoteAction} resetOnSuccess className="space-y-2">
              <input type="hidden" name="booking_id" value={booking.id} />
              <label className="sr-only" htmlFor="new-note">
                New note
              </label>
              <textarea
                id="new-note"
                name="body"
                rows={4}
                className={ui.input}
                placeholder="What came up, what you suggested, what to follow up next time…"
                maxLength={20000}
              />
              <SubmitButton>Add note</SubmitButton>
            </ActionForm>
          </section>

          <section className={ui.card}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className={ui.h2}>Report for the client</h2>
              {report ? <StatusBadge status={report.status} /> : null}
            </div>
            {actions.canWriteReport || report ? (
              <ReportEditor
                bookingId={booking.id}
                templates={templates}
                report={report}
                attachmentUrl={attachmentUrl}
                defaultTitle={`Career guidance summary for ${booking.client_name}`}
                action={saveReportAction}
              />
            ) : (
              <p className={ui.muted}>You can write a report once the booking is confirmed.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {booking.status === 'confirmed' || booking.status === 'pending_payment' ? (
            <section className={ui.card}>
              <h2 className={`${ui.h2} mb-3`}>Meeting link</h2>
              <ActionForm action={updateMeetingLinkAction} className="space-y-2">
                <input type="hidden" name="booking_id" value={booking.id} />
                <input
                  name="meeting_link"
                  type="url"
                  className={ui.input}
                  defaultValue={booking.meeting_link ?? ''}
                  placeholder="https://meet.google.com/…"
                />
                <SubmitButton variant="secondary">Save link</SubmitButton>
              </ActionForm>
              {booking.meeting_link ? (
                <a className={`${ui.btn} mt-3 w-full`} href={booking.meeting_link} target="_blank" rel="noreferrer">
                  Join meeting
                </a>
              ) : null}
            </section>
          ) : null}

          {actions.canComplete ? (
            <section className={ui.card}>
              <h2 className={`${ui.h2} mb-2`}>After the session</h2>
              <ActionForm action={completeBookingAction}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <SubmitButton>Mark as completed</SubmitButton>
              </ActionForm>
            </section>
          ) : null}

          {actions.canCancel ? (
            <section className={ui.card}>
              <h2 className={`${ui.h2} mb-2`}>Cancel</h2>
              <ActionForm action={cancelBookingAction} confirm="Cancel this session? The client will be notified.">
                <input type="hidden" name="booking_id" value={booking.id} />
                <input name="reason" className={ui.input} placeholder="Reason (shown to the client)" maxLength={500} />
                <SubmitButton variant="danger" pendingLabel="Cancelling…">
                  Cancel session
                </SubmitButton>
              </ActionForm>
              {booking.status === 'confirmed' && booking.fee_inr > 0 ? (
                <p className="mt-2 text-xs text-[#687083]">
                  Paid sessions are refunded by Career Diya after you cancel.
                </p>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
