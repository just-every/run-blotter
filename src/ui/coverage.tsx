import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, when, type Row, type Run } from './common';

const ACTION: Record<string, string> = { change: 'Moves', unresolved: 'Unresolved', conflict: 'Refused', excluded: 'Excluded' };

/**
 * Cover an absence or overload (CAPACITY-002): preview who takes each job in
 * dependency order and what moves, adjust a line, then approve the feasible
 * changes. Work nobody can cover stays with the approving manager.
 */
export function Coverage({ state, open, run, tick }: { state: Row; open: (id: string) => void; run: Run; tick: number }) {
  const [request, setRequest] = useState<Row>(), [plan, setPlan] = useState<Row>(), [plans, setPlans] = useState<Row[]>([]);
  useEffect(() => { api('/coverage').then(setPlans).catch(() => setPlans([])); }, [tick]);
  const preview = (body: Row) => run(async () => { setRequest(body); setPlan(await api('/coverage/preview', body)); }, 'Preview ready');
  const choose = (jobId: string, patch: Row) => { const choices = (request!.choices ?? []).filter((c: Row) => c.jobId !== jobId); preview({ ...request, choices: [...choices, { ...(request!.choices ?? []).find((c: Row) => c.jobId === jobId), jobId, ...patch }] }); };
  return <section className="panel">
    <h2>Cover an absence or overload</h2>
    <Form label="Preview cover" submit={async data => preview({ email: data.email, reason: data.reason, startsOn: data.startsOn, endsOn: data.endsOn, dueNote: data.dueNote || undefined })}>
      <div className="row">
        <Field label="Person" name="email"><select name="email">{state.people.map((p: Row) => <option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>
        <Field label="Because" name="reason"><select name="reason"><option value="leave">On leave</option><option value="overload">Over capacity</option></select></Field>
        <Field label="From" name="startsOn" type="date" /><Field label="To" name="endsOn" type="date" />
      </div>
      <Field label="Where moved due dates come from" name="dueNote" required={false} hint="Needed when you move a due date below" />
    </Form>
    {plan && <div className="stack">
      <p className="muted">Open jobs {plan.person} prepares or reviews, due {plan.startsOn} to 14 days after {plan.endsOn}, in dependency order.</p>
      {!plan.lines.length ? <Empty>No open work falls in these dates.</Empty> : <ul className="list">{plan.lines.map((l: Row) => <li key={l.jobId}>
        <button className="quiet text-action" onClick={() => open(l.jobId)}>{l.work}</button> <strong>{ACTION[l.action]}</strong>
        {l.to && <small className="muted"> · preparer {l.from.preparer} → {l.to.preparer} · reviewer {l.from.reviewer} → {l.to.reviewer} · due {l.from.dueDate} → {l.to.dueDate}{l.skillMatch && ' · has the skill'}</small>}
        {[...l.reasons, ...(l.unresolved ?? [])].map((r: string) => <p key={r} className="error">{r}</p>)}
        <details><summary>Change this line</summary>
          <Form label="Preview with this" submit={async data => choose(l.jobId, { preparerEmail: data.preparerEmail || undefined, dueDate: data.dueDate || undefined, exclude: data.exclude === 'on' })}>
            <div className="row"><Field label="Preparer" name="preparerEmail" required={false}><select name="preparerEmail"><option value="">Proposed</option>{state.people.map((p: Row) => <option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>
              <Field label="New due date" name="dueDate" type="date" required={false} /></div>
            <label className="check"><input type="checkbox" name="exclude" /> Leave this job out</label>
          </Form>
        </details>
      </li>)}</ul>}
      {plan.notifications.length > 0 && <><h3>Who is told</h3><ul className="list">{plan.notifications.map((n: Row, i: number) => <li key={i}>{n.to}: {n.summary}</li>)}</ul></>}
      {plan.conflicts.length > 0 && <><h3>Stays with you as unresolved</h3><ul className="list">{plan.conflicts.map((c: Row) => <li key={c.jobId}>{c.work}: {c.reason}</li>)}</ul></>}
      <button onClick={() => run(async () => { await api('/coverage', { ...request, fingerprint: plan.fingerprint }); setPlan(undefined); }, 'Cover approved')}>Approve the feasible changes</button>
    </div>}
    {plans.length > 0 && <><h3>Approved cover</h3><ul className="list">{plans.map(p => <li key={p.id}>{p.person_email} {p.reason === 'leave' ? 'on leave' : 'over capacity'} {p.starts_on} to {p.ends_on} <small className="muted">approved by {p.approved_by} {when(p.approved_at)}</small>
      {p.conflicts.length > 0 && <ul className="list">{p.conflicts.map((k: Row) => <li key={k.id}><button className="quiet text-action" onClick={() => open(k.job_id)}>{k.work}</button> <small className="muted">{k.reason} · owner {k.owner_email}{k.resolved_at && ` · resolved by ${k.resolved_by}: ${k.resolution}`}</small>
        {!k.resolved_at && (k.owner_email === state.actor.email || state.actor.role === 'owner') && <Form label="Mark resolved" submit={async data => run(() => api(`/coverage/conflicts/${k.id}/resolve`, { note: data.note }), 'Resolved')}><Field label="How it was resolved" name="note" /></Form>}</li>)}</ul>}</li>)}</ul></>}
  </section>;
}
