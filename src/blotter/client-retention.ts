// ERASURE-002 retention: the principal marks records to keep (a hold, or a retain-until
// date) and records copies held outside this installation. Owner only, person only,
// every change audited. Nothing here expires, deletes or sends anything.
import { atomic, audit, date, human, id, insist, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

const COPY_KINDS = ['document', 'provider', 'buyer'] as const;

async function clientRow(db: D1Database, clientId: string) {
  const c = await stmt(db, 'SELECT id,name,lifecycle,erased_at FROM b_clients WHERE id=?', clientId).first<Data>();
  insist(c, 'Client not found', 404);
  return c;
}

export async function retentionState(db: D1Database, actor: Actor, clientId: string) {
  human(actor); need(actor, 'owner');
  await clientRow(db, clientId);
  return {
    marks: await rows(db, 'SELECT id,scope,target_id,kind,until,reason,placed_by,placed_at,released_by,released_at,release_reason FROM b_retention_marks WHERE client_id=? ORDER BY placed_at,id', clientId),
    copies: await rows(db, 'SELECT id,kind,system,holder,note,recorded_by,recorded_at,closed_by,closed_at,closed_note FROM b_external_copies WHERE client_id=? ORDER BY recorded_at,id', clientId),
  };
}

/** Hold a client, one job or one file; or retain it until a date. */
export async function placeMark(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const c = await clientRow(db, clientId);
  insist(!c.erased_at, 'This client was already erased', 409);
  insist(['client', 'job', 'file'].includes(body.scope), 'Choose client, job or file');
  insist(body.kind === 'hold' || body.kind === 'retain', 'Choose hold or retain until a date');
  const until = body.kind === 'retain' ? date(body.until, 'Retain until') : null, reason = text(body.reason, 'Reason', 1000);
  let target = clientId;
  if (body.scope === 'job') {
    target = text(body.targetId, 'Job');
    insist(await stmt(db, 'SELECT 1 FROM b_jobs WHERE id=? AND client_id=?', target, clientId).first(), 'Job not found for this client', 404);
  } else if (body.scope === 'file') {
    target = text(body.targetId, 'File');
    insist(await stmt(db, 'SELECT 1 FROM b_files f JOIN b_jobs j ON j.id=f.job_id WHERE f.id=? AND j.client_id=?', target, clientId).first(), 'File not found for this client', 404);
  }
  const markId = id();
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_retention_marks(id,client_id,scope,target_id,kind,until,reason,placed_by,placed_at) VALUES(?,?,?,?,?,?,?,?,?)', markId, clientId, body.scope, target, body.kind, until, reason, actor.email, now()),
    audit(db, actor, body.kind === 'hold' ? 'retention.held' : 'retention.retained', clientId, `${body.scope} ${target}${until ? ` until ${until}` : ''}: ${reason}`)]);
  return { id: markId, scope: body.scope, targetId: target, kind: body.kind, until };
}

export async function releaseMark(db: D1Database, actor: Actor, markId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const mark = await stmt(db, 'SELECT * FROM b_retention_marks WHERE id=?', markId).first<Data>();
  insist(mark, 'Retention mark not found', 404);
  insist(!mark.released_at, 'This mark was already released', 409);
  const reason = text(body.reason, 'Release reason', 1000);
  await atomic(db, actor, [
    stmt(db, 'UPDATE b_retention_marks SET released_by=?,released_at=?,release_reason=? WHERE id=? AND released_at IS NULL', actor.email, now(), reason, markId),
    audit(db, actor, 'retention.released', mark.client_id, `${mark.scope} ${mark.target_id}: ${reason}`)]);
  return { id: markId, released: true };
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
