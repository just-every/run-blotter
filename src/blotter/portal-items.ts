import { contactRequestSql } from './organizers-requests';
// Client progress, secure messages and to-dos (PORTAL-003). The client link
// shows the engagement's milestones, next action, outstanding requests and
// review/completion progress, the job's portal messages and the to-dos staff
// set for the client. A client question is owned by the job's preparer when it
// is asked and alerts them; answering it closes only that question. Staff may
// compose a message from a template (MSG-004): previewed for the chosen contact,
// refused while a placeholder is unresolved, and sent with that version's files,
// which the client downloads from the link. Completing
// a to-do records the client's response, alerts the person who set it and
// completes nothing else. Internal discussions, internal tasks and other jobs
// never reach the link. Staff messages are shown on the link only: no email is
// sent for them.
import { tr, type Key, type Language } from '../i18n/catalog';
import { contactGuard } from './client-recipients';
import type { Bindings } from '../auth.server';
import { runtimeBindings } from '../auth.server';
import { portalJob } from './documents';
import { flowSteps } from './flow';
import { notify } from './notifications';
import { clientStatus } from './statuses';
import { engagementOnly, localize, render, templateFiles, translationWarning, usable, valuesFor } from './messages';
import { recipientFor } from './client-recipients';
import { atomic, audit, date, guard, human, id, insist, now, optional, readableJob, rows, stmt, text, type Actor, type Data } from './model';

const CLIENT = 'client (portal link)';
const MAX_OPEN_QUESTIONS = 20;
const short = (body: string) => body.length > 120 ? body.slice(0, 119) + '…' : body;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** What the client sees of the engagement's progress; staff see the same view on the job. */
export async function clientProgress(db: D1Database, j: Data,contactId?:string,language:Language='en') {
  const T=(key:Key,vars:Record<string,string|number>={})=>tr(language,key,vars);
  const [requests, steps, todos] = await Promise.all([
    contactId ? rows(db,`SELECT r.status FROM b_requests r WHERE r.job_id=? AND ${contactRequestSql()}`,j.id,contactId) : rows(db,'SELECT status FROM b_requests WHERE job_id=? AND organizer_active=1',j.id),
    flowSteps(db, j),
    rows(db, "SELECT COUNT(*) n FROM b_portal_items WHERE job_id=? AND kind='todo' AND status='open'", j.id),
  ]);
  const applicable = steps.filter(s => s.state !== 'not_applicable'), done = applicable.filter(s => s.state === 'done').length;
  const outstanding = requests.filter(r => r.status === 'requested').length, accepted = requests.filter(r => r.status === 'accepted').length;
  const openTodos = Number(todos[0].n);
  const stage = j.status === 'signed_off' ? 'completed' : j.status === 'review' ? 'in_review' : outstanding ? 'collecting' : 'preparing';
  const yours = [outstanding ? T('progress.upload', { n: outstanding, document: T(outstanding === 1 ? 'progress.document.one' : 'progress.document.other') }) : '', openTodos ? T('progress.todo', { n: openTodos, todo: T(openTodos === 1 ? 'progress.todo.one' : 'progress.todo.other') }) : ''].filter(Boolean);
  return {
    stage, status: await clientStatus(db, j, language),
    nextAction: yours.length ? T('progress.please', { actions: yours.join(T('progress.and')) }) : T(`progress.nothing.${stage === 'completed' ? 'completed' : stage === 'in_review' ? 'in_review' : 'preparing'}` as Key),
    milestones: [
      { key: 'documents', label: T('progress.m.documents'), done: requests.length > 0 && accepted === requests.length, detail: T('progress.d.documents', { received: requests.length - outstanding, total: requests.length, accepted }) },
      { key: 'preparation', label: T('progress.m.preparation'), done: j.status !== 'open', detail: T('progress.d.preparation', { done, total: applicable.length }) },
      { key: 'review', label: T('progress.m.review'), done: j.status === 'signed_off', detail: j.status === 'review' ? T('progress.d.inReview') : j.status === 'signed_off' ? T('progress.d.reviewed') : T('progress.d.notStarted') },
      { key: 'completed', label: T('progress.m.completed'), done: j.status === 'signed_off', detail: j.status === 'signed_off' ? T('progress.d.signedOff') : T('progress.d.notYet') },
    ],
  };
}

