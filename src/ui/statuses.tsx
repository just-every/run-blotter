import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, when, type Row, type Run, day } from './common';
import { FilterBar, JobFlags, NO_FILTERS, PRIORITY } from './filters';

const OPEN = ['planned', 'ready', 'in_progress', 'waiting'];
const hours = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
const allowed = (sub: Row, workTypeId: string) => !sub.work_types.length || sub.work_types.includes(workTypeId);
/** "Waiting – on client documents" for a stage and sub-status. */
export const statusLabel = (model: Row, stage: string, sub?: string | null) => `${model.stages.find((s: Row) => s.key === stage)?.label ?? stage}${sub ? ` – ${sub}` : ''}`;

/** The stages and sub-statuses a job may move to (WORK-007): open stages while open; In review and Completed only by review. */
export function MoveTo({ model, job, run }: { model: Row; job: Row; run: Run }) {
  const stage = job.stage, options = (job.status === 'open' ? OPEN : [stage]).flatMap(key => [
    { value: key, label: statusLabel(model, key) },
    ...model.subStatuses.filter((s: Row) => s.stage === key && allowed(s, job.work_type_id)).map((s: Row) => ({ value: `${key}|${s.id}`, label: statusLabel(model, key, s.name) })),
  ]);
  return <select aria-label={`Move ${job.client_name ?? ''} ${job.title}`.trim()} value={job.sub_status_id ? `${stage}|${job.sub_status_id}` : stage}
    onChange={e => { const [to, sub] = e.target.value.split('|'); run(() => api(`/jobs/${job.id}/status`, { stage: to, subStatusId: sub || undefined }), 'Status changed'); }}>
    {options.map((o: Row) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
}

/** The job's status, its move control and history. */
export function JobStatus({ detail, run, tick }: { detail: Row; run: Run; tick: number }) {
  const [model, setModel] = useState<Row>();
  useEffect(() => { api('/work-types').then(setModel).catch(() => setModel(undefined)); }, [tick]);
  if (!model) return null;
  const { job } = detail, type = model.workTypes.find((w: Row) => w.id === job.work_type_id);
  const sub = model.subStatuses.find((s: Row) => s.id === job.sub_status_id);
  const stage = job.status === 'review' ? 'in_review' : job.status === 'signed_off' ? 'completed' : job.open_stage ?? 'in_progress';
  const subName = job.status === 'review' && job.reviewed_at ? `partner sign-off by ${job.partner_email}` : sub?.name;
  return <section className="panel">
    <h2>Status</h2>
    <p><span className="badge" style={{ borderColor: type?.color }}>{type?.name}</span> {statusLabel(model, stage, subName)}</p>
    {detail.portal && job.status !== 'signed_off' && !job.reviewed_at && <label>Move to <MoveTo model={model} job={{ ...job, stage }} run={run} /></label>}
    {detail.portal && job.status !== 'signed_off' && <label>Priority <select value={job.priority} onChange={e => run(() => api(`/jobs/${job.id}/priority`, { priority: e.target.value }), 'Priority changed')}>
      {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
    <p className="muted">In review and Completed are reached only by submitting for review and signing off.</p>
    <details><summary>Status history ({detail.statusHistory.length})</summary><ol className="list">{detail.statusHistory.map((h: Row) => <li key={h.id}>
      {h.from_stage ? statusLabel(model, h.from_stage, h.from_sub_status) : 'Created'} → {statusLabel(model, h.to_stage, h.to_sub_status)} <small className="muted">{h.by} · {when(h.at)}</small></li>)}</ol></details>
  </section>;
}

/**
 * The board (WORK-006): columns by stage, or by the chosen work type's
 * sub-statuses; each card moves in place through WORK-007's moves. The
 * person's filters are kept, so a refresh opens the same board.
 */
export function Board({ state, open, run, tick }: { state: Row; open: (id: string) => void; run: Run; tick: number }) {
  const model = state.statusModel, [filter, setFilter] = useState<Row>(), [board, setBoard] = useState<Row>(), [views, setViews] = useState<Row[]>([]);
  useEffect(() => { api('/board' + (filter ? '?' + new URLSearchParams(filter) : '')).then(b => { setBoard(b); if (!filter) setFilter(b.filters); }).catch(e => run(async () => { throw e; })); }, [filter, tick]);
  useEffect(() => { api('/views').then(setViews).catch(() => setViews([])); }, [tick]);
  const change = (next: Row) => { const f = { ...next, groupBy: next.workType ? next.groupBy : 'stage' }; setFilter(f); api('/filters/board', f).catch(e => run(async () => { throw e; })); };
  if (!filter || !board) return <p>Opening the board…</p>;
  return <section className="panel">
    <FilterBar state={state} filter={filter} set={change} client={state.actor.role !== 'preparer'} />
    <div className="row">
      <label>Columns<select value={filter.groupBy} disabled={!filter.workType} onChange={e => change({ ...filter, groupBy: e.target.value })}><option value="stage">By stage</option><option value="sub_status">By sub-status of the work type</option></select></label>
      {views.length > 0 && <label>Saved view<select value="" onChange={e => { const v = views.find(x => x.id === e.target.value); if (v) change({ ...NO_FILTERS, groupBy: filter.groupBy, ...JSON.parse(v.filters) }); }}><option value="">Choose…</option>{views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
    </div>
    <Form label="Save this view" submit={async (data, form) => run(async () => { await api('/views', { ...filter, name: data.name }); form.reset(); }, 'View saved')}><Field label="View name" name="name" /></Form>
    <div className="board">{board.columns.map((c: Row) => <div key={c.key} className="board-column"><h3>{c.label} <small className="muted">{c.jobs.length}</small></h3>
      {c.jobs.map((j: Row) => <article key={j.id} className="record" style={{ borderLeftColor: j.color }}>
        <button className="quiet text-action" onClick={() => open(j.id)}>{j.client_name} · {j.title} · {j.period_label}</button>
        <small className="muted"> {j.work_type}{j.sub_status && ` · ${j.sub_status}`} · due {day(j.due_date)}</small> <JobFlags job={j} />
        {j.status !== 'signed_off' && <MoveTo model={model} job={j} run={run} />}
      </article>)}</div>)}</div>
  </section>;
}

/** The principal's work types and sub-statuses, and the time-in-status report. */
export function StatusSettings({ state, run, tick }: { state: Row; run: Run; tick: number }) {
  const model = state.statusModel, owner = state.actor.role === 'owner', [report, setReport] = useState<Row[]>([]), [plan, setPlan] = useState<Row>();
  useEffect(() => { api('/reports/status-time').then(setReport).catch(() => setReport([])); }, [tick]);
  const types = (data: Row) => model.workTypes.filter((w: Row) => data['type:' + w.id] === 'on').map((w: Row) => w.id);
  return <section className="panel">
    <h2>Work types and statuses</h2>
    <ul className="list">{model.workTypes.map((w: Row) => <li key={w.id}><span className="badge" style={{ borderColor: w.color }}>{w.name}</span> <small className="muted">{w.template ? `default template ${w.template}` : 'no default template'}{w.budget_minutes && ` · default budget ${hours(w.budget_minutes)}`}{w.roles.length > 0 && ` · needs ${w.roles.join(' and ')}`} · {w.jobs} jobs</small></li>)}</ul>
    <ul className="list">{model.subStatuses.map((s: Row) => <li key={s.id}>{statusLabel(model, s.stage, s.name)} <small className="muted">{s.client_label && `client sees “${s.client_label}” · `}{s.work_types.length ? `only ${s.work_types.map((t: string) => model.workTypes.find((w: Row) => w.id === t)?.name).join(', ')}` : 'every work type'} · {s.jobs} jobs</small>
      {owner && <details><summary>Rename or delete</summary>
        <Form label="Save" submit={async data => run(() => api(`/sub-statuses/${s.id}`, { name: data.name, clientLabel: data.clientLabel }), 'Saved; history kept')}><Field label="Name" name="name" value={s.name} /><Field label="Client sees (optional)" name="clientLabel" required={false} value={s.client_label ?? ''} hint="Shown on the client link instead of the stage name" /></Form>
        <Form label="Preview deletion" submit={async data => run(async () => setPlan({ id: s.id, body: { toStage: data.toStage }, ...await api(`/sub-statuses/${s.id}/delete/preview`, { toStage: data.toStage }) }), 'Preview ready')}>
          <Field label="Move its jobs to" name="toStage"><select name="toStage" defaultValue={s.stage}>{model.stages.map((st: Row) => <option key={st.key} value={st.key}>{st.label}</option>)}</select></Field>
        </Form>
        {plan && plan.id === s.id && <div className="notice"><p>{plan.jobs.length} jobs move to {statusLabel(model, plan.to?.stage ?? s.stage)}.{plan.problems.join(' ')}</p>
          <button onClick={() => run(async () => { await api(`/sub-statuses/${s.id}/delete`, { ...plan.body, fingerprint: plan.fingerprint }); setPlan(undefined); }, 'Sub-status deleted; its jobs moved')}>Move jobs and delete</button></div>}
      </details>}</li>)}</ul>
    {owner && <>
      <Form label="Add work type" submit={async (data, form) => run(async () => { await api('/work-types', { name: data.name, templateId: data.templateId || undefined, roles: ['manager', 'partner'].filter(r => data['role:' + r] === 'on'), budgetMinutes: data.budgetHours ? Math.round(Number(data.budgetHours) * 60) : undefined, color: data.color }); form.reset(); }, 'Work type added')}>
        <div className="row"><Field label="Work type" name="name" />
          <Field label="Default template" name="templateId" required={false}><select name="templateId"><option value="">None</option>{state.templates.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Default budget hours" name="budgetHours" type="number" required={false} /><Field label="Color" name="color" type="color" value="#64748b" /></div>
        <fieldset><legend>Roles its jobs need besides preparer and reviewer</legend><label className="check"><input type="checkbox" name="role:manager" /> Manager</label><label className="check"><input type="checkbox" name="role:partner" /> Partner sign-off</label></fieldset>
      </Form>
      <Form label="Add sub-status" submit={async (data, form) => run(async () => { await api('/sub-statuses', { stage: data.stage, name: data.name, clientLabel: data.clientLabel || undefined, workTypeIds: types(data) }); form.reset(); }, 'Sub-status added')}>
        <div className="row"><Field label="Under" name="stage"><select name="stage">{model.stages.map((s: Row) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></Field><Field label="Sub-status" name="name" /><Field label="Client sees (optional)" name="clientLabel" required={false} /></div>
        <fieldset><legend>Only for (none ticked: every work type)</legend>{model.workTypes.map((w: Row) => <label key={w.id} className="check"><input type="checkbox" name={'type:' + w.id} /> {w.name}</label>)}</fieldset>
      </Form>
    </>}
    <h3>Time in status</h3>
    {!report.length ? <Empty>No status history yet.</Empty> : <table className="table"><thead><tr><th>Status</th><th>Jobs now</th><th>Entries</th><th>Total</th><th>Average</th></tr></thead>
      <tbody>{report.map(r => <tr key={r.stage + (r.subStatusId ?? '')}><td data-label="Status">{statusLabel(model, r.stage, r.subStatus)}</td><td data-label="Jobs now">{r.now}</td><td data-label="Entries">{r.entries}</td><td data-label="Total">{hours(r.minutes)}</td><td data-label="Average">{hours(r.averageMinutes)}</td></tr>)}</tbody></table>}
  </section>;
}
