// ERASURE-002 retention (ct 22 Oct 2026): the principal's holds, extend-only retain-until
// dates, deletion requests and recorded outside copies. Owner only, person only, every change
// audited. A hold names its scope, reason, hold owner and review date; the review date shows as
// due on the retention page and no reminder is sent. Nothing here expires, deletes or sends.
import { CLIENT_CLASSES, type ClientClass } from './erasure-registry';
import { lit } from './erasure-scope';
import { firmSettings } from './firm';
import { clocks, localDate, periods, type Clocked } from './retention-clock';
import { atomic, audit, date, human, id, insist, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

const COPY_KINDS = ['document', 'provider', 'buyer'] as const;
const SCOPES = ['client', 'job', 'file', 'engagement', 'export', 'class'] as const;
export const SUBJECTS = ['client', 'contact', 'prospect'] as const;

/** Today in the firm's time zone, the calendar every clock and mark is read in. */
export const firmToday = async (db: D1Database) => localDate(now(), (await firmSettings(db)).timeZone);
export const active = (today: string) => `released_at IS NULL AND (kind='hold' OR until>=${lit(today)})`;

async function clientRow(db: D1Database, clientId: string) {
  const c = await stmt(db, 'SELECT id,name,lifecycle,erased_at FROM b_clients WHERE id=?', clientId).first<Data>();
  insist(c, 'Client not found', 404);
  return c;
}

export type Target = { clientIds: string[]; jobId?: string; fileId?: string; engagementId?: string; exportId?: string; cls?: ClientClass };
/** Active marks that cover a target: its client, its job, file or record, or its record class for this client or the whole firm. */
export async function marksCovering(db: D1Database, target: Target, kinds: ('hold' | 'retain')[] = ['hold', 'retain']) {
  const today = await firmToday(db);
  const marks = await rows(db, `SELECT * FROM b_retention_marks WHERE ${active(today)} ORDER BY placed_at,id`);
  return marks.filter(m => kinds.includes(m.kind) && (
    (m.scope === 'client' && target.clientIds.includes(m.client_id)) || (m.scope === 'job' && m.target_id === target.jobId) || (m.scope === 'file' && m.target_id === target.fileId)
    || (m.scope === 'engagement' && m.target_id === target.engagementId) || (m.scope === 'export' && m.target_id === target.exportId)
    || (m.scope === 'class' && m.class === target.cls && (!m.client_id || target.clientIds.includes(m.client_id)))));
}
const holdName = (m: Data) => `${m.kind === 'hold' ? 'hold' : 'retention'} ${String(m.id).slice(0, 8)} (${m.reason}; owner ${m.owner ?? m.placed_by})`;
/** The single-item doors (ERASURE-001 files, PORTAL-004 answers, VAULT-001 credentials) refuse inside a hold, naming it. Only access revocation runs under a hold. */
export async function refuseHeld(db: D1Database, target: Target, what: string) {
  const holds = await marksCovering(db, target, ['hold']);
  insist(!holds.length, `${what} is refused: inside ERASURE-002 ${holds.map(holdName).join('; ')}. Release the hold first.`, 409);
}

/** The latest date a record or client is already kept to; a retain-until date can only go later. */
async function keptTo(db: D1Database, clientId: string, scope: string, targetId: string | null, today: string) {
  const all: Clocked[] = await clocks(db);
  let mine: Clocked[] = [];
  if (scope === 'client') mine = all.filter(c => c.clientIds.includes(clientId));
  else if (scope === 'job') mine = all.filter(c => c.kind === 'job' && c.id === targetId);
  else if (scope === 'file') { const jobId = await stmt(db, 'SELECT job_id FROM b_files WHERE id=?', targetId).first<string>('job_id'); mine = all.filter(c => c.kind === 'job' && c.id === jobId); }
  else mine = all.filter(c => c.kind === scope && c.id === targetId);
  const existing = await rows(db, `SELECT until FROM b_retention_marks WHERE kind='retain' AND released_at IS NULL AND client_id=? AND scope=? AND ${scope === 'client' ? '1' : 'target_id=?'}`, ...(scope === 'client' ? [clientId, scope] : [clientId, scope, targetId]));
  return [today, ...mine.map(c => c.expiry), ...existing.map(r => String(r.until))].sort().at(-1)!;
}

async function holdOwner(db: D1Database, actor: Actor, owner: unknown) {
  const email = text(owner, 'Hold owner', 254).toLowerCase();
  if (email === actor.email.toLowerCase()) return email;
  insist(await stmt(db, "SELECT 1 FROM b_members WHERE email=? AND role='reviewer' AND active=1", email).first(), 'A hold owner is the principal or a named active reviewer');
  return email;
}

export async function retentionState(db: D1Database, actor: Actor, clientId: string) {
  human(actor); need(actor, 'owner');
  await clientRow(db, clientId);
  const today = await firmToday(db);
  const marks = (await rows(db, `SELECT id,scope,target_id,class,kind,until,owner,review_date,reason,placed_by,placed_at,released_by,released_at,release_reason FROM b_retention_marks WHERE client_id=? OR (client_id IS NULL AND scope='class') ORDER BY placed_at,id`, clientId))
    .map(m => ({ ...m, reviewDue: m.kind === 'hold' && !m.released_at && m.review_date <= today }));
  return {
    today, marks, periods: await periods(db), classes: CLIENT_CLASSES,
    records: (await clocks(db)).filter(c => c.clientIds.includes(clientId)),
    copies: await rows(db, 'SELECT id,kind,system,holder,note,recorded_by,recorded_at,closed_by,closed_at,closed_note FROM b_external_copies WHERE client_id=? ORDER BY recorded_at,id', clientId),
    requests: await rows(db, 'SELECT id,subject_kind,subject_id,requester,channel,received_on,verification,reason,recorded_by,recorded_at,erasure_id FROM b_deletion_requests WHERE client_id=? ORDER BY recorded_at,id', clientId),
  };
}

/** Every hold due for review across the firm, for the retention page. */
export async function firmHolds(db: D1Database, actor: Actor) {
  human(actor); need(actor, 'owner');
  const today = await firmToday(db);
  return { today, holds: (await rows(db, `SELECT m.id,m.client_id,c.name client_name,m.scope,m.target_id,m.class,m.owner,m.review_date,m.reason,m.placed_by,m.placed_at FROM b_retention_marks m LEFT JOIN b_clients c ON c.id=m.client_id WHERE m.kind='hold' AND m.released_at IS NULL ORDER BY m.review_date,m.id`))
    .map(m => ({ ...m, reviewDue: m.review_date <= today })) };
}

/** Hold a client, a job, a file, a record or a record class (for this client or the whole firm); or retain a client, job or record to a later date. */
export async function placeMark(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const c = await clientRow(db, clientId);
  insist(!c.erased_at, 'This client was already erased', 409);
  insist((SCOPES as readonly string[]).includes(body.scope), 'Choose client, job, file, engagement, export or record class');
  insist(body.kind === 'hold' || body.kind === 'retain', 'Choose hold or retain until a date');
  const reason = text(body.reason, 'Reason', 1000), today = await firmToday(db);
  let target: string | null = null, cls: string | null = null, owner: string | null = null, review: string | null = null, until: string | null = null, owning: string | null = clientId;
  if (body.scope === 'class') {
    insist(body.kind === 'hold', 'A record class is held, never given a retain-until date');
    insist(Object.hasOwn(CLIENT_CLASSES, body.class), 'Choose a record class');
    cls = body.class;
    if (body.firmWide === true) owning = null;
  } else if (body.scope !== 'client') {
    target = text(body.targetId, 'Record');
    const found = {
      job: ['SELECT 1 FROM b_jobs WHERE id=? AND client_id=?', 'Job'], file: ['SELECT 1 FROM b_files f JOIN b_jobs j ON j.id=f.job_id WHERE f.id=? AND j.client_id=?', 'File'],
      engagement: ['SELECT 1 FROM b_engagements WHERE id=? AND client_id=?', 'Engagement'],
      export: ["SELECT 1 FROM b_exports WHERE id=? AND status='approved' AND EXISTS(SELECT 1 FROM b_export_sources s WHERE s.export_id=b_exports.id AND (s.source_key IN (SELECT 'time:'||t.id FROM b_time t JOIN b_jobs j ON j.id=t.job_id WHERE j.client_id=?2) OR s.source_key IN (SELECT 'exp:'||e.id FROM b_expenses e WHERE e.client_id=?2) OR s.source_key IN (SELECT 'fee:'||j.id FROM b_jobs j WHERE j.client_id=?2)))", 'Billing export'],
    }[body.scope as 'job' | 'file' | 'engagement' | 'export'];
    insist(await stmt(db, found[0], target, clientId).first(), `${found[1]} not found for this client`, 404);
  }
  if (body.kind === 'hold') {
    owner = await holdOwner(db, actor, body.owner);
    review = date(body.reviewDate, 'Review date');
    insist(review > today, 'Choose a review date after today');
  } else {
    until = date(body.until, 'Retain until');
    const floor = await keptTo(db, clientId, body.scope, target, today);
    insist(until > floor, `Retention can only be extended: choose a date after ${floor}`);
  }
  const markId = id();
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_retention_marks(id,client_id,scope,target_id,class,kind,until,owner,review_date,reason,placed_by,placed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', markId, owning, body.scope, target, cls, body.kind, until, owner, review, reason, actor.email, now()),
    audit(db, actor, body.kind === 'hold' ? 'retention.held' : 'retention.retained', clientId, `${body.scope} ${target ?? cls ?? ''}${owning ? '' : ' (whole firm)'}${until ? ` until ${until}` : ` owner ${owner} review ${review}`}: ${reason}`)]);
  return { id: markId, scope: body.scope, targetId: target, class: cls, kind: body.kind, until, owner, reviewDate: review };
}

