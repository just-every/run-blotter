// ERASURE-002 Ready to erase (ct 22 Oct 2026). Nothing expires or is purged automatically:
// a retained record whose period (or later retain-until date) has passed is listed here and is
// erased only when the principal confirms it. Confirmation removes the record's bytes and
// personal fields and keeps the record, its kind, number, totals, revision, sign-off
// attribution and SHA-256. A held record is skipped and named.
import { createPortability } from '@runeditrun/rer/modules/portability';
import policy from './archive-policy.mjs';
import { firmToday, marksCovering } from './client-retention';
import { GUARDS } from './client-erasure';
import { lit } from './erasure-scope';
import { clocks, type Clocked } from './retention-clock';
import { atomic, audit, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';

type Effect = { table: string; label: string; where: string; set?: string; action: 'redact' | 'delete' };
const MARK = '[erased]';

/** What confirming one record removes: bytes and personal fields only; ids, kinds, totals, revisions, attribution and hashes stay. */
function effects(record: Clocked, at: string): Effect[] {
  const r = lit(record.id);
  if (record.kind === 'job') return [
    { table: 'b_files', label: 'Accepted document bytes (name, size and SHA-256 stay)', where: `job_id=${r} AND erased_at IS NULL`, set: `content_base64=NULL,erased_at=${lit(at)},erased_by='retention expiry',erase_reason='retention period ended'`, action: 'redact' },
    { table: 'b_file_text', label: 'Extracted text', where: `file_id IN (SELECT id FROM b_files WHERE job_id=${r})`, action: 'delete' },
    { table: 'b_organizer_submissions', label: 'Consumed organizer originals', where: `organizer_id IN (SELECT id FROM b_job_organizers WHERE job_id=${r}) AND erased_at IS NULL`, set: `answers=NULL,review_note=NULL,erased_at=${lit(at)}`, action: 'redact' },
    { table: 'b_job_answers', label: 'Recorded answers', where: `job_id=${r} AND value IS NOT NULL`, set: 'value=NULL', action: 'redact' },
    { table: 'b_job_steps', label: 'Checklist attachment bytes', where: `job_id=${r} AND attachment_base64 IS NOT NULL`, set: 'attachment_base64=NULL', action: 'redact' },
    { table: 'b_deliverable_versions', label: 'Approved deliverable bytes', where: `job_id=${r} AND content_base64<>''`, set: `content_base64='',note='${MARK}'`, action: 'redact' },
    { table: 'b_document_annotations', label: 'Annotations', where: `file_id IN (SELECT id FROM b_files WHERE job_id=${r}) AND note<>'${MARK}'`, set: `note='${MARK}'`, action: 'redact' },
    { table: 'b_readiness_questions', label: 'Readiness decision notes', where: `job_id=${r} AND (decision_note IS NOT NULL OR resolution IS NOT NULL)`, set: 'decision_note=NULL,resolution=NULL', action: 'redact' },
  ];
  if (record.kind === 'engagement') return [
    { table: 'b_engagements', label: 'Signed letter bytes and signer names (title, signed date and SHA-256 stay)', where: `id=${r} AND erased_at IS NULL`, set: `content_base64=NULL,title='${MARK}',signers='["${MARK}"]',erased_at=${lit(at)}`, action: 'redact' },
  ];
  const lines = `(SELECT substr(source_key,6) FROM b_export_sources WHERE export_id=${r} AND source_key LIKE 'time:%')`, spend = `(SELECT substr(source_key,5) FROM b_export_sources WHERE export_id=${r} AND source_key LIKE 'exp:%')`;
  return [
    { table: 'b_exports', label: 'Approved export CSV bytes and line snapshot (number, totals, revision and SHA-256 stay)', where: `id=${r} AND csv<>''`, set: `csv='',snapshot=json_object('erased',1,'totalCents',total_cents)`, action: 'redact' },
    { table: 'b_time', label: 'Snapshotted time descriptions', where: `id IN ${lines} AND description<>'${MARK}'`, set: `description='${MARK}'`, action: 'redact' },
    { table: 'b_expenses', label: 'Snapshotted expense descriptions and receipts', where: `id IN ${spend} AND description<>'${MARK}'`, set: `description='${MARK}',receipt_name=NULL,receipt_mime=NULL,receipt_size=NULL,receipt_base64=NULL`, action: 'redact' },
  ];
}

async function confirmed(db: D1Database) { return new Set((await rows(db, 'SELECT kind||\':\'||record_id k FROM b_expiry_erasures')).map(r => String(r.k))); }

/** Every retained record past its date that no hold preserves, with what confirming it removes. */
export async function readyToErase(db: D1Database, actor: Actor) {
  human(actor); need(actor, 'owner');
  const today = await firmToday(db), done = await confirmed(db), ready: Data[] = [], skipped: Data[] = [];
  for (const c of await clocks(db)) {
    if (done.has(`${c.kind}:${c.id}`)) continue;
    const target = { clientIds: c.clientIds, ...(c.kind === 'job' ? { jobId: c.id } : c.kind === 'engagement' ? { engagementId: c.id } : { exportId: c.id }), cls: c.cls };
    const marks = await marksCovering(db, target), files = c.kind === 'job' ? await rows(db, 'SELECT id FROM b_files WHERE job_id=?', c.id) : [];
    const fileHolds = (await marksCovering(db, { ...target, fileId: undefined }, ['hold'])).length ? [] : (await rows(db, "SELECT id,target_id,reason,owner FROM b_retention_marks WHERE scope='file' AND kind='hold' AND released_at IS NULL")).filter(m => files.some(f => f.id === m.target_id));
    const until = marks.filter(m => m.kind === 'retain').map(m => String(m.until)).sort().at(-1) ?? null, effective = [c.expiry, until].filter(Boolean).sort().at(-1)!;
    const holds = [...marks.filter(m => m.kind === 'hold'), ...fileHolds];
    const row = { kind: c.kind, id: c.id, class: c.cls, clientIds: c.clientIds, client: (await rows(db, 'SELECT name FROM b_clients WHERE id=?', c.clientIds[0]))[0]?.name ?? null, label: c.label, clock: c.clock, years: c.years, expiry: c.expiry, retainedUntil: until, effective };
    if (effective >= today) continue;
    if (holds.length) { skipped.push({ ...row, heldBy: holds.map(h => ({ id: h.id, reason: h.reason, owner: h.owner })) }); continue; }
    const counts = [];
    for (const e of effects(c, now())) counts.push({ table: e.table, label: e.label, count: Number((await stmt(db, `SELECT count(*) n FROM ${e.table} WHERE ${e.where}`).first<Data>())?.n ?? 0) });
    ready.push({ ...row, effects: counts.filter(e => e.count > 0) });
  }
  return { today, ready, held: skipped };
}

/** The principal confirms one Ready to erase record. Bytes and personal fields go; the record stays. */
export async function confirmExpiry(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const reason = text(body.reason, 'Reason', 1000), list = await readyToErase(db, actor);
  const item = list.ready.find(r => r.kind === body.kind && r.id === body.id);
  const held = list.held.find(r => r.kind === body.kind && r.id === body.id);
  insist(!held, `This record is preserved by hold ${String(held?.heldBy?.[0]?.id ?? '').slice(0, 8)} (${held?.heldBy?.[0]?.reason}). Release the hold first.`, 409);
  insist(item, 'This record is not past its retention date, was already erased, or is not retained', 409);
  const record = (await clocks(db)).find(c => c.kind === item.kind && c.id === item.id)!, at = now(), list2 = effects(record, at);
  const triggers = await rows(db, `SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN (${[...GUARDS, 'b_exports_transition'].map(() => '?').join(',')})`, ...GUARDS, 'b_exports_transition');
  const service = await createPortability({ db, policy }), expiryId = id();
  const [check, release] = guard(db, 'NOT EXISTS(SELECT 1 FROM b_expiry_erasures WHERE kind=? AND record_id=?)', item.kind, item.id);
  const batch: D1PreparedStatement[] = [check, ...triggers.map(t => stmt(db, `DROP TRIGGER ${t.name}`)),
    stmt(db, 'INSERT INTO b_expiry_erasures(id,kind,record_id,client_id,reason,confirmed_by,confirmed_at,counts,journal_epoch) VALUES(?,?,?,?,?,?,?,?,0)', expiryId, item.kind, item.id, item.clientIds[0] ?? null, reason, actor.email, at, JSON.stringify(item.effects))];
  for (const e of list2) batch.push(stmt(db, e.action === 'delete' ? `DELETE FROM ${e.table} WHERE ${e.where}` : `UPDATE ${e.table} SET ${e.set} WHERE ${e.where}`));
  batch.push(...triggers.map(t => stmt(db, String(t.sql))), ...await service.redactionStatements(), ...await service.invalidateTransfersStatements(), audit(db, actor, 'retention.expired', item.id, `${item.kind}; ${item.class}; ${reason}`), release);
  await atomic(db, actor, batch);
  const epoch = Number((await stmt(db, 'SELECT epoch FROM rer_portability_state WHERE id=1').first<Data>())?.epoch ?? 0);
  await stmt(db, 'UPDATE b_expiry_erasures SET journal_epoch=? WHERE id=?', epoch, expiryId).run();
  return { id: expiryId, kind: item.kind, recordId: item.id, class: item.class, effects: item.effects, journalEpoch: epoch };
}
