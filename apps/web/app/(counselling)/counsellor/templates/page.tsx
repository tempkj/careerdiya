import { listTemplates, sectionsToText } from '@modules/counselling';
import ActionForm, { SubmitButton } from '@modules/counselling/ui/ActionForm';
import { PageHeader } from '@modules/counselling/ui/Bits';
import { ui } from '@modules/counselling/ui/styles';
import { deleteTemplateAction, saveTemplateAction } from '../../actions';
import { requireCounsellor } from '../../_lib/viewer';
import { CounsellorNav } from '../_components';

export const metadata = { title: 'Report templates — Counsellor portal' };

function TemplateFields({ name, description, sections }: { name?: string; description?: string | null; sections?: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ui.label}>Name</label>
          <input name="name" className={ui.input} defaultValue={name ?? ''} required minLength={2} maxLength={120} />
        </div>
        <div>
          <label className={ui.label}>Description</label>
          <input name="description" className={ui.input} defaultValue={description ?? ''} maxLength={500} />
        </div>
      </div>
      <div>
        <label className={ui.label}>Sections</label>
        <textarea
          name="sections"
          rows={6}
          className={`${ui.input} font-mono`}
          defaultValue={sections ?? ''}
          required
          placeholder={'One section per line. Add a hint after a | if you like:\nWhere you are now | Background and what prompted the session\nRecommended direction\nNext steps | Concrete actions for the next 30 days'}
        />
      </div>
    </>
  );
}

export default async function TemplatesPage() {
  const { supabase, counsellor } = await requireCounsellor('/counsellor/templates');
  const templates = await listTemplates(supabase);
  const system = templates.filter((t) => !t.counsellor_id);
  const mine = templates.filter((t) => t.counsellor_id === counsellor.id);

  return (
    <div className={ui.page}>
      <PageHeader title="Report templates" subtitle="Starting points for the written reports you share with clients." />
      <CounsellorNav current="/counsellor/templates" />
      <div className="space-y-6">
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>Career Diya templates</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {system.map((t) => (
              <li key={t.id} className="rounded-xl border border-[#e8e7e2] p-4">
                <p className="font-semibold">{t.name}</p>
                {t.description ? <p className={ui.muted}>{t.description}</p> : null}
                <ol className="mt-2 list-decimal pl-5 text-sm text-[#2c3142]">
                  {t.sections.map((s) => (
                    <li key={s.key}>{s.title}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>

        {mine.map((t) => (
          <section key={t.id} className={ui.card}>
            <h2 className={`${ui.h2} mb-3`}>{t.name}</h2>
            <ActionForm action={saveTemplateAction}>
              <input type="hidden" name="template_id" value={t.id} />
              <TemplateFields name={t.name} description={t.description} sections={sectionsToText(t.sections)} />
              <SubmitButton>Save template</SubmitButton>
            </ActionForm>
            <ActionForm action={deleteTemplateAction} confirm="Delete this template?" className="mt-3">
              <input type="hidden" name="template_id" value={t.id} />
              <SubmitButton variant="danger" pendingLabel="Deleting…">
                Delete template
              </SubmitButton>
            </ActionForm>
          </section>
        ))}

        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>Create your own template</h2>
          <ActionForm action={saveTemplateAction} resetOnSuccess>
            <TemplateFields />
            <SubmitButton>Create template</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