/** The job's portal items, as the client sees them (no staff emails) or as staff see them. */
async function items(db: D1Database, jobId: string, staff: boolean) {
  const all = await rows(db, 'SELECT * FROM b_portal_items WHERE job_id=? ORDER BY created_at,id', jobId);
  const shown = (i: Data) => staff ? i : { id: i.id, kind: i.kind, replyTo: i.reply_to, body: i.body, from: i.author === 'client' ? 'you' : 'your accountant', status: i.status, dueDate: i.due_date, response: i.response, closedAt: i.closed_at, createdAt: i.created_at,
    ...(i.subject ? { subject: i.subject } : {}), files: JSON.parse(i.attachments).map((f: Data) => ({ ordinal: f.ordinal, name: f.name, mime: f.mime, size: f.size })) };
  return { messages: all.filter(i => i.kind !== 'todo').map(shown), todos: all.filter(i => i.kind === 'todo').map(shown) };
}

export async function portalItems(db: D1Database, j: Data,contactId?:string,language:Language='en') { return { progress: await clientProgress(db, j,contactId,language), ...await items(db, j.id, false) }; }
export async function staffPortal(db: D1Database, j: Data) { return { progress: await clientProgress(db, j), ...await items(db, j.id, true) }; }

const linkGuard = (db: D1Database, linkId: string) => guard(db, "EXISTS(SELECT 1 FROM b_portal_links l JOIN b_jobs j ON j.id=l.job_id WHERE l.id=? AND l.revoked_at IS NULL AND l.expires_at>? AND j.status<>'signed_off' AND EXISTS(SELECT 1 FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id WHERE c.id=l.contact_id AND c.client_id=j.client_id AND c.authorized=1 AND c.active=1 AND c.portal=1 AND c.request_consent=1 AND e.lifecycle='active'))", linkId, now());
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

/** In a portal message the placeholder names the page the client is already reading; no new link is created. */
const THIS_PAGE = 'this secure page';

/** A message template rendered for one contact of this job: the template's current version, or the sender's edited text. */
async function composed(db: D1Database, actor: Actor, j: Data, body: Data) {
  const t = await usable(db, actor, text(body.templateId, 'Template'));
  engagementOnly(t);
  const contact = await recipientFor(db, j.client_id, 'request', optional(body.contactId, 'Contact', 100) || undefined);
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', j.client_id).first<Data>();
  client!.contact_email = contact.email; client!.contact_name = contact.name;
  const outstanding = (await rows(db, "SELECT label FROM b_requests WHERE job_id=? AND status='requested' ORDER BY ordinal", j.id)).map(r => r.label as string);
  const language: Language = contact.language ?? 'en', localized = await localize(db, t, language), edited = body.subject !== undefined || body.body !== undefined;
  const subject = body.subject !== undefined ? text(body.subject, 'Subject', 200) : localized.subject, message = body.body !== undefined ? text(body.body, 'Message', 10_000) : localized.body;
  const rendered = render(subject, message, await valuesFor(db, actor, j, client!, outstanding, THIS_PAGE), body.values);
  // The version's files go with the message even when its text was edited.
  return { to: contact.email, ...rendered, templateId: t.id as string, version: t.version as number, attachments: t.attachments as Data[], edited, language, translated: localized.translated && !edited, warnings: localized.missing && !edited ? [translationWarning(t, language)] : [] };
}

