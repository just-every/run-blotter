// ERASURE-002 (owner only): the retention screens for one client, the preview-then-approve
// whole-client erasure with its receipt and journal, and the audited retained-records door.
import { useEffect, useState } from 'react';
import { api, day, Field, Form, when, type Row, type Run } from './common';
import { Copies, COPY_KINDS, Engagements, Marks, Requests } from './client-retention';

const ACTIONS = (c: Row) => [c.removed && `${c.removed} removed`, c.marker && `${c.marker} replaced by the erasure marker`, c.retained && `${c.retained} retained`, c.held && `${c.held} held`].filter(Boolean).join(' · ') || 'nothing to change';

function Receipt({ clientId, erasedAt, run }: { clientId: string; erasedAt: string; run: Run }) {
  const [receipt, setReceipt] = useState<Row>(), [remainder, setRemainder] = useState<Row>();
  useEffect(() => { api('/erasure-journal').then(j => setReceipt(j.receipts.find((r: Row) => r.clientId === clientId))); }, [clientId]);
  return <section aria-label="Erasure receipt">
    <h3>Erasure receipt</h3>
    <p>This client was erased {when(erasedAt)}.</p>
    {receipt && <>
      <p>Approved by {receipt.approvedBy} · {when(receipt.approvedAt)} · journal epoch {receipt.journalEpoch}</p>
      <ul className="list">{receipt.retained.classes.map((c: Row) => <li key={c.class}>{c.class.replaceAll('_', ' ')}: {ACTIONS(c)}</li>)}</ul>
      <h4>Kept, with owner</h4>
      <ul className="list">{receipt.retained.exceptions.map((e: Row) => <li key={e.key}>{e.label}: {e.count} · {e.reason} · owner {e.owner}</li>)}
        {receipt.retained.records.map((r: Row, n: number) => <li key={n}>{r.kind} · {r.class.replaceAll('_', ' ')} · clock {day(r.clock)} + {r.years} years = expires {day(r.expiry)}</li>)}</ul>
      <h4>Copies outside Blotter (never erased by Blotter)</h4>
      <ul className="list">{receipt.retained.externalCopies.map((c: Row, n: number) => <li key={n}>{c.kind === 'observed' ? 'Observed' : COPY_KINDS[c.kind]} · {c.system} · owner {c.holder} · {c.source}</li>)}</ul>
      <a href="/api/blotter/erasure-journal" download="erasure-journal.json">Download the erasure journal</a>
    </>}
    {receipt?.retained.restrictedRemainder && <Form label="Read retained records" submit={async data => run(async () => setRemainder(await api(`/clients/${clientId}/retained-records`, { reason: data.reason, action: 'read' })), 'Retained records read and logged')}>
      <p className="muted">The legal name, taxpayer identifier and address a retained record needs are sealed. Reading them is logged with your reason.</p>
      <Field label="Reason for reading retained records" name="reason" />
    </Form>}
    {remainder && <div className="notice"><p>{remainder.identity.legalName} · taxpayer ID {remainder.identity.taxpayerId || 'none'} · {Object.entries(remainder.identity.address).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
      <ul className="list">{remainder.records.map((r: Row) => <li key={r.id}>{r.label} · {r.status}</li>)}</ul></div>}
  </section>;
}

function Preview({ clientId, client, run }: { clientId: string; client: Row; run: Run }) {
  const [preview, setPreview] = useState<Row>();
  return <section aria-label="Erase this client">
    <h3>Erase this client</h3>
    <p className="muted">Preview first. Erasure removes eligible personal data and payloads, keeps signed-off work, signed engagements and approved billing until their periods end, and refuses to restore any older archive without the newer journal.</p>
    <button className="quiet" onClick={() => run(async () => setPreview(await api(`/clients/${clientId}/erasure/preview`)), 'Erasure preview ready')}>Preview erasure</button>
    {preview && <div className="stack">
      {preview.blockers.map((b: string) => <p key={b} className="notice">{b}</p>)}
      <ul className="list">{preview.classes.map((c: Row) => <li key={c.class}><strong>{c.class.replaceAll('_', ' ')}</strong>: {ACTIONS(c)}{c.holds.length ? ` · held by ${c.holds.map((h: Row) => String(h.id).slice(0, 8)).join(', ')}` : ''}</li>)}</ul>
      <ul className="list">{preview.erase.map((e: Row) => <li key={e.table}>{e.label}: {e.count}</li>)}</ul>
      <p>{preview.totals.redacted} erased or redacted · {preview.totals.deleted} deleted{preview.withdrawalsCarried > 0 && ` · ${preview.withdrawalsCarried} withdrawal(s) carried to other contacts`}</p>
      <h4>Will be kept, with owner</h4>
      <ul className="list">{preview.retained.map((e: Row) => <li key={e.key}>{e.label}: {e.count} · {e.reason} · owner {e.owner}</li>)}
        {preview.records.map((r: Row) => <li key={r.kind + r.id}>{r.label} · {r.class.replaceAll('_', ' ')} · clock {day(r.clock)} + {r.years} years = expires {day(r.expiry)}</li>)}
        {preview.holds.map((h: Row) => <li key={h.id}>{h.kind === 'hold' ? `Hold · owner ${h.owner} · review ${day(h.review_date)}` : `Retain until ${day(h.until)}`} on {h.scope}: {h.reason} · {h.placed_by}</li>)}
        {preview.externalCopies.map((c: Row, n: number) => <li key={n}>{c.source === 'principal-recorded' ? COPY_KINDS[c.kind] : 'Observed'} · {c.system} · {c.action}</li>)}</ul>
      {preview.eligible && <Form danger label="Erase this client" submit={async data => run(() => api(`/clients/${clientId}/erasure`, { planHash: preview.planHash, confirm: data.confirm, reason: data.reason }), 'Client erased')}>
        <Field label={`Type the client name (${client.name}) to confirm`} name="confirm" />
        <Field label="Reason" name="reason" />
      </Form>}
    </div>}
  </section>;
}

export function ClientErasure({ clientId, client, jobs, run, tick }: { clientId: string; client: Row; jobs: Row[]; run: Run; tick: number }) {
  const [retention, setRetention] = useState<Row>(), [engagements, setEngagements] = useState<Row[]>([]);
  useEffect(() => { Promise.all([api(`/clients/${clientId}/retention`), api(`/clients/${clientId}/engagements`)]).then(([r, e]) => { setRetention(r); setEngagements(e); }).catch(e => run(async () => { throw e; })); }, [clientId, tick]);
  if (client.erased_at) return <Receipt clientId={clientId} erasedAt={client.erased_at} run={run} />;
  return retention ? <div className="stack"><Marks clientId={clientId} jobs={jobs} retention={retention} engagements={engagements} run={run} /><Engagements clientId={clientId} engagements={engagements} run={run} />
    <Requests clientId={clientId} retention={retention} run={run} /><Copies clientId={clientId} retention={retention} run={run} />
    {client.lifecycle === 'archived' ? <Preview clientId={clientId} client={client} run={run} /> : <p className="muted">Archive this client to request erasure.</p>}</div> : null;
}
