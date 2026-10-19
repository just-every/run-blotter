// Timesheets and period locks (TIME-002): a person submits a Monday-to-Sunday
// week of their time; a reviewer or the principal approves or returns each
// entry with a reason; the person corrects a returned entry. Only approved time
// is billable. Closing a billing period locks its approved time, and the
// principal corrects locked time with an adjustment that keeps the original.
import { amount, newEntry, openPeriodSql } from './billing';
import { atomic, audit, date, guard, human, id, insist, integer, job, need, now, rows, stmt, text, type Actor, type Data } from './model';

const DAY = 86_400_000;
const shift = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
/** The Monday that starts this date's timesheet week. */
export const weekStart = (day: string) => shift(day, -((new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7));

export async function timesheets(db: D1Database, actor: Actor) {
  const lead = actor.role !== 'preparer';
  return {
    entries: await rows(db, `SELECT t.id,t.job_id,t.person_email,t.date,t.minutes,t.rate_cents,t.amount_cents,t.description,
        s.status,s.week_start,s.reason,s.submitted_at,s.decided_by,s.decided_at,j.title job,j.period_label period,c.name client,
        EXISTS(SELECT 1 FROM b_periods p WHERE t.date BETWEEN p.start_date AND p.end_date) locked
      FROM b_time t JOIN b_jobs j ON j.id=t.job_id JOIN b_clients c ON c.id=j.client_id LEFT JOIN b_time_status s ON s.entry_id=t.id
      WHERE ? OR t.person_email=? ORDER BY t.date DESC,t.created_at DESC LIMIT 500`, lead ? 1 : 0, actor.email),
    periods: await rows(db, 'SELECT * FROM b_periods ORDER BY start_date DESC'),
  };
}

/** Submit every not-yet-submitted entry of the actor's week. */
export async function submitWeek(db: D1Database, actor: Actor, body: Data) {
  human(actor);
  const start = date(body.weekStart, 'Week starting');
  insist(weekStart(start) === start, 'A timesheet week starts on a Monday');
  const end = shift(start, 6), pending = `FROM b_time t WHERE t.person_email=? AND t.date BETWEEN ? AND ? AND NOT EXISTS(SELECT 1 FROM b_time_status s WHERE s.entry_id=t.id)`;
  const count = Number((await stmt(db, `SELECT COUNT(*) n ${pending}`, actor.email, start, end).first<Data>())!.n);
  insist(count > 0, 'Nothing new to submit for that week', 409);
  await atomic(db, actor, [
    stmt(db, `INSERT INTO b_time_status(entry_id,person_email,week_start,status,submitted_at) SELECT t.id,t.person_email,?,'submitted',? ${pending}`, start, now(), actor.email, start, end),
    audit(db, actor, 'timesheet.submitted', start, `${count} entries`),
  ]);
  return { weekStart: start, submitted: count };
}

async function entryWithStatus(db: D1Database, actor: Actor, entryId: string) {
  const entry = await stmt(db, 'SELECT t.*,s.status,s.reason FROM b_time t LEFT JOIN b_time_status s ON s.entry_id=t.id WHERE t.id=?', entryId).first<Data>();
  insist(entry, 'Time entry not found', 404);
  await job(db, actor, entry.job_id);
  return entry;
}

/** A reviewer or the principal approves or returns a submitted entry; nobody but the principal approves their own time. */
export async function reviewEntry(db: D1Database, actor: Actor, entryId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const entry = await entryWithStatus(db, actor, entryId);
  insist(entry.status === 'submitted', 'Only submitted time can be approved or returned', 409);
  insist(entry.person_email !== actor.email || actor.role === 'owner', 'Another person approves your time', 403);
  insist(body.decision === 'approve' || body.decision === 'return', 'Choose approve or return');
  const reason = body.decision === 'return' ? text(body.reason, 'Reason for returning', 500) : '';
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_time_status WHERE entry_id=? AND status='submitted')", entryId);
  const status = body.decision === 'approve' ? 'approved' : 'returned';
  await atomic(db, actor, [check,
    stmt(db, 'UPDATE b_time_status SET status=?,reason=?,decided_by=?,decided_at=? WHERE entry_id=?', status, reason, actor.email, now(), entryId), release,
    audit(db, actor, `time.${status}`, entryId, reason)]);
  return { id: entryId, status, reason };
}

