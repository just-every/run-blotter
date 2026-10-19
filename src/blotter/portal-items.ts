// Client progress, secure messages and to-dos (PORTAL-003). The client link
// shows the engagement's milestones, next action, outstanding requests and
// review/completion progress, the job's portal messages and the to-dos staff
// set for the client. A client question is owned by the job's preparer when it
// is asked and alerts them; answering it closes only that question. Completing
// a to-do records the client's response, alerts the person who set it and
// completes nothing else. Internal discussions, internal tasks and other jobs
// never reach the link. Staff messages are shown on the link only: no email is
// sent for them.
import type { Bindings } from '../auth.server';
import { runtimeBindings } from '../auth.server';
import { portalJob } from './documents';
import { flowSteps } from './flow';
import { notify } from './notifications';
import { clientStatus } from './statuses';
import { atomic, audit, date, guard, human, id, insist, now, optional, readableJob, rows, stmt, text, type Actor, type Data } from './model';

const CLIENT = 'client (portal link)';
const MAX_OPEN_QUESTIONS = 20;
const short = (body: string) => body.length > 120 ? body.slice(0, 119) + '…' : body;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** What the client sees of the engagement's progress; staff see the same view on the job. */
export async function clientProgress(db: D1Database, j: Data) {
  const [requests, steps, todos] = await Promise.all([
    rows(db, 'SELECT status FROM b_requests WHERE job_id=?', j.id),
    flowSteps(db, j),
    rows(db, "SELECT COUNT(*) n FROM b_portal_items WHERE job_id=? AND kind='todo' AND status='open'", j.id),
  ]);
  const applicable = steps.filter(s => s.state !== 'not_applicable'), done = applicable.filter(s => s.state === 'done').length;
  const outstanding = requests.filter(r => r.status === 'requested').length, accepted = requests.filter(r => r.status === 'accepted').length;
  const openTodos = Number(todos[0].n);
  const stage = j.status === 'signed_off' ? 'completed' : j.status === 'review' ? 'in_review' : outstanding ? 'collecting' : 'preparing';
  const yours = [outstanding ? `upload ${plural(outstanding, 'document')}` : '', openTodos ? `complete ${plural(openTodos, 'to-do')}` : ''].filter(Boolean);
  return {
    stage, status: await clientStatus(db, j),
    nextAction: yours.length ? `Please ${yours.join(' and ')}.` : stage === 'completed' ? 'Nothing needed from you: the work is complete.'
      : stage === 'in_review' ? 'Nothing needed from you: your accountant is reviewing the work.' : 'Nothing needed from you: your accountant is preparing the work.',
    milestones: [
      { key: 'documents', label: 'Documents', done: requests.length > 0 && accepted === requests.length, detail: `${requests.length - outstanding} of ${requests.length} received, ${accepted} accepted` },
      { key: 'preparation', label: 'Preparation', done: j.status !== 'open', detail: `${done} of ${applicable.length} steps complete` },
      { key: 'review', label: 'Review', done: j.status === 'signed_off', detail: j.status === 'review' ? 'in review' : j.status === 'signed_off' ? 'reviewed' : 'not started' },
      { key: 'completed', label: 'Completed', done: j.status === 'signed_off', detail: j.status === 'signed_off' ? 'signed off' : 'not yet' },
    ],
  };
}

/** The job's portal items, as the client sees them (no staff emails) or as staff see them. */
async function items(db: D1Database, jobId: string, staff: boolean) {
  const all = await rows(db, 'SELECT * FROM b_portal_items WHERE job_id=? ORDER BY created_at,id', jobId);
  const shown = (i: Data) => staff ? i : { id: i.id, kind: i.kind, replyTo: i.reply_to, body: i.body, from: i.author === 'client' ? 'you' : 'your accountant', status: i.status, dueDate: i.due_date, response: i.response, closedAt: i.closed_at, createdAt: i.created_at };
  return { messages: all.filter(i => i.kind !== 'todo').map(shown), todos: all.filter(i => i.kind === 'todo').map(shown) };
}

export async function portalItems(db: D1Database, j: Data) { return { progress: await clientProgress(db, j), ...await items(db, j.id, false) }; }
export async function staffPortal(db: D1Database, j: Data) { return { progress: await clientProgress(db, j), ...await items(db, j.id, true) }; }

const linkGuard = (db: D1Database, linkId: string) => guard(db, "EXISTS(SELECT 1 FROM b_portal_links l JOIN b_jobs j ON j.id=l.job_id WHERE l.id=? AND l.revoked_at IS NULL AND l.expires_at>? AND j.status<>'signed_off')", linkId, now());
const clientAudit = (db: D1Database, action: string, objectId: string, detail: string) =>
  stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), CLIENT, action, objectId, detail, now());
async function clientWrite(db: D1Database, statements: D1PreparedStatement[]) {
  try { await db.batch(statements); } catch (error) {
    if (/b_guard|constraint|immutable/i.test(String(error))) insist(false, 'This link changed. Refresh and try again.', 409);
    throw error;
  }
}

