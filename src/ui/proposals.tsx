import { useState } from 'react';
import { Blotter, api, Empty, Field, Form, Status, when, type Row, type Run, day } from './common';

export function Proposals({ state, run, open }: { state: Row; run: Run; open: (id: string) => void }) {
  const proposals: Row[] = state.proposals;
  const [link, setLink] = useState<Row>();
  return <Blotter><section className="panel">
    <p className="muted">An agent with your key prepares roll-forwards, client reminders and billing exports. Nothing happens until you approve; every decision is recorded. Create a key under Team & safety and see API.md.</p>
    {link && <div className="notice"><p>Reminder delivery: {link.delivery}. The upload link is shown once and expires {day(link.expiresAt)}.</p><input readOnly value={link.portalUrl} aria-label="Client upload link" onFocus={e => e.currentTarget.select()} /></div>}
    {!proposals.length && <Empty>No preparations yet.</Empty>}
    {proposals.map(p => { const payload = JSON.parse(p.payload); return <article key={p.id} className="record">
      <div className="split"><strong>{payload.summary}</strong><Status value={p.status} /></div>
      <small className="muted">{p.kind} · prepared by {p.agent_label} {when(p.created_at)}{p.decided_by && ` · ${p.status} by ${p.decided_by} ${when(p.decided_at)}`}{p.decision_note && `: ${p.decision_note}`}</small>
      {payload.jobId && <p><button className="quiet" onClick={() => open(payload.jobId)}>Open the job</button></p>}
      {p.status === 'pending' && <div className="actions">
        <button onClick={() => run(async () => { const done = await api(`/proposals/${p.id}/decide`, { decision: 'approve' }); setLink(done.result?.portalUrl ? done.result : undefined); }, 'Approved and carried out')}>Approve</button>
        <details><summary>Decline</summary><Form danger label="Decline" submit={async data => run(() => api(`/proposals/${p.id}/decide`, { decision: 'decline', reason: data.reason }), 'Declined')}><Field label="Reason" name="reason" /></Form></details>
      </div>}
    </article>; })}
  </section></Blotter>;
}
