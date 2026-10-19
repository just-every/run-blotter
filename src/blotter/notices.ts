// Tax notices and resolution work (DUE-002): open a notice from a client
// document filed on a job, verify its response date, assign a practitioner,
// and keep an append-only timeline of research, client questions, agency
// contact, responses, follow-ups, transcripts and receipts until it closes with
// a recorded outcome. Blotter tracks the work; it gives no tax advice.
import { decodeFile, fileResponse } from './documents';
import { eligible } from './jobs';
import { atomic, audit, date, digest, Fault, human, id, insist, job, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

const KINDS = ['research', 'client_question', 'agency_contact', 'response_submitted', 'follow_up', 'transcript', 'receipt', 'note'] as const;
/** Evidence that can back an acknowledged resolution: a file on one of these entries. */
const EVIDENCE = ['receipt', 'agency_contact', 'transcript', 'response_submitted'];

async function practitioner(db: D1Database, value: unknown) {
  const address = text(value, 'Assigned practitioner', 254).toLowerCase();
  insist(await eligible(db, address, ['preparer', 'reviewer']), 'The assigned practitioner must be an active practice member');
  return address;
}

export async function openNotice(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const file = await stmt(db, 'SELECT * FROM b_files WHERE id=?', text(body.fileId, 'Notice file')).first<Data>();
  insist(file, 'File not found', 404);
  const j = await job(db, actor, file.job_id);
  insist(['federal', 'state'].includes(body.jurisdiction), 'Choose federal or state');
  const n = {
    id: id(), agency: text(body.agency, 'Agency', 120), noticeType: text(body.noticeType, 'Notice type', 60), taxPeriod: text(body.taxPeriod, 'Tax period', 40),
    noticeDate: date(body.noticeDate, 'Notice date'), responseDue: date(body.responseDue, 'Respond by'), assignee: await practitioner(db, body.assigneeEmail),
    authorization: optional(body.authorization, 'Authorization on file', 300), plan: optional(body.plan, 'Resolution plan', 4000),
  };
  insist(n.responseDue >= n.noticeDate, 'The response date is before the notice date');
  await atomic(db, actor, [
    stmt(db, `INSERT INTO b_notices(id,client_id,job_id,source_file_id,agency,jurisdiction,notice_type,tax_period,notice_date,response_due,assignee_email,authorization,plan,created_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, n.id, j.client_id, j.id, file.id, n.agency, body.jurisdiction, n.noticeType, n.taxPeriod, n.noticeDate, n.responseDue, n.assignee, n.authorization, n.plan, actor.email, now()),
    audit(db, actor, 'notice.opened', n.id, `${n.agency} ${n.noticeType} ${n.taxPeriod}, respond by ${n.responseDue}, assigned to ${n.assignee}`)]);
  return noticeDetail(db, actor, n.id);
}

/** The principal, reviewers, the assigned practitioner and anyone who sees the notice's job. */
async function visible(db: D1Database, actor: Actor, noticeId: string) {
  const n = await stmt(db, 'SELECT * FROM b_notices WHERE id=?', noticeId).first<Data>();
  insist(n, 'Notice not found', 404);
  if (n.assignee_email !== actor.email) await job(db, actor, n.job_id).catch(() => { throw new Fault('Notice not found', 404); });
  return n;
}
const open = (n: Data) => insist(n.status === 'open', 'This notice is closed', 409);

export async function notices(db: D1Database, actor: Actor) {
  const lead = actor.role !== 'preparer';
  return rows(db, `SELECT n.id,n.agency,n.jurisdiction,n.notice_type,n.tax_period,n.response_due,n.due_verified_at,n.assignee_email,n.status,n.outcome,c.name client,
      (SELECT MIN(follow_up_on) FROM b_notice_events e WHERE e.notice_id=n.id AND e.kind='follow_up' AND e.follow_up_on>=date('now')) next_follow_up
    FROM b_notices n JOIN b_clients c ON c.id=n.client_id JOIN b_jobs ON b_jobs.id=n.job_id
    WHERE ? OR n.assignee_email=? OR b_jobs.preparer_email=? ORDER BY n.status='closed',n.response_due`, lead ? 1 : 0, actor.email, actor.email);
}

export async function noticeDetail(db: D1Database, actor: Actor, noticeId: string) {
  const n = await visible(db, actor, noticeId);
  return {
    notice: n, client: await stmt(db, 'SELECT id,name FROM b_clients WHERE id=?', n.client_id).first<Data>(),
    source: await stmt(db, 'SELECT id,name,uploaded_by,channel,uploaded_at FROM b_files WHERE id=?', n.source_file_id).first<Data>(),
    events: await rows(db, 'SELECT id,kind,note,result,follow_up_on,file_name,file_size,file_sha256,by_email,at FROM b_notice_events WHERE notice_id=? ORDER BY at,rowid', n.id),
  };
}

/** A person checks the response date against the notice itself; a corrected date is recorded. */
export async function verifyDeadline(db: D1Database, actor: Actor, noticeId: string, body: Data) {
  human(actor);
  const n = await visible(db, actor, noticeId); open(n);
  const due = date(body.responseDue, 'Respond by');
  insist(due >= n.notice_date, 'The response date is before the notice date');
  await atomic(db, actor, [
    stmt(db, "UPDATE b_notices SET response_due=?,due_verified_by=?,due_verified_at=? WHERE id=? AND status='open'", due, actor.email, now(), n.id),
    audit(db, actor, 'notice.deadline_verified', n.id, due === n.response_due ? `confirmed ${due}` : `corrected ${n.response_due} to ${due}`)]);
  return noticeDetail(db, actor, n.id);
}

export async function updateNotice(db: D1Database, actor: Actor, noticeId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const n = await visible(db, actor, noticeId); open(n);
  const assignee = body.assigneeEmail === undefined ? n.assignee_email : await practitioner(db, body.assigneeEmail);
  const authorization = body.authorization === undefined ? n.authorization : optional(body.authorization, 'Authorization on file', 300);
  const plan = body.plan === undefined ? n.plan : optional(body.plan, 'Resolution plan', 4000);
  await atomic(db, actor, [
    stmt(db, "UPDATE b_notices SET assignee_email=?,authorization=?,plan=? WHERE id=? AND status='open'", assignee, authorization, plan, n.id),
    audit(db, actor, 'notice.updated', n.id, `assigned to ${assignee}; authorization: ${authorization || 'none'}`)]);
  return noticeDetail(db, actor, n.id);
}

/** One timeline entry. Responses record their result; follow-ups their date; transcripts and receipts their file. */
export async function addNoticeEvent(db: D1Database, actor: Actor, noticeId: string, body: Data) {
  human(actor);
  const n = await visible(db, actor, noticeId); open(n);
  const kind = body.kind;
  insist(KINDS.includes(kind), 'Choose what happened');
  const note = text(body.note, 'Note', 4000);
  const result = kind === 'response_submitted' ? body.result : null;
  insist(kind !== 'response_submitted' || ['pending', 'failed', 'accepted'].includes(result), 'Record whether the response is pending, failed or accepted');
  const followUp = kind === 'follow_up' ? date(body.followUpOn, 'Follow up on') : null;
  const file = body.file ? decodeFile(body.file) : null;
  insist(!['transcript', 'receipt'].includes(kind) || file, 'Attach the transcript or receipt file');
  const eventId = id();
  await atomic(db, actor, [
    stmt(db, `INSERT INTO b_notice_events(id,notice_id,kind,note,result,follow_up_on,file_name,file_mime,file_size,file_sha256,file_base64,by_email,at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      eventId, n.id, kind, note, result, followUp, file?.name ?? null, file?.mime ?? null, file?.bytes.length ?? null, file ? await digest(file.bytes) : null, file?.encoded ?? null, actor.email, now()),
    audit(db, actor, `notice.${kind}`, n.id, result ? `${result}: ${note}` : note)]);
  return { id: eventId, kind, result, followUpOn: followUp };
}

export async function noticeFile(db: D1Database, actor: Actor, noticeId: string, eventId: string) {
  const n = await visible(db, actor, noticeId);
  const e = await stmt(db, 'SELECT file_name name,file_mime mime,file_base64 content_base64 FROM b_notice_events WHERE id=? AND notice_id=?', eventId, n.id).first<Data>();
  insist(e?.content_base64, 'This entry has no file', 404);
  return fileResponse(e);
}

/**
 * Close with a recorded outcome: "resolved" needs an evidence file on an agency
 * contact, transcript, receipt or accepted response, and no failed response
 * after the last accepted one; "exception" needs its documented reason.
 */
export async function closeNotice(db: D1Database, actor: Actor, noticeId: string, body: Data) {
  human(actor);
  const n = await visible(db, actor, noticeId); open(n);
  insist(actor.role !== 'preparer' || n.assignee_email === actor.email, 'Only the assigned practitioner, a reviewer or the principal closes a notice', 403);
  insist(body.outcome === 'resolved' || body.outcome === 'exception', 'Choose resolved or documented exception');
  const note = text(body.note, body.outcome === 'resolved' ? 'How it was resolved' : 'Why this is an exception', 4000);
  let evidence: string | null = null;
  if (body.outcome === 'resolved') {
    const responses = await rows(db, "SELECT result FROM b_notice_events WHERE notice_id=? AND kind='response_submitted' ORDER BY at,rowid", n.id);
    insist(!responses.length || responses.at(-1)!.result === 'accepted', 'The latest response is not accepted; the notice stays open until it is, or close it as a documented exception', 409);
    const e = await stmt(db, 'SELECT * FROM b_notice_events WHERE id=? AND notice_id=?', text(body.evidenceEventId, 'Evidence'), n.id).first<Data>();
    insist(e && e.file_sha256 && EVIDENCE.includes(e.kind) && (e.kind !== 'response_submitted' || e.result === 'accepted'),
      'Choose an entry with an evidence file: an agency contact, transcript, receipt or accepted response', 409);
    evidence = e.id;
  }
  await atomic(db, actor, [
    stmt(db, "UPDATE b_notices SET status='closed',outcome=?,outcome_note=?,evidence_event_id=?,closed_by=?,closed_at=? WHERE id=? AND status='open'", body.outcome, note, evidence, actor.email, now(), n.id),
    audit(db, actor, 'notice.closed', n.id, `${body.outcome}: ${note}`)]);
  return noticeDetail(db, actor, n.id);
}
