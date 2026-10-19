import { useEffect, useState } from 'react';
import { api, Field, Form, readFile, Status, when, type Row, type Run, day } from './common';

const short = (sha: string) => sha.slice(0, 12);

/** Staff side of DOC-003: send versions for client approval and read each decision. */
export function Deliverables({ job, deliverables, run, contacts = [] }: { job: Row; deliverables: Row[]; run: Run; contacts?: Row[] }) {
  const [link, setLink] = useState<Row>(), isOpen = job.status === 'open';
  const send = (data: Row, extra: Row) => run(async () => {
    insistFile(data.file);
    setLink(await api(`/jobs/${job.id}/deliverables`, { ...(await readFile(data.file)), contactId:data.contactId, note: data.note, submitOnApproval: data.submitOnApproval === 'on', ...extra }));
  }, 'Sent to the client for approval');
  return <section className="panel">
    <h2 id="job-deliverables">Deliverables for client approval</h2>
    {deliverables.length === 0 && <p className="muted">No deliverables sent yet.</p>}
    {deliverables.map(d => <article key={d.id} className="record">
      <div className="split"><strong>{d.title}</strong><Status value={d.status} /></div>
      <ul>{d.versions.map((v: Row) => <li key={v.id}>
        <a href={`/api/blotter/deliverables/versions/${v.id}/file`}>Version {v.version}: {v.name}</a>
        <small className="muted"> SHA-256 {short(v.sha256)} · sent by {v.sent_by} {when(v.sent_at)} · {v.delivery}</small>
        {v.status === 'approved' && <p className="notice">Approved by {v.approver_name}{v.approver_email && ` <${v.approver_email}>`} on {when(v.decided_at)} for SHA-256 {short(v.decided_sha256)}{v.comment && `: ${v.comment}`}.{v.moved_job === 1 ? ' The approval submitted the job for review.' : v.submit_on_approval === 1 ? ' The job stayed open: finish the checklist and accept every document, then submit it.' : ''}</p>}
        {v.status === 'changes_requested' && <p className="notice">Changes requested by {v.approver_name} on {when(v.decided_at)}: {v.comment}</p>}
      </li>)}</ul>
      {isOpen && <details><summary>Send a new version</summary>
        <Form label="Send version for approval" submit={async data => send(data, { deliverableId: d.id })}><VersionFields contacts={contacts} /></Form>
      </details>}
    </article>)}
    {isOpen && <details><summary>Send a deliverable for approval</summary>
      <Form label="Send for approval" submit={async data => send(data, { title: data.title })}>
        <Field label="Deliverable" name="title" hint="For example: Financial statements FY2026" />
        <VersionFields contacts={contacts} />
      </Form>
    </details>}
    {link && <div className="notice"><p>Version {link.version} sent (SHA-256 {short(link.sha256)}). Delivery: {link.delivery}. This client link is shown once and replaces earlier links. It expires {day(link.expiresAt)}.</p><input readOnly value={link.portalUrl} onFocus={e => e.currentTarget.select()} aria-label="Client approval link" /></div>}
  </section>;
}

function insistFile(file: unknown): asserts file is File {
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose the file to send');
}

function VersionFields({contacts}: {contacts:Row[]}) {
  return <>
    <Field label="Recipient for this entity" name="contactId"><select name="contactId"><option value="">Primary contact</option>{contacts.filter(c => c.active && c.authorized && c.portal && c.request_consent && c.email_consent).map(c => <option key={c.id} value={c.id}>{c.name} &lt;{c.email}&gt;</option>)}</select></Field>
    <Field label="File (up to 1 MiB)" name="file"><input name="file" type="file" required /></Field>
    <Field label="Note to the client (optional)" name="note" required={false}><textarea name="note" rows={2} /></Field>
    <label className="check"><input type="checkbox" name="submitOnApproval" /> Submit the job for review when the client approves</label>
  </>;
}

/** Client side: approve the newest version, or request changes with a comment. */
export function PortalDeliverables({ path, busy, act }: { path: string; busy: boolean; act: (work: () => Promise<string>) => Promise<void> }) {
  const [list, setList] = useState<Row[]>([]);
  const load = async () => { const r = await fetch(`${path}/deliverables`); if (r.ok) setList(await r.json()); };
  useEffect(() => { load(); }, [path]);
  const decide = (v: Row, data: Row) => act(async () => {
    const r = await fetch(`${path}/deliverables/${v.id}/decide`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, sha256: v.sha256 }) });
    const b: any = await r.json(); await load(); if (!r.ok) throw new Error(b.error ?? 'Your answer was not recorded');
    return b.status === 'approved' ? `You approved version ${v.version}. Thank you.` : 'Your requested changes were sent to your accountant.';
  });
  if (list.length === 0) return null;
  return <>
    <h2>For your approval</h2>
    {list.map(d => <section key={d.id} className="panel">
      <div className="split"><h3>{d.title}</h3><Status value={d.status} /></div>
      {d.versions.map((v: Row) => <div key={v.id} className="record">
        <p><a href={`${path}/deliverables/${v.id}/file`}>Version {v.version}: {v.name}</a> <small className="muted">sent {when(v.sentAt)} · SHA-256 {v.sha256.slice(0, 12)}</small></p>
        {v.note && <p className="muted">{v.note}</p>}
        {v.status === 'approved' && <p className="notice">Approved by {v.approverName} on {when(v.decidedAt)}.</p>}
        {v.status === 'changes_requested' && <p className="notice">{v.approverName} asked for changes on {when(v.decidedAt)}: {v.comment}</p>}
        {v.id === d.currentVersionId && v.status === 'sent' && <Form label="Send my answer" disabled={busy} submit={async (data, form) => { await decide(v, data); form.reset(); }}>
          <Field label="Your name" name="name" />
          <Field label="Your answer" name="decision"><select name="decision"><option value="approve">Approve this version</option><option value="changes">Request changes</option></select></Field>
          <Field label="Comment (required when requesting changes)" name="comment" required={false}><textarea name="comment" rows={3} /></Field>
        </Form>}
      </div>)}
    </section>)}
  </>;
}
