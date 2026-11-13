// Career Diya design tokens (public/assets/design-system-v2.css) as Tailwind classes.
export const ui = {
  page: 'mx-auto w-full max-w-5xl px-4 py-8',
  card: 'rounded-2xl border border-[#e8e7e2] bg-white p-5 shadow-[0_18px_50px_rgba(31,35,54,0.06)]',
  h1: 'text-2xl font-bold text-[#151827] sm:text-3xl',
  h2: 'text-lg font-semibold text-[#151827]',
  muted: 'text-sm text-[#687083]',
  label: 'mb-1 block text-sm font-medium text-[#151827]',
  input:
    'w-full rounded-lg border border-[#d9d8d2] bg-white px-3 py-2 text-sm text-[#151827] outline-none focus:border-[#213a8f] focus:ring-2 focus:ring-[#213a8f]/15',
  btn: 'inline-flex items-center justify-center rounded-lg bg-[#213a8f] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_25px_rgba(33,58,143,0.18)] transition hover:bg-[#1b2f75] disabled:cursor-not-allowed disabled:opacity-60',
  btnSecondary:
    'inline-flex items-center justify-center rounded-lg border border-[#d9d8d2] bg-white px-4 py-2 text-sm font-semibold text-[#151827] transition hover:border-[#213a8f] hover:text-[#213a8f] disabled:opacity-60',
  btnDanger:
    'inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60',
  link: 'font-medium text-[#213a8f] hover:underline',
  tag: 'inline-flex items-center rounded-full bg-[#f8f1d9] px-2.5 py-0.5 text-xs font-medium text-[#6b5208]',
} as const;

export const statusTone: Record<string, string> = {
  pending_payment: 'bg-amber-50 text-amber-800 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  completed: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  expired: 'bg-slate-50 text-slate-500 border-slate-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  shared: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  open: 'bg-sky-50 text-sky-800 border-sky-200',
  held: 'bg-amber-50 text-amber-800 border-amber-200',
  booked: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  created: 'bg-slate-50 text-slate-600 border-slate-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-slate-100 text-slate-700 border-slate-200',
};
