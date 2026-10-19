// Dependencies and conditional workflow on the job screen (WORK-003): the job's
// questions, each task's state with the reasons it waits, and recorded exceptions.
import { api, Field, Form, when, type Row, type Run } from './common';

const LABEL: Record<string, string> = { ready: 'Ready', blocked: 'Blocked', not_applicable: 'Does not apply' };

/** The job's questions; answering one decides which branch tasks apply. */
export function Answers({ jobId, answers, open, run }: { jobId: string; answers: Row[]; open: boolean; run: Run }) {
  if (!answers?.length) return null;
  return <div className="stack">
    <h3>Questions</h3>
    {answers.map(a => <div key={a.key} className="record">
      <strong>{a.label}</strong> {a.value ? <small className="muted">{a.value} — {a.answered_by}, {when(a.answered_at)}</small> : <small className="muted">not answered yet</small>}
      {open && <Form label="Save answer" submit={async data => run(() => api(`/jobs/${jobId}/answers`, { key: a.key, value: data.value }), 'Answer recorded')}>
        <Field label="Answer" name="value"><select name="value" defaultValue={a.value ?? ''} required><option value="" disabled>Choose</option>
          {(JSON.parse(a.options) as string[]).map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
      </Form>}
    </div>)}
  </div>;
}

/** A task's state, what it waits for and any recorded exception; a lead may record one with a reason. */
export function TaskFlow({ jobId, step, lead, open, run }: { jobId: string; step: Row; lead: boolean; open: boolean; run: Run }) {
  if (step.done_at || (!step.gated && !step.exception_at)) return null;
  return <>
    <small className="muted"> · {step.state === 'blocked' ? <strong>{LABEL[step.state]}</strong> : LABEL[step.state]}{step.prerequisite && ` · after ${step.prerequisite.title} ${step.prerequisite.period_label} (${step.prerequisite.status})`}</small>
    {step.blockers.length > 0 && <small className="hint"> — {step.blockers.join('; ')}.</small>}
    {step.exception_at && <small className="hint"> — Exception by {step.exception_by}, {when(step.exception_at)}: {step.exception_reason} (waived: {step.exception_waived.join('; ')}).</small>}
    {lead && open && step.waivable.length > 0 && <details><summary>Record an exception</summary>
      <Form label="Record exception" submit={async data => run(() => api(`/jobs/${jobId}/steps/${step.ordinal}/exception`, { reason: data.reason }), 'Exception recorded; nothing it waited for is marked done')}>
        <Field label="Why this task may go ahead" name="reason"><textarea name="reason" rows={2} required /></Field>
      </Form>
    </details>}
  </>;
}

/** Template questions typed one per line: key | question | answer, answer. */
export function questionBody(value: unknown) {
  return String(value ?? '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [key, label, options] = l.split('|').map(s => s.trim());
    return { key, label, options: (options ?? '').split(',').map(s => s.trim()).filter(Boolean) };
  });
}
