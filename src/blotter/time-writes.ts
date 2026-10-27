// Native staff sessions record only their own time through the existing time authority.
import { newEntry } from './billing';
import { atomic, audit, digest, Fault, guard, insist, job, now, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';

function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

/** Recheck the native session and its current factor at the effect boundary. */
function sessionGuard(db: D1Database, actor: Actor) {
  return guard(db, `EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
    WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version)
    AND (EXISTS(SELECT 1 FROM b_enterprise_sessions s JOIN b_enterprise_connection c ON c.id=1 AND c.active=1 AND c.revision=s.revision
      JOIN b_enterprise_identities i ON i.id=s.identity_id AND i.active=1 AND i.blocked=0 WHERE s.session_id=? AND i.email=? AND s.mfa=1)
    OR ((NOT EXISTS(SELECT 1 FROM b_mfa_policy WHERE required=1) AND NOT EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL))
      OR (EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL) AND EXISTS(SELECT 1 FROM b_mfa_sessions WHERE session_id=? AND email=?))))`,
    actor.sessionId, actor.id, Date.now(), actor.sessionId, actor.email, actor.email, actor.email, actor.sessionId, actor.email);
}

export async function createTimeOnce(db: D1Database, actor: Actor, body: Data, key: string | undefined) {
  insist(actor.channel === 'person' && actor.sessionId && !actor.readOnly, 'A writable native staff session is required', 403);
  insist(Object.keys(body).every(k => ['jobId','date','minutes','description','billable','taskOrdinal'].includes(k)), 'Only native time fields are accepted; the person, rate, currency and submission state are server controlled');
  insist(typeof key === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(key), 'Supply an Idempotency-Key of 1–128 letters, digits, dots, underscores, colons or hyphens');
  const jobId = text(body.jobId, 'Job', 100), keyHash = await digest(key), payloadHash = await digest(canonical(body));
  const receipt = () => stmt(db, 'SELECT payload_digest,entry_id FROM b_api_time_writes WHERE actor_email=? AND key_digest=?', actor.email, keyHash).first<Data>();
  // This is the native write scope (named-task read access alone cannot record time).
  const currentJob = async () => {
    const j = await job(db, actor, jobId);
    insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND merged_into IS NULL', j.client_id).first(), 'Client no longer available', 404);
    return j;
  };
  const liveJob = (j: Data) => guard(db, `EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND ${visibleJobSql})
    AND EXISTS(SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND merged_into IS NULL)`, j.id, j.revision, ...visibleJobParams(actor), j.client_id);
  const replay = async (saved: Data) => {
    insist(saved.payload_digest === payloadHash, 'Idempotency-Key was already used with a different request', 409);
    const j = await currentJob();
    const entry = await stmt(db, 'SELECT * FROM b_time WHERE id=? AND job_id=? AND person_email=?', saved.entry_id, j.id, actor.email).first<Data>();
    insist(entry, 'Referenced time entry no longer exists', 404);
    const [check, done] = liveJob(j), [session, sessionDone] = sessionGuard(db, actor);
    const [record, recordDone] = guard(db, 'EXISTS(SELECT 1 FROM b_time WHERE id=? AND job_id=? AND person_email=?)', entry.id, j.id, actor.email);
    await atomic(db, actor, [session, check, record, recordDone, done, sessionDone]);
    return { entryId: entry.id, replayed: true, id: entry.id, date: entry.date, minutes: entry.minutes, description: entry.description,
      rateCents: entry.rate_cents, rateSource: entry.rate_source, rateCardId: entry.rate_card_id, currency: entry.currency,
      amountCents: entry.amount_cents, billable: !!entry.billable, taskOrdinal: entry.step_ordinal };
  };
  const saved = await receipt();
  if (saved) return replay(saved);
  const j = await currentJob(), { entry, statements } = await newEntry(db, actor, j, body);
  const [check, done] = liveJob(j), [session, sessionDone] = sessionGuard(db, actor);
  const [task, taskDone] = guard(db, '? IS NULL OR EXISTS(SELECT 1 FROM b_job_steps WHERE job_id=? AND ordinal=?)', entry.taskOrdinal, j.id, entry.taskOrdinal);
  try {
    await atomic(db, actor, [session, check, task, ...statements,
      audit(db, actor, 'time.added', entry.id, `${entry.minutes} min at ${entry.rateCents} (${entry.rateSource})${entry.billable ? '' : ', not billable'}`),
      stmt(db, 'INSERT INTO b_api_time_writes(actor_email,key_digest,payload_digest,entry_id,client_id,created_at) VALUES(?,?,?,?,?,?)', actor.email, keyHash, payloadHash, entry.id, j.client_id, now()),
      taskDone, done, sessionDone]);
  } catch (error) {
    if (error instanceof Fault && error.status === 409) {
      const winner = await receipt();
      if (winner) return replay(winner);
    }
    throw error;
  }
  return { entryId: entry.id, replayed: false, ...entry };
}
