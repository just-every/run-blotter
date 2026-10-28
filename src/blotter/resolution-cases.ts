// Native collection only. No transcript inference, agency transport or resolution recommendation.
import { listOrganizers, storedOrganizer } from './organizers-store';
import { submittedAnswers } from './organizers-client';
import { visibleQuestions } from './organizers-definition';
import { atomic, audit, guard, human, id, insist, job, need, now, rows, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';

export async function resolutionCase(db: D1Database, actor: Actor, jobId: string) {
  human(actor);
  const j = await job(db, actor, jobId);
  const client = await stmt(db, 'SELECT erased_at FROM b_clients WHERE id=?', j.client_id).first<Data>();
  const record = await stmt(db, 'SELECT * FROM b_resolution_cases WHERE job_id=?', j.id).first<Data>();
  const base = { case: record, transcriptContext: 'unavailable', resolutionDecision: 'Practitioner decision required; no recommendation or agency action', erased: !!client?.erased_at };
  if (client?.erased_at) return { ...base, organizer: null, candidate: null, answers: {}, files: [], canCreate: false };
  const view = await listOrganizers(db, actor, j.id);
  const organizer = view.organizers.find(o => o.id === record?.organizer_id);
  const candidate = view.organizers.find(o => !o.erased_at && o.definition.collectionForm === '433-A');
  // Draft and carried values never appear as case facts. Only the latest
  // submitted current confirmations from each responsible contact may do so.
  const submitted = organizer && !organizer.erased_at ? await submittedAnswers(db, organizer.id, organizer.answers) : {};
  const applicable = organizer ? visibleQuestions(organizer.definition, submitted) : new Set<string>();
  const answers = Object.fromEntries(Object.entries(submitted).filter(([key, a]) => applicable.has(key) && a.confirmed && a.value));
  const files = organizer ? await rows(db, `SELECT m.key,f.id,f.name,f.size,f.sha256,f.erased_at FROM b_organizer_requests m JOIN b_files f ON f.request_id=m.request_id WHERE m.organizer_id=? ORDER BY f.uploaded_at,f.id`, organizer.id) : [];
  return { ...base, organizer, candidate: record ? null : candidate ?? null, answers, files,
    canCreate: !record && !!candidate && j.status === 'open' && !actor.readOnly && ['owner','reviewer'].includes(actor.role) };
}

export async function createResolutionCase(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  insist(!actor.readOnly, 'Read-only staff cannot create a resolution case', 403);
  const j = await job(db, actor, jobId), organizer = await storedOrganizer(db, text(body.organizerId, 'Organizer'));
  insist(organizer.job_id === j.id, 'Organizer not found on this job', 404);
  insist(j.status === 'open' && !organizer.erased_at, 'Collection work is closed', 409);
  insist(organizer.definition.collectionForm === '433-A', 'Choose an explicitly designated 433-A organizer', 409);
  insist(body.reviewed === true, 'Review and confirm this job’s 433-A question set before creating the case');
  insist(body.revision === organizer.revision && body.version === organizer.definition.version, 'Organizer changed; review its current version', 409);
  const recordId = id(), at = now();
  const [fresh, done] = guard(db, `EXISTS(SELECT 1 FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id JOIN b_job_organizers o ON o.job_id=b_jobs.id
    WHERE b_jobs.id=? AND b_jobs.status='open' AND ${visibleJobSql} AND c.erased_at IS NULL AND c.lifecycle='active' AND c.merged_into IS NULL
    AND o.id=? AND o.revision=? AND o.erased_at IS NULL AND json_extract(o.definition,'$.collectionForm')='433-A'
    AND json_extract(o.definition,'$.version')=?)`, j.id, ...visibleJobParams(actor), organizer.id, organizer.revision, organizer.definition.version);
  await atomic(db, actor, [fresh,
    stmt(db, 'INSERT INTO b_resolution_cases(id,job_id,organizer_id,form,definition_version,reviewed_by,reviewed_at) VALUES(?,?,?,?,?,?,?)', recordId, j.id, organizer.id, '433-A', organizer.definition.version, actor.email, at),
    audit(db, actor, 'resolution.case_created', j.id, `${recordId}; reviewed organizer ${organizer.id}; version ${organizer.definition.version}; collection only`), done]);
  return resolutionCase(db, actor, j.id);
}
