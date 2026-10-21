// ERASURE-002 (owner only): retention holds, recorded external copies, and the
// preview-then-approve whole-client erasure with its receipt and journal.
import { useEffect, useState } from 'react';
import { api, day, Empty, Field, Form, when, type Row, type Run } from './common';

const KINDS: Record<string, string> = { document: 'Document copy', provider: 'Provider-retained copy', buyer: 'Buyer-controlled copy' };

function Marks({ clientId, jobs, retention, run }: { clientId: string; jobs: Row[]; retention: Row; run: Run }) {
  const [scope, setScope] = useState('job'), [kind, setKind] = useState('hold'), [jobId, setJobId] = useState(''), [files, setFiles] = useState<Row[]>([]);
  useEffect(() => { if (scope === 'file' && jobId) api('/jobs/' + jobId).then(d => setFiles(d.requests.flatMap((r: Row) => r.files))); else setFiles([]); }, [scope, jobId]);
  return <section aria-label="Holds and retention">
    <h3>Holds and retention</h3>
    <p className="muted">Nothing is kept or deleted automatically. A hold lasts until you release it; a retain-until date lasts through that day. A marked record stays whole through erasure and is named in its receipt.</p>
    {!retention.marks.length ? <Empty>No holds or retention dates.</Empty> : <ul className="list">{retention.marks.map((m: Row) => <li key={m.id}>
      {m.kind === 'hold' ? 'Hold' : `Retain until ${day(m.until)}`} · {m.scope} {m.scope === 'client' ? '' : m.target_id.slice(0, 8)} · {m.reason} · {m.placed_by}
      {m.released_at ? <> · released {when(m.released_at)}: {m.release_reason}</> : <details><summary>Release</summary><Form label="Release mark" submit={async data => run(() => api(`/retention/${m.id}/release`, data), 'Mark released')}><Field label="Release reason" name="reason" /></Form></details>}
    </li>)}</ul>}
    <Form label="Place a mark" submit={async (data, form) => { await run(() => api(`/clients/${clientId}/retention`, { scope, kind, until: data.until || undefined, reason: data.reason, targetId: scope === 'file' ? data.fileId : scope === 'job' ? data.jobId : undefined }), 'Retention mark placed'); form.reset(); }}>
      <Field label="What to keep" name="scope"><select value={scope} onChange={e => setScope(e.target.value)}><option value="client">The whole client (blocks erasure)</option><option value="job">One job</option><option value="file">One uploaded file</option></select></Field>
      {scope !== 'client' && <Field label="Job" name="jobId"><select name="jobId" required onChange={e => setJobId(e.target.value)}><option value="">Choose a job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {j.period_label}</option>)}</select></Field>}
      {scope === 'file' && <Field label="File" name="fileId"><select name="fileId" required><option value="">Choose a file</option>{files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>}
      <Field label="Mark type" name="kind"><select value={kind} onChange={e => setKind(e.target.value)}><option value="hold">Hold until released</option><option value="retain">Retain until a date</option></select></Field>
      {kind === 'retain' && <Field label="Retain through" name="until" type="date" />}
      <Field label="Reason" name="reason" />
    </Form>
  </section>;
}

function Copies({ clientId, retention, run }: { clientId: string; retention: Row; run: Run }) {
  return <section aria-label="Copies outside Blotter">
    <h3>Copies outside Blotter</h3>
    <p className="muted">Blotter cannot delete a copy held elsewhere. Record it with the person or company that holds it; erasure lists it as an exception until you confirm they deleted it.</p>
    {!retention.copies.length ? <Empty>No external copies recorded.</Empty> : <ul className="list">{retention.copies.map((c: Row) => <li key={c.id}>
      {KINDS[c.kind]} · {c.system} · holder {c.holder}{c.note && ` · ${c.note}`}
      {c.closed_at ? <> · confirmed deleted {when(c.closed_at)}: {c.closed_note}</> : <details><summary>Confirm deleted</summary><Form label="Confirm deleted" submit={async data => run(() => api(`/external-copies/${c.id}/close`, data), 'Copy closed')}><Field label="Who confirmed, and how" name="note" /></Form></details>}
    </li>)}</ul>}
    <Form label="Record a copy" submit={async (data, form) => { await run(() => api(`/clients/${clientId}/external-copies`, data), 'External copy recorded'); form.reset(); }}>
      <Field label="Kind" name="kind"><select name="kind">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Where it is held" name="system" />
      <Field label="Named holder" name="holder" />
      <Field label="Note" name="note" required={false} />
    </Form>
  </section>;
}

