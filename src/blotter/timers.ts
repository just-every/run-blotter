// Running timers and time budgets (TIME-005 slice). A person runs at most one
// timer; it lives in D1, so it keeps running across restarts and devices.
// Stopping records one time entry through the same path as manual time: the
// rate in force snapshotted, closed periods refused. Minutes are the elapsed
// time rounded up to the next whole minute (at least 1, at most 1440), dated
// the UTC day the timer started, billable or not and against the task chosen when it started.
import { billableFlag, newEntry, taskOrdinal } from './billing';
import { atomic, audit, guard, human, insist, job, now, stmt, text, type Actor, type Data } from './model';

export async function startTimer(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await job(db, actor, jobId);
  const running = await stmt(db, 'SELECT t.*,j.title FROM b_timers t JOIN b_jobs j ON j.id=t.job_id WHERE t.person_email=?', actor.email).first<Data>();
  insist(!running, `Your timer is already running on ${running?.title}; stop it first`, 409);
  const timer = { job_id: j.id, description: text(body.description, 'Description', 500), billable: billableFlag(body.billable), step_ordinal: await taskOrdinal(db, j, body.taskOrdinal), started_at: now() };
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_timers(person_email,job_id,description,billable,step_ordinal,started_at) VALUES(?,?,?,?,?,?)', actor.email, timer.job_id, timer.description, timer.billable ? 1 : 0, timer.step_ordinal, timer.started_at),
    audit(db, actor, 'timer.started', j.id, timer.description)]);
  return { ...timer, title: j.title };
}

async function mine(db: D1Database, actor: Actor) {
  human(actor);
  const timer = await stmt(db, 'SELECT * FROM b_timers WHERE person_email=?', actor.email).first<Data>();
  insist(timer, 'No timer is running', 404);
  return timer;
}

export async function stopTimer(db: D1Database, actor: Actor) {
  const timer = await mine(db, actor);
  const minutes = Math.max(1, Math.ceil((Date.now() - Date.parse(timer.started_at)) / 60_000));
  insist(minutes <= 1440, 'This timer ran for more than 24 hours; discard it and enter the time by hand', 409);
  const { entry, statements } = await newEntry(db, actor, await job(db, actor, timer.job_id), { date: timer.started_at.slice(0, 10), minutes, description: timer.description, billable: !!timer.billable, taskOrdinal: timer.step_ordinal });
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_timers WHERE person_email=? AND started_at=?)', actor.email, timer.started_at);
  await atomic(db, actor, [check, ...statements, stmt(db, 'DELETE FROM b_timers WHERE person_email=?', actor.email), release,
    audit(db, actor, 'time.added', entry.id, `${entry.minutes} min at ${entry.rateCents} (${entry.rateSource}) from a timer started ${timer.started_at}`)]);
  return entry;
}

export async function discardTimer(db: D1Database, actor: Actor) {
  const timer = await mine(db, actor);
  await atomic(db, actor, [stmt(db, 'DELETE FROM b_timers WHERE person_email=? AND started_at=?', actor.email, timer.started_at),
    audit(db, actor, 'timer.discarded', timer.job_id, timer.description)]);
  return { ok: true };
}

export const myTimer = (db: D1Database, actor: Actor) =>
  stmt(db, 'SELECT t.*,j.title FROM b_timers t JOIN b_jobs j ON j.id=t.job_id WHERE t.person_email=?', actor.email).first<Data>();

/** Actual against the approved budget: every recorded entry (any review state) plus adjustments, at their snapshotted amounts. */
export async function budget(db: D1Database, j: Data) {
  const actual = await stmt(db, `SELECT COALESCE((SELECT SUM(minutes) FROM b_time WHERE job_id=?1),0)+COALESCE((SELECT SUM(a.minutes) FROM b_time_adjustments a JOIN b_time t ON t.id=a.entry_id WHERE t.job_id=?1),0) minutes,
    COALESCE((SELECT SUM(amount_cents) FROM b_time WHERE job_id=?1),0)+COALESCE((SELECT SUM(a.amount_cents) FROM b_time_adjustments a JOIN b_time t ON t.id=a.entry_id WHERE t.job_id=?1),0) cents`, j.id).first<Data>();
  return { currency: j.currency, budgetMinutes: j.budget_minutes ?? null, actualMinutes: actual!.minutes, actualCents: actual!.cents, varianceMinutes: j.budget_minutes == null ? null : actual!.minutes - j.budget_minutes };
}
