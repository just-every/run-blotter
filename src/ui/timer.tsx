// A job's time budget against actual time, and the person's running timer (TIME-001).
import { api, aud, Field, Form, when, type Row, type Run } from './common';

export function TimeBudget({ budget }: { budget: Row }) {
  const over = budget.varianceMinutes > 0;
  return <p className="muted">Recorded {budget.actualMinutes} min ({aud(budget.actualCents)})
    {budget.budgetMinutes != null ? <> against a budget of {budget.budgetMinutes} min · {over ? `${budget.varianceMinutes} min over` : `${-budget.varianceMinutes} min left`}</> : ' · no time budget'}</p>;
}

export function Timer({ job, timer, run }: { job: Row; timer: Row | null; run: Run }) {
  if (timer && timer.job_id !== job.id) return <p className="muted">Your timer is running on {timer.title} since {when(timer.started_at)}.</p>;
  if (timer) return <div className="row"><p>Timer running since {when(timer.started_at)}: {timer.description}</p>
    <button onClick={() => run(() => api('/timer/stop', {}), 'Timer stopped; its time is recorded at the rate in force')}>Stop timer</button>
    <button className="quiet" onClick={() => run(() => api('/timer/discard', {}), 'Timer discarded; no time recorded')}>Discard timer</button></div>;
  return <Form label="Start timer" submit={async (data, form) => run(async () => { await api(`/jobs/${job.id}/timer`, data); form.reset(); }, 'Timer started; it keeps running if you close the app')}>
    <Field label="What you are working on" name="description" />
  </Form>;
}
