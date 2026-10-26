import { ServiceCosts } from './service-costs';
import { ScheduledAgents } from './scheduled-agents';
import { useState } from 'react';
import { Blotter, api, Empty, Field, Form, prose, Status, when, who, type Row, type Run, day } from './common';
import { Automation } from './automation';

export function Proposals({ state, run, open, tick }: { tick:number; state: Row; run: Run; open: (id: string) => void }) {
  const proposals: Row[] = state.proposals;
  const [link, setLink] = useState<Row>();
  return <Blotter><section className="panel">
    <p className="muted">An agent with your key prepares roll-forwards, client reminders and billing exports. Nothing happens until you approve; every decision is recorded. Create a key under Team & safety and see API.md.</p>
    {link && <div className="notice"><p>Reminder delivery: {link.delivery}. The upload link is shown once and expires {day(link.expiresAt)}.</p><input readOnly value={link.portalUrl} aria-label="Client upload link" onFocus={e => e.currentTarget.select()} /></div>}
    {!proposals.length && <Empty>No preparations yet.</Empty>}
    {proposals.map(p => { const payload = JSON.parse(p.payload); return <article key={p.id} className="record">
      <div className="split"><strong>{prose(payload.summary)}</strong><Status value={p.status} /></div>
      <small className="muted">{p.kind} · prepared by {p.agent_label} {when(p.created_at)}{p.decided_by && ` · ${p.status} by ${who(state.people, p.decided_by)} ${when(p.decided_at)}`}{p.decision_note && `: ${p.decision_note}`}</small>
      {payload.jobId && <p><button className="quiet" onClick={() => open(payload.jobId)}>Open the job</button></p>}
      {p.kind === 'reminder' && <p><strong>Additional reminder wording:</strong> {payload.message || 'None; use the standard request reminder.'}</p>}
      {payload.dueDate && <p><strong>Proposed due date:</strong> {day(payload.dueDate)} · {payload.dueNote}</p>}
      {p.agent_policy && <p>{p.agent_policy}</p>}
      {payload.source && <p className="muted">Source event: {payload.source.event} · job revision {payload.source.jobRevision}</p>}
      {p.status === 'pending' && <div className="actions">
        <button onClick={() => run(async () => { const done = await api(`/proposals/${p.id}/decide`, { decision: 'approve' }); setLink(done.result?.portalUrl ? done.result : undefined); }, 'Approved and carried out')}>Approve</button>
        <details><summary>Decline</summary><Form danger label="Decline" submit={async data => run(() => api(`/proposals/${p.id}/decide`, { decision: 'decline', reason: data.reason }), 'Declined')}><Field label="Reason" name="reason" /></Form></details>
      </div>}
    </article>; })}
  </section>{state.actor.role === 'owner' && <><ServiceCosts run={run} tick={tick}/><ScheduledAgents state={state} run={run} open={open} tick={tick}/></>}{state.actor.role === 'owner' && <Automation state={state} run={run} open={open} />}</Blotter>;
}
