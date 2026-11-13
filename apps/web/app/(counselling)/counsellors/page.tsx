import {
  formatInr,
  formatIstDateTime,
  listVerifiedCounsellors,
  type DirectoryEntry,
} from '@modules/counselling';
import { EmptyState, PageHeader } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { getViewer } from '../_lib/viewer';

export const metadata = { title: 'Find a counsellor — Career Diya' };

const MODE_LABEL = { online: 'Online', in_person: 'In person', both: 'Online or in person' } as const;

function matches(c: DirectoryEntry, q: string): boolean {
  if (!q) return true;
  const hay = [c.display_name, c.headline, c.city, ...c.languages, ...c.specialisations]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word));
}

export default async function CounsellorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { supabase } = await getViewer();
  const all = await listVerifiedCounsellors(supabase);
  const counsellors = all.filter((c) => matches(c, q.trim()));

  return (
    <div className={ui.page}>
      <PageHeader
        title="Find a counsellor"
        subtitle="Verified career counsellors. Pick a time that suits you and book online."
      />

      <form className="mb-6 flex gap-2" action="/counsellors">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by language, city or focus (e.g. Bengali, engineering, Class 12)"
          className={ui.input}
          aria-label="Search counsellors"
        />
        <button className={ui.btnSecondary} type="submit">
          Search
        </button>
      </form>

      {counsellors.length === 0 ? (
        <EmptyState title={q ? 'No counsellors match that search.' : 'No counsellors are listed yet.'}>
          {q ? (
            <a className={ui.link} href="/counsellors">
              Show all counsellors
            </a>
          ) : (
            'Please check back soon.'
          )}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {counsellors.map((c) => (
            <li key={c.id} className={ui.card}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className={ui.h2}>{c.display_name}</h2>
                  {c.headline ? <p className={`mt-0.5 ${ui.muted}`}>{c.headline}</p> : null}
                </div>
                <span className="whitespace-nowrap text-sm font-semibold text-[#213a8f]">
                  {formatInr(c.session_fee_inr)}
                </span>
              </div>
              <p className={`mt-2 ${ui.muted}`}>
                {MODE_LABEL[c.session_mode]} · {c.session_minutes} min{c.city ? ` · ${c.city}` : ''}
              </p>
              {c.specialisations.length || c.languages.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[...c.specialisations, ...c.languages].slice(0, 6).map((t) => (
                    <span key={t} className={ui.tag}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-[#687083]">
                  {c.next_slot ? `Next available: ${formatIstDateTime(c.next_slot)}` : 'No open slots right now'}
                </span>
                <a className={ui.btn} href={`/counsellors/${c.id}`}>
                  View & book
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
