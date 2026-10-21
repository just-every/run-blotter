// ERASURE-002 (owner only), one client: holds with owner and review date, extend-only retain-until
// dates, the practitioner-recorded signed engagement, deletion requests and recorded outside copies.
import { useEffect, useState } from 'react';
import { api, day, Empty, Field, Form, readFile, when, type Row, type Run } from './common';

export const COPY_KINDS: Record<string, string> = { document: 'Document copy', provider: 'Provider-retained copy', buyer: 'Buyer-controlled copy' };

export function Marks({ clientId, jobs, retention, engagements, run }: { clientId: string; jobs: Row[]; retention: Row; engagements: Row[]; run: Run }) {
  const [scope, setScope] = useState('job'), [kind, setKind] = useState('hold'), [jobId, setJobId] = useState(''), [files, setFiles] = useState<Row[]>([]);
  useEffect(() => { if (scope === 'file' && jobId) api('/jobs/' + jobId).then(d => setFiles(d.requests.flatMap((r: Row) => r.files))); else setFiles([]); }, [scope, jobId]);
  const target = (data: Row) => scope === 'file' ? data.fileId : scope === 'job' ? data.jobId : scope === 'engagement' ? data.engagementId : undefined;
  return <section aria-label="Holds and retention">
    <h3>Holds and retention</h3>
    <p className="muted">A hold keeps everything in its scope through erasure until you release it, and refuses single-item erasure inside it. A retain-until date can only extend a record's period. Review dates show as due on the retention page; no reminder is sent.</p>
    {!retention.marks.length ? <Empty>No holds or retention dates.</Empty> : <ul className="list">{retention.marks.map((m: Row) => <li key={m.id}>
      {m.kind === 'hold' ? `Hold · owner ${m.owner} · review ${day(m.review_date)}${m.reviewDue ? ' (due)' : ''}` : `Retain until ${day(m.until)}`} · {m.scope === 'class' ? `class ${m.class}${m.client_id ? '' : ' (whole firm)'}` : `${m.scope} ${m.target_id ? m.target_id.slice(0, 8) : ''}`} · {m.reason} · {m.placed_by}
      {m.released_at ? <> · released {when(m.released_at)}: {m.release_reason}</> : <details><summary>Release</summary><Form label="Release mark" submit={async data => run(() => api(`/retention/${m.id}/release`, data), 'Mark released')}><Field label="Release reason" name="reason" /></Form></details>}
    </li>)}</ul>}
    <Form label="Place a mark" submit={async (data, form) => { await run(() => api(`/clients/${clientId}/retention`, { scope, kind, until: data.until || undefined, reason: data.reason, targetId: target(data), class: scope === 'class' ? data.cls : undefined, firmWide: scope === 'class' && data.firmWide === 'on', owner: kind === 'hold' ? data.owner : undefined, reviewDate: kind === 'hold' ? data.reviewDate : undefined }), 'Retention mark placed'); form.reset(); }}>
      <Field label="What to keep" name="scope"><select value={scope} onChange={e => setScope(e.target.value)}><option value="client">The whole client</option><option value="job">One job</option><option value="file">One uploaded file</option><option value="engagement">One signed engagement</option><option value="class">A record class</option></select></Field>
      {(scope === 'job' || scope === 'file') && <Field label="Job" name="jobId"><select name="jobId" required onChange={e => setJobId(e.target.value)}><option value="">Choose a job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {j.period_label}</option>)}</select></Field>}
      {scope === 'file' && <Field label="File" name="fileId"><select name="fileId" required><option value="">Choose a file</option>{files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>}
      {scope === 'engagement' && <Field label="Engagement" name="engagementId"><select name="engagementId" required><option value="">Choose an engagement</option>{engagements.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></Field>}
      {scope === 'class' && <><Field label="Record class" name="cls"><select name="cls" required>{Object.entries(retention.classes as Row).map(([k, v]) => <option key={k} value={k}>{k.replaceAll('_', ' ')}: {String(v).split(':')[0]}</option>)}</select></Field>
        <div className="field"><label><input type="checkbox" name="firmWide" /> Hold this class for the whole firm</label></div></>}
      <Field label="Mark type" name="kind"><select value={kind} onChange={e => setKind(e.target.value)}><option value="hold">Hold until released</option>{scope !== 'class' && <option value="retain">Retain until a later date</option>}</select></Field>
      {kind === 'retain' && <Field label="Retain through" name="until" type="date" />}
      {kind === 'hold' && <><Field label="Hold owner (your email or a named reviewer's)" name="owner" /><Field label="Review date" name="reviewDate" type="date" /></>}
      <Field label="Reason" name="reason" />
    </Form>
  </section>;
}

export function Engagements({ clientId, engagements, run }: { clientId: string; engagements: Row[]; run: Run }) {
  return <section aria-label="Signed engagements">
    <h3>Signed engagements</h3>
    <p className="muted">File the signed letter to this client. It is labelled practitioner-recorded, not signed through Blotter, and kept until its retention clock expires.</p>
    {!engagements.length ? <Empty>No signed engagement is filed.</Empty> : <ul className="list">{engagements.map(e => <li key={e.id}>
      {e.title} · signed {day(e.signed_date)} by {JSON.parse(e.signers).join(', ')} · {e.label} · SHA-256 {e.sha256.slice(0, 12)}…{e.erased_at ? ` · bytes erased ${when(e.erased_at)}` : <> · <a href={`/api/blotter/engagements/${e.id}/file`}>Download</a></>}</li>)}</ul>}
    <Form label="File a signed engagement" submit={async (data, form) => { const input = form.elements.namedItem('letter') as HTMLInputElement; if (!input.files?.[0]) throw new Error('Choose the signed letter'); await run(async () => api(`/clients/${clientId}/engagements`, { title: data.title, signers: data.signers, signedDate: data.signedDate, file: await readFile(input.files![0]!) }), 'Signed engagement filed'); form.reset(); }}>
      <Field label="Title" name="title" /><Field label="Signers (one per line)" name="signers"><textarea name="signers" required rows={2} /></Field><Field label="Signed date" name="signedDate" type="date" />
      <Field label="Signed letter" name="letter"><input type="file" name="letter" required /></Field>
    </Form>
  </section>;
}

export function Requests({ clientId, retention, run }: { clientId: string; retention: Row; run: Run }) {
  return <section aria-label="Deletion requests">
    <h3>Deletion requests</h3>
    <p className="muted">A client's or contact's request reaches you, not a self-service door. Record who asked, how, when, how you verified them and why.</p>
    {!retention.requests.length ? <Empty>No deletion request is recorded.</Empty> : <ul className="list">{retention.requests.map((r: Row) => <li key={r.id}>{r.requester} · {r.channel} · received {day(r.received_on)} · {r.verification} · {r.reason}{r.erasure_id ? ' · erased' : ''}</li>)}</ul>}
    <Form label="Record a request" submit={async (data, form) => { await run(() => api(`/clients/${clientId}/deletion-requests`, { requester: data.requester, channel: data.channel, receivedOn: data.receivedOn, verification: data.verification, reason: data.reason }), 'Request recorded'); form.reset(); }}>
      <Field label="Requested by" name="requester" /><Field label="Channel" name="channel" /><Field label="Received on" name="receivedOn" type="date" /><Field label="How you verified them" name="verification" /><Field label="Reason" name="reason" />
    </Form>
  </section>;
}

export function Copies({ clientId, retention, run }: { clientId: string; retention: Row; run: Run }) {
  return <section aria-label="Copies outside Blotter">
    <h3>Copies outside Blotter</h3>
    <p className="muted">Blotter cannot delete a copy held elsewhere. It names the copies it can observe (mail through the relay, downloads, keys) in the preview and receipt; record any other copy here with the person or company that holds it.</p>
    {!retention.copies.length ? <Empty>No external copies recorded.</Empty> : <ul className="list">{retention.copies.map((c: Row) => <li key={c.id}>
      {COPY_KINDS[c.kind]} · {c.system} · holder {c.holder}{c.note && ` · ${c.note}`} · principal-recorded
      {c.closed_at ? <> · confirmed deleted {when(c.closed_at)}: {c.closed_note}</> : <details><summary>Confirm deleted</summary><Form label="Confirm deleted" submit={async data => run(() => api(`/external-copies/${c.id}/close`, data), 'Copy closed')}><Field label="Who confirmed, and how" name="note" /></Form></details>}
    </li>)}</ul>}
    <Form label="Record a copy" submit={async (data, form) => { await run(() => api(`/clients/${clientId}/external-copies`, data), 'External copy recorded'); form.reset(); }}>
      <Field label="Kind" name="kind"><select name="kind">{Object.entries(COPY_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Where it is held" name="system" /><Field label="Named holder" name="holder" /><Field label="Note" name="note" required={false} />
    </Form>
  </section>;
}
