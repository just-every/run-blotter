import { useEffect, useState } from 'react';
import { api, Field, Form, moneyText, readFile, Status, when, type Row, type Run, day } from './common';
import { useT } from './i18n';

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
      <PaymentGate deliverable={d} job={job} run={run} />
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
  const t = useT(), [list, setList] = useState<Row[]>([]);
  const load = async () => { const r = await fetch(`${path}/deliverables`); if (r.ok) setList(await r.json()); };
  useEffect(() => { load(); }, [path]);
  const decide = (v: Row, data: Row) => act(async () => {
    const r = await fetch(`${path}/deliverables/${v.id}/decide`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, sha256: v.sha256 }) });
    const b: any = await r.json(); await load(); if (!r.ok) throw new Error(b.error ?? t('del.failed'));
    return b.status === 'approved' ? t('del.approvedDone', { version: v.version }) : t('del.changesDone');
  });
  if (list.length === 0) return null;
  return <>
    <h2>{t('del.title')}</h2>
    {list.map(d => <section key={d.id} className="panel" aria-labelledby={`deliverable-${d.id}`}>
      <div className="split"><h3 id={`deliverable-${d.id}`}>{d.title}</h3><Status value={d.status} /></div>
      {d.locked && <p className="notice" role="status">{t('del.lockedNotice', { invoice: d.locked.invoiceNumber })}{d.locked.remainingCents > 0 ? t('del.stillDue', { amount: moneyText(d.locked.remainingCents) }) : ''}{d.locked.pendingCents > 0 ? t('del.achPending') : ''}{t('del.yourDocs')}</p>}
      {d.versions.map((v: Row) => <div key={v.id} className="record">
        {d.locked ? <p><strong>{t('del.version', { version: v.version, name: v.name })}</strong> <small className="muted">{t('del.sent', { when: when(v.sentAt) })} · {t('del.locked')}</small></p>
          : <p><a href={`${path}/deliverables/${v.id}/file`}>{t('del.version', { version: v.version, name: v.name })}</a> <small className="muted">{t('del.sent', { when: when(v.sentAt) })} · SHA-256 {v.sha256.slice(0, 12)}</small></p>}
        {v.note && <p className="muted">{v.note}</p>}
        {v.status === 'approved' && <p className="notice">{t('del.approvedBy', { name: v.approverName, when: when(v.decidedAt) })}</p>}
        {v.status === 'changes_requested' && <p className="notice">{t('del.changesBy', { name: v.approverName, when: when(v.decidedAt), comment: v.comment })}</p>}
        {v.id === d.currentVersionId && v.status === 'sent' && <Form label={t('del.send')} disabled={busy} submit={async (data, form) => { await decide(v, data); form.reset(); }}>
          <Field label={t('del.name')} name="name" />
          <Field label={t('del.answer')} name="decision"><select name="decision"><option value="approve">{t('del.approve')}</option><option value="changes">{t('del.changes')}</option></select></Field>
          <Field label={t('del.comment')} name="comment" required={false}><textarea name="comment" rows={3} /></Field>
        </Form>}
      </div>)}
    </section>)}
  </>;
}

/** BILL-005 staff side: require payment of an issued invoice before the client can open this firm-prepared file. */
function PaymentGate({ deliverable, job, run }: { deliverable: Row; job: Row; run: Run }) {
  const [invoices, setInvoices] = useState<Row[]>([]), gate = deliverable.paymentGate;
  useEffect(() => { api('/invoices').then(r => setInvoices(r.invoices.filter((i: Row) => i.client_id === job.client_id && i.status === 'issued' && !i.erased_at))).catch(() => setInvoices([])); }, [job.client_id, deliverable.id]);
  if (!gate && !invoices.length) return null;
  if (!gate) return <details><summary>Require payment before release</summary>
    <p className="muted">The client sees this file as locked until the invoice is paid. Only the firm's own work product can be gated; records the client supplied are never withheld.</p>
    <Form label="Require payment" submit={data => run(() => api(`/jobs/${job.id}/payment-gates`, { ...data, deliverableId: deliverable.id }), 'Payment now required before release')}>
      <Field label="Invoice that must be paid" name="invoiceId"><select name="invoiceId">{invoices.map(i => <option key={i.id} value={i.id}>INV-{String(i.number).padStart(6, '0')} · {i.title}</option>)}</select></Field>
      <Field label="Reason for the payment gate" name="reason" />
    </Form></details>;
  return <div className="notice" role="status">
    <p><strong>{gate.locked ? 'Locked for the client' : gate.releasedBy === 'override' ? 'Released by partner override' : 'Released: paid'}</strong> · until {gate.invoiceNumber} is paid ({gate.remainingCents > 0 ? `USD ${(gate.remainingCents / 100).toFixed(2)} still counts as owed` : 'fully covered'}{gate.pendingCents > 0 && `; USD ${(gate.pendingCents / 100).toFixed(2)} in pending ACH`}) · {gate.reason}</p>
    {gate.override && <p>Override by {gate.override.approved_by} {when(gate.override.approved_at)}: {gate.override.reason}</p>}
    <details><summary>Partner controls</summary>
      {gate.override ? <Form danger label="Relock the file" submit={data => run(() => api(`/payment-gates/${gate.id}/override`, { ...data, revoke: true }), 'File relocked')}><Field label="Reason to relock" name="reason" /></Form>
        : <Form label="Release this file" submit={data => run(() => api(`/payment-gates/${gate.id}/override`, data), 'Partner override recorded')}><Field label="Override reason" name="reason" /></Form>}
      <Form danger label="Remove the payment gate" submit={data => run(() => api(`/payment-gates/${gate.id}/remove`, data), 'Payment gate removed')}><Field label="Reason to remove" name="reason" /></Form>
    </details>
  </div>;
}
