// Time with snapshotted rates and once-only, reviewed billing exports.
// Rates snapshot as in just-every/run-gauge src/gauge/time.ts; export review and
// source reservations as in just-every/run-satchel src/satchel/billing.ts (MIT).
import { atomic, audit, date, digest, guard, human, id, insist, integer, job, need, now, rows, stmt, text, type Actor, type Data } from './model';
import { mileageRates, reimbursements } from './expenses';
import { resolveRate, stillResolves } from './rates';

/** Whole cents, rounded half up: minutes × hourly cents ÷ 60. */
export const amount = (minutes: number, rateCents: number) => Math.floor((minutes * rateCents + 30) / 60);

/** SQL that holds while no closed billing period (TIME-002) covers this date. */
export const openPeriodSql = 'NOT EXISTS(SELECT 1 FROM b_periods WHERE ? BETWEEN start_date AND end_date)';

/** Time is billable unless the request says `billable: false` (TIME-001). */
export const billableFlag = (value: unknown, fallback = true) => {
  insist(value === undefined || typeof value === 'boolean', 'Billable is true or false');
  return value === undefined ? fallback : value as boolean;
};

/** The job's checklist task an entry or timer names, if any (TIME-001). */
export async function taskOrdinal(db: D1Database, j: Data, value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const ordinal = integer(value, 'Task', 1, 100);
  insist(await stmt(db, 'SELECT 1 FROM b_job_steps WHERE job_id=? AND ordinal=?', j.id, ordinal).first(), 'That task is not on this job', 404);
  return ordinal;
}

