import { PortalMessageComposer } from './messages';
import { api, Field, MessageText, Form, prose, Status, when, type Row, type Run, day } from './common';

/** Milestones and the client's next action (PORTAL-003); staff see the same view on the job. */
export function PortalProgress({ progress, title = 'Where things stand' }: { progress: Row; title?: string }) {
  return <section className="panel">
    <h2>{title}</h2>
    <p><strong>Status:</strong> {progress.status}</p>
    <p><strong>Next step:</strong> {progress.nextAction}</p>
    <ol className="list">{progress.milestones.map((m: Row) => <li key={m.key}>{m.done ? '✓' : '○'} {m.label} <small className="muted">· {prose(m.detail)}</small></li>)}</ol>
  </section>;
}

const thread = (messages: Row[], replyTo: (m: Row) => string | null): Row[] => messages.map(m => ({ ...m, answer: messages.filter(r => replyTo(r) === m.id) }));

/** The client's secure messages and to-dos on their link. */
export function PortalConversation({ view, path, busy, act, reload }: { view: Row; path: string; busy: boolean; act: (work: () => Promise<string>) => Promise<void>; reload: () => Promise<void> }) {
  const post = (url: string, body: Row, done: string) => act(async () => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const b: any = await r.json(); if (!r.ok) throw new Error(b.error ?? 'That did not go through');
    await reload(); return done;
  });
  return <>
    {view.todos.length > 0 && <section className="panel">
      <h2>Your to-dos</h2>
      <ul className="list">{view.todos.map((t: Row) => <li key={t.id}>
        {t.status === 'done' ? '✓' : '○'} {t.body}{t.dueDate && <small className="muted"> · due {day(t.dueDate)}</small>}
        {t.status === 'done' ? <small className="muted"> · completed {when(t.closedAt)}{t.response && `: ${t.response}`}</small>
          : <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); post(`${path}/todos/${t.id}`, { response: data.get('response') }, 'To-do completed. Your accountant has been told.'); }}>
            <label>Reply (optional)<input name="response" maxLength={2000} disabled={busy} /></label>
            <button disabled={busy}>Mark done</button>
          </form>}
      </li>)}</ul>
    </section>}
    <section className="panel">
      <h2>Messages</h2>
      <p className="muted">Secure messages about this work only. Your accountant replies here; no email is sent.</p>
      {thread(view.messages, m => m.replyTo).filter(m => !m.replyTo).map(m => <article key={m.id} className="record">
        <p><strong>{m.from === 'you' ? 'You' : 'Your accountant'}</strong> <small className="muted">{when(m.createdAt)}</small>{m.kind === 'question' && <> <Status value={m.status} /></>}<br />{m.subject && <strong>{m.subject}</strong>}</p>{m.subject ? <MessageText>{m.body}</MessageText> : <p>{m.body}</p>}
        {m.files?.length > 0 && <ul className="list">{m.files.map((f: Row) => <li key={f.ordinal}><a href={`${path}/messages/${m.id}/files/${f.ordinal}`}>{f.name}</a> <small className="muted">· {f.size} bytes</small></li>)}</ul>}
        {m.answer.map((r: Row) => <p key={r.id}><strong>Your accountant</strong> <small className="muted">{when(r.createdAt)}</small><br />{r.subject && <strong>{r.subject}<br /></strong>}{r.body}</p>)}
        {m.answer.flatMap((r: Row) => r.files ?? []).length > 0 && <ul className="list">{m.answer.flatMap((r: Row) => (r.files ?? []).map((f: Row) => <li key={`${r.id}-${f.ordinal}`}><a href={`${path}/messages/${r.id}/files/${f.ordinal}`}>{f.name}</a></li>))}</ul>}
      </article>)}
      <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget, data = new FormData(form); post(`${path}/messages`, { body: data.get('body') }, 'Question sent to your accountant.').then(() => form.reset()); }}>
        <label>Ask your accountant a question<textarea name="body" required maxLength={2000} rows={3} disabled={busy} /></label>
        <button disabled={busy}>Send question</button>
      </form>
    </section>
  </>;
}

/** The job's client link as staff manage it: progress, the client's questions, replies and to-dos. */
export function ClientLink({ detail, run }: { detail: Row; run: Run }) {
  const { job, portal } = detail;
  if (!portal) return null;
  const writable = job.status !== 'signed_off';
  const questions = thread(portal.messages, m => m.reply_to);
  return <section className="panel">
    <h2>Client link</h2>
    <p className="muted">The client sees this progress, these messages and to-dos, request labels and return notes, and client-facing tasks. Internal discussion and other tasks stay hidden. Messages appear on the client's link; no email is sent.</p>
    <PortalProgress progress={portal.progress} title="Client's progress view" />
    {questions.filter(m => !m.reply_to).map(m => <article key={m.id} className="record">
      <p><strong>{m.author === 'client' ? 'Client' : m.author}</strong> <small className="muted">{when(m.created_at)}{m.kind === 'question' && ` · owner ${m.owner_email}`}</small>{m.kind === 'question' && <> <Status value={m.status} /></>}<br />{m.subject && <strong>{m.subject}<br /></strong>}{m.body}</p>
      {JSON.parse(m.attachments ?? '[]').length > 0 && <p className="muted">Client can download: {JSON.parse(m.attachments).map((f: Row) => f.name).join(', ')}</p>}
      {m.answer.map((r: Row) => <p key={r.id}><strong>{r.author}</strong> <small className="muted">{when(r.created_at)}</small><br />{r.subject && <strong>{r.subject}<br /></strong>}{r.body}{JSON.parse(r.attachments ?? '[]').length > 0 && <small className="muted"> · client can download {JSON.parse(r.attachments).map((f: Row) => f.name).join(', ')}</small>}</p>)}
      {writable && m.kind === 'question' && m.status === 'open' && <Form label="Answer the client" submit={async (data, form) => run(async () => { await api(`/jobs/${job.id}/portal/messages`, { body: data.body, replyTo: m.id }); form.reset(); }, 'Answer shown on the client link')}>
        <Field label="Answer" name="body"><textarea name="body" required rows={2} /></Field>
      </Form>}
    </article>)}
    {portal.todos.length > 0 && <ul className="list">{portal.todos.map((t: Row) => <li key={t.id}>{t.status === 'done' ? '✓' : '○'} {t.body} <small className="muted">· set by {t.author}, owner {t.owner_email}{t.due_date && `, due ${day(t.due_date)}`}{t.status === 'done' && ` · completed ${when(t.closed_at)}${t.response ? `: ${t.response}` : ''}`}</small></li>)}</ul>}
    {writable && <div className="row">
      <Form label="Send to the client" submit={async (data, form) => run(async () => { await api(`/jobs/${job.id}/portal/messages`, { body: data.body }); form.reset(); }, 'Message shown on the client link')}>
        <Field label="Message to the client" name="body"><textarea name="body" required rows={2} /></Field>
      </Form>
      <PortalMessageComposer jobId={job.id} run={run} contacts={detail.contacts ?? []} />
      <Form label="Add to-do" submit={async (data, form) => run(async () => { await api(`/jobs/${job.id}/portal/todos`, { body: data.body, dueDate: data.dueDate || undefined }); form.reset(); }, 'To-do added to the client link')}>
        <Field label="To-do for the client" name="body" />
        <Field label="Due (optional)" name="dueDate" type="date" required={false} />
      </Form>
    </div>}
  </section>;
}
