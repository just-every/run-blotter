// Internal discussions (COLLAB-001): threads on a client, or on a job and one of
// its steps, document requests or its review. Staff mention colleagues who can
// see the work, own follow-ups, and resolve a thread with a retained decision.
// Reading a thread marks it read for that person. Nothing here is served through
// the client link.
import { runtimeBindings, type Bindings } from '../auth.server';
import { notify } from './notifications';
import { atomic, audit, date, email, human, id, insist, job, need, now, rows, stmt, text, type Actor, type Data } from './model';

/** Whether this person may read threads on the client or job: the principal and reviewers, or the preparer of that work. */
async function readable(db: D1Database, address: string, role: string, t: { client_id: string; job_id: string | null }) {
  if (role === 'owner' || role === 'reviewer') return true;
  return t.job_id
    ? !!await stmt(db, 'SELECT 1 FROM b_jobs WHERE id=? AND preparer_email=?', t.job_id, address).first()
    : !!await stmt(db, 'SELECT 1 FROM b_jobs WHERE client_id=? AND preparer_email=?', t.client_id, address).first();
}
async function roleOf(db: D1Database, address: string) {
  const owner = await stmt(db, "SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active'", address).first();
  if (owner) return 'owner';
  return (await stmt(db, 'SELECT role FROM b_members WHERE email=? AND active=1', address).first<Data>())?.role as string | undefined;
}
async function mentions(db: D1Database, value: unknown, t: { client_id: string; job_id: string | null }) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/).filter(Boolean) : [];
  insist(list.length <= 10, 'Mention at most 10 people');
  const people: string[] = [];
  for (const raw of list) {
    const address = email(String(raw).replace(/^@/, ''), 'Mention');
    const role = await roleOf(db, address);
    insist(role, `${address} is not an active practice member`);
    insist(await readable(db, address, role, t), `${address} cannot see this work, so they cannot be mentioned`);
    people.push(address);
  }
  return [...new Set(people)];
}
async function thread(db: D1Database, actor: Actor, threadId: string) {
  const t = await stmt(db, 'SELECT * FROM b_threads WHERE id=?', threadId).first<Data>();
  insist(t && await readable(db, actor.email, actor.role, t as { client_id: string; job_id: string | null }), 'Discussion not found', 404);
  return t;
}
const label = async (db: D1Database, t: Data) => {
  const row = await stmt(db, 'SELECT c.name client, j.title, j.period_label FROM b_clients c LEFT JOIN b_jobs j ON j.id=? WHERE c.id=?', t.job_id, t.client_id).first<Data>();
  return row!.title ? `${row!.client} ${row!.title} ${row!.period_label}` : row!.client;
};

/** Discussions on a job and on its client, each with this person's unread state. */
export async function threadsFor(db: D1Database, actor: Actor, jobId: string) {
  const j = await job(db, actor, jobId);
  const list = await rows(db, `SELECT t.*,(SELECT COUNT(*) FROM b_thread_messages m WHERE m.thread_id=t.id) messages,
    (SELECT MAX(created_at) FROM b_thread_messages m WHERE m.thread_id=t.id) last_at,r.read_at
    FROM b_threads t LEFT JOIN b_thread_reads r ON r.thread_id=t.id AND r.email=?
    WHERE t.job_id=? OR (t.job_id IS NULL AND t.client_id=?) ORDER BY last_at DESC`, actor.email, j.id, j.client_id);
  const clientVisible = await readable(db, actor.email, actor.role, { client_id: j.client_id, job_id: null });
  return list.filter(t => t.job_id || clientVisible).map(t => ({ ...t, unread: !t.read_at || t.read_at < t.last_at }));
}

