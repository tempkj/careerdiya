import type { ReactNode } from 'react';
import { statusTone, ui } from './styles';

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = statusTone[status] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {label ?? status.replace(/_/g, ' ')}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className={ui.h1}>{title}</h1>
        {subtitle ? <p className={`mt-1 ${ui.muted}`}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9d8d2] bg-white/60 p-8 text-center">
      <p className="font-semibold text-[#151827]">{title}</p>
      {children ? <div className={`mt-1 ${ui.muted}`}>{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function SubNav({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-[#e8e7e2]">
      {items.map((item) => {
        const active = item.href === current;
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              active ? 'border-[#213a8f] text-[#213a8f]' : 'border-transparent text-[#687083] hover:text-[#151827]'
            }`}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
