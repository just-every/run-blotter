// LEARN-001 evidence is projected from its current native source. Learning
// stores references and change fences, never a second copy of private content.
import { nextPeriod } from './jobs';
import { insist, job, need, rows, stmt, text, type Actor, type Data } from './model';

export function learningIds(value: unknown, label: string, min = 1, max = 30): string[] {
  insist(Array.isArray(value) && value.length >= min && value.length <= max, `${label}: choose between ${min} and ${max}`);
  const ids = value.map(v => text(v, label, 100));
  insist(new Set(ids).size === ids.length, `${label}: choose each record once`);
  return ids;
}

// SQL can compare this fence again inside the write transaction. No private
// question, correction, document content or organizer answer is retained.
export const learningStampSql = `SELECT json_object(
 'revision',j.revision,'clientId',j.client_id,
 'returns',(SELECT group_concat(id) FROM (SELECT id FROM b_audit WHERE object_id=j.id AND action='job.returned' ORDER BY id)),
 'requestReturns',(SELECT group_concat(id) FROM (SELECT a.id FROM b_audit a JOIN b_requests r ON r.id=a.object_id WHERE r.job_id=j.id AND a.action='request.returned' ORDER BY a.id)),
 'requests',(SELECT group_concat(state) FROM (SELECT id||':'||status||':'||updated_at state FROM b_requests WHERE job_id=j.id ORDER BY id)),
 'questions',(SELECT group_concat(id) FROM (SELECT id FROM b_portal_items WHERE job_id=j.id AND kind='question' ORDER BY id)),
 'erasedFiles',(SELECT COUNT(*) FROM b_files WHERE job_id=j.id AND erased_at IS NOT NULL),
 'erasedOrganizers',(SELECT COUNT(*) FROM b_job_organizers WHERE job_id=j.id AND erased_at IS NOT NULL)
 ) stamp FROM b_jobs j WHERE j.id=?`;

export async function learningJobEvidence(db: D1Database, actor: Actor, jobId: string) {
  const j = await job(db, actor, jobId);
  const [corrections, portalQuestions, requests, stamp] = await Promise.all([
    rows(db, "SELECT id,actor,note,at FROM (SELECT id,actor,detail note,at FROM b_audit WHERE object_id=? AND action='job.returned') ORDER BY at,id", j.id),
    rows(db, "SELECT id,body,status,created_at FROM b_portal_items WHERE job_id=? AND kind='question' ORDER BY created_at,id", j.id),
    rows(db, `SELECT r.id,r.label,r.status,r.organizer_active,
      (SELECT COUNT(*) FROM b_audit a WHERE a.object_id=r.id AND a.action='request.returned') returns
      FROM b_requests r WHERE r.job_id=? ORDER BY r.ordinal`, j.id),
    stmt(db, learningStampSql, j.id).first<string>('stamp'),
  ]);
  return { jobId: j.id, clientId: j.client_id, templateId: j.template_id, periodStart: j.period_start, periodLabel: j.period_label,
    status: j.status, corrections, portalQuestions, requests, stamp: stamp!,
    metrics: { reviewReturns: corrections.length, questions: portalQuestions.length,
      missingDocuments: requests.reduce((n, r) => n + Number(r.returns) + (r.organizer_active && r.status === 'requested' ? 1 : 0), 0) } };
}
export type LearningJobEvidence = Awaited<ReturnType<typeof learningJobEvidence>>;

function repeated(jobs: LearningJobEvidence[], field: 'corrections' | 'portalQuestions' | 'requests', value: 'note' | 'body' | 'label') {
  const groups = new Map<string, { key: string; examples: { jobId: string; id: string }[]; periods: Set<string> }>();
  for (const j of jobs) for (const item of j[field]) {
    if (field === 'requests' && !Number(item.returns) && !(item.organizer_active && item.status === 'requested')) continue;
    const key = String(item[value] ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) continue;
    const group = groups.get(key) ?? { key, examples: [], periods: new Set<string>() };
    group.examples.push({ jobId: j.jobId, id: String(item.id) }); group.periods.add(j.periodStart); groups.set(key, group);
  }
  return [...groups.values()].filter(g => g.periods.size >= 2).map(({ key, examples }) => ({ pattern: key, examples }));
}

export async function learningEvidence(db: D1Database, actor: Actor, input: Data = {}) {
  need(actor, 'owner');
  const jobIds = input.jobIds !== undefined ? learningIds(input.jobIds, 'Source jobs') :
    (await rows(db, `SELECT id FROM b_jobs WHERE (?='' OR template_id=?) ORDER BY period_start DESC,id LIMIT 30`,
      input.templateId ? text(input.templateId, 'Template', 100) : '', input.templateId ?? '')).map(j => j.id as string);
  const jobs = await Promise.all(jobIds.map(jobId => learningJobEvidence(db, actor, jobId)));
  return { jobs, patterns: { reviewerCorrections: repeated(jobs, 'corrections', 'note'),
    clientQuestions: repeated(jobs, 'portalQuestions', 'body'), missingDocuments: repeated(jobs, 'requests', 'label') },
    measurement: 'Review-return events, client questions, and document-return events plus currently outstanding active requests. Compare completed next periods; an unfinished period is provisional.' };
}

