// Staff offboarding (ACCESS-006): preview everything a member owns, name
// successors for their work and reviews, then transfer it and deactivate them
// in one reviewed batch.
import { useState } from 'react';
import { api, day, Empty, Field, Form, when, type Row, type Run } from './common';

const count = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function Offboarding({ state, members, run }: { state: Row; members: Row[]; run: Run }) {
  const [plan, setPlan] = useState<Row>();
  const active = members.filter(m => m.active);
  if (!members.length) return null;
  const people = [{ email: state.actor.email, name: `${state.actor.name} (you)` }, ...active];
  const choose = (name: string, label: string, optional = false) => <Field label={label} name={name}><select name={name} defaultValue="">{optional && <option value="">Same as work successor</option>}{!optional && <option value="" disabled>Choose a person</option>}{people.map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>;
  return <details><summary>Offboard a person</summary>
    <p className="muted">Preview everything they own, transfer it to successors and deactivate them in one step (or transfer the work of someone already deactivated). Sent messages, decisions and recorded time keep their author. Their sessions and agent keys are revoked.</p>
    <Form label="Preview transfer" submit={async data => run(async () => setPlan(await api('/team/offboard/preview', { email: data.email, workSuccessor: data.workSuccessor, reviewSuccessor: data.reviewSuccessor || undefined })))}>
      <Field label="Departing person" name="email"><select name="email">{members.map(m => <option key={m.email} value={m.email}>{m.name}{m.active ? '' : ' (deactivated)'}</option>)}</select></Field>
      {choose('workSuccessor', 'Successor for their work (jobs they prepare, tasks, notices, discussions, template tasks)')}
      {choose('reviewSuccessor', 'Successor for their reviews (jobs they review or manage, pending proposals, unsent message batches)', true)}
    </Form>
    {plan && <article className="record">
      <h3>Transfer from {plan.name}</h3>
      <ul className="list">
        {plan.clients.map((c:Row) => <li key={c.id}>{c.name}: client partner and assigned team responsibility</li>)}
        {plan.jobs.map((j: Row) => <li key={j.id}>{j.client} · {j.title} · {j.period_label}: preparer {j.to.preparer}, reviewer {j.to.reviewer}{j.to.manager ? `, manager ${j.to.manager}` : ''}</li>)}
        {plan.tasks.map((t: Row) => <li key={t.job_id + t.ordinal}>Task “{t.label}” on {t.job} → {plan.workSuccessor}</li>)}
        {plan.rules.map((r: Row) => <li key={r.id}>Recurring {r.template} for {r.client}: preparer {r.to.preparer}, reviewer {r.to.reviewer}</li>)}
        {plan.automations.map((r: Row) => <li key={r.id}>Automation “{r.name}” · version {r.version}: live authority checks refuse an inactive assignee. Its approval is not transferred; preview and approve a new version for the successor.</li>)}
        {plan.notices.map((n: Row) => <li key={n.id}>Notice {n.agency} {n.notice_type} (respond by {day(n.response_due)}) → {plan.workSuccessor}</li>)}
        {plan.threads.map((t: Row) => <li key={t.id}>Discussion “{t.title}” → {plan.workSuccessor}</li>)}
        {plan.proposals.map((p: Row) => <li key={p.id}>Pending {p.kind} proposal from {p.agent_label} → {plan.reviewSuccessor}</li>)}
        {plan.batches.map((b: Row) => <li key={b.id}>{b.class === 'marketing' ? 'Marketing' : 'Engagement'} message batch ({b.status}{b.reason ? `: ${b.reason}` : ''}) → {plan.reviewSuccessor}{b.class === 'marketing' ? '; its approval is not transferred, so the principal approves it again before it sends' : ''}</li>)}
        {plan.templates.map((t: Row) => <li key={t.id}>Template “{t.name}” task owner → {plan.workSuccessor}</li>)}
        {plan.timer && <li>Running timer on {plan.timer.title} since {when(plan.timer.started_at)}: discarded, nothing recorded</li>}
        {plan.time.length > 0 && <li>{count(plan.time.filter((t: Row) => !t.status).length, 'unsubmitted time entry', 'unsubmitted time entries')} submitted for approval on their behalf; {count(plan.time.filter((t: Row) => t.status === 'submitted').length, 'entry', 'entries')} already waiting; {count(plan.time.filter((t: Row) => t.status === 'returned').length, 'returned entry', 'returned entries')} never billed (delete before closing their period)</li>}
        <li>{count(plan.keys.length, 'agent key')} and {count(plan.sessions, 'session')} revoked</li>
      </ul>
      {!plan.clients.length && !plan.jobs.length && !plan.tasks.length && !plan.rules.length && !plan.automations.length && !plan.notices.length && !plan.threads.length && !plan.proposals.length && !plan.batches.length && !plan.templates.length && <Empty>They own no open work.</Empty>}
      {plan.problems.length > 0 ? <p className="error">Resolve first: {plan.problems.join('; ')}</p>
        : <button className="danger" onClick={() => run(async () => { await api('/team/offboard', { email: plan.email, workSuccessor: plan.workSuccessor, reviewSuccessor: plan.reviewSuccessor, fingerprint: plan.fingerprint }); setPlan(undefined); }, 'Work transferred and person deactivated')}>Transfer and deactivate</button>}
    </article>}
  </details>;
}
