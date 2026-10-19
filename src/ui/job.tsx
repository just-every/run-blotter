import { useEffect, useState } from 'react';
import { Blotter, api, aud, Field, Form, readFile, SOURCE, Status, today, when, type Row, type Run } from './common';
import { Deliverables } from './deliverables';
import { Discussions } from './discussions';
import { JobExpenses } from './expenses';
import { ReminderComposer } from './messages';
import { OpenNotice } from './notices';
import { Answers, TaskFlow } from './flow';
import { attachmentBody, TaskInfo } from './tasks';
import { EntryHistory } from './timesheet';

export function JobDetail({ jobId, actor, people, back, open, run, tick }: { jobId: string; actor: Row; people: Row[]; back: () => void; open: (id: string) => void; run: Run; tick: number }) {
  const [detail, setDetail] = useState<Row>(), [link, setLink] = useState<Row>();
  useEffect(() => { api('/jobs/' + jobId).then(setDetail).catch(e => run(async () => { throw e; })); }, [jobId, tick]);
  if (!detail) return <p>Opening job…</p>;
  const { job, client } = detail, isOpen = job.status === 'open';
  const lead = actor.role !== 'preparer';
  const canReview = job.status === 'review' && (actor.role === 'owner' || actor.email === job.reviewer_email);
  const selfReview = actor.email === job.preparer_email || actor.email === job.submitted_by;
  return <div className="stack">
    <button className="quiet back" onClick={back}>← All jobs</button>
    <Blotter className="job-working"><section className="panel">
      <div className="split">
        <div><h2>{client.name} · {job.title}</h2><p className="muted">{job.period_label} · due {job.due_date} ({job.due_note})</p></div>
        <Status value={job.status} />
      </div>
      <p className="muted">Preparer {job.preparer_email} · reviewer {job.reviewer_email} · manager {job.manager_email || job.reviewer_email}{job.fee_cents > 0 && <> · fixed fee {aud(job.fee_cents)}</>}</p>
      {job.status === 'signed_off' && <p className="notice">Signed off by {job.signed_off_by} on {when(job.signed_off_at)}: {job.sign_off_note}</p>}
      {lead && (detail.nextJobId
        ? <p><button className="quiet" onClick={() => open(detail.nextJobId)}>Open next period's job</button></p>
        : <details><summary>Roll forward to the next period</summary>
          <Form label="Create next period's job" submit={async data => run(async () => { const next = await api(`/jobs/${job.id}/roll-forward`, data); open(next.id); }, 'Next period created from the template')}>
            <Field label="Due date (record it; Blotter does not compute due dates)" name="dueDate" type="date" />
            <Field label="Where the due date comes from" name="dueNote" value={job.due_note} />
          </Form>
        </details>)}
    </section>
    <div className="grid">
      <section className="panel">
        <h2>Checklist</h2>
        <Answers jobId={job.id} answers={detail.answers} open={isOpen && job.access === 'full'} run={run} />
        <ul className="checklist">{detail.steps.map((s: Row) => <li key={s.ordinal}>
          <label className="check"><input type="checkbox" checked={!!s.done_at} disabled={!isOpen || (!s.done_at && (!!s.requires_attachment || s.state !== 'ready'))} onChange={e => {
            const done = e.target.checked;
            setDetail({ ...detail, steps: detail.steps.map((step: Row) => step.ordinal === s.ordinal ? { ...step, done_at: done ? new Date().toISOString() : null, done_by: done ? actor.email : null } : step) });
            run(async () => {
              try { await api(`/jobs/${job.id}/steps`, { ordinal: s.ordinal, done }); }
              catch (error) { setDetail(detail); throw error; }
            }, done ? 'Step done' : 'Step reopened');
          }} />
            <span>{s.label}{s.done_at && <small className="muted"> — {s.done_by}, {when(s.done_at)}</small>}<TaskInfo jobId={job.id} step={s} /><TaskFlow jobId={job.id} step={s} lead={lead} open={isOpen} run={run} /></span></label>
          {isOpen && s.state === 'ready' && !!s.requires_attachment && <label className="upload">Complete with the required attachment<input type="file" onChange={e => { const file = e.target.files?.[0]; if (file) run(async () => api(`/jobs/${job.id}/steps`, { ordinal: s.ordinal, done: true, ...await attachmentBody(file) }), 'Step done'); }} /></label>}
        </li>)}</ul>
        {isOpen && <button onClick={() => run(() => api(`/jobs/${job.id}/submit`, { revision: job.revision }), 'Submitted for review')}>Submit for review</button>}
        {canReview && <div className="review">
          <h3>Review</h3>
          <Form label="Record decision" submit={async data => run(() => api(`/jobs/${job.id}/review`, { revision: job.revision, decision: data.decision, note: data.note, selfReview: data.selfReview === 'on' }), data.decision === 'signoff' ? 'Job signed off' : 'Job returned to the preparer')}>
            <Field label="Decision" name="decision"><select name="decision"><option value="signoff">Sign off</option><option value="return">Return to preparer</option></select></Field>
            <Field label="Review note" name="note"><textarea name="note" required rows={3} /></Field>
            {selfReview && actor.role === 'owner' && <label className="check"><input type="checkbox" name="selfReview" /> I am reviewing my own work (recorded)</label>}
          </Form>
        </div>}
      </section>
      <section className="panel">
        <h2>Client documents</h2>
        <p className="muted">Contact: {client.contact_name || '—'} {client.contact_email ? `<${client.contact_email}>` : '(no email yet)'}</p>
        {detail.requests.map((r: Row) => <article key={r.id} className="record">
          <div className="split"><strong>{r.label}</strong><Status value={r.status} /></div>
          {r.note && <small className="muted">{r.note}</small>}
          {r.files.map((f: Row) => <div key={f.id} className="file">
            {f.erased_at ? <span>{f.name} — erased {when(f.erased_at)}</span> : <a href={`/api/blotter/files/${f.id}`}>{f.name}</a>}
            <small className="muted"> {Math.ceil(f.size / 1024)} KB · {f.channel === 'portal' ? 'client upload' : f.uploaded_by} · {when(f.uploaded_at)}</small>
            {lead && !f.erased_at && <OpenNotice fileId={f.id} people={people} run={run} />}
          </div>)}
          {isOpen && <div className="actions">
            {r.status === 'received' && <button onClick={() => run(() => api(`/requests/${r.id}/decide`, { decision: 'accept' }), 'Document accepted')}>Accept</button>}
            {r.status === 'received' && <details><summary>Ask again</summary><Form label="Ask the client again" submit={async data => run(() => api(`/requests/${r.id}/decide`, { decision: 'return', note: data.note }), 'Returned to the client')}><Field label="What should the client send instead?" name="note" /></Form></details>}
            {r.status !== 'accepted' && <label className="upload">Add a file received another way<input type="file" onChange={e => { const file = e.target.files?.[0]; if (file) run(async () => api(`/requests/${r.id}/files`, await readFile(file)), 'File added'); }} /></label>}
          </div>}
        </article>)}
        {isOpen && <details><summary>Send a reminder with an upload link</summary>
          <ReminderComposer jobId={job.id} run={run} sent={setLink} />
        </details>}
        {link && <div className="notice"><p>Delivery: {link.delivery}. This upload link is shown once and replaces earlier links. It expires {link.expiresAt.slice(0, 10)}.</p><input readOnly value={link.portalUrl} onFocus={e => e.currentTarget.select()} aria-label="Client upload link" /></div>}
        {detail.reminders.length > 0 && <details><summary>Reminder history ({detail.reminders.length})</summary><ul>{detail.reminders.map((m: Row) => <li key={m.id}>{when(m.sent_at)} to {m.to_email} by {m.sent_by}{m.proposal_id ? ' (approved preparation)' : ''}: {m.delivery}</li>)}</ul></details>}
      </section>
    </div></Blotter>
    <Deliverables job={job} deliverables={detail.deliverables} run={run} />
    <Discussions detail={detail} actor={actor} run={run} tick={tick} />
    <section className="panel">
      <h2>Time</h2>
      {detail.time.length === 0 ? <p className="muted">No time recorded yet.</p> : <table className="table"><thead><tr><th>Date</th><th>Person</th><th>Description</th><th>Minutes</th><th>Rate</th><th>Amount</th><th></th></tr></thead>
        <tbody>{detail.time.map((t: Row) => <tr key={t.id}><td data-label="Date">{t.date}</td><td data-label="Person">{t.person_email}</td><td data-label="Description">{t.description}</td><td data-label="Minutes">{t.minutes}</td><td data-label="Rate">{aud(t.rate_cents)}/h <small className="muted">({SOURCE[t.rate_source]} rate)</small></td><td data-label="Amount">{aud(t.amount_cents)}</td>
          <td><small className="muted">{t.review_status ?? 'not submitted'}{t.export_id && ' · exported'}</small>
            {!t.export_id && ['returned', null].includes(t.review_status) && (t.person_email === actor.email || actor.role === 'owner') && <button className="quiet" onClick={() => run(() => api(`/time/${t.id}/delete`, {}), 'Time entry deleted')}>Delete</button>}
            <EntryHistory entryId={t.id} owner={actor.role === 'owner'} approved={t.review_status === 'approved'} run={run} /></td></tr>)}</tbody></table>}
      <Form label="Record time" submit={async (data, form) => run(async () => { await api(`/jobs/${job.id}/time`, { ...data, minutes: Number(data.minutes) }); form.reset(); }, 'Time recorded at the rate in force on its date')}>
        <div className="row"><Field label="Date" name="date" type="date" value={today()} /><Field label="Minutes" name="minutes" type="number" /></div>
        <Field label="Description" name="description" />
      </Form>
    </section>
    <JobExpenses detail={detail} actor={actor} run={run} />
  </div>;
}
