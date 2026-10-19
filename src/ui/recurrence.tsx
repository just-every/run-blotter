// Automatic recurring work (WORK-002): approve a rule, preview its schedule,
// pause, skip or claim periods, and see the scheduler's runs.
import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, when, type Row, type Run, day } from './common';

const STATE: Record<string, string> = { generated: 'created', claimed: 'existing job claimed', skipped: 'skipped', due: 'created at the next run', scheduled: 'scheduled' };

export function RecurrencePanel({ state, run, tick }: { state: Row; run: Run; tick: number }) {
  const [data, setData] = useState<Row>(), [review, setReview] = useState<Row>();
  useEffect(() => { api('/rules').then(setData).catch(e => run(async () => { throw e; })); }, [tick]);
  const people: Row[] = state.people;
  return <section className="panel wide">
    <h2>Recurring work</h2>
    <p className="muted">Each approved rule creates its periods' jobs ahead of time (an hourly run, in UTC dates), once each, with fresh document requests. Due dates are the period's last day plus the rule's days; change one job's due date under Reassign or reschedule.</p>
    {!data ? <p>Opening rules…</p> : !data.rules.length ? <Empty>No rules yet.</Empty> : data.rules.map((r: Row) => <article key={r.id} className="record">
      <div className="split"><strong>{r.client} · {r.template}</strong><small className="muted">{r.status} · {r.lead_months} months ahead · due {r.due_days} days after period end{r.budget_minutes && ` · budget ${r.budget_minutes} min`}{r.end_period && ` · last period ${r.end_period}`}</small></div>
      <ul className="list">{r.schedule.map((p: Row) => <li key={p.periodStart}>{p.label} <small className="muted">· {STATE[p.state]}{p.state === 'scheduled' && ` on ${day(p.createOn)}`} · due {day(p.dueDate)}{p.note && ` · ${p.note}`}</small></li>)}</ul>
      <div className="actions">
        {r.restore_review && r.status === 'paused' ? <button className="quiet" onClick={() => run(async () => setReview(await api(`/rules/${r.id}/activation`)))}>Review restored schedule</button> : <button className="quiet" onClick={() => run(() => api(`/rules/${r.id}/status`, { status: r.status === 'active' ? 'paused' : 'active' }), r.status === 'active' ? 'Rule paused' : 'Rule resumed; missed periods are created at the next run')}>{r.status === 'active' ? 'Pause' : 'Resume'}</button>}
        {review && review.ruleId === r.id && <section className="notice"><h3>Restored schedule review</h3><p>{review.held.length} periods already held; {review.pending.length} pending through the current horizon. The scheduler creates at most {review.nextRunLimit} per run. Fresh work retains normal review gates and does not send client messages or payments.</p><ul className="list">{review.pending.map((p: Row) => <li key={p.periodStart}>{day(p.periodStart)} · {p.action} · due {day(p.dueDate)}</li>)}</ul><button onClick={() => run(async () => { await api(`/rules/${r.id}/status`, { status:'active', previewToken:review.token }); setReview(undefined); },'Reviewed rule resumed')}>Approve this schedule and resume</button></section>}
        <details><summary>Skip a period</summary><Form label="Skip period" submit={async data => run(() => api(`/rules/${r.id}/skip`, data), 'Period skipped')}>
          <Field label="Period starts" name="periodStart" type="date" /><Field label="Why" name="reason" /></Form></details>
        <details><summary>Claim an existing job</summary><Form label="Claim job" submit={async data => run(() => api(`/rules/${r.id}/claim`, data), 'Job claimed for this rule')}>
          <Field label="Job" name="jobId"><select name="jobId" required>{state.jobs.filter((j: Row) => j.client_id === r.client_id && j.template_id === r.template_id).map((j: Row) => <option key={j.id} value={j.id}>{j.period_label}</option>)}</select></Field></Form></details>
      </div>
    </article>)}
    {data && <button className="quiet" onClick={() => run(() => api('/rules/run', {}), 'Scheduler ran')}>Run now</button>}
    {data && data.runs.length > 0 && <details><summary>Scheduler runs</summary><ul className="list">{data.runs.map((x: Row) => <li key={x.id}>{when(x.finished_at)} · {x.trigger} as of {day(x.as_of)}: {x.created} created, {x.claimed} claimed{JSON.parse(x.held).length > 0 && ` · held: ${JSON.parse(x.held).join('; ')}`}</li>)}</ul></details>}
    {state.clients.length > 0 && state.templates.length > 0 && <details><summary>Approve a rule</summary>
      <Form label="Approve rule" submit={async data => run(() => api('/rules', { ...data, months: data.months || undefined, endPeriod: data.endPeriod || undefined, budgetMinutes: data.budgetMinutes || undefined, managerEmail: data.managerEmail || undefined }), 'Rule approved')}>
        <div className="row">
          <Field label="Client" name="clientId"><select name="clientId" required>{state.clients.map((c: Row) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Template" name="templateId"><select name="templateId" required>{state.templates.map((t: Row) => <option key={t.id} value={t.id}>{t.name} ({t.recurrence})</option>)}</select></Field>
        </div>
        <div className="row">
          <Field label="First period starts (a fiscal year starts in its first month)" name="firstPeriod" type="date" />
          <Field label="Last period starts (optional)" name="endPeriod" type="date" required={false} />
          <Field label="Only these months (optional, e.g. 1, 4, 7, 10)" name="months" required={false} />
        </div>
        <div className="row">
          <Field label="Create months ahead" name="leadMonths" type="number" value={3} />
          <Field label="Due, days after the period ends" name="dueDays" type="number" value={20} />
          <Field label="Time budget, minutes (optional)" name="budgetMinutes" type="number" required={false} />
        </div>
        <Field label="Where the due-date rule comes from" name="dueNote" />
        <div className="row">
          <Field label="Preparer" name="preparerEmail"><select name="preparerEmail" required>{people.map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>
          <Field label="Reviewer" name="reviewerEmail"><select name="reviewerEmail" required>{people.filter(p => p.role !== 'preparer').map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>
        </div>
      </Form>
    </details>}
  </section>;
}
