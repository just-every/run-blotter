// Activity suggestions (TIME-008). A person who consents sees one suggestion
// per job and UTC day on which they took audited work actions while consent
// was on and recorded no time of their own on that job. Each suggestion links
// its source actions. Only that person approves it, entering the minutes and
// choosing billable or not, which records time through the manual-entry path,
// or rejects it; nothing is ever recorded without that approval. Email and
// calendar activity (MAIL-004, INTEGRATE-014) are not sources yet.
import { newEntry } from './billing';
import { atomic, audit, date, human, insist, job, now, optional, rows, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';

/** Work actions that suggest time, each mapped to its job. */
const ON_JOB = ['step.done', 'timer.discarded'], ON_REQUEST = ['request.accepted', 'request.returned'], ON_THREAD = ['thread.opened', 'thread.correction_requested', 'thread.replied'];
const list = (actions: string[]) => actions.map(a => `'${a}'`).join(',');
const SOURCES = `SELECT a.id,a.action,a.at,substr(a.at,1,10) day,
    CASE WHEN a.action='step.done' THEN (SELECT label FROM b_job_steps WHERE job_id=a.object_id AND ordinal=CAST(a.detail AS INTEGER)) ELSE a.detail END detail,
    CASE WHEN a.action IN (${list(ON_JOB)}) THEN a.object_id
      WHEN a.action IN (${list(ON_REQUEST)}) THEN (SELECT job_id FROM b_requests WHERE id=a.object_id)
      WHEN a.action IN (${list(ON_THREAD)}) THEN (SELECT job_id FROM b_threads WHERE id=a.object_id)
      ELSE (SELECT job_id FROM b_notices WHERE id=a.object_id) END job_id
  FROM b_audit a WHERE a.actor=? AND a.at>=? AND (a.action IN (${list([...ON_JOB, ...ON_REQUEST, ...ON_THREAD])}) OR a.action LIKE 'notice.%')`;

const consent = (db: D1Database, actor: Actor) => stmt(db, 'SELECT consented_at FROM b_activity_consent WHERE person_email=?', actor.email).first<Data>();

async function pending(db: D1Database, actor: Actor, only?: { jobId: string; day: string }) {
  const given = await consent(db, actor);
  if (!given) return [];
  const found = await rows(db, `WITH s AS (${SOURCES})
    SELECT s.job_id,s.day,json_group_array(json_object('id',s.id,'action',s.action,'detail',s.detail,'at',s.at)) sources,b_jobs.title job,b_jobs.period_label period,c.name client
    FROM s JOIN b_jobs ON b_jobs.id=s.job_id JOIN b_clients c ON c.id=b_jobs.client_id
    WHERE ${visibleJobSql} AND (? IS NULL OR (s.job_id=? AND s.day=?))
      AND NOT EXISTS(SELECT 1 FROM b_time t WHERE t.job_id=s.job_id AND t.person_email=? AND t.date=s.day)
      AND NOT EXISTS(SELECT 1 FROM b_time_suggestions d WHERE d.person_email=? AND d.job_id=s.job_id AND d.day=s.day)
    GROUP BY s.job_id,s.day ORDER BY s.day DESC,b_jobs.title LIMIT 200`,
    actor.email, given.consented_at, ...visibleJobParams(actor), only?.jobId ?? null, only?.jobId ?? null, only?.day ?? null, actor.email, actor.email);
  return found.map(s => ({ ...s, sources: JSON.parse(s.sources) }));
}

/** The person's own consent, pending suggestions and recent decisions; nobody sees another person's. */
export async function suggestions(db: D1Database, actor: Actor) {
  human(actor);
  return {
    consentedAt: (await consent(db, actor))?.consented_at ?? null,
    pending: await pending(db, actor),
    decided: await rows(db, `SELECT d.*,j.title job FROM b_time_suggestions d JOIN b_jobs j ON j.id=d.job_id WHERE d.person_email=? ORDER BY d.decided_at DESC LIMIT 50`, actor.email),
  };
}

/** Give or withdraw consent. Giving starts from now; withdrawing removes every pending suggestion. */
export async function setConsent(db: D1Database, actor: Actor, body: Data) {
  human(actor);
  insist(typeof body.consent === 'boolean', 'Choose to give or withdraw consent');
  const on = !!await consent(db, actor);
  insist(on !== body.consent, body.consent ? 'You have already consented' : 'You have not consented', 409);
  const at = now();
  await atomic(db, actor, body.consent
    ? [stmt(db, 'INSERT INTO b_activity_consent(person_email,consented_at) VALUES(?,?)', actor.email, at), audit(db, actor, 'activity.consent_given', actor.email)]
    : [stmt(db, 'DELETE FROM b_activity_consent WHERE person_email=?', actor.email), audit(db, actor, 'activity.consent_withdrawn', actor.email)]);
  return { consentedAt: body.consent ? at : null };
}

/** Approve (minutes, billable chosen, description) or reject the actor's own suggestion for a job and day. */
export async function decideSuggestion(db: D1Database, actor: Actor, body: Data) {
  human(actor);
  const jobId = text(body.jobId, 'Job', 100), day = date(body.day, 'Day');
  const [suggestion] = await pending(db, actor, { jobId, day });
  insist(suggestion, 'Suggestion not found', 404);
  insist(body.decision === 'approve' || body.decision === 'reject', 'Choose approve or reject');
  const sources = JSON.stringify(suggestion.sources.map((s: Data) => s.id));
  const decide = (status: string, entryId: string | null, reason: string) =>
    stmt(db, 'INSERT INTO b_time_suggestions(person_email,job_id,day,status,entry_id,sources,reason,decided_at) VALUES(?,?,?,?,?,?,?,?)', actor.email, jobId, day, status, entryId, sources, reason, now());
  if (body.decision === 'reject') {
    const reason = optional(body.reason, 'Reason', 500);
    await atomic(db, actor, [decide('rejected', null, reason), audit(db, actor, 'time.suggestion_rejected', jobId, `${day}: ${reason}`)]);
    return { jobId, day, status: 'rejected' };
  }
  insist(typeof body.billable === 'boolean', 'Choose whether this time is billable');
  const { entry, statements } = await newEntry(db, actor, await job(db, actor, jobId), { date: day, minutes: body.minutes, description: body.description, billable: body.billable });
  await atomic(db, actor, [...statements, decide('approved', entry.id, ''),
    audit(db, actor, 'time.added', entry.id, `${entry.minutes} min at ${entry.rateCents} (${entry.rateSource})${entry.billable ? '' : ', not billable'} from a suggestion for ${day}`)]);
  return { jobId, day, status: 'approved', entry };
}
