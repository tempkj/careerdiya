import { notFound } from 'next/navigation';
import { formatInr, getPublicCounsellor, listOpenSlots } from '@modules/counselling';
import BookingPanel from '@modules/counselling/ui/BookingPanel';
import { ui } from '@modules/counselling/ui/styles';
import { bookSlotAction } from '../../actions';
import { getViewer, loginUrl } from '../../_lib/viewer';

const MODE_LABEL = { online: 'Online', in_person: 'In person', both: 'Online or in person' } as const;

export default async function CounsellorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getViewer();
  const counsellor = await getPublicCounsellor(supabase, id);
  if (!counsellor) notFound();
  const slots = await listOpenSlots(supabase, counsellor.id);
  const own = user?.id === counsellor.user_id;

  return (
    <div className={ui.page}>
      <a href="/counsellors" className={`${ui.link} text-sm`}>
        ← All counsellors
      </a>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className={ui.card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className={ui.h1}>{counsellor.display_name}</h1>
              {counsellor.headline ? <p className={`mt-1 ${ui.muted}`}>{counsellor.headline}</p> : null}
            </div>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              ✓ Verified by Career Diya
            </span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className={ui.muted}>Fee</dt>
              <dd className="font-semibold">{formatInr(counsellor.session_fee_inr)}</dd>
            </div>
            <div>
              <dt className={ui.muted}>Length</dt>
              <dd className="font-semibold">{counsellor.session_minutes} min</dd>
            </div>
            <div>
              <dt className={ui.muted}>Format</dt>
              <dd className="font-semibold">{MODE_LABEL[counsellor.session_mode]}</dd>
            </div>
            {counsellor.city ? (
              <div>
                <dt className={ui.muted}>City</dt>
                <dd className="font-semibold">{counsellor.city}</dd>
              </div>
            ) : null}
          </dl>
          {counsellor.bio ? (
            <div className="mt-6">
              <h2 className={ui.h2}>About</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#2c3142]">{counsellor.bio}</p>
            </div>
          ) : null}
          {counsellor.specialisations.length ? (
            <div className="mt-6">
              <h2 className={ui.h2}>Focus areas</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {counsellor.specialisations.map((t) => (
                  <span key={t} className={ui.tag}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {counsellor.languages.length ? (
            <p className={`mt-6 ${ui.muted}`}>Speaks {counsellor.languages.join(', ')}</p>
          ) : null}
        </section>

        <aside className={ui.card}>
          <h2 className={`${ui.h2} mb-4`}>Book a session</h2>
          {own ? (
            <p className={ui.muted}>
              This is your public profile. Manage your times in the{' '}
              <a className={ui.link} href="/counsellor/availability">
                counsellor portal
              </a>
              .
            </p>
          ) : (
            <BookingPanel
              slots={slots}
              fee={counsellor.session_fee_inr}
              signedIn={!!user}
              loginHref={loginUrl(`/counsellors/${counsellor.id}`)}
              defaultName={(user?.user_metadata?.full_name as string | undefined) ?? ''}
              bookAction={bookSlotAction}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