export function supportingLearningRefs(value: unknown, jobs: LearningJobEvidence[]) {
  insist(Array.isArray(value) && value.length >= 2 && value.length <= 90, 'Supply between 2 and 90 supporting source references');
  const seen = new Set<string>();
  const refs = value.map((raw: Data) => {
    insist(raw && typeof raw === 'object', 'Each source reference is an object');
    const kind = text(raw.kind, 'Evidence kind', 30), refId = text(raw.id, 'Evidence ID', 100), key = `${kind}:${refId}`;
    insist(!seen.has(key), 'Use each supporting source reference once'); seen.add(key);
    const source = jobs.find(j => kind === 'review_return' ? j.corrections.some(r => r.id === refId) :
      kind === 'portal_question' ? j.portalQuestions.some(r => r.id === refId) :
      kind === 'missing_request' ? j.requests.some(r => r.id === refId && (Number(r.returns) || (r.organizer_active && r.status === 'requested'))) : false);
    insist(source, 'Supporting evidence must belong to the authorized source jobs');
    return { kind, id: refId, jobId: source.jobId };
  });
  const selected = new Set(refs.filter(r => r.kind === 'review_return').map(r => r.id));
  insist(repeated(jobs, 'corrections', 'note').some(g => new Set(g.examples.filter(e => selected.has(e.id)).map(e => jobs.find(j => j.jobId === e.jobId)!.periodStart)).size >= 2),
    'Support the improvement with the same actual reviewer correction returned in at least two different periods');
  return refs;
}

const mean = (jobs: LearningJobEvidence[]) => ({ reviewReturns: jobs.reduce((n,j) => n+j.metrics.reviewReturns,0)/jobs.length,
  questions: jobs.reduce((n,j) => n+j.metrics.questions,0)/jobs.length,
  missingDocuments: jobs.reduce((n,j) => n+j.metrics.missingDocuments,0)/jobs.length });

export async function learningComparison(db: D1Database, actor: Actor, proposal: Data, sources: LearningJobEvidence[]) {
  if (proposal.status !== 'approved') return { status: 'not_approved', clients: [], assumptions: proposal.assumptions };
  const version = await stmt(db, 'SELECT id,client_ids FROM b_learning_versions WHERE proposal_id=?', proposal.id).first<Data>();
  const clients = [];
  for (const clientId of await learningClientIds(db, version?.client_ids ?? '[]')) {
    const baselineJobs = sources.filter(j => j.clientId === clientId);
    if (!baselineJobs.length) continue;
    const last = baselineJobs.map(j => j.periodStart).sort().at(-1)!;
    const expectedPeriod = nextPeriod(last, JSON.parse(proposal.template_state).recurrence);
    const next = await stmt(db, `SELECT j.id FROM b_jobs j JOIN b_learning_job_versions v ON v.job_id=j.id
      WHERE j.client_id=? AND j.template_id=? AND j.period_start=? AND v.version_id=? ORDER BY j.period_start,j.id LIMIT 1`, clientId, proposal.source_template_id, expectedPeriod, version?.id ?? '').first<Data>();
    const outcome = next ? await learningJobEvidence(db, actor, next.id) : null;
    const baseline = mean(baselineJobs);
    clients.push({ clientId, expectedPeriod, baselineJobIds: baselineJobs.map(j => j.jobId), baseline,
      status: !outcome ? 'pending' : outcome.status === 'signed_off' ? 'complete' : 'provisional',
      nextJobId: outcome?.jobId ?? null, outcome: outcome?.metrics ?? null,
      delta: outcome ? { reviewReturns: outcome.metrics.reviewReturns-baseline.reviewReturns,
        questions: outcome.metrics.questions-baseline.questions, missingDocuments: outcome.metrics.missingDocuments-baseline.missingDocuments } : null });
  }
  return { status: clients.length > 0 && clients.every(c => c.status === 'complete') ? 'complete' : 'pending', clients, assumptions: proposal.assumptions,
    expectedBenefit: proposal.expected_benefit, exceptions: proposal.exceptions,
    interpretation: 'Baseline is the per-period mean for this client. Negative deltas mean fewer exceptions. Unfinished periods are provisional; these observations do not prove causation.' };
}

/** Client history follows an authorized merge and its undo through the live native identity. */
export async function learningClientIds(db: D1Database, ids: string): Promise<string[]> {
  const current = await Promise.all((JSON.parse(ids) as string[]).map(async clientId =>
    await stmt(db, `WITH RECURSIVE up(id,next,depth) AS (SELECT id,merged_into,0 FROM b_clients WHERE id=? UNION ALL
      SELECT c.id,c.merged_into,up.depth+1 FROM b_clients c JOIN up ON c.id=up.next WHERE up.depth<50)
      SELECT id FROM up WHERE next IS NULL`, clientId).first<string>('id')));
  return [...new Set(current.filter((v): v is string => !!v))];
}
