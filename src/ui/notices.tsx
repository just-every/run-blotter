import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, readFile, Status, today, when, type Row, type Run } from './common';

const KINDS: Record<string, string> = { research: 'Research', client_question: 'Client question', agency_contact: 'Agency contact', response_submitted: 'Response submitted', follow_up: 'Follow-up', transcript: 'Transcript', receipt: 'Receipt', note: 'Note' };
const fileOf = async (form: HTMLFormElement) => { const f = (form.elements.namedItem('file') as HTMLInputElement | null)?.files?.[0]; return f ? { file: await readFile(f) } : {}; };

/** Open a tax notice (DUE-002) from a document already filed on the job. */
export function OpenNotice({ fileId, people, run }: { fileId: string; people: Row[]; run: Run }) {
  return <details><summary>Open as a tax notice</summary>
    <Form label="Open notice" submit={async data => run(() => api('/notices', { ...data, fileId }), 'Notice opened; verify its response date against the notice')}>
      <div className="row"><Field label="Agency" name="agency" value="IRS" /><Field label="Level" name="jurisdiction"><select name="jurisdiction"><option value="federal">Federal</option><option value="state">State</option></select></Field></div>
      <div className="row"><Field label="Notice type" name="noticeType" value="CP2000" /><Field label="Tax period" name="taxPeriod" /></div>
      <div className="row"><Field label="Notice date" name="noticeDate" type="date" /><Field label="Respond by" name="responseDue" type="date" /></div>
      <Field label="Assigned practitioner" name="assigneeEmail"><select name="assigneeEmail">{people.map(p => <option key={p.email} value={p.email}>{p.name} ({p.role})</option>)}</select></Field>
      <Field label="Authorization on file (for example Form 2848, CAF number)" name="authorization" required={false} />
      <Field label="Resolution plan" name="plan" required={false}><textarea name="plan" rows={2} /></Field>
    </Form>
  </details>;
}

function NoticeDetail({ id, actor, run, tick }: { id: string; actor: Row; run: Run; tick: number }) {
  const [d, setD] = useState<Row>();
  useEffect(() => { api('/notices/' + id).then(setD).catch(e => run(async () => { throw e; })); }, [id, tick]);
  if (!d) return <p>Opening notice…</p>;
  const n = d.notice, isOpen = n.status === 'open', withFiles = d.events.filter((e: Row) => e.file_sha256);
  return <div className="stack">
    <p className="muted">{d.client.name} · {n.agency} {n.notice_type} · {n.tax_period} · notice dated {n.notice_date} · source {d.source.name} ({d.source.channel === 'portal' ? 'client upload' : d.source.uploaded_by})</p>
    <p>Respond by <strong>{n.response_due}</strong> {n.due_verified_at ? <small className="muted">verified by {n.due_verified_by} {when(n.due_verified_at)}</small> : <small className="error">not verified against the notice yet</small>}</p>
    <p className="muted">Assigned to {n.assignee_email} · authorization: {n.authorization || 'none recorded'}{n.plan && ` · plan: ${n.plan}`}</p>
    {n.status === 'closed' && <p className="notice">Closed {n.outcome === 'resolved' ? 'as resolved' : 'as a documented exception'} by {n.closed_by} {when(n.closed_at)}: {n.outcome_note}</p>}
    <ol>{d.events.map((e: Row) => <li key={e.id}><strong>{KINDS[e.kind]}</strong>{e.result && ` (${e.result})`}{e.follow_up_on && ` on ${e.follow_up_on}`}: {e.note}
      {e.file_name && <> · <a href={`/api/blotter/notices/${n.id}/events/${e.id}/file`}>{e.file_name}</a></>} <small className="muted">{e.by_email} {when(e.at)}</small></li>)}</ol>
    {isOpen && <>
      <details><summary>Verify the response date</summary>
        <Form label="Record verified date" submit={async data => run(() => api(`/notices/${n.id}/deadline`, data), 'Response date verified')}><Field label="Respond by, as printed on the notice" name="responseDue" type="date" value={n.response_due} /></Form>
      </details>
      <details><summary>Record work</summary>
        <Form label="Add to timeline" submit={async (data, form) => run(async () => { await api(`/notices/${n.id}/events`, { ...data, ...await fileOf(form) }); form.reset(); }, 'Recorded')}>
          <div className="row"><Field label="What happened" name="kind"><select name="kind">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Response result" name="result"><select name="result"><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="failed">Failed</option></select></Field>
            <Field label="Follow up on" name="followUpOn" type="date" value={today()} /></div>
          <Field label="Note" name="note"><textarea name="note" rows={2} required /></Field>
          <Field label="File (transcript, receipt or correspondence)" name="file" required={false}><input name="file" type="file" /></Field>
        </Form>
      </details>
      {(actor.role !== 'preparer' || n.assignee_email === actor.email) && <details><summary>Close the notice</summary>
        <Form label="Close notice" submit={async data => run(() => api(`/notices/${n.id}/close`, data), 'Notice closed')}>
          <Field label="Outcome" name="outcome"><select name="outcome"><option value="resolved">Resolved (acknowledged)</option><option value="exception">Documented exception</option></select></Field>
          <Field label="Evidence (for resolved)" name="evidenceEventId"><select name="evidenceEventId"><option value="">—</option>{withFiles.map((e: Row) => <option key={e.id} value={e.id}>{KINDS[e.kind]}: {e.file_name}</option>)}</select></Field>
          <Field label="Outcome note" name="note"><textarea name="note" rows={2} required /></Field>
        </Form>
      </details>}
    </>}
  </div>;
}

/** Notices list: open first, by response date, with the next follow-up. Blotter tracks the work; it gives no tax advice. */
export function Notices({ actor, run, tick }: { actor: Row; run: Run; tick: number }) {
  const [list, setList] = useState<Row[]>(), [open, setOpen] = useState('');
  useEffect(() => { api('/notices').then(setList).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!list) return null;
  return <section className="panel">
    <h2>Tax notices</h2>
    <p className="muted">Open a notice from a client document on a job. Blotter tracks deadlines, work and evidence; it does not give tax advice.</p>
    {!list.length ? <Empty>No notices.</Empty> : <ul className="list">{list.map(n => <li key={n.id}>
      <button className="quiet text-action" onClick={() => setOpen(open === n.id ? '' : n.id)}>{n.client} · {n.agency} {n.notice_type} {n.tax_period}</button> <Status value={n.status} />
      <small className="muted"> respond by {n.response_due}{!n.due_verified_at && ' (unverified)'} · {n.assignee_email}{n.next_follow_up && ` · follow up ${n.next_follow_up}`}</small>
      {open === n.id && <NoticeDetail id={n.id} actor={actor} run={run} tick={tick} />}
    </li>)}</ul>}
  </section>;
}
