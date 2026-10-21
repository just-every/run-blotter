import { SignatureRequests } from './signatures';
import { JobDeadline } from './deadlines';
import { OrganizerStaff } from './organizers';
import { DocumentPackets } from './document-packets';
import { DocumentCustody } from './document-access';
import { StarterJobSummary } from './starter-library';
import { useEffect, useState } from 'react';
import { Blotter, api, money, Field, Form, prose, readFile, SOURCE, Status, today, when, who, type Row, type Run, day } from './common';
import { Deliverables } from './deliverables';
import { Discussions } from './discussions';
import { ClientLink } from './client-portal';
import { JobStatus } from './statuses';
import { JobExpenses } from './expenses';
import { TaskChoice, TimeBudget, Timer } from './timer';
import { ReminderComposer } from './messages';
import { OpenNotice } from './notices';
import { Answers, TaskFlow } from './flow';
import { attachmentBody, TaskInfo } from './tasks';
import { EntryHistory } from './timesheet';

export function JobDetail({ jobId, actor, people, back, open, run, tick }: { jobId: string; actor: Row; people: Row[]; back: () => void; open: (id: string) => void; run: Run; tick: number }) {
  const [detail, setDetail] = useState<Row>(), [link, setLink] = useState<Row>();
  useEffect(() => { api('/jobs/' + jobId).then(setDetail).catch(e => run(async () => { throw e; })); }, [jobId, tick]);
  useEffect(()=>{if(detail && window.location.hash)document.getElementById(window.location.hash.slice(1))?.scrollIntoView();},[jobId,detail?.job.id]);
  if (!detail) return <p>Opening job…</p>;
  const { job, client } = detail, isOpen = job.status === 'open';
  const lead = actor.role !== 'preparer';
  // After the reviewer's sign-off, work that needs a partner waits for the partner (WORK-007).
  const canReview = job.status === 'review' && (actor.role === 'owner' || actor.email === (job.reviewed_at ? job.partner_email : job.reviewer_email));
  const selfReview = actor.email === job.preparer_email || actor.email === job.submitted_by;
  return <div className="stack">
    {job.access==='full'&&<SignatureRequests detail={detail} run={run} tick={tick} readOnly={!!actor.readOnly}/>}
    <button className="quiet back" onClick={back}>← All jobs</button>
    <Blotter className="job-working"><section className="panel">
      <div className="split">
        <div><h2>{client.name} · {job.title}</h2><p className="muted">{job.period_label} · due {day(job.due_date)} ({job.due_note})</p></div>
        <Status value={job.status} />
      </div>
      <p className="muted">Preparer {who(people, job.preparer_email)} · reviewer {who(people, job.reviewer_email)} · manager {who(people, job.manager_email || job.reviewer_email)}{job.partner_email && <> · partner {who(people, job.partner_email)}</>}{job.fee_cents > 0 && <> · fixed fee {money(job.fee_cents, job.currency)}</>}{job.budget_minutes && <> · time budget {job.budget_minutes} min</>}</p>
      <StarterJobSummary content={detail.starter} />
      <JobDeadline detail={detail} actor={actor} run={run} />
      {job.status === 'signed_off' && <p className="notice">Signed off by {who(people, job.signed_off_by)} on {when(job.signed_off_at)}: {prose(job.sign_off_note)}</p>}
      {lead && (detail.nextJobId
        ? <p><button className="quiet" onClick={() => open(detail.nextJobId)}>Open next period's job</button></p>
        : <details><summary>Roll forward to the next period</summary>
          <Form label="Create next period's job" submit={async data => run(async () => { const next = await api(`/jobs/${job.id}/roll-forward`, data); open(next.id); }, 'Next period created from the template')}>
            <Field label="Due date (record it; roll forward does not compute it)" name="dueDate" type="date" />
            <Field label="Where the due date comes from" name="dueNote" value={job.due_note} />
          </Form>
        </details>)}
    </section>
    <DocumentPackets detail={detail} run={run} tick={tick} />
    <div className="grid">
      <section className="panel">
        <h2 id="job-checklist">Checklist</h2>
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
            <span>{s.label}{s.done_at && <small className="muted"> — {who(people, s.done_by)}, {when(s.done_at)}</small>}<TaskInfo jobId={job.id} step={s} /><TaskFlow jobId={job.id} step={s} lead={lead} open={isOpen} run={run} /></span></label>
          {isOpen && s.state === 'ready' && !!s.requires_attachment && <label className="upload">Complete with the required attachment<input type="file" onChange={e => { const file = e.target.files?.[0]; if (file) run(async () => api(`/jobs/${job.id}/steps`, { ordinal: s.ordinal, done: true, ...await attachmentBody(file) }), 'Step done'); }} /></label>}
        </li>)}</ul>
        {isOpen && <button onClick={() => run(() => api(`/jobs/${job.id}/submit`, { revision: job.revision }), 'Submitted for review')}>Submit for review</button>}
        {canReview && <div className="review">
          <h3>Review</h3>
          <Form label="Record decision" submit={async data => run(() => api(`/jobs/${job.id}/review`, { revision: job.revision, decision: data.decision, note: data.note, selfReview: data.selfReview === 'on' }), data.decision !== 'signoff' ? 'Job returned to the preparer' : job.partner_email && !job.reviewed_at ? 'Reviewed; waiting for partner sign-off' : 'Job signed off')}>
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
          <div className="split"><strong>{r.label}</strong><Status value={r.organizer_active ? r.status : 'not_required'} /></div>
          {r.note && <small className="muted">{r.note}</small>}
          {r.files.map((f: Row) => <div key={f.id} className="file">
            {f.erased_at ? <span>{f.name} — erased {when(f.erased_at)}</span> : <a href={`/api/blotter/files/${f.id}`}>{f.name}</a>}
            <small className="muted"> {Math.ceil(f.size / 1024)} KB · {f.channel === 'portal' ? 'client upload' : who(people, f.uploaded_by)} · {when(f.uploaded_at)}</small>
            {lead && !f.erased_at && <OpenNotice fileId={f.id} people={people} run={run} />}
          </div>)}
          {isOpen && r.organizer_active === 1 && <div className="actions">
            {r.status === 'received' && <button onClick={() => run(() => api(`/requests/${r.id}/decide`, { decision: 'accept' }), 'Document accepted')}>Accept</button>}
            {r.status === 'received' && <details><summary>Ask again</summary><Form label="Ask the client again" submit={async data => run(() => api(`/requests/${r.id}/decide`, { decision: 'return', note: data.note }), 'Returned to the client')}><Field label="What should the client send instead?" name="note" /></Form></details>}
            {r.status !== 'accepted' && <label className="upload">Add a file received another way<input type="file" onChange={e => { const file = e.target.files?.[0]; if (file) run(async () => api(`/requests/${r.id}/files`, await readFile(file)), 'File added'); }} /></label>}
          </div>}
        </article>)}
        {isOpen && <details><summary>Send a reminder with an upload link</summary>
          <ReminderComposer contacts={detail.contacts} copied={detail.starter?.messages} jobId={job.id} run={run} sent={setLink} />
        </details>}
        {link && <div className="notice"><p>Delivery: {link.delivery}. This upload link is shown once and replaces earlier links. It expires {day(link.expiresAt)}.</p><input readOnly value={link.portalUrl} onFocus={e => e.currentTarget.select()} aria-label="Client upload link" /></div>}
        {detail.reminders.length > 0 && <details><summary>Reminder history ({detail.reminders.length})</summary><ul>{detail.reminders.map((m: Row) => <li key={m.id}>{when(m.sent_at)} to {m.to_email} by {who(people, m.sent_by)}{m.proposal_id ? ' (approved preparation)' : ''}: {m.delivery}{JSON.parse(m.attachments ?? '[]').length > 0 && <small className="muted"> · attached {JSON.parse(m.attachments).map((f: Row) => f.name).join(', ')}</small>}</li>)}</ul></details>}
      </section>
    </div></Blotter>
    <Deliverables contacts={detail.contacts} job={job} deliverables={detail.deliverables} run={run} />
    <DocumentCustody jobId={job.id} run={run} tick={tick} />
    {job.access === 'full' && <OrganizerStaff jobId={job.id} run={run} actorRole={actor.role} />}
    <JobStatus detail={detail} run={run} tick={tick} />
    <ClientLink detail={detail} run={run} />
    <Discussions detail={detail} actor={actor} run={run} tick={tick} />
    <section className="panel">
      <h2>Time</h2>
      <TimeBudget budget={detail.budget} />
      {detail.time.length === 0 ? <p className="muted">No time recorded yet.</p> : <table className="table"><thead><tr><th>Date</th><th>Person</th><th>Description</th><th>Minutes</th><th className="amount">Rate</th><th className="amount">Amount</th><th></th></tr></thead>
        <tbody>{detail.time.map((t: Row) => <tr key={t.id}><td data-label="Date">{day(t.date)}</td><td data-label="Person">{who(people, t.person_email)}</td><td data-label="Description">{t.description}{t.task && <small className="muted"> · task: {t.task}</small>}{!t.billable && <small className="muted"> · not billable</small>}</td><td data-label="Minutes">{t.minutes}</td><td data-label="Rate" className="amount">{money(t.rate_cents, t.currency)}/h <small className="muted">({SOURCE[t.rate_source]} rate)</small></td><td data-label="Amount" className="amount">{money(t.amount_cents, t.currency)}</td>
          <td><small className="muted">{t.review_status ?? 'not submitted'}{t.export_id && ' · exported'}</small>
            {!t.export_id && ['returned', null].includes(t.review_status) && (t.person_email === actor.email || actor.role === 'owner') && <button className="quiet" onClick={() => run(() => api(`/time/${t.id}/delete`, {}), 'Time entry deleted')}>Delete</button>}
            <EntryHistory entryId={t.id} owner={actor.role === 'owner'} approved={t.review_status === 'approved'} people={people} run={run} /></td></tr>)}</tbody></table>}
      <Timer job={job} timer={detail.timer} steps={detail.steps} run={run} />
      <Form label="Record time" submit={async (data, form) => run(async () => { await api(`/jobs/${job.id}/time`, { ...data, minutes: Number(data.minutes), billable: data.billable === 'on', taskOrdinal: data.taskOrdinal ? Number(data.taskOrdinal) : undefined }); form.reset(); }, 'Time recorded at the rate in force on its date')}>
        <div className="row"><Field label="Date" name="date" type="date" value={today()} /><Field label="Minutes" name="minutes" type="number" /></div>
        <Field label="Description" name="description" />
        <TaskChoice steps={detail.steps} />
        <label className="check"><input type="checkbox" name="billable" defaultChecked /> Billable to the client</label>
      </Form>
    </section>
    <JobExpenses detail={detail} actor={actor} people={people} run={run} />
  </div>;
}
