import { useEffect, useState } from 'react';
import { api, day, Empty, Field, Form, today, type Row, type Run } from './common';
import { FilterBar, JobFlags } from './filters';
import { statusLabel } from './statuses';

const shift = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
const hours = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;

/** Move a job's due date: preview the task dates and capacity it changes, then reschedule it (WORK-004). */
function MoveDue({ job, run }: { job: Row; run: Run }) {
  const [preview, setPreview] = useState<Row>();
  return <details><summary>Move due date</summary>
    <Form label="Preview the move" submit={async data => run(async () => setPreview({ body: { jobId: job.id, dueDate: data.dueDate, dueNote: data.dueNote }, ...await api('/calendar/move/preview', { jobId: job.id, dueDate: data.dueDate, dueNote: data.dueNote }) }), 'Preview ready')}>
      <div className="row"><Field label="New due date" name="dueDate" type="date" value={job.due_date} /><Field label="Where the new due date comes from" name="dueNote" /></div>
    </Form>
    {preview && <div className="notice">
      <p>Due {preview.consequences.job.from} → {preview.consequences.job.to}</p>
      {preview.consequences.tasks.length > 0 && <ul className="list">{preview.consequences.tasks.map((t: Row) => <li key={t.ordinal}>“{t.label}” ({t.owner}) {t.from ?? 'no date'} → {t.to ?? 'no date'}{t.pastDue && <strong> · already past</strong>}</li>)}</ul>}
      {preview.consequences.capacity.length > 0 && <ul className="list">{preview.consequences.capacity.map((c: Row) => <li key={c.week + c.email}>{c.name}, week of {c.week}: demand {hours(c.demandBefore)} → {hours(c.demandAfter)} of {hours(c.availableMinutes)} available{c.overloadedAfter && <strong> · over capacity</strong>}</li>)}</ul>}
      {preview.consequences.warnings.map((w: string) => <p key={w} className="error">{w}</p>)}
      {preview.lines[0]?.reasons.map((r: string) => <p key={r} className="error">{r}</p>)}
      <button disabled={preview.lines[0]?.action !== 'change'} onClick={() => run(async () => { await api('/bulk/reassign', { jobIds: [job.id], dueDate: preview.body.dueDate, dueNote: preview.body.dueNote, fingerprint: preview.fingerprint }); setPreview(undefined); }, 'Due date moved')}>Move the due date</button>
    </div>}
  </details>;
}

/** Firm or client calendar (WORK-017): jobs and open tasks on their due dates, with the person's kept filters. */
export function Calendar({ state, open, run, tick }: { state: Row; open: (id: string) => void; run: Run; tick: number }) {
  const [from, setFrom] = useState(today()), [filter, setFilter] = useState<Row>(), [view, setView] = useState<Row>();
  const to = shift(from, 34), lead = state.actor.role !== 'preparer', model = state.statusModel;
  useEffect(() => { api(`/calendar?from=${from}&to=${to}` + (filter ? '&' + new URLSearchParams(filter) : '')).then(v => { setView(v); if (!filter) setFilter(v.filters); }).catch(e => run(async () => { throw e; })); }, [from, filter, tick]);
  const change = (next: Row) => { setFilter(next); api('/filters/calendar', next).catch(e => run(async () => { throw e; })); };
  if (!filter || !view) return <p>Opening the calendar…</p>;
  return <section className="panel">
    <FilterBar state={state} filter={filter} set={change} client={lead} />
    <Form label="Show" submit={async data => setFrom(String(data.from))}><Field label="From" name="from" type="date" value={from} /></Form>
    <p className="muted">{day(view.from)} to {day(view.to)}{filter.client && ` · ${state.clients.find((c: Row) => c.id === filter.client)?.name ?? 'one client'}`}</p>
    {!view.days.length ? <Empty>Nothing falls due in these dates.</Empty> : view.days.map((d: Row) => <div key={d.date} className="calendar-day">
      <h3>{day(d.date)}</h3>
      <ul className="list">
        {d.jobs.map((j: Row) => <li key={j.id}><button className="quiet text-action" onClick={() => open(j.id)}>{j.client_name} · {j.title} · {j.period_label}</button>
          <small className="muted"> {j.work_type} · {statusLabel(model, j.stage, j.sub_status)}</small> <JobFlags job={j} />
          {lead && j.status !== 'signed_off' && <MoveDue job={j} run={run} />}</li>)}
        {d.tasks.map((t: Row) => <li key={t.job_id + t.ordinal}><button className="quiet text-action" onClick={() => open(t.job_id)}>{t.label}</button> <small className="muted">task · {t.client} · {t.job} {t.period} · {t.owner}</small></li>)}
      </ul>
    </div>)}
  </section>;
}
