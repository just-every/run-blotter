import { useEffect, useState } from 'react';
import { api, MessageText, Empty, Field, Form, type Row, type Run } from './common';

export function StarterLibrary({ state, run, tick }: { state: Row; run: Run; tick: number }) {
  const [catalog, setCatalog] = useState<Row>(), [selected, setSelected] = useState('1040'), [version, setVersion] = useState<number>();
  useEffect(() => { api('/library').then(setCatalog).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!catalog) return null;
  const item = catalog.templates.find((t: Row) => t.id === selected), release = item.versions.find((v: Row) => v.version === (version ?? item.latestVersion));
  const owner = state.actor.role === 'owner';
  return <section className="panel wide">
    <h2>US starter library</h2>
    <p className="muted">Starting checklists for firm review. Dates are internal targets relative to your recorded due date; no agency deadline, tax treatment or filing is verified. Each organizer is a starting set of conditional questions; review and tailor it before sending.</p>
    <Field label="Starter template" name="starter"><select name="starter" value={selected} onChange={e => { setSelected(e.target.value); setVersion(undefined); }}>{catalog.templates.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
    <Field label="Library release" name="release"><select name="release" value={release.version} onChange={e => setVersion(Number(e.target.value))}>{item.versions.map((v: Row) => <option key={v.version} value={v.version}>Version {v.version}{v.version === item.latestVersion ? ' (latest)' : ''}</option>)}</select></Field>
    <p>{release.description}</p>
    <p className="muted">{item.recurrence} · budget {(release.budgetMinutes / 60).toFixed(2)} hours · work type {item.name}</p>
    <p className="muted">Stages: {catalog.stages.map((s: Row) => s.label).join(' → ')}</p>
    <ol>{release.tasks.map((t: Row) => <li key={t.label}><strong>{t.label}</strong><small className="muted"> · {t.assignee} · starts {t.startDays} days from {t.startFrom}, due {t.dueDays} days from {t.dueFrom} · {t.estimateMinutes} min</small></li>)}</ol>
    {release.organizer && <details><summary>{release.organizer.name} · version {release.organizer.version}</summary><ul>{release.organizer.questions.map((q: Row)=><li key={q.key}>{q.label}{q.required?' · required':''}{q.when && ` · when ${q.when.question}: ${q.when.values.join(', ')}`}{q.request && ` · supporting document: ${q.request}`}</li>)}</ul></details>}
    <details><summary>Requests and messages</summary><ul>{release.requests.map((r: string) => <li key={r}>{r}</li>)}</ul>{release.messages.map((m: Row) => <div key={m.name}><h3>{m.name}</h3><p>{m.subject}</p><MessageText>{m.body}</MessageText></div>)}</details>
    {owner && <Form key={selected + release.version} label="Adopt this version" submit={async data => run(() => api('/library/adopt', { libraryId: selected, version: release.version, name: data.name }), 'Starter template adopted; review and tailor it before starting work')}><Field label="Firm template name" name="name" value={item.name} /></Form>}
    {owner && <details><summary>Import a reviewed library release</summary>
      <p className="muted">Install a newer release package from your maintainer. This records its source and author; it does not verify tax rules or change adopted templates. Preview and choose adoption changes afterwards.</p>
      <Form label="Import library release" submit={async data => run(() => api('/library/releases', { libraryId: selected, source: data.source, release: JSON.parse(data.release) }), 'Library release imported; adopted templates are unchanged')}>
        <Field label="Release source or change note" name="source" />
        <Field label="Release package JSON" name="release"><textarea name="release" rows={5} required /></Field>
      </Form>
    </details>}
    <h3>Adopted templates</h3>
    {!catalog.adoptions.length && <Empty>No starter templates adopted yet.</Empty>}
    {catalog.adoptions.map((a: Row) => <Adoption key={a.id} adoption={a} owner={owner} run={run} />)}
  </section>;
}
function Adoption({ adoption: a, owner, run }: { adoption: Row; owner: boolean; run: Run }) {
  const [preview, setPreview] = useState<Row>();
  const tasks = Object.entries(a.content.state.tasks) as [string, Row][];
  return <details className="record"><summary>{a.name} · adopted version {a.version}{a.latestVersion > a.version ? ` · version ${a.latestVersion} available` : ''}</summary>
    <p className="muted">Firm edits stay yours. Library updates affect future jobs only. Each existing job keeps its tasks, requests, budget and message copies.</p>
    {owner && <details><summary>Edit firm requests and budget</summary>
      <Form key={a.revision} label="Save requests and budget" submit={async data => run(() => api(`/library/adoptions/${a.id}/details`, { ...data, revision: a.revision }), 'Firm requests and budget saved; existing jobs are unchanged')}>
        <Field label="Client requests (one per line)" name="requests"><textarea name="requests" rows={4} defaultValue={Object.values(a.content.state.requests).join('\n')} /></Field>
        <Field label="Default budget in minutes" name="budgetMinutes" type="number" value={a.content.state.budgetMinutes} />
      </Form>
      <p className="muted">Edit message copies under Message templates. Those edits are retained when you review library updates.</p>
    </details>}
    {tasks.map(([key, t]) => <details key={key}><summary>{t.label} · {t.assignee} · {t.estimateMinutes} min</summary>
      <p>{t.instructions}</p>
      {owner && <Form key={a.revision} label="Save task edit" submit={async data => run(() => api(`/library/adoptions/${a.id}/task`, { revision: a.revision, key, task: { ...t, ...data, startDays: Number(data.startDays), dueDays: Number(data.dueDays), estimateMinutes: Number(data.estimateMinutes) } }), 'Firm task saved; existing jobs are unchanged')}>
        <Field label="Task label" name="label" value={t.label} /><Field label="Job role" name="assignee"><select name="assignee" defaultValue={t.assignee}><option value="preparer">Preparer</option><option value="reviewer">Reviewer</option></select></Field>
        <div className="row"><Field label="Start from" name="startFrom"><select name="startFrom" defaultValue={t.startFrom}><option value="due">Job due date</option><option value="start">Period start</option></select></Field><Field label="Start days" name="startDays" type="number" value={t.startDays} /></div>
        <div className="row"><Field label="Due from" name="dueFrom"><select name="dueFrom" defaultValue={t.dueFrom}><option value="due">Job due date</option><option value="start">Period start</option></select></Field><Field label="Due days" name="dueDays" type="number" value={t.dueDays} /></div>
        <Field label="Estimate in minutes" name="estimateMinutes" type="number" value={t.estimateMinutes} /><Field label="Task instructions" name="instructions"><textarea name="instructions" rows={3} defaultValue={t.instructions} /></Field>
      </Form>}
    </details>)}
    {owner && <button className="quiet" onClick={() => run(async () => setPreview(await api(`/library/adoptions/${a.id}/preview`)), 'Library changes previewed')}>Preview library update</button>}
    {preview && (preview.changes.length ? <Form key={preview.token} label="Apply reviewed choices" submit={async data => run(async () => {
      const choices = Object.fromEntries(preview.changes.map((c: Row) => [c.key, data[c.key] === 'on' ? 'accept' : 'ignore']));
      await api(`/library/adoptions/${a.id}/update`, { token: preview.token, choices }); setPreview(undefined);
    }, 'Reviewed library choices saved; firm edits and existing jobs retained')}>
      <p>Version {preview.fromVersion} → {preview.toVersion}. Unchecked changes are ignored.</p>
      {preview.changes.map((c: Row) => <div className="record" key={c.key}>
        <strong>{changeLabel(c.key)}</strong><p>{describe(c.before)} → {describe(c.after)}</p>
        {c.conflict ? <p className="notice">Firm edit retained: {describe(c.current)}</p> : <label className="check"><input type="checkbox" name={c.key} />Accept this change</label>}
      </div>)}
    </Form> : <p>No library changes available.</p>)}
  </details>;
}
const changeLabel = (key: string) => ({ tasks: 'Task', requests: 'Client request', messages: 'Message template', organizerQuestions:'Organizer question',workflowQuestions:'Workflow question',organizerName:'Organizer name',organizerKind:'Organizer kind',budgetMinutes: 'Default time budget (minutes)', description: 'Library description' })[key.split(':')[0] as 'tasks'] ?? 'Library change';
const describe = (value: any) => value === null ? '(absent)' : typeof value !== 'object' ? String(value) : value.label ? value.type || value.options ? `${value.label}${value.required?' · required':''}${value.when ? ` · when ${value.when.question}: ${(value.when.values??[]).join(', ')}`:''}${value.request?` · document: ${value.request}`:''}` : `${value.label}: ${value.instructions} (${value.estimateMinutes} min)` : `${value.name}: ${value.body}`;

export function StarterJobSummary({ content }: { content?: Row }) {
  if (!content) return null;
  return <details><summary>Starter library · {content.libraryName} · version {content.version}</summary>
    <p>Copied when this job started. Later library updates do not change this work.</p>{content.state.organizer && <p>{content.state.organizer.name} · organizer version {content.state.organizer.version} · {content.state.organizer.questions.length} questions</p>}
    <ul>{content.messages.map((m: Row) => <li key={m.id}>{m.name} · message version {m.version}</li>)}</ul>
  </details>;
}