/** A new time entry on a job at the rate in force on its date, as guarded statements. */
export async function newEntry(db: D1Database, actor: Actor, j: Data, body: Data) {
  const day = date(body.date), basis = { date: day, clientId: j.client_id, templateId: j.template_id, workTypeId: j.work_type_id, email: actor.email, role: actor.role };
  const rate = await resolveRate(db, basis);
  insist(rate, `Ask the principal to set a rate in force on ${day} for you, your role, this service or this client`, 409);
  insist(rate.currency === j.currency, `The rate is in ${rate.currency}; set a ${j.currency} rate for this job`, 409);
  const entry = {
    id: id(), date: day, minutes: integer(body.minutes, 'Minutes', 1, 1440),
    description: text(body.description, 'Description', 500), rateCents: rate.rateCents, rateSource: rate.source, rateCardId: rate.cardId, currency: rate.currency,
    billable: billableFlag(body.billable), taskOrdinal: await taskOrdinal(db, j, body.taskOrdinal),
  };
  const total = amount(entry.minutes, entry.rateCents);
  // The rate is resolved again inside the batch: a rate change between read and write fails the batch.
  insist(!await stmt(db, `SELECT 1 WHERE NOT ${openPeriodSql}`, day).first(), `The billing period covering ${day} is closed`, 409);
  const held = stillResolves(basis, rate), [check, release] = guard(db, `${held.sql} AND ${openPeriodSql}`, ...held.params, day);
  return {
    entry: { ...entry, amountCents: total },
    statements: [check,
      stmt(db, 'INSERT INTO b_time(id,job_id,person_email,date,minutes,rate_cents,amount_cents,description,created_by,created_channel,created_at,rate_source,rate_card_id,billable,step_ordinal,currency) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        entry.id, j.id, actor.email, entry.date, entry.minutes, entry.rateCents, total, entry.description, actor.email, actor.channel, now(), entry.rateSource, entry.rateCardId, entry.billable ? 1 : 0, entry.taskOrdinal, entry.currency),
      release],
  };
}

export async function addTime(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const { entry, statements } = await newEntry(db, actor, await job(db, actor, jobId), body);
  await atomic(db, actor, [...statements, audit(db, actor, 'time.added', entry.id, `${entry.minutes} min at ${entry.rateCents} (${entry.rateSource})${entry.billable ? '' : ', not billable'}`)]);
  return entry;
}

export async function deleteTime(db: D1Database, actor: Actor, entryId: string) {
  human(actor);
  const entry = await stmt(db, 'SELECT * FROM b_time WHERE id=?', entryId).first<Data>();
  insist(entry, 'Time entry not found', 404);
  await job(db, actor, entry.job_id);
  insist(entry.person_email === actor.email || actor.role === 'owner', 'Only the person who recorded it or the principal can delete it', 403);
  // Submitted and approved time stays; a returned entry can go. Closed periods are locked.
  const locked = `EXISTS(SELECT 1 FROM b_time_status WHERE entry_id=? AND status IN ('submitted','approved')) OR NOT ${openPeriodSql}`;
  insist(!await stmt(db, `SELECT 1 WHERE ${locked}`, entryId, entry.date).first(), 'Submitted, approved or closed-period time cannot be deleted; the principal posts an adjustment instead', 409);
  const [check, release] = guard(db, `NOT (${locked})`, entryId, entry.date);
  await atomic(db, actor, [check, stmt(db, 'DELETE FROM b_time_status WHERE entry_id=?', entryId), stmt(db, 'DELETE FROM b_time WHERE id=?', entryId), release,
    audit(db, actor, 'time.deleted', entryId, `${entry.minutes} min`)]);
  return { ok: true };
}

/** Billable sources not yet in a live export: approved billable time and its adjustments, fixed fees of signed-off jobs and approved billable expenses (TIME-004). */
/** Ready-to-bill work: approved sources no billing export or invoice (draft or issued) has reserved. */
export async function unbilled(db: D1Database) {
  const time = await rows(db, `SELECT 'time:'||t.id source_key,'time' kind,t.id source_id,t.job_id,t.date,t.person_email person,t.description,t.minutes,t.rate_cents,t.rate_source,t.amount_cents,t.currency,
      j.title job,j.period_label period,c.name client,c.abn
    FROM b_time t JOIN b_time_status st ON st.entry_id=t.id AND st.status='approved' JOIN b_jobs j ON j.id=t.job_id JOIN b_clients c ON c.id=j.client_id
    WHERE t.billable=1 AND NOT EXISTS(SELECT 1 FROM b_export_sources s WHERE s.source_key='time:'||t.id) AND NOT EXISTS(SELECT 1 FROM b_invoice_sources s WHERE s.source_key='time:'||t.id) ORDER BY c.name,t.date,t.created_at`);
  const adjustments = await rows(db, `SELECT 'adj:'||a.id source_key,'adjustment' kind,a.id source_id,t.job_id,substr(a.created_at,1,10) date,t.person_email person,
      'Adjustment to '||t.date||' time: '||a.reason description,a.minutes,t.rate_cents,t.rate_source,a.amount_cents,t.currency,j.title job,j.period_label period,c.name client,c.abn
    FROM b_time_adjustments a JOIN b_time t ON t.id=a.entry_id JOIN b_jobs j ON j.id=t.job_id JOIN b_clients c ON c.id=j.client_id
    WHERE t.billable=1 AND NOT EXISTS(SELECT 1 FROM b_export_sources s WHERE s.source_key='adj:'||a.id) AND NOT EXISTS(SELECT 1 FROM b_invoice_sources s WHERE s.source_key='adj:'||a.id) ORDER BY c.name,a.created_at`);
  const fees = await rows(db, `SELECT 'fee:'||j.id source_key,'fee' kind,j.id source_id,j.id job_id,substr(j.signed_off_at,1,10) date,j.signed_off_by person,'Fixed fee' description,NULL minutes,NULL rate_cents,NULL rate_source,j.fee_cents amount_cents,j.currency,
      j.title job,j.period_label period,c.name client,c.abn
    FROM b_jobs j JOIN b_clients c ON c.id=j.client_id
    WHERE j.status='signed_off' AND j.fee_cents>0 AND NOT EXISTS(SELECT 1 FROM b_export_sources s WHERE s.source_key='fee:'||j.id) AND NOT EXISTS(SELECT 1 FROM b_invoice_sources s WHERE s.source_key='fee:'||j.id) ORDER BY c.name,j.signed_off_at`);
  const expenses = await rows(db, `SELECT 'exp:'||e.id source_key,'expense' kind,e.id source_id,e.job_id,e.date,e.person_email person,
      CASE e.kind WHEN 'filing_fee' THEN 'Filing fee' WHEN 'postage' THEN 'Postage' WHEN 'mileage' THEN 'Mileage' WHEN 'software' THEN 'Software pass-through' ELSE 'Expense' END||': '||e.description
        ||CASE WHEN e.markup_percent>0 THEN ' (cost '||e.cost_cents||' cents + '||e.markup_percent||'% markup)' ELSE '' END description,
      NULL minutes,NULL rate_cents,NULL rate_source,e.charge_cents amount_cents,e.currency,e.cost_cents,e.markup_percent,e.receipt_sha256,j.title job,j.period_label period,c.name client,c.abn
    FROM b_expenses e JOIN b_jobs j ON j.id=e.job_id JOIN b_clients c ON c.id=e.client_id
    WHERE e.status='approved' AND e.billable=1 AND NOT EXISTS(SELECT 1 FROM b_export_sources s WHERE s.source_key='exp:'||e.id) AND NOT EXISTS(SELECT 1 FROM b_invoice_sources s WHERE s.source_key='exp:'||e.id) ORDER BY c.name,e.date,e.created_at`);
  return [...fees, ...time, ...adjustments, ...expenses];
}

/** Work in progress: the value of everything ready to bill, by kind. */
export function wip(lines: Data[]) {
  const currencies = [...new Set(lines.map(l => l.currency))];
  const byCurrency = Object.fromEntries(currencies.map(c => [c, { totalCents: 0, byKind: { fee: 0, time: 0, adjustment: 0, expense: 0 } as Record<string, number> }]));
  for (const line of lines) { const group = byCurrency[line.currency]; group.totalCents += Number(line.amount_cents); group.byKind[line.kind] += Number(line.amount_cents); }
  const byKind: Record<string, number> = { fee: 0, time: 0, adjustment: 0, expense: 0 };
  for (const line of lines) byKind[line.kind] += Number(line.amount_cents);
  return { totalCents: currencies.length > 1 ? null : Object.values(byKind).reduce((a, b) => a + b, 0), byKind: currencies.length > 1 ? null : byKind, currency: currencies[0] ?? 'USD', byCurrency };
}

export async function billingState(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  const lines = await unbilled(db);
  return {
    unbilled: lines, wip: wip(lines), reimbursements: await reimbursements(db), mileageRates: await mileageRates(db),
    exports: await rows(db, 'SELECT id,title,status,total_cents,csv_sha256,revision,prepared_by,prepared_channel,prepared_at,approved_by,approved_at,review_note,voided_by,void_reason,snapshot FROM b_exports ORDER BY prepared_at DESC'),
  };
}

export async function prepareExport(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const title = text(body.title, 'Export title', 120);
  insist(Array.isArray(body.sourceKeys) && body.sourceKeys.length > 0 && body.sourceKeys.length <= 500, 'Choose between 1 and 500 billable items');
  const wanted = new Set(body.sourceKeys as string[]);
  insist(wanted.size === body.sourceKeys.length, 'Each item can appear once');
  const expenseIds = [...wanted].filter(key => String(key).startsWith('exp:')).map(key => String(key).slice(4));
  if (expenseIds.length) insist(!await stmt(db, "SELECT 1 FROM b_expenses WHERE id IN (SELECT value FROM json_each(?)) AND (status<>'approved' OR billable=0)", JSON.stringify(expenseIds)).first(),
    'Only approved billable expenses can be billed', 409);
  const timeIds = [...wanted].filter(key => String(key).startsWith('time:')).map(key => String(key).slice(5));
  if (timeIds.length) insist(!await stmt(db, 'SELECT 1 FROM b_time WHERE id IN (SELECT value FROM json_each(?)) AND billable=0', JSON.stringify(timeIds)).first(),
    'Non-billable time cannot be billed', 409);
  const available = (await unbilled(db)).filter(line => wanted.has(line.source_key));
  insist(available.length === wanted.size, 'Some items were already exported or no longer exist. Refresh and try again.', 409);
  const lines: Data[] = available.map((line, n) => ({ line: n + 1, ...line }));
  const currency = lines[0].currency;
  insist(lines.every(line => line.currency === currency), 'Choose items in one currency per export; amounts are never converted', 409);
  const total = lines.reduce((sum, line) => sum + Number(line.amount_cents), 0);
  const exportId = actor.approval?.resultId ?? id();
  await atomic(db, actor, [
    stmt(db, "INSERT INTO b_exports(id,title,status,snapshot,total_cents,revision,prepared_by,prepared_channel,prepared_at) VALUES(?,?,'draft',?,?,?,?,?,?)",
      exportId, title, JSON.stringify({ lines, totalCents: total, currency, taxIdTypes: true }), total, id(), actor.email, actor.channel, now()),
    // The primary key reserves each source for exactly one live export.
    ...lines.map(line => stmt(db, 'INSERT INTO b_export_sources(source_key,export_id) VALUES(?,?)', line.source_key, exportId)),
    audit(db, actor, 'export.prepared', exportId, `${lines.length} lines, ${total} cents`),
  ]);
  return { id: exportId, title, status: 'draft', totalCents: total, currency, lines };
}

const cell = (value: unknown) => { const v = value === null || value === undefined ? '' : String(value); return /[",\n\r]/.test(v) || /^[=+\-@]/.test(v) ? `"${(/^[=+\-@]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"` : v; };
export function exportCsv(exportId: string, snapshot: Data) {
  const currency = snapshot.currency ?? 'AUD'; // Snapshots predating currency were AUD.
  const header = ['export_id', 'line', 'client', ...(!snapshot.taxIdTypes ? ['abn'] : ['tax_id', 'tax_id_type']), 'job', 'period', 'kind', 'date', 'person', 'description', 'minutes', 'rate_cents', 'amount_cents', 'currency'];
  const body = snapshot.lines.map((l: Data) => [exportId, l.line, l.client, ...(!snapshot.taxIdTypes ? [l.abn] : [l.abn, l.abn ? (String(l.abn).length === 11 ? 'ABN' : 'EIN') : '']), l.job, l.period, l.kind, l.date, l.person, l.description, l.minutes, l.rate_cents, l.amount_cents, l.currency ?? currency]);
  return [header, ...body, [exportId, 'total', '', '', '', '', '', '', '', '', '', '', ...(!snapshot.taxIdTypes ? [] : ['']), snapshot.totalCents, currency]].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
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
  await atomic(db, actor, [audit(db, actor, 'export.downloaded', e.id, e.csv_sha256)]);
  return new Response(e.csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="blotter-export-${e.id.slice(0, 8)}.csv"`, 'cache-control': 'no-store' } });
}