function Preview({ clientId, client, run }: { clientId: string; client: Row; run: Run }) {
  const [preview, setPreview] = useState<Row>(), [receipt, setReceipt] = useState<Row>();
  if (receipt) return <section aria-label="Erasure receipt">
    <h3>Erasure receipt</h3>
    <p>Erased by {receipt.approvedBy} · {when(receipt.approvedAt)} · journal epoch {receipt.journalEpoch}</p>
    <ul className="list">{receipt.steps.map((s: Row) => <li key={s.table}>{s.label}: {s.count} {s.action === 'delete' ? 'deleted' : s.action === 'cascade' ? 'removed with files' : 'erased or redacted'}</li>)}</ul>
    <h4>Kept, with owner</h4>
    <ul className="list">{receipt.retained.exceptions.map((e: Row) => <li key={e.key}>{e.label}: {e.count} · {e.reason} · owner {e.owner}</li>)}</ul>
    <a href="/api/blotter/erasure-journal" download="erasure-journal.json">Download the erasure journal</a>
  </section>;
  return <section aria-label="Erase this client">
    <h3>Erase this client</h3>
    <p className="muted">Preview first. Erasure removes eligible personal data and payloads, keeps held and signed evidence, and refuses to restore any older archive without the newer journal.</p>
    <button className="quiet" onClick={() => run(async () => setPreview(await api(`/clients/${clientId}/erasure/preview`)), 'Erasure preview ready')}>Preview erasure</button>
    {preview && <div className="stack">
      {preview.blockers.map((b: string) => <p key={b} className="notice">{b}</p>)}
      <ul className="list">{preview.erase.map((e: Row) => <li key={e.table}>{e.label}: {e.count}</li>)}</ul>
      <p>{preview.totals.redacted} erased or redacted · {preview.totals.deleted} deleted{preview.withdrawalsCarried > 0 && ` · ${preview.withdrawalsCarried} withdrawal(s) carried to other contacts`}</p>
      <h4>Will be kept, with owner</h4>
      <ul className="list">{preview.retained.map((e: Row) => <li key={e.key}>{e.label}: {e.count} · {e.reason} · owner {e.owner}</li>)}
        {preview.holds.map((h: Row) => <li key={h.id}>{h.kind === 'hold' ? 'Hold' : `Retain until ${day(h.until)}`} on {h.scope}: {h.reason} · {h.placed_by}</li>)}
        {preview.externalCopies.map((c: Row) => <li key={c.id}>{KINDS[c.kind]} · {c.system} · {c.action}</li>)}</ul>
      {preview.eligible && <Form danger label="Erase this client" submit={async data => run(async () => setReceipt(await api(`/clients/${clientId}/erasure`, { planHash: preview.planHash, confirm: data.confirm, reason: data.reason })), 'Client erased')}>
        <Field label={`Type the client name (${client.name}) to confirm`} name="confirm" />
        <Field label="Reason" name="reason" />
      </Form>}
    </div>}
  </section>;
}

export function ClientErasure({ clientId, client, jobs, run, tick }: { clientId: string; client: Row; jobs: Row[]; run: Run; tick: number }) {
  const [retention, setRetention] = useState<Row>();
  useEffect(() => { api(`/clients/${clientId}/retention`).then(setRetention).catch(e => run(async () => { throw e; })); }, [clientId, tick]);
  if (client.erased_at) return <p>This client was erased {when(client.erased_at)}. Its receipt is in the erasure journal.</p>;
  return retention ? <div className="stack"><Marks clientId={clientId} jobs={jobs} retention={retention} run={run} /><Copies clientId={clientId} retention={retention} run={run} />
    {client.lifecycle === 'archived' ? <Preview clientId={clientId} client={client} run={run} /> : <p className="muted">Archive this client to request erasure.</p>}</div> : null;
}