export async function releaseMark(db: D1Database, actor: Actor, markId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const mark = await stmt(db, 'SELECT * FROM b_retention_marks WHERE id=?', markId).first<Data>();
  insist(mark, 'Retention mark not found', 404);
  insist(!mark.released_at, 'This mark was already released', 409);
  const reason = text(body.reason, 'Release reason', 1000);
  await atomic(db, actor, [
    stmt(db, 'UPDATE b_retention_marks SET released_by=?,released_at=?,release_reason=? WHERE id=? AND released_at IS NULL', actor.email, now(), reason, markId),
    audit(db, actor, 'retention.released', mark.client_id ?? 'firm', `${mark.scope} ${mark.target_id ?? mark.class ?? ''}: ${reason}`)]);
  return { id: markId, released: true };
}

/** A client's, contact's or prospect's request reaches the principal, who records who asked, how, when, how it was verified and why. */
export async function recordRequest(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  await clientRow(db, clientId);
  insist((SUBJECTS as readonly string[]).includes(body.subjectKind ?? 'client'), 'Choose client, contact or prospect');
  const kind = body.subjectKind ?? 'client', subject = kind === 'client' ? clientId : text(body.subjectId, 'Subject');
  if (kind === 'contact') insist(await stmt(db, 'SELECT 1 FROM b_client_contacts WHERE id=? AND client_id=?', subject, clientId).first(), 'Contact not found for this client', 404);
  if (kind === 'prospect') insist(await stmt(db, 'SELECT 1 FROM b_prospects WHERE id=? AND client_id=?', subject, clientId).first(), 'Prospect not found for this client', 404);
  const requestId = id();
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_deletion_requests(id,client_id,subject_kind,subject_id,requester,channel,received_on,verification,reason,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      requestId, clientId, kind, subject, text(body.requester, 'Requester', 200), text(body.channel, 'Channel', 200), date(body.receivedOn, 'Received date'), text(body.verification, 'Verification note', 1000), text(body.reason, 'Reason', 1000), actor.email, now()),
    audit(db, actor, 'retention.request_recorded', clientId, `${kind} ${subject}; ${String(body.channel).trim()}`)]);
  return { id: requestId, subjectKind: kind, subjectId: subject };
}