/** Render a portal message without sending it. */
export async function previewPortalMessage(env: Bindings, actor: Actor, jobId: string, body: Data) {
  const db = runtimeBindings(env).DB, j = await staffJob(db, actor, jobId);
  const { templateId, version, edited, ...preview } = await composed(db, actor, j, body);
  return { ...preview, templateId, version };
}

/** Staff write to the client on the link; answering a question closes only that question. */
export async function staffMessage(env: Bindings, actor: Actor, jobId: string, body: Data) {
  const db = runtimeBindings(env).DB, j = await staffJob(db, actor, jobId);
  const replyTo = optional(body.replyTo, 'Question', 100) || null;
  let message: string, subject: string | null = null, template: Awaited<ReturnType<typeof composed>> | null = null, files: Data[] = [];
  if (body.templateId) {
    template = await composed(db, actor, j, body);
    insist(!template.missing.length, `Fill in or remove before sending: ${template.missing.map(m => m.label).join(', ')}`, 409);
    insist(template.body.length <= 2000, `A portal message holds up to 2000 characters; this renders to ${template.body.length}. Shorten the template text`, 400);
    message = template.body; subject = template.subject;
    files = (await templateFiles(db, template.templateId, template.version)).map(f => ({ ordinal: f.ordinal, name: f.name, mime: f.mime, size: f.size, sha256: f.sha256 }));
  } else message = text(body.body, 'Message', 2000);
  const statements: D1PreparedStatement[] = [];
  if (replyTo) {
    const q = await stmt(db, "SELECT * FROM b_portal_items WHERE id=? AND job_id=? AND kind='question'", replyTo, j.id).first<Data>();
    insist(q, 'Question not found', 404);
    insist(q.status === 'open', 'This question is already answered', 409);
    statements.push(stmt(db, "UPDATE b_portal_items SET status='answered',closed_at=? WHERE id=? AND status='open'", now(), q.id), audit(db, actor, 'portal.answered', q.id, short(message)));
  }
  const itemId = id();
  await atomic(db, actor, [
    stmt(db, "INSERT INTO b_portal_items(id,job_id,kind,reply_to,body,author,status,created_at,subject,template_id,template_version,template_edited,attachments) VALUES(?,?,'message',?,?,?,'sent',?,?,?,?,?,?)",
      itemId, j.id, replyTo, message, actor.email, now(), subject, template?.templateId ?? null, template?.version ?? null, template?.edited ? 1 : 0, JSON.stringify(files)),
    ...statements, audit(db, actor, 'portal.message', itemId, short(message))]);
  return staffPortal(db, j);
}

/** The client downloads a file that came with a message; the bytes must still be the ones recorded. */
export async function portalMessageFile(db: D1Database, token: string, itemId: string, ordinal: string) {
  const { link, job: j } = await portalJob(db, token);
  const item = await stmt(db, "SELECT * FROM b_portal_items WHERE id=? AND job_id=? AND kind='message' AND template_id IS NOT NULL", itemId, j.id).first<Data>();
  const recorded = item && (JSON.parse(item.attachments) as Data[]).find(f => String(f.ordinal) === ordinal);
  const file = recorded && await stmt(db, 'SELECT name,mime,sha256,content_base64 FROM b_msg_template_files WHERE template_id=? AND version=? AND ordinal=?', item.template_id, item.template_version, recorded.ordinal).first<Data>();
  insist(file && file.sha256 === recorded.sha256, 'File not found', 404);
  await stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), CLIENT, 'portal.message_file', item.id, `${file.name} ${file.sha256}`, now()).run();
  const safeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'text/csv', 'text/plain'];
  return new Response(Uint8Array.from(atob(file.content_base64), c => c.charCodeAt(0)), { headers: {
    'content-type': safeTypes.includes(file.mime) ? file.mime : 'application/octet-stream',
    'content-disposition': `attachment; filename="${String(file.name).replace(/[^A-Za-z0-9._ -]/g, '_')}"`,
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
  } });
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
