// Time with snapshotted rates and once-only, reviewed billing exports.
// Rates snapshot as in just-every/run-gauge src/gauge/time.ts; export review and
// source reservations as in just-every/run-satchel src/satchel/billing.ts (MIT).
import { atomic, audit, date, digest, guard, human, id, insist, integer, job, need, now, rows, stmt, text, type Actor, type Data } from './model';

/** Whole cents, rounded half up: minutes × hourly cents ÷ 60. */
export const amount = (minutes: number, rateCents: number) => Math.floor((minutes * rateCents + 30) / 60);

export async function addTime(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await job(db, actor, jobId);
  const rate = await stmt(db, 'SELECT rate_cents FROM b_rates WHERE email=?', actor.email).first<{ rate_cents: number }>();
  insist(rate, 'Ask the principal to set your hourly rate first', 409);
  const entry = {
    id: id(), date: date(body.date), minutes: integer(body.minutes, 'Minutes', 1, 1440),
    description: text(body.description, 'Description', 500), rateCents: rate.rate_cents,
  };
  const total = amount(entry.minutes, entry.rateCents);
  // The rate is re-read inside the batch: a rate change between read and write fails the batch.
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_rates WHERE email=? AND rate_cents=?)', actor.email, entry.rateCents);
  await atomic(db, actor, [check,
    stmt(db, 'INSERT INTO b_time(id,job_id,person_email,date,minutes,rate_cents,amount_cents,description,created_by,created_channel,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      entry.id, j.id, actor.email, entry.date, entry.minutes, entry.rateCents, total, entry.description, actor.email, actor.channel, now()),
    release, audit(db, actor, 'time.added', entry.id, `${entry.minutes} min`)]);
  return { ...entry, amountCents: total };
}

export async function deleteTime(db: D1Database, actor: Actor, entryId: string) {
  human(actor);
  const entry = await stmt(db, 'SELECT * FROM b_time WHERE id=?', entryId).first<Data>();
  insist(entry, 'Time entry not found', 404);
  await job(db, actor, entry.job_id);
  insist(entry.person_email === actor.email || actor.role === 'owner', 'Only the person who recorded it or the principal can delete it', 403);
  await atomic(db, actor, [stmt(db, 'DELETE FROM b_time WHERE id=?', entryId), audit(db, actor, 'time.deleted', entryId, `${entry.minutes} min`)]);
  return { ok: true };
}

/** Billable sources not yet in a live export: time, and fixed fees of signed-off jobs. */
export async function unbilled(db: D1Database) {
  const time = await rows(db, `SELECT 'time:'||t.id source_key,'time' kind,t.id source_id,t.job_id,t.date,t.person_email person,t.description,t.minutes,t.rate_cents,t.amount_cents,
      j.title job,j.period_label period,c.name client,c.abn
    FROM b_time t JOIN b_jobs j ON j.id=t.job_id JOIN b_clients c ON c.id=j.client_id
    WHERE NOT EXISTS(SELECT 1 FROM b_export_sources s WHERE s.source_key='time:'||t.id) ORDER BY c.name,t.date,t.created_at`);
  const fees = await rows(db, `SELECT 'fee:'||j.id source_key,'fee' kind,j.id source_id,j.id job_id,substr(j.signed_off_at,1,10) date,j.signed_off_by person,'Fixed fee' description,NULL minutes,NULL rate_cents,j.fee_cents amount_cents,
      j.title job,j.period_label period,c.name client,c.abn
    FROM b_jobs j JOIN b_clients c ON c.id=j.client_id
    WHERE j.status='signed_off' AND j.fee_cents>0 AND NOT EXISTS(SELECT 1 FROM b_export_sources s WHERE s.source_key='fee:'||j.id) ORDER BY c.name,j.signed_off_at`);
  return [...fees, ...time];
}

export async function billingState(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  return {
    unbilled: await unbilled(db),
    exports: await rows(db, 'SELECT id,title,status,total_cents,csv_sha256,revision,prepared_by,prepared_channel,prepared_at,approved_by,approved_at,review_note,voided_by,void_reason,snapshot FROM b_exports ORDER BY prepared_at DESC'),
  };
}

