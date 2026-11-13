import { formatIstDate, formatIstTime, groupByIstDay, istDateKey, listMySlots } from '@modules/counselling';
import ActionForm, { SubmitButton } from '@modules/counselling/ui/ActionForm';
import { EmptyState, PageHeader, StatusBadge } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { addSlotsAction, removeSlotAction } from '../../actions';
import { requireCounsellor } from '../../_lib/viewer';
import { CounsellorNav } from '../_components';

export const metadata = { title: 'Availability — Counsellor portal' };

const SLOT_LABEL = { open: 'Open', held: 'Being booked', booked: 'Booked', cancelled: 'Cancelled' } as const;

export default async function AvailabilityPage() {
  const { supabase, counsellor } = await requireCounsellor('/counsellor/availability');
  const slots = await listMySlots(supabase, counsellor.id);
  const days = groupByIstDay(slots.filter((s) => new Date(s.ends_at).getTime() > Date.now()));
  const tomorrow = istDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  return (
    <div className={ui.page}>
      <PageHeader title="Availability" subtitle="Add the times clients can book. All times are India time (IST)." />
      <CounsellorNav current="/counsellor/availability" />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className={`${ui.card} h-fit`}>
          <h2 className={`${ui.h2} mb-4`}>Add a slot</h2>
          <ActionForm action={addSlotsAction}>
            <div>
              <label className={ui.label} htmlFor="date">
                Date
              </label>
              <input id="date" name="date" type="date" min={tomorrow} defaultValue={tomorrow} className={ui.input} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={ui.label} htmlFor="time">
                  Start time
                </label>
                <input id="time" name="time" type="time" defaultValue="18:00" step={900} className={ui.input} required />
              </div>
              <div>
                <label className={ui.label} htmlFor="minutes">
                  Minutes
                </label>
                <input
                  id="minutes"
                  name="minutes"
                  type="number"
                  min={15}
                  max={240}
                  step={5}
                  defaultValue={counsellor.session_minutes}
                  className={ui.input}
                />
              </div>
            </div>
            <div>
              <label className={ui.label} htmlFor="repeat_weeks">
                Repeat weekly
              </label>
              <select id="repeat_weeks" name="repeat_weeks" className={ui.input} defaultValue="0">
                <option value="0">Just this once</option>
                <option value="3">For the next 3 weeks</option>
                <option value="7">For the next 7 weeks</option>
                <option value="11">For the next 11 weeks</option>
              </select>
            </div>
            <SubmitButton pendingLabel="Adding…">Add slot</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-xs text-[#687083]">
            Clients can book a slot until an hour before it starts. Overlapping slots are not allowed.
          </p>
        </section>

        <section>
          {days.length === 0 ? (
            <EmptyState title="No upcoming slots.">Add a slot to start taking bookings.</EmptyState>
          ) : (
            <div className="space-y-4">
              {days.map((d) => (
                <div key={d.day} className={ui.card}>
                  <h3 className="mb-2 font-semibold">{d.items[0] ? formatIstDate(d.items[0].starts_at) : d.day}</h3>
                  <ul className="divide-y divide-[#e8e7e2]">
                    {d.items.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                        <span>
                          {formatIstTime(s.starts_at)} – {formatIstTime(s.ends_at)}
                        </span>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={s.status} label={SLOT_LABEL[s.status]} />
                          {s.status === 'open' ? (
                            <ActionForm action={removeSlotAction} className="">
                              <input type="hidden" name="slot_id" value={s.id} />
                              <SubmitButton variant="danger" pendingLabel="Removing…">
                                Remove
                              </SubmitButton>
                            </ActionForm>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
