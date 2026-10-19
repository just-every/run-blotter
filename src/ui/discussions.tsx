import { useEffect, useState } from 'react';
import { api, Field, Form, Status, today, when, type Row, type Run } from './common';

const mentionList = (value: unknown) => String(value ?? '').split(/[\s,]+/).filter(Boolean);

/** Internal discussions on a job and its client (COLLAB-001). Never shown on the client link. */
export function Discussions({ detail, actor, run, tick }: { detail: Row; actor: Row; run: Run; tick: number }) {
  const { job } = detail, lead = actor.role !== 'preparer';
  const [threads, setThreads] = useState<Row[]>([]), [open, setOpen] = useState<Row>();
  const load = () => api(`/jobs/${job.id}/threads`).then(setThreads);
  useEffect(() => { load().catch(() => setThreads([])); }, [job.id, tick]);
  const show = (id: string) => run(async () => { setOpen(await api('/threads/' + id)); await load(); }, 'Discussion opened');
  const about = (anchor: string) => anchor === 'client' ? 'the whole client' : anchor === 'review' ? 'the review'
    : anchor.startsWith('step:') ? `step: ${detail.steps.find((s: Row) => s.ordinal === Number(anchor.slice(5)))?.label ?? anchor}`
    : anchor.startsWith('request:') ? `document: ${detail.requests.find((r: Row) => r.id === anchor.slice(8))?.label ?? anchor}` : 'this job';
  return <section className="panel">
    <h2>Internal discussion</h2>
    <p className="muted">Only staff who can see this work read these threads. The client never sees them.</p>
    {threads.length === 0 && <p className="muted">No discussions yet.</p>}
    <ul>{threads.map(t => <li key={t.id}>
      <button className="quiet" onClick={() => show(t.id)}>{t.title}</button> {t.unread && <strong>Unread</strong>} <Status value={t.status} />
      <small className="muted"> {t.kind === 'correction' ? `Correction for ${t.owner_email}, follow up by ${t.follow_up_due}` : `Owner ${t.owner_email}`} · about {about(t.anchor)} · {t.messages} {t.messages === 1 ? 'message' : 'messages'} · {when(t.last_at)}</small>
    </li>)}</ul>
    {open && <article className="record">
      <h3>{open.thread.title}</h3>
      {open.messages.map((m: Row) => <p key={m.id}><strong>{m.author_email}</strong> <small className="muted">{when(m.created_at)}{m.mentions.length > 0 && ` · mentioned ${m.mentions.join(', ')}`}</small><br />{m.body}</p>)}
      {open.thread.status === 'resolved'
        ? <p className="notice">Resolved by {open.thread.resolved_by} on {when(open.thread.resolved_at)}: {open.thread.resolution}</p>
        : <>
          <Form label="Reply" submit={async (data, form) => run(async () => { setOpen(await api(`/threads/${open.thread.id}/messages`, { body: data.body, mentions: mentionList(data.mentions) })); form.reset(); await load(); }, 'Reply posted')}>
            <Field label="Reply" name="body"><textarea name="body" required rows={3} /></Field>
            <Field label="Mention (emails, optional)" name="mentions" required={false} />
          </Form>
          {(open.thread.owner_email === actor.email || actor.role === 'owner') && <details><summary>Resolve</summary>
            <Form label="Resolve with this decision" submit={async data => run(async () => { setOpen(await api(`/threads/${open.thread.id}/resolve`, { resolution: data.resolution })); await load(); }, 'Discussion resolved')}>
              <Field label="Decision" name="resolution"><textarea name="resolution" required rows={2} /></Field>
            </Form>
          </details>}
        </>}
    </article>}
    <details><summary>Start a discussion</summary>
      <Form label="Start discussion" submit={async (data, form) => run(async () => {
        setOpen(await api(`/jobs/${job.id}/threads`, { title: data.title, anchor: data.anchor, body: data.body, mentions: mentionList(data.mentions), correction: data.correction === 'on', followUpDue: data.followUpDue || undefined }));
        form.reset(); await load();
      }, 'Discussion started')}>
        <Field label="Subject" name="title" />
        <Field label="About" name="anchor"><select name="anchor">
          <option value="job">This job</option><option value="review">The review</option>
          {detail.steps.map((s: Row) => <option key={s.ordinal} value={`step:${s.ordinal}`}>Step: {s.label}</option>)}
          {detail.requests.map((r: Row) => <option key={r.id} value={`request:${r.id}`}>Document: {r.label}</option>)}
          <option value="client">The whole client</option>
        </select></Field>
        <Field label="Message" name="body"><textarea name="body" required rows={3} /></Field>
        <Field label="Mention (emails, optional)" name="mentions" required={false} hint="Only colleagues who can see this work can be mentioned" />
        {lead && <>
          <label className="check"><input type="checkbox" name="correction" /> Request a correction from the preparer</label>
          <Field label="Follow up by (for a correction)" name="followUpDue" type="date" required={false} value={today()} />
        </>}
      </Form>
    </details>
  </section>;
}

/** The signed-in person's review and discussion alerts. */
export function MyAlerts({ tick, open }: { tick: number; open: (id: string) => void }) {
  const [alerts, setAlerts] = useState<Row[]>([]);
  useEffect(() => { api('/notifications').then(setAlerts).catch(() => setAlerts([])); }, [tick]);
  if (alerts.length === 0) return null;
  return <section className="panel">
    <h2>Alerts</h2>
    <ul>{alerts.slice(0, 10).map(a => <li key={a.id}>
      {a.job_id ? <button className="quiet" onClick={() => open(a.job_id)}>{a.summary}</button> : a.summary}
      <small className="muted"> {when(a.created_at)} · email {a.delivery}</small>
    </li>)}</ul>
  </section>;
}
