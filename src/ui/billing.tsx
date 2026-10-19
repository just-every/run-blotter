import { useEffect, useState } from 'react';
import { Blotter, api, aud, Empty, Field, Form, Status, when, type Row, type Run } from './common';
import { ExpenseSettings } from './expenses';
import { TimeApprovals } from './timesheet';

export function Billing({ actor, run, tick }: { actor: Row; run: Run; tick: number }) {
  const [state, setState] = useState<Row>(), [chosen, setChosen] = useState<Set<string>>(new Set());
  useEffect(() => { api('/billing').then(s => { setState(s); setChosen(new Set()); }).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!state) return <p>Opening billing…</p>;
  const toggle = (key: string) => setChosen(previous => { const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const total = state.unbilled.filter((l: Row) => chosen.has(l.source_key)).reduce((sum: number, l: Row) => sum + Number(l.amount_cents), 0);
  return <div className="stack">
    <TimeApprovals actor={actor} run={run} tick={tick} />
    <Blotter><section className="panel">
      <h2>Ready to bill</h2>
      <p className="muted">Approved time and adjustments, fixed fees of signed-off jobs and approved billable expenses. Work in progress: {aud(state.wip.totalCents)} (expenses {aud(state.wip.byKind.expense)}). Each item can go into one export. Amounts are AUD ex GST; Blotter does not calculate GST or send invoices.</p>
      {!state.unbilled.length ? <Empty>Nothing waiting to be billed.</Empty> : <>
        <table className="table"><thead><tr><th><span className="sr-only">Include</span></th><th>Client</th><th>Job</th><th>Item</th><th>Amount</th></tr></thead>
          <tbody>{state.unbilled.map((l: Row) => <tr key={l.source_key}>
            <td><input type="checkbox" aria-label={`Include ${l.description}`} checked={chosen.has(l.source_key)} onChange={() => toggle(l.source_key)} /></td>
            <td data-label="Client">{l.client}</td><td data-label="Job">{l.job} · {l.period}</td>
            <td data-label="Item">{l.kind === 'fee' ? 'Fixed fee' : l.kind === 'expense' ? `${l.date} ${l.person}: ${l.description}` : `${l.date} ${l.person}: ${l.description} (${l.minutes} min at ${aud(l.rate_cents)}/h)`}</td>
            <td data-label="Amount">{aud(l.amount_cents)}</td></tr>)}</tbody></table>
        <Form disabled={chosen.size === 0} label={chosen.size ? `Prepare export (${chosen.size} items, ${aud(total)})` : 'Choose items to export'} submit={async data => run(() => api('/exports', { title: data.title, sourceKeys: [...chosen] }), 'Export prepared. The principal reviews and approves it.')}>
          <Field label="Export title" name="title" value={`Billing ${new Date().toISOString().slice(0, 7)}`} />
        </Form>
      </>}
    </section></Blotter>
    <ExpenseSettings state={state} actor={actor} run={run} />
    <section className="panel">
      <h2>Exports</h2>
      {!state.exports.length && <Empty>No exports yet.</Empty>}
      {state.exports.map((e: Row) => <article key={e.id} className="record">
        <div className="split"><strong>{e.title} · {aud(e.total_cents)}</strong><Status value={e.status} /></div>
        <small className="muted">Prepared by {e.prepared_by}{e.prepared_channel === 'agent' ? ' (agent)' : ''} {when(e.prepared_at)}{e.approved_by && ` · approved by ${e.approved_by} ${when(e.approved_at)}: ${e.review_note}`}{e.void_reason && ` · void: ${e.void_reason}`}</small>
        <details><summary>{JSON.parse(e.snapshot).lines.length} lines</summary><ul>{JSON.parse(e.snapshot).lines.map((l: Row) => <li key={l.line}>{l.client} · {l.job} · {l.description} · {aud(l.amount_cents)}</li>)}</ul></details>
        {e.status === 'approved' && <p><a className="button" href={`/api/blotter/exports/${e.id}/csv`}>Download CSV</a> <small className="muted">SHA-256 {e.csv_sha256.slice(0, 12)}…</small></p>}
        {e.status === 'draft' && <div className="actions">
          <details><summary>Approve</summary><Form label="Approve export" submit={async data => run(() => api(`/exports/${e.id}/approve`, { revision: e.revision, reviewNote: data.reviewNote }), 'Export approved; the CSV is now fixed')}><Field label="Review note" name="reviewNote" /></Form></details>
          <details><summary>Void</summary><Form danger label="Void draft" submit={async data => run(() => api(`/exports/${e.id}/void`, { reason: data.reason }), 'Draft voided; its items are ready to bill again')}><Field label="Reason" name="reason" /></Form></details>
        </div>}
      </article>)}
    </section>
  </div>;
}
