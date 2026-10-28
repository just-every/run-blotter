import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, today, type Row, type Run, day } from './common';
import { JobFlags } from './filters';
import { MoveTo, statusLabel } from './statuses';

const monday = (day: string) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };

/** Put a job or task on one of the week's days. */
function PlanOn({ plan, item, label, run }: { plan: Row; item: Row; label: string; run: Run }) {
  return <select aria-label={`Plan ${label}`} value="" onChange={e => run(() => api('/plan', { ...item, email: plan.email, day: e.target.value }), 'Planned')}>
    <option value="">Plan for…</option>{plan.days.map((d: Row) => <option key={d.date} value={d.date}>{day(d.date)}</option>)}
  </select>;
}

/**
 * The personal weekly plan (WORK-016): the jobs and tasks placed on each day,
 * with each planned job's status and move control, and the open tasks and jobs
 * due in or before the week (overdue ones flagged) to plan from.
 */
export function MyWeek({ state, open, run, tick }: { state: Row; open: (id: string) => void; run: Run; tick: number }) {
  const [week, setWeek] = useState(monday(today())), [who, setWho] = useState(''), [plan, setPlan] = useState<Row>();
  useEffect(() => { api(`/plan?week=${week}${who ? '&email=' + encodeURIComponent(who) : ''}`).then(setPlan).catch(e => run(async () => { throw e; })); }, [week, who, tick]);
  const model = state.statusModel, owner = state.actor.role === 'owner';
  return <section className="panel plan-view">
    <div className="split"><h2>My week</h2>
      <Form label="Show week" submit={async data => { setWeek(monday(String(data.week))); if (owner) setWho(String(data.email ?? '')); }}>
        <div className="row"><Field label="Week of" name="week" type="date" value={week} />
          {owner && <Field label="Whose week" name="email" required={false}><select name="email" defaultValue={who}><option value="">Mine</option>{state.people.filter((p: Row) => p.email !== state.actor.email).map((p: Row) => <option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>}</div>
      </Form></div>
    {!plan ? <p>Opening your plan…</p> : <>
      <p className="muted">{day(plan.weekStart)} to {day(plan.weekEnd)}{plan.email !== state.actor.email && ` · ${plan.email}`}: work placed on each day, then open tasks and jobs due by the week's end, including overdue ones.</p>
      <ol className="list plan-days">{plan.days.map((d: Row) => <li key={d.date}><strong>{day(d.date)}</strong>
        {!d.items.length ? <small className="muted"> · nothing planned</small> : <ul className="list">{d.items.map((i: Row) => <li key={i.id}>
          <button className="quiet text-action" onClick={() => open(i.job_id)}>{i.ordinal ? i.task : `${i.job?.client_name} · ${i.job?.title} · ${i.job?.period_label}`}</button>
          {i.job && <small className="muted"> {i.ordinal ? `${i.job.client_name} · ${i.job.title}` : statusLabel(model, i.job.stage, i.job.sub_status)} · due {day(i.job.due_date)}</small>}
          {i.job && !i.ordinal && <> <JobFlags job={i.job} />{i.job.status === 'open' && <MoveTo model={model} job={i.job} run={run} />}</>}
          <button className="quiet" onClick={() => run(() => api(`/plan/${i.id}/delete`, {}), 'Removed from the plan')}>Remove</button>
        </li>)}</ul>}</li>)}</ol>
      <h3>Tasks</h3>
      {!plan.tasks.length ? <Empty>No tasks for you this week.</Empty> : <ul className="list">{plan.tasks.map((t: Row) => <li key={t.job_id + t.ordinal}>
        <button className="quiet text-action" onClick={() => open(t.job_id)}>{t.label}</button> <small className="muted">{t.client} · {t.job} {t.period}{t.due_date && ` · due ${day(t.due_date)}`}{t.estimate_minutes && ` · ${t.estimate_minutes} min`}</small>
        {t.sop_url && <> <a href={t.sop_url} target="_blank" rel="noreferrer noopener">SOP</a></>} <PlanOn plan={plan} item={{ jobId: t.job_id, ordinal: t.ordinal }} label={t.label} run={run} /></li>)}</ul>}
      {plan.jobs.length > 0 && <><h3>Jobs due</h3><ul className="list">{plan.jobs.map((j: Row) => <li key={j.id}>
        <button className="quiet text-action" onClick={() => open(j.id)}>{j.client_name} · {j.title} {j.period_label}</button> <small className="muted">due {day(j.due_date)} · {statusLabel(model, j.stage, j.sub_status)}{j.planned.length > 0 && ` · planned ${j.planned.join(', ')}`}</small> <JobFlags job={j} />
        <PlanOn plan={plan} item={{ jobId: j.id }} label={`${j.client_name} ${j.title}`} run={run} /></li>)}</ul></>}
    </>}
  </section>;
}
