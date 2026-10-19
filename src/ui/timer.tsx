// A job's time budget against actual time, and the person's running timer (TIME-001).
import { api, aud, Field, Form, when, type Row, type Run } from './common';

export function TimeBudget({ budget }: { budget: Row }) {
  const over = budget.varianceMinutes > 0;
  return <p className="muted">Recorded {budget.actualMinutes} min ({aud(budget.actualCents)})
    {budget.budgetMinutes != null ? <> against a budget of {budget.budgetMinutes} min · {over ? `${budget.varianceMinutes} min over` : `${-budget.varianceMinutes} min left`}</> : ' · no time budget'}</p>;
}

/** An optional task of the job to record time against. */
export function TaskChoice({ steps }: { steps: Row[] }) {
  return <Field label="Task (optional)" name="taskOrdinal"><select name="taskOrdinal" defaultValue=""><option value="">Whole job</option>{steps.map(s => <option key={s.ordinal} value={s.ordinal}>{s.label}</option>)}</select></Field>;
}

export function Timer({ job, timer, steps, run }: { job: Row; timer: Row | null; steps: Row[]; run: Run }) {
  if (timer && timer.job_id !== job.id) return <p className="muted">Your timer is running on {timer.title} since {when(timer.started_at)}.</p>;
  if (timer) return <div className="row"><p>Timer running since {when(timer.started_at)}: {timer.description}{timer.billable ? '' : ' (not billable)'}</p>
    <button onClick={() => run(() => api('/timer/stop', {}), 'Timer stopped; its time is recorded at the rate in force')}>Stop timer</button>
    <button className="quiet" onClick={() => run(() => api('/timer/discard', {}), 'Timer discarded; no time recorded')}>Discard timer</button></div>;
  return <Form label="Start timer" submit={async (data, form) => run(async () => { await api(`/jobs/${job.id}/timer`, { description: data.description, billable: data.billable === 'on', taskOrdinal: data.taskOrdinal ? Number(data.taskOrdinal) : undefined }); form.reset(); }, 'Timer started; it keeps running if you close the app')}>
    <Field label="What you are working on" name="description" />
    <TaskChoice steps={steps} />
    <label className="check"><input type="checkbox" name="billable" defaultChecked /> Billable to the client</label>
  </Form>;
}