/** The person replaces a returned entry with a corrected one, submitted again in the same step. */
export async function correctEntry(db: D1Database, actor: Actor, entryId: string, body: Data) {
  human(actor);
  const entry = await entryWithStatus(db, actor, entryId);
  insist(entry.person_email === actor.email, 'Only the person who recorded it can correct it', 403);
  insist(entry.status === 'returned', 'Only returned time can be corrected; approved time takes an adjustment', 409);
  const { entry: corrected, statements } = await newEntry(db, actor, await job(db, actor, entry.job_id), { date: body.date ?? entry.date, minutes: body.minutes, description: body.description });
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_time_status WHERE entry_id=? AND status='returned')", entryId);
  await atomic(db, actor, [check,
    stmt(db, 'DELETE FROM b_time_status WHERE entry_id=?', entryId), stmt(db, 'DELETE FROM b_time WHERE id=?', entryId), release,
    ...statements,
    stmt(db, "INSERT INTO b_time_status(entry_id,person_email,week_start,status,submitted_at) VALUES(?,?,?,'submitted',?)", corrected.id, actor.email, weekStart(corrected.date), now()),
    audit(db, actor, 'time.corrected', corrected.id, `replaces ${entryId} (${entry.date}, ${entry.minutes} min, "${entry.description}", returned: ${entry.reason})`)]);
  return { ...corrected, status: 'submitted', replaces: entryId };
}

/** Close a billing period once every entry in it is approved; its time is then locked. */
export async function closePeriod(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const start = date(body.startDate, 'Period start'), end = date(body.endDate, 'Period end'), note = text(body.note, 'Closing note', 500);
  insist(end >= start, 'The period ends before it starts');
  const overlap = 'EXISTS(SELECT 1 FROM b_periods WHERE start_date<=? AND end_date>=?)';
  insist(!await stmt(db, `SELECT 1 WHERE ${overlap}`, end, start).first(), 'This overlaps a closed period', 409);
  const open = `(SELECT COUNT(*) FROM b_time t WHERE t.date BETWEEN ? AND ? AND NOT EXISTS(SELECT 1 FROM b_time_status s WHERE s.entry_id=t.id AND s.status='approved'))`;
  const waiting = Number((await stmt(db, `SELECT ${open} n`, start, end).first<Data>())!.n);
  insist(waiting === 0, `${waiting} time ${waiting === 1 ? 'entry' : 'entries'} in this period ${waiting === 1 ? 'is' : 'are'} not approved yet`, 409);
  const periodId = id(), [check, release] = guard(db, `NOT ${overlap} AND ${open}=0`, end, start, start, end);
  await atomic(db, actor, [check,
    stmt(db, 'INSERT INTO b_periods(id,start_date,end_date,note,closed_by,closed_at) VALUES(?,?,?,?,?,?)', periodId, start, end, note, actor.email, now()), release,
    audit(db, actor, 'period.closed', periodId, `${start} to ${end}: ${note}`)]);
  return { id: periodId, startDate: start, endDate: end };
}

/** The principal's authorized correction to approved time: the original entry stays as it was. */
export async function adjustEntry(db: D1Database, actor: Actor, entryId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const entry = await entryWithStatus(db, actor, entryId);
  insist(entry.status === 'approved', 'Only approved time is adjusted; other time is returned and corrected', 409);
  const minutes = integer(body.minutes, 'Minutes to add or remove', -1440, 1440), reason = text(body.reason, 'Reason', 500);
  insist(minutes !== 0, 'An adjustment changes the minutes');
  const prior = Number((await stmt(db, 'SELECT COALESCE(SUM(minutes),0) n FROM b_time_adjustments WHERE entry_id=?', entryId).first<Data>())!.n);
  insist(entry.minutes + prior + minutes >= 0, 'An adjustment cannot take the entry below zero minutes');
  const adjustment = { id: id(), entryId, minutes, amountCents: Math.sign(minutes) * amount(Math.abs(minutes), entry.rate_cents), reason };
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_time_adjustments(id,entry_id,minutes,amount_cents,reason,created_by,created_at) VALUES(?,?,?,?,?,?,?)', adjustment.id, entryId, minutes, adjustment.amountCents, reason, actor.email, now()),
    audit(db, actor, 'time.adjusted', entryId, `${minutes} min, ${adjustment.amountCents} cents: ${reason}`)]);
  return adjustment;
}

/** One entry's history: the entry, its review, its adjustments and its audit trail. */
export async function entryHistory(db: D1Database, actor: Actor, entryId: string) {
  const entry = await entryWithStatus(db, actor, entryId);
  insist(actor.role !== 'preparer' || entry.person_email === actor.email, 'Time entry not found', 404);
  return {
    entry, locked: !!await stmt(db, `SELECT 1 WHERE NOT ${openPeriodSql}`, entry.date).first(),
    review: await stmt(db, 'SELECT * FROM b_time_status WHERE entry_id=?', entryId).first<Data>(),
    adjustments: await rows(db, 'SELECT * FROM b_time_adjustments WHERE entry_id=? ORDER BY created_at', entryId),
    audit: await rows(db, 'SELECT * FROM b_audit WHERE object_id=? ORDER BY at', entryId),
  };
}
