'use client';
import { useMemo, useState } from 'react';
import type { Report, ReportTemplate } from '../domain/types';
import ActionForm, { SubmitButton, type FormAction } from './ActionForm';
import { ui } from './styles';

export default function ReportEditor({
  bookingId,
  templates,
  report,
  attachmentUrl,
  defaultTitle,
  action,
}: {
  bookingId: string;
  templates: ReportTemplate[];
  report: Report | null;
  attachmentUrl: string | null;
  defaultTitle: string;
  action: FormAction;
}) {
  const initialTemplate =
    report?.template_id && templates.some((t) => t.id === report.template_id)
      ? report.template_id
      : report
        ? ''
        : templates[0]?.id ?? '';
  const [templateId, setTemplateId] = useState(initialTemplate);

  // Keep what was written when switching templates: bodies carry over by section key.
  const bodies = useMemo(
    () => Object.fromEntries((report?.content ?? []).map((s) => [s.key, s.body])),
    [report],
  );
  const sections = useMemo(() => {
    const template = templates.find((t) => t.id === templateId);
    if (template) return template.sections;
    return (report?.content ?? []).map((s) => ({ key: s.key, title: s.title, hint: undefined as string | undefined }));
  }, [templateId, templates, report]);

  return (
    <ActionForm action={action}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="existing_attachment" value={report?.attachment_path ?? ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ui.label} htmlFor="title">
            Report title
          </label>
          <input
            id="title"
            name="title"
            className={ui.input}
            defaultValue={report?.title ?? defaultTitle}
            required
            minLength={2}
            maxLength={200}
          />
        </div>
        <div>
          <label className={ui.label} htmlFor="template_id">
            Template
          </label>
          <select
            id="template_id"
            name="template_id"
            className={ui.input}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {!templates.some((t) => t.id === templateId) && report ? <option value="">Current sections</option> : null}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.counsellor_id ? ' (yours)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sections.map((s) => (
        <div key={`${templateId}-${s.key}`}>
          <input type="hidden" name="section_key" value={s.key} />
          <input type="hidden" name="section_title" value={s.title} />
          <label className={ui.label} htmlFor={`section_${s.key}`}>
            {s.title}
          </label>
          <textarea
            id={`section_${s.key}`}
            name={`section_${s.key}`}
            rows={4}
            className={ui.input}
            defaultValue={bodies[s.key] ?? ''}
            placeholder={s.hint || undefined}
            maxLength={8000}
          />
        </div>
      ))}

      <div className="rounded-xl border border-dashed border-[#d9d8d2] p-4">
        <label className={ui.label} htmlFor="attachment">
          Attach a PDF (optional, max 10 MB)
        </label>
        <input id="attachment" name="attachment" type="file" accept="application/pdf" className="block w-full text-sm" />
        {report?.attachment_path ? (
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            {attachmentUrl ? (
              <a className={ui.link} href={attachmentUrl} target="_blank" rel="noreferrer">
                Current attachment
              </a>
            ) : (
              <span className={ui.muted}>A PDF is attached.</span>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" name="remove_attachment" /> Remove it
            </label>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="secondary" name="intent" value="draft" pendingLabel="Saving…">
          Save draft
        </SubmitButton>
        <SubmitButton name="intent" value="share" pendingLabel="Sharing…">
          {report?.status === 'shared' ? 'Update shared report' : 'Share with client'}
        </SubmitButton>
      </div>
      <p className="text-xs text-[#687083]">
        {report?.status === 'shared'
          ? 'Your client can see this report. Saving as a draft hides it again.'
          : 'Drafts are private. Your client sees the report only once you share it.'}
      </p>
    </ActionForm>
  );
}
