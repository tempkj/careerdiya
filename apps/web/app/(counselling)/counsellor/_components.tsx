import type { Counsellor } from '@modules/counselling';
import ActionForm, { SubmitButton } from '@modules/counselling/ui/ActionForm';
import { Notice, SubNav } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { saveProfileAction } from '../actions';

const NAV = [
  { href: '/counsellor', label: 'Overview' },
  { href: '/counsellor/availability', label: 'Availability' },
  { href: '/counsellor/clients', label: 'Clients' },
  { href: '/counsellor/profile', label: 'Profile' },
  { href: '/counsellor/templates', label: 'Report templates' },
];

export function CounsellorNav({ current }: { current: string }) {
  return <SubNav items={NAV} current={current} />;
}

export function StatusNotice({ counsellor }: { counsellor: Counsellor }) {
  switch (counsellor.status) {
    case 'pending':
      return (
        <Notice tone="warn">
          Your profile is waiting for verification. Upload your certificates on the Profile tab so we can verify you.
          You can set up availability now; clients will see you once you&apos;re verified.
        </Notice>
      );
    case 'rejected':
    case 'suspended':
      return (
        <Notice tone="error">
          Your profile is {counsellor.status} and hidden from clients.
          {counsellor.status_note ? ` Note from Career Diya: ${counsellor.status_note}` : ''} Please contact Career
          Diya if you have questions.
        </Notice>
      );
    default:
      return (
        <Notice tone="success">
          You&apos;re verified and listed.{' '}
          <a className="font-semibold underline" href={`/counsellors/${counsellor.id}`}>
            View your public profile
          </a>
        </Notice>
      );
  }
}

export function ProfileForm({ counsellor }: { counsellor: Counsellor | null }) {
  return (
    <ActionForm action={saveProfileAction}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="display_name">
            Name shown to clients
          </label>
          <input
            id="display_name"
            name="display_name"
            className={ui.input}
            defaultValue={counsellor?.display_name ?? ''}
            required
            minLength={2}
            maxLength={120}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="headline">
            Headline
          </label>
          <input
            id="headline"
            name="headline"
            className={ui.input}
            defaultValue={counsellor?.headline ?? ''}
            maxLength={160}
            placeholder="e.g. Career counsellor for Class 10–12 students and parents"
          />
        </div>
        <div className="sm:col-span-2">
          <label className={ui.label} htmlFor="bio">
            About you
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={5}
            className={ui.input}
            defaultValue={counsellor?.bio ?? ''}
            maxLength={4000}
            placeholder="Your background, how you work, and who you help most."
          />
        </div>
        <div>
          <label className={ui.label} htmlFor="specialisations">
            Focus areas
          </label>
          <input
            id="specialisations"
            name="specialisations"
            className={ui.input}
            defaultValue={counsellor?.specialisations.join(', ') ?? ''}
            placeholder="Stream selection, Engineering, Study abroad"
          />
          <p className="mt-1 text-xs text-[#687083]">Separate with commas.</p>
        </div>
        <div>
          <label className={ui.label} htmlFor="languages">
            Languages
          </label>
          <input
            id="languages"
            name="languages"
            className={ui.input}
            defaultValue={counsellor?.languages.join(', ') ?? ''}
            placeholder="English, Hindi, Bengali"
          />
        </div>
        <div>
          <label className={ui.label} htmlFor="city">
            City
          </label>
          <input id="city" name="city" className={ui.input} defaultValue={counsellor?.city ?? ''} maxLength={80} />
        </div>
        <div>
          <label className={ui.label} htmlFor="session_mode">
            Sessions are
          </label>
          <select
            id="session_mode"
            name="session_mode"
            className={ui.input}
            defaultValue={counsellor?.session_mode ?? 'online'}
          >
            <option value="online">Online</option>
            <option value="in_person">In person</option>
            <option value="both">Online or in person</option>
          </select>
        </div>
        <div>
          <label className={ui.label} htmlFor="session_fee_inr">
            Fee per session (₹)
          </label>
          <input
            id="session_fee_inr"
            name="session_fee_inr"
            type="number"
            min={0}
            max={100000}
            step={1}
            className={ui.input}
            defaultValue={counsellor?.session_fee_inr ?? 1000}
          />
          <p className="mt-1 text-xs text-[#687083]">Set 0 for free sessions (e.g. clients you bring yourself).</p>
        </div>
        <div>
          <label className={ui.label} htmlFor="session_minutes">
            Session length (minutes)
          </label>
          <input
            id="session_minutes"
            name="session_minutes"
            type="number"
            min={15}
            max={240}
            step={5}
            className={ui.input}
            defaultValue={counsellor?.session_minutes ?? 60}
          />
        </div>
      </div>
      <SubmitButton>{counsellor ? 'Save profile' : 'Create my counsellor profile'}</SubmitButton>
    </ActionForm>
  );
}
