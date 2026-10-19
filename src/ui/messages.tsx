import { useEffect, useState } from 'react';
import { api, MessageText, Empty, Field, Form, readFile, when, type Row, type Run } from './common';

/** Files chosen in the form replace the template's attachments; none chosen keeps them. */
const withFiles = async (data: Row, form: HTMLFormElement) => {
  const chosen = [...((form.elements.namedItem('files') as HTMLInputElement | null)?.files ?? [])];
  const { files, ...rest } = data;
  return { ...rest, ...(chosen.length ? { attachments: await Promise.all(chosen.map(readFile)) } : {}) };
};

/** Firm and personal message templates (MSG-001): search, categories, versions, personal copies. */
export function MessageTemplates({ actor, run, tick }: { actor: Row; run: Run; tick: number }) {
  const [state, setState] = useState<Row>(), [query, setQuery] = useState<Row>({ q: '', category: '' }), [editing, setEditing] = useState('');
  const owner = actor.role === 'owner';
  useEffect(() => { api(`/messages/templates?q=${encodeURIComponent(query.q)}&category=${encodeURIComponent(query.category)}`).then(setState).catch(e => run(async () => { throw e; })); }, [tick, query]);
  if (!state) return null;
  const catalog = Object.keys(state.placeholders).map(k => `{{${k}}}`).join(' ');
  const fields = (t?: Row) => <>
    <div className="row"><Field label="Name" name="name" value={t?.name} /><Field label="Category" name="category" value={t?.category ?? 'Document requests'} /></div>
    <Field label="Subject" name="subject" value={t?.subject} />
    <Field label="Message" name="body" hint={`Placeholders: ${catalog}`}><textarea name="body" rows={6} required defaultValue={t?.body} /></Field>
    <Field label={t?.attachments?.length ? 'Replace attachments (optional)' : 'Attachments (optional, up to 5 files of 1 MiB)'} name="files"><input name="files" type="file" multiple /></Field>
  </>;
  return <section className="panel wide">
    <h2>Message templates</h2>
    <p className="muted">Firm templates are kept by the principal; personal templates are yours. Editing saves a new version; messages already sent never change.</p>
    {owner && <details><summary>Firm name {state.firmName ? `(${state.firmName})` : '(not set)'}</summary>
      <Form label="Save firm name" submit={async data => run(() => api('/firm', data), 'Firm name saved')}><Field label="Firm name used in {{firm_name}}" name="name" value={state.firmName} /></Form>
    </details>}
    <Form label="Search" submit={async data => setQuery({ q: data.q, category: data.category })}>
      <div className="row"><Field label="Search templates" name="q" required={false} value={query.q} /><Field label="Category" name="category" required={false} value={query.category} /></div>
    </Form>
    {!state.templates.length ? <Empty>No templates match.</Empty> : state.templates.map((t: Row) => <article key={t.id} className="record">
      <div className="split"><strong>{t.name}</strong><small className="muted">{t.scope === 'firm' ? 'Firm' : 'Personal'} · {t.category} · version {t.version} by {t.author} {when(t.updated_at)}</small></div>
      <p className="muted">{t.subject}{t.attachments.length > 0 && <> · attached {t.attachments.map((f: Row) => f.name).join(', ')}</>}</p>
      <div className="actions">
        {(t.scope === 'personal' || owner) && <button className="quiet" onClick={() => setEditing(editing === t.id ? '' : t.id)}>Edit</button>}
        {t.scope === 'firm' && <button className="quiet" onClick={() => run(() => api(`/messages/templates/${t.id}/copy`, {}), 'Personal copy saved')}>Save a personal copy</button>}
        {(t.scope === 'personal' || owner) && <button className="quiet" onClick={() => run(() => api(`/messages/templates/${t.id}/delete`, {}), 'Template deleted; sent messages keep their text')}>Delete</button>}
      </div>
      {editing === t.id && <Form label="Save new version" submit={async (data, form) => run(async () => { await api(`/messages/templates/${t.id}`, await withFiles(data, form)); setEditing(''); }, 'New version saved')}>{fields(t)}</Form>}
    </article>)}
    <details><summary>New template</summary>
      <Form label="Save template" submit={async (data, form) => run(async () => { await api('/messages/templates', await withFiles(data, form)); form.reset(); }, 'Template saved')}>
        {owner && <Field label="Kind" name="scope"><select name="scope"><option value="firm">Firm template</option><option value="personal">Personal template</option></select></Field>}
        {fields()}
      </Form>
    </details>
  </section>;
}

/** Compose a document reminder from a template: preview it for this client, fill any missing field, then send. */
export function ReminderComposer({ jobId, run, sent, copied = [] }: { jobId: string; run: Run; sent: (result: Row) => void; copied?: Row[] }) {
  const [list, setList] = useState<Row[]>([]), [draft, setDraft] = useState<Row>({ templateId: '' }), [preview, setPreview] = useState<Row>();
  useEffect(() => { api('/messages/templates').then(s => setList(s.templates)).catch(() => setList([])); }, []);
  const show = async (next: Row) => { setDraft(next); setPreview(next.templateId || next.subject ? await api(`/jobs/${jobId}/reminders/preview`, next) : undefined); };
  return <div className="stack">
    {copied.map(m => <button key={m.id} className="quiet" onClick={() => run(() => show({ templateId: m.id }), 'Copied starter message previewed')}>Preview copied {m.name}</button>)}
    <Field label="Template" name="templateId"><select name="templateId" value={draft.templateId} onChange={e => run(() => show({ templateId: e.target.value }), 'Preview updated')}>
      <option value="">Standard reminder</option>{list.map(t => <option key={t.id} value={t.id}>{t.name} ({t.scope === 'firm' ? 'firm' : 'mine'})</option>)}</select></Field>
    {preview && <div className="notice">
      <p><strong>To {preview.to}: {preview.subject}</strong></p><MessageText>{preview.body}</MessageText>
      {preview.attachments.length > 0 && <p className="muted">Attached: {preview.attachments.map((f: Row) => f.name).join(', ')}</p>}
      {preview.missing.length > 0 && <Form label="Fill in and preview again" submit={async data => run(() => show({ ...draft, values: { ...(draft.values ?? {}), ...data } }), 'Preview updated')}>
        <p className="error">Missing: {preview.missing.map((m: Row) => m.label).join(', ')}. Fill them in, or choose another template.</p>
        {preview.missing.map((m: Row) => <Field key={m.key} label={m.label} name={m.key} />)}
      </Form>}
    </div>}
    {draft.templateId
      ? <button disabled={!preview || preview.missing.length > 0} onClick={() => run(async () => sent(await api(`/jobs/${jobId}/reminders`, draft)), 'Reminder recorded')}>Send this message</button>
      : <Form label="Send reminder" submit={async data => run(async () => sent(await api(`/jobs/${jobId}/reminders`, data)), 'Reminder recorded')}>
        <Field label="Extra message (optional)" name="message" required={false}><textarea name="message" rows={2} /></Field>
      </Form>}
  </div>;
}
