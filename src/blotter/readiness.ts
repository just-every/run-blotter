// READY-001 native evidence and deterministic question drafts. External agents
// may prepare; existing job authority and human review govern every effect.
import { atomic, audit, digest, guard, human, id, insist, job, need, now, rows, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';
import { flowSteps, jobAnswers } from './flow';

const sourceSql = {
  request: `SELECT json_object('label',r.label,'status',r.status,'active',r.organizer_active,'updated',r.updated_at,
    'files',(SELECT json_group_array(json_object('id',id,'erased',erased_at)) FROM
      (SELECT id,erased_at FROM b_files WHERE request_id=r.id ORDER BY id))) stamp
    FROM b_requests r WHERE r.job_id=? AND r.id=?`,
  answer: `SELECT json_object('label',label,'value',value,'at',answered_at,'source',organizer_source) stamp
    FROM b_job_answers WHERE job_id=? AND key=?`,
};
type Kind = keyof typeof sourceSql;
async function source(db: D1Database, jobId: string, kind: Kind, sourceId: string) {
  const stamp = await stmt(db, sourceSql[kind], jobId, sourceId).first<string>('stamp');
  insist(stamp, 'Readiness source not found on this job', 404);
  return { stamp, value: JSON.parse(stamp) as Data };
}
const questionText = (kind: Kind, value: Data, period: string) => kind === 'request'
  ? `Please provide or clarify “${value.label}” for ${period}. Your accountant will review the evidence.`
  : `Please confirm or explain “${value.label}” for ${period}, including any change from the prior period. Your accountant will review your answer.`;

/** Project current data on every read; no cached document bytes or answer copies. */
export async function readiness(db: D1Database, actor: Actor, jobId: string) {
  const j = await job(db, actor, jobId);
  const [requests, answers, steps, questions, prior] = await Promise.all([
    rows(db, `SELECT r.id,r.label,r.status,r.organizer_active,
      (SELECT COUNT(*) FROM b_files WHERE request_id=r.id AND erased_at IS NULL) file_count
      FROM b_requests r WHERE r.job_id=? ORDER BY r.ordinal`, j.id),
    jobAnswers(db, j.id), flowSteps(db, j),
    rows(db, `SELECT q.*,t.status response_status,t.response,t.closed_at response_at FROM b_readiness_questions q
      LEFT JOIN b_portal_items t ON t.id=q.todo_id WHERE q.job_id=? ORDER BY q.created_at,q.id`, j.id),
    stmt(db, `SELECT id,period_start,period_label,status FROM b_jobs WHERE client_id=? AND template_id=? AND period_start<?
      AND ${visibleJobSql} ORDER BY period_start DESC LIMIT 1`, j.client_id, j.template_id, j.period_start, ...visibleJobParams(actor)).first<Data>(),
  ]);
  const priorAnswers = prior ? await jobAnswers(db, prior.id) : [];
  const documents = requests.filter(r => r.organizer_active).map(r => ({ id: r.id, label: r.label, status: r.status,
    fileCount: r.file_count, state: !r.file_count ? 'missing' : r.status === 'accepted' ? 'validated' : 'collected',
    validation: r.status === 'accepted' && r.file_count ? 'Staff accepted this request; no independent content validation claimed' : null,
    source: `/api/blotter/jobs/${j.id}`, questionDraft: questionText('request', r, j.period_label) }));
  const comparedAnswers = answers.map(a => {
    const previous = priorAnswers.find(p => p.key === a.key);
    return { ...a, state: a.value === null ? 'missing' : 'judgment_required', source: `/api/blotter/jobs/${j.id}`,
      previous: previous ? { jobId: prior!.id, period: prior!.period_label, value: previous.value, source: `/api/blotter/jobs/${prior!.id}` } : null,
      changed: a.value !== null && previous?.value != null ? a.value !== previous.value : null,
      questionDraft: questionText('answer', a, j.period_label) };
  });
  return { jobId: j.id, clientId: j.client_id, period: j.period_label, jobStatus: j.status,
    documents, answers: comparedAnswers, steps: steps.map(s => ({ ordinal: s.ordinal, label: s.label, state: s.state, blockers: s.blockers })),
    prior: prior ?? null,
    questions: questions.map(q => ({ ...q, source_stamp: undefined,
      progress: q.status === 'approved' ? q.response_status === 'done' ? 'evidence_received_judgment_required' : 'awaiting_client' : q.status })),
    unresolvedJudgments: questions.filter(q => q.status === 'approved').length,
    coverage: { signedScope: 'unavailable in this map: principal inspection requires the separate reviewed-scope door', ledger: 'unavailable: LEDGER-001',
      varianceAnalysis: 'unavailable: ledger comparison not implemented',
      interpretation: 'Native request acceptance and recorded checklist answers only. Changed answers are differences, not inferred contradictions. Client responses never validate evidence or complete review or filing.' } };
}

export async function prepareReadiness(db: D1Database, actor: Actor, jobId: string, body: Data) {
  const j = await job(db, actor, jobId);
  insist(j.status === 'open', 'Prepare readiness questions only on open work', 409);
  const kind = text(body.sourceKind, 'Source kind', 20) as Kind;
  insist(kind === 'request' || kind === 'answer', 'Choose a request or answer source');
  const sourceId = text(body.sourceId, 'Source ID', 100), current = await source(db, j.id, kind, sourceId);
  insist(kind !== 'request' || current.value.active, 'This document request is not applicable', 409);
  const fingerprint = await digest(current.stamp);
  const existing = await stmt(db, 'SELECT id FROM b_readiness_questions WHERE job_id=? AND source_kind=? AND source_id=? AND source_stamp=?', j.id, kind, sourceId, fingerprint).first<Data>();
  if (existing) return { id: existing.id, readiness: await readiness(db, actor, j.id) };
  const questionId = id();
  await atomic(db, actor, [
    ...guard(db, `EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open' AND revision=? AND ${visibleJobSql})`, j.id, j.revision, ...visibleJobParams(actor)),
    ...guard(db, `(${sourceSql[kind]}) IS ?`, j.id, sourceId, current.stamp),
    stmt(db, `INSERT INTO b_readiness_questions(id,job_id,source_kind,source_id,source_stamp,prepared_by,agent_label,created_at)
      VALUES(?,?,?,?,?,?,?,?)`, questionId, j.id, kind, sourceId, fingerprint, actor.email, actor.channel === 'agent' ? actor.label ?? 'agent' : null, now()),
    audit(db, actor, 'readiness.prepared', questionId, `${j.id}; ${kind}:${sourceId}`),
  ]);
  return { id: questionId, readiness: await readiness(db, actor, j.id) };
}

/** Approval creates exactly one existing portal to-do; it sends no mail. */
export async function decideReadiness(db: D1Database, actor: Actor, jobId: string, questionId: string, body: Data) {
  human(actor);
  const j = await job(db, actor, jobId);
  const q = await stmt(db, 'SELECT * FROM b_readiness_questions WHERE id=? AND job_id=?', questionId, j.id).first<Data>();
  insist(q, 'Readiness question not found', 404);
  const decision = text(body.decision, 'Decision', 20), reason = text(body.reason, 'Decision reason', 2000), at = now();
  insist(['approve','decline','resolve'].includes(decision), 'Choose approve, decline or resolve');
  const statements: D1PreparedStatement[] = [
    ...guard(db, `EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND ${visibleJobSql})`, j.id, j.revision, ...visibleJobParams(actor)),
  ];
  if (decision === 'resolve') {
    need(actor, 'owner', 'reviewer');
    insist(actor.role === 'owner' || actor.email === j.reviewer_email, 'Only the assigned reviewer or principal resolves readiness judgments', 403);
    insist(q.status === 'approved' && j.status !== 'signed_off', 'Only an approved unresolved question can be resolved', 409);
    statements.push(...guard(db, "EXISTS(SELECT 1 FROM b_readiness_questions WHERE id=? AND status='approved')", q.id),
      stmt(db, "UPDATE b_readiness_questions SET status='resolved',resolved_by=?,resolved_at=?,resolution=? WHERE id=?", actor.email, at, reason, q.id));
  } else {
    insist(q.status === 'pending', 'This readiness question was already decided', 409);
    statements.push(...guard(db, "EXISTS(SELECT 1 FROM b_readiness_questions WHERE id=? AND status='pending')", q.id));
    let todoId: string | null = null;
    if (decision === 'approve') {
      insist(j.status === 'open', 'Approve questions only on open work', 409);
      const current = await source(db, j.id, q.source_kind, q.source_id);
      insist(await digest(current.stamp) === q.source_stamp, 'Evidence changed; decline this stale question and review current evidence', 409);
      statements.push(...guard(db, `(${sourceSql[q.source_kind as Kind]}) IS ?`, j.id, q.source_id, current.stamp));
      todoId = id();
      statements.push(stmt(db, `INSERT INTO b_portal_items(id,job_id,kind,body,author,owner_email,status,created_at)
        VALUES(?,?,'todo',?,?,?,'open',?)`, todoId, j.id, questionText(q.source_kind, current.value, j.period_label), actor.email, actor.email, at));
    }
    statements.push(stmt(db, 'UPDATE b_readiness_questions SET status=?,todo_id=?,decided_by=?,decided_at=?,decision_note=? WHERE id=?',
      decision === 'approve' ? 'approved' : 'declined', todoId, actor.email, at, reason, q.id));
  }
  statements.push(stmt(db, 'UPDATE b_jobs SET revision=? WHERE id=?', id(), j.id), audit(db, actor, `readiness.${decision}`, q.id, j.id));
  await atomic(db, actor, statements);
  return readiness(db, actor, j.id);
}