export async function prepareExport(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const title = text(body.title, 'Export title', 120);
  insist(Array.isArray(body.sourceKeys) && body.sourceKeys.length > 0 && body.sourceKeys.length <= 500, 'Choose between 1 and 500 billable items');
  const wanted = new Set(body.sourceKeys as string[]);
  insist(wanted.size === body.sourceKeys.length, 'Each item can appear once');
  const available = (await unbilled(db)).filter(line => wanted.has(line.source_key));
  insist(available.length === wanted.size, 'Some items were already exported or no longer exist. Refresh and try again.', 409);
  const lines: Data[] = available.map((line, n) => ({ line: n + 1, ...line }));
  const total = lines.reduce((sum, line) => sum + Number(line.amount_cents), 0);
  const exportId = actor.approval?.resultId ?? id();
  await atomic(db, actor, [
    stmt(db, "INSERT INTO b_exports(id,title,status,snapshot,total_cents,revision,prepared_by,prepared_channel,prepared_at) VALUES(?,?,'draft',?,?,?,?,?,?)",
      exportId, title, JSON.stringify({ lines, totalCents: total, currency: 'AUD' }), total, id(), actor.email, actor.channel, now()),
    // The primary key reserves each source for exactly one live export.
    ...lines.map(line => stmt(db, 'INSERT INTO b_export_sources(source_key,export_id) VALUES(?,?)', line.source_key, exportId)),
    audit(db, actor, 'export.prepared', exportId, `${lines.length} lines, ${total} cents`),
  ]);
  return { id: exportId, title, status: 'draft', totalCents: total, lines };
}

const cell = (value: unknown) => { const v = value === null || value === undefined ? '' : String(value); return /[",\n\r]/.test(v) || /^[=+\-@]/.test(v) ? `"${(/^[=+\-@]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"` : v; };
export function exportCsv(exportId: string, snapshot: Data) {
  const header = ['export_id', 'line', 'client', 'abn', 'job', 'period', 'kind', 'date', 'person', 'description', 'minutes', 'rate_cents', 'amount_cents', 'currency'];
  const body = snapshot.lines.map((l: Data) => [exportId, l.line, l.client, l.abn, l.job, l.period, l.kind, l.date, l.person, l.description, l.minutes, l.rate_cents, l.amount_cents, 'AUD']);
  return [header, ...body, [exportId, 'total', '', '', '', '', '', '', '', '', '', '', snapshot.totalCents, 'AUD']].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export async function approveExport(db: D1Database, actor: Actor, exportId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const e = await stmt(db, 'SELECT * FROM b_exports WHERE id=?', exportId).first<Data>();
  insist(e, 'Export not found', 404);
  insist(e.status === 'draft', 'Only a draft export can be approved', 409);
  insist(body.revision === e.revision, 'The export changed. Refresh and try again.', 409);
  const note = text(body.reviewNote, 'Review note', 1000);
  const csv = exportCsv(e.id, JSON.parse(e.snapshot));
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_exports WHERE id=? AND revision=? AND status='draft')", e.id, e.revision);
  await atomic(db, actor, [check,
    stmt(db, "UPDATE b_exports SET status='approved',csv=?,csv_sha256=?,approved_by=?,approved_at=?,review_note=?,revision=? WHERE id=?", csv, await digest(csv), actor.email, now(), note, id(), e.id),
    release, audit(db, actor, 'export.approved', e.id, note)]);
  return { id: e.id, status: 'approved' };
}

export async function voidExport(db: D1Database, actor: Actor, exportId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const e = await stmt(db, 'SELECT * FROM b_exports WHERE id=?', exportId).first<Data>();
  insist(e, 'Export not found', 404);
  insist(e.status === 'draft', 'Approved exports are permanent; only a draft can be voided', 409);
  const reason = text(body.reason, 'Reason', 500);
  await atomic(db, actor, [
    stmt(db, "UPDATE b_exports SET status='void',voided_by=?,voided_at=?,void_reason=?,revision=? WHERE id=? AND status='draft'", actor.email, now(), reason, id(), e.id),
    stmt(db, 'DELETE FROM b_export_sources WHERE export_id=?', e.id),
    audit(db, actor, 'export.voided', e.id, reason)]);
  return { id: e.id, status: 'void' };
}

export async function downloadExport(db: D1Database, actor: Actor, exportId: string) {
  need(actor, 'owner', 'reviewer');
  const e = await stmt(db, 'SELECT * FROM b_exports WHERE id=?', exportId).first<Data>();
  insist(e, 'Export not found', 404);
  insist(e.status === 'approved', 'Approve the export before downloading it', 409);
  return new Response(e.csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="blotter-export-${e.id.slice(0, 8)}.csv"`, 'cache-control': 'no-store' } });
}