/** Opens a thread on the job or its client. A correction is owned by the job's preparer and needs a follow-up date. */
export async function openThread(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB, j = await job(db, actor, jobId);
  const anchor = text(body.anchor ?? 'job', 'About', 100);
  if (anchor.startsWith('step:')) insist(await stmt(db, 'SELECT 1 FROM b_job_steps WHERE job_id=? AND ordinal=?', j.id, Number(anchor.slice(5))).first(), 'Checklist step not found');
  else if (anchor.startsWith('request:')) insist(await stmt(db, 'SELECT 1 FROM b_requests WHERE job_id=? AND id=?', j.id, anchor.slice(8)).first(), 'Document request not found');
  else insist(['job', 'review', 'client'].includes(anchor), 'Choose what the discussion is about');
  const t = { client_id: j.client_id as string, job_id: anchor === 'client' ? null : j.id as string };
  insist(await readable(db, actor.email, actor.role, t), 'Discussion not found', 404);
  const correction = body.correction === true;
  if (correction) { need(actor, 'owner', 'reviewer'); insist(t.job_id, 'A correction belongs to a job, not the whole client'); }
  const followUp = correction ? date(body.followUpDue, 'Follow up by') : null;
  const owner = correction ? j.preparer_email : actor.email;
  const title = text(body.title, 'Subject', 200), message = text(body.body, 'Message', 4000), people = await mentions(db, body.mentions, t);
  const threadId = id(), at = now();
  await atomic(db, actor, [
    stmt(db, `INSERT INTO b_threads(id,client_id,job_id,anchor,title,kind,owner_email,follow_up_due,status,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,'open',?,?)`,
      threadId, t.client_id, t.job_id, anchor, title, correction ? 'correction' : 'discussion', owner, followUp, actor.email, at),
    stmt(db, 'INSERT INTO b_thread_messages(id,thread_id,author_email,body,mentions,created_at) VALUES(?,?,?,?,?,?)', id(), threadId, actor.email, message, JSON.stringify(people), at),
    stmt(db, 'INSERT INTO b_thread_reads(thread_id,email,read_at) VALUES(?,?,?)', threadId, actor.email, at),
    audit(db, actor, correction ? 'thread.correction_requested' : 'thread.opened', threadId, title)]);
  const where = await label(db, t);
  if (correction) await notify(env, [owner], { kind: 'correction', jobId: j.id, threadId, summary: `${actor.name || actor.email} asked you for a correction on ${where} by ${followUp}: ${title}` }, actor.email);
  await notify(env, people, { kind: 'mention', jobId: j.id, threadId, summary: `${actor.name || actor.email} mentioned you on ${where}: ${title}` }, actor.email);
  return readThread(db, actor, threadId);
}

/** A thread with its messages; reading it marks it read for this person. */
export async function readThread(db: D1Database, actor: Actor, threadId: string) {
  const t = await thread(db, actor, threadId);
  const messages = await rows(db, 'SELECT * FROM b_thread_messages WHERE thread_id=? ORDER BY created_at,id', t.id);
  await stmt(db, 'INSERT INTO b_thread_reads(thread_id,email,read_at) VALUES(?,?,?) ON CONFLICT(thread_id,email) DO UPDATE SET read_at=excluded.read_at', t.id, actor.email, now()).run();
  return { thread: t, messages: messages.map(m => ({ ...m, mentions: JSON.parse(m.mentions) })) };
}

/** A reply returns the thread to its owner and creator, and alerts anyone mentioned. */
export async function reply(env: Bindings, actor: Actor, threadId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB, t = await thread(db, actor, threadId);
  insist(t.status === 'open', 'This discussion is resolved', 409);
  const message = text(body.body, 'Message', 4000), people = await mentions(db, body.mentions, t as { client_id: string; job_id: string | null }), at = now();
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_thread_messages(id,thread_id,author_email,body,mentions,created_at) VALUES(?,?,?,?,?,?)', id(), t.id, actor.email, message, JSON.stringify(people), at),
    stmt(db, 'INSERT INTO b_thread_reads(thread_id,email,read_at) VALUES(?,?,?) ON CONFLICT(thread_id,email) DO UPDATE SET read_at=excluded.read_at', t.id, actor.email, at),
    audit(db, actor, 'thread.replied', t.id, t.title)]);
  const where = await label(db, t);
  await notify(env, [t.owner_email, t.created_by], { kind: 'reply', jobId: t.job_id, threadId: t.id, summary: `${actor.name || actor.email} replied on ${where}: ${t.title}` }, actor.email);
  await notify(env, people, { kind: 'mention', jobId: t.job_id, threadId: t.id, summary: `${actor.name || actor.email} mentioned you on ${where}: ${t.title}` }, actor.email);
  return readThread(db, actor, t.id);
}

/** The thread's owner, or the principal, resolves it with a recorded decision; the thread is then kept unchanged. */
export async function resolveThread(env: Bindings, actor: Actor, threadId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB, t = await thread(db, actor, threadId);
  insist(t.status === 'open', 'This discussion is already resolved', 409);
  insist(actor.email === t.owner_email || actor.role === 'owner', 'Only the person who owns this discussion, or the principal, can resolve it', 403);
  const resolution = text(body.resolution, 'Decision', 2000);
  await atomic(db, actor, [
    stmt(db, "UPDATE b_threads SET status='resolved',resolution=?,resolved_by=?,resolved_at=? WHERE id=? AND status='open'", resolution, actor.email, now(), t.id),
    audit(db, actor, 'thread.resolved', t.id, resolution)]);
  await notify(env, [t.created_by], { kind: 'resolved', jobId: t.job_id, threadId: t.id, summary: `${actor.name || actor.email} resolved ${t.title} on ${await label(db, t)}: ${resolution}` }, actor.email);
  return readThread(db, actor, t.id);
}