/** Record that a copy of client data lives with a named holder outside Blotter. */
export async function recordCopy(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const c = await clientRow(db, clientId);
  insist(!c.erased_at, 'This client was already erased', 409);
  insist((COPY_KINDS as readonly string[]).includes(body.kind), 'Choose document, provider or buyer copy');
  const copyId = id();
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_external_copies(id,client_id,kind,system,holder,note,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)', copyId, clientId, body.kind, text(body.system, 'System', 200), text(body.holder, 'Named holder', 200), optional(body.note, 'Note', 1000), actor.email, now()),
    audit(db, actor, 'retention.copy_recorded', clientId, `${body.kind}: ${String(body.system).trim()}; holder ${String(body.holder).trim()}`)]);
  return { id: copyId };
}

/** The principal confirms the holder deleted the copy. Blotter cannot verify that and says so. */
export async function closeCopy(db: D1Database, actor: Actor, copyId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const copy = await stmt(db, 'SELECT * FROM b_external_copies WHERE id=?', copyId).first<Data>();
  insist(copy, 'Copy not found', 404);
  insist(!copy.closed_at, 'This copy was already closed', 409);
  const note = text(body.note, 'Who confirmed deletion, and how', 1000);
  await atomic(db, actor, [
    stmt(db, 'UPDATE b_external_copies SET closed_by=?,closed_at=?,closed_note=? WHERE id=? AND closed_at IS NULL', actor.email, now(), note, copyId),
    audit(db, actor, 'retention.copy_closed', copy.client_id, `${copy.system}: ${note}`)]);
  return { id: copyId, closed: true };
}
