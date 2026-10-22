import { useEffect, useState } from 'react';
import { Blotter, api, day, money, moneyTotals, moneyTotalsText, Empty, Field, Form, prose, Status, today, when, who, type Row, type Run, ExportLink } from './common';
import { ExpenseSettings } from './expenses';
import { TimeApprovals } from './timesheet';

export function Billing({ actor, people, run, tick }: { actor: Row; people: Row[]; run: Run; tick: number }) {
  const [state, setState] = useState<Row>(), [chosen, setChosen] = useState<Set<string>>(new Set());
  useEffect(() => { api('/billing').then(s => { setState(s); setChosen(new Set()); }).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!state) return <p>Opening billing…</p>;
  const toggle = (key: string) => setChosen(previous => { const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const selected: Row[] = state.unbilled.filter((l: Row) => chosen.has(l.source_key));
  const mixed = new Set(selected.map(l => l.currency)).size > 1;
  return <div className="stack">
    <TimeApprovals actor={actor} people={people} run={run} tick={tick} />
    <Blotter><section className="panel">
      <h2>Ready to bill</h2>
      <p className="muted">Approved time and adjustments, fixed fees of signed-off jobs and approved billable expenses. Work in progress: {moneyTotals(state.unbilled, 'amount_cents') || money(0)}. Each item can go into one export. Each export uses one currency; amounts are never converted. Use Invoices and retainers above for native USD documents and explicit delivery. Blotter does not calculate tax.</p>
      {!state.unbilled.length ? <Empty>Nothing waiting to be billed.</Empty> : <>
        <table className="table"><thead><tr><th><span className="sr-only">Include</span></th><th>Client</th><th>Job</th><th>Item</th><th className="amount">Amount</th></tr></thead>
          <tbody>{state.unbilled.map((l: Row) => <tr key={l.source_key}>
            <td><input type="checkbox" aria-label={`Include ${l.description}`} checked={chosen.has(l.source_key)} onChange={() => toggle(l.source_key)} /></td>
            <td data-label="Client">{l.client}</td><td data-label="Job">{l.job} · {l.period}</td>
            <td data-label="Item">{l.kind === 'fee' ? 'Fixed fee' : <>{day(l.date)} · {who(people, l.person)}: {l.description}{l.kind !== 'expense' && <> ({l.minutes} min at {money(l.rate_cents, l.currency)}/h)</>}</>}</td>
            <td data-label="Amount" className="amount">{money(l.amount_cents, l.currency)}</td></tr>)}</tbody></table>
        <Form disabled={chosen.size === 0 || mixed} label={chosen.size ? `Prepare export (${chosen.size} items, ${moneyTotalsText(selected, 'amount_cents')})` : 'Choose items to export'} submit={async data => run(() => api('/exports', { title: data.title, sourceKeys: [...chosen] }), 'Export prepared. The principal reviews and approves it.')}>
          {mixed && <p className="error">Choose items in one currency per export.</p>}
          <Field label="Export title" name="title" value={`Billing ${new Date(today() + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })}`} />
        </Form>
      </>}
    </section></Blotter>
    <ExpenseSettings state={state} actor={actor} people={people} run={run} />
    <section className="panel">
      <h2>Exports</h2>
      {!state.exports.length && <Empty>No exports yet.</Empty>}
      {state.exports.map((e: Row) => <article key={e.id} className="record">
        <div className="split"><strong>{e.title} · {money(e.total_cents, JSON.parse(e.snapshot).currency ?? 'AUD')}</strong><Status value={e.status} /></div>
        <small className="muted">Prepared by {who(people, e.prepared_by)}{e.prepared_channel === 'agent' ? ' (agent)' : ''} {when(e.prepared_at)}{e.approved_by && ` · approved by ${who(people, e.approved_by)} ${when(e.approved_at)}: ${prose(e.review_note)}`}{e.void_reason && ` · void: ${e.void_reason}`}</small>
        <details><summary>{JSON.parse(e.snapshot).lines.length} lines</summary><ul>{JSON.parse(e.snapshot).lines.map((l: Row) => <li key={l.line}>{l.client} · {l.job} · {prose(l.description)} · {money(l.amount_cents, l.currency ?? JSON.parse(e.snapshot).currency ?? 'AUD')}</li>)}</ul></details>
        {e.status === 'approved' && <p><ExportLink className="button" href={`/api/blotter/exports/${e.id}/csv`}>Download CSV</ExportLink> <small className="muted">SHA-256 {e.csv_sha256.slice(0, 12)}…</small></p>}
        {e.status === 'draft' && <div className="actions">
          <details><summary>Approve</summary><Form label="Approve export" submit={async data => run(() => api(`/exports/${e.id}/approve`, { revision: e.revision, reviewNote: data.reviewNote }), 'Export approved; the CSV is now fixed')}><Field label="Review note" name="reviewNote" /></Form></details>
          <details><summary>Void</summary><Form danger label="Void draft" submit={async data => run(() => api(`/exports/${e.id}/void`, { reason: data.reason }), 'Draft voided; its items are ready to bill again')}><Field label="Reason" name="reason" /></Form></details>
        </div>}
      </article>)}
    </section>
  </div>;
}
