import {
  CERTIFICATE_BUCKET,
  getMyContact,
  listCertificates,
  signedFileUrl,
} from '@modules/counselling';
import ActionForm, { SubmitButton } from '@modules/counselling/ui/ActionForm';
import { PageHeader } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { addCertificateAction, deleteCertificateAction, saveContactAction } from '../../actions';
import { requireCounsellor } from '../../_lib/viewer';
import { CounsellorNav, ProfileForm, StatusNotice } from '../_components';

export const metadata = { title: 'Profile — Counsellor portal' };

export default async function CounsellorProfilePage() {
  const { supabase, user, counsellor } = await requireCounsellor('/counsellor/profile');
  const [contact, certificates] = await Promise.all([
    getMyContact(supabase, user.id),
    listCertificates(supabase, [counsellor.id]),
  ]);
  const links = await Promise.all(
    certificates.map((c) => signedFileUrl(supabase, CERTIFICATE_BUCKET, c.storage_path)),
  );

  return (
    <div className={ui.page}>
      <PageHeader title="Profile" subtitle="What clients see, and how we reach you." />
      <CounsellorNav current="/counsellor/profile" />
      <div className="space-y-6">
        <StatusNotice counsellor={counsellor} />

        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-4`}>Public profile</h2>
          <ProfileForm counsellor={counsellor} />
        </section>

        <section className={ui.card}>
          <h2 className={ui.h2}>Sessions and contact</h2>
          <p className={`mb-4 ${ui.muted}`}>Private: only you and the clients you&apos;re booked with see the meeting link.</p>
          <ActionForm action={saveContactAction}>
            <div>
              <label className={ui.label} htmlFor="meeting_link">
                Default meeting link (Google Meet or Zoom)
              </label>
              <input
                id="meeting_link"
                name="meeting_link"
                type="url"
                className={ui.input}
                defaultValue={contact?.meeting_link ?? ''}
                placeholder="https://meet.google.com/abc-defg-hij"
              />
              <p className="mt-1 text-xs text-[#687083]">
                Added to every confirmed booking. You can change it for a single session from that session&apos;s page.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={ui.label} htmlFor="phone">
                  Mobile number
                </label>
                <input
                  id="phone"
                  name="phone"
                  className={ui.input}
                  defaultValue={contact?.phone_e164 ?? ''}
                  inputMode="tel"
                  placeholder="98765 43210"
                />
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="whatsapp_opt_in" defaultChecked={contact?.whatsapp_opt_in ?? false} />
                Send me booking alerts on WhatsApp
              </label>
            </div>
            <SubmitButton>Save contact details</SubmitButton>
          </ActionForm>
        </section>

        <section className={ui.card}>
          <h2 className={ui.h2}>Certificates</h2>
          <p className={`mb-4 ${ui.muted}`}>
            Used to verify you. Only you and Career Diya admins can see these files.
          </p>
          {certificates.length ? (
            <ul className="mb-5 divide-y divide-[#e8e7e2] rounded-xl border border-[#e8e7e2]">
              {certificates.map((c, i) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className={ui.muted}>
                      {[c.issuer, c.issued_on].filter(Boolean).join(' · ') || 'Uploaded'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {links[i] ? (
                      <a className={ui.link} href={links[i]!} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : null}
                    <ActionForm action={deleteCertificateAction} confirm="Remove this certificate?" className="">
                      <input type="hidden" name="certificate_id" value={c.id} />
                      <SubmitButton variant="danger" pendingLabel="Removing…">
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <ActionForm action={addCertificateAction} resetOnSuccess>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className={ui.label} htmlFor="title">
                  Certificate or qualification
                </label>
                <input
                  id="title"
                  name="title"
                  className={ui.input}
                  required
                  placeholder="e.g. Certified Career Guide"
                />
              </div>
              <div>
                <label className={ui.label} htmlFor="issuer">
                  Issued by
                </label>
                <input id="issuer" name="issuer" className={ui.input} placeholder="e.g. Edumilestones" />
              </div>
              <div>
                <label className={ui.label} htmlFor="issued_on">
                  Issue date
                </label>
                <input id="issued_on" name="issued_on" type="date" className={ui.input} />
              </div>
              <div>
                <label className={ui.label} htmlFor="file">
                  File (PDF, PNG or JPG, max 5 MB)
                </label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  required
                  accept="application/pdf,image/png,image/jpeg"
                  className="block w-full text-sm"
                />
              </div>
            </div>
            <SubmitButton pendingLabel="Uploading…">Upload certificate</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