/** The client asks a secure question on the engagement; the job's preparer owns it and is alerted. */
export async function clientQuestion(env: Bindings, token: string, body: Data) {
  const db = runtimeBindings(env).DB, { link, job: j } = await portalJob(db, token);
  const question = text(body.body, 'Your question', 2000);
  const open = await stmt(db, "SELECT COUNT(*) n FROM b_portal_items WHERE job_id=? AND kind='question' AND status='open'", j.id).first<Data>();
  insist(Number(open!.n) < MAX_OPEN_QUESTIONS, 'Your accountant has not answered your earlier questions yet. Please wait for a reply.', 429);
  const itemId = id(), [check, release] = linkGuard(db, link.id);
  await clientWrite(db, [check,
    stmt(db, "INSERT INTO b_portal_items(id,job_id,kind,body,author,owner_email,status,created_at) VALUES(?,?,'question',?,'client',?,'open',?)", itemId, j.id, question, j.preparer_email, now()),
    release, clientAudit(db, 'portal.question', itemId, short(question))]);
  await notify(env, [j.preparer_email], { kind: 'client_question', jobId: j.id, summary: `${j.client_name} asked about ${j.title} ${j.period_label}: ${short(question)}` });
  return { id: itemId, status: 'open' };
}

/** The client completes one to-do with an optional response; the person who set it is alerted. */
export async function completeTodo(env: Bindings, token: string, todoId: string, body: Data) {
  const db = runtimeBindings(env).DB, { link, job: j } = await portalJob(db, token);
  const todo = await stmt(db, "SELECT * FROM b_portal_items WHERE id=? AND job_id=? AND kind='todo'", todoId, j.id).first<Data>();
  insist(todo, 'To-do not found', 404);
  insist(todo.status === 'open', 'This to-do is already complete', 409);
  const response = optional(body.response, 'Your response', 2000), [check, release] = linkGuard(db, link.id);
  await clientWrite(db, [check,
    stmt(db, "UPDATE b_portal_items SET status='done',response=?,closed_at=? WHERE id=? AND status='open'", response || null, now(), todo.id),
    release, clientAudit(db, 'portal.todo_done', todo.id, short(response ? `${todo.body}: ${response}` : todo.body))]);
  await notify(env, [todo.owner_email], { kind: 'client_todo_done', jobId: j.id, summary: `${j.client_name} completed “${short(todo.body)}” on ${j.title} ${j.period_label}` });
  return { id: todo.id, status: 'done' };
}

async function staffJob(db: D1Database, actor: Actor, jobId: string) {
  human(actor);
  const j = await readableJob(db, actor, jobId);
  insist(j.access === 'full', 'Only the job’s people can write to the client', 403);
  insist(j.status !== 'signed_off', 'This job is signed off; its client link is closed', 409);
  return j;
}

/** Staff write to the client on the link; answering a question closes only that question. */
export async function staffMessage(env: Bindings, actor: Actor, jobId: string, body: Data) {
  const db = runtimeBindings(env).DB, j = await staffJob(db, actor, jobId);
  const message = text(body.body, 'Message', 2000), replyTo = optional(body.replyTo, 'Question', 100) || null;
  const statements: D1PreparedStatement[] = [];
  if (replyTo) {
    const q = await stmt(db, "SELECT * FROM b_portal_items WHERE id=? AND job_id=? AND kind='question'", replyTo, j.id).first<Data>();
    insist(q, 'Question not found', 404);
    insist(q.status === 'open', 'This question is already answered', 409);
    statements.push(stmt(db, "UPDATE b_portal_items SET status='answered',closed_at=? WHERE id=? AND status='open'", now(), q.id), audit(db, actor, 'portal.answered', q.id, short(message)));
  }
  const itemId = id();
  await atomic(db, actor, [
    stmt(db, "INSERT INTO b_portal_items(id,job_id,kind,reply_to,body,author,status,created_at) VALUES(?,?,'message',?,?,?,'sent',?)", itemId, j.id, replyTo, message, actor.email, now()),
    ...statements, audit(db, actor, 'portal.message', itemId, short(message))]);
  return staffPortal(db, j);
}

/** Staff set a to-do for the client; they own it until the client completes it. */
export async function staffTodo(env: Bindings, actor: Actor, jobId: string, body: Data) {
  const db = runtimeBindings(env).DB, j = await staffJob(db, actor, jobId);
  const todo = text(body.body, 'To-do', 2000), due = body.dueDate ? date(body.dueDate, 'Due date') : null, itemId = id();
  await atomic(db, actor, [
    stmt(db, "INSERT INTO b_portal_items(id,job_id,kind,body,author,owner_email,due_date,status,created_at) VALUES(?,?,'todo',?,?,?,?,'open',?)", itemId, j.id, todo, actor.email, actor.email, due, now()),
    audit(db, actor, 'portal.todo_set', itemId, short(todo))]);
  return staffPortal(db, j);
}
