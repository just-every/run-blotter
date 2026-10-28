// LEARN-002: agents prepare operational copies; the preparing principal
// approves a new immutable version and its explicitly selected client uses.
import { organizerTemplate, validateOrganizerWorkflow } from './organizers-definition';
import { templateWork } from './tasks';
import { atomic, audit, guard, human, id, insist, need, now, rows, stmt, text, type Actor, type Data } from './model';
import { learningClientIds, learningComparison, learningIds, learningJobEvidence, learningStampSql, supportingLearningRefs, type LearningJobEvidence } from './learning-evidence';
export { learningEvidence } from './learning-evidence';

const TEMPLATE_FIELDS = ['name','recurrence','steps','requests','questions','fee_cents','currency','organizer','starter_content'] as const;
const templateState = (template: Data): Data => Object.fromEntries(TEMPLATE_FIELDS.map(key => [key, template[key] ?? null]));

async function sourceTemplate(db: D1Database, templateId: string) {
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', templateId).first<Data>();
  insist(template, 'Source template not found', 404); return template;
}
async function ownedProposal(db: D1Database, actor: Actor, proposalId: string) {
  need(actor, 'owner');
  const p = await stmt(db, 'SELECT * FROM b_learning_proposals WHERE id=? AND for_email=?', proposalId, actor.email).first<Data>();
  insist(p, 'Learning proposal not found', 404); return p;
}
async function sourceEvidence(db: D1Database, actor: Actor, proposalId: string) {
  const sourceIds = await rows(db, 'SELECT job_id FROM b_learning_sources WHERE proposal_id=? ORDER BY job_id', proposalId);
  return Promise.all(sourceIds.map(s => learningJobEvidence(db, actor, s.job_id)));
}
async function clientState(db: D1Database, templateId: string, clientIds: string[]) {
  return Promise.all(clientIds.map(async clientId => ({ clientId,
    versionId: await stmt(db, 'SELECT version_id FROM b_learning_clients WHERE client_id=? AND source_template_id=?', clientId, templateId).first<string>('version_id') ?? null })));
}

export async function prepareLearning(db: D1Database, actor: Actor, body: Data) {
  need(actor, 'owner');
  const jobIds = learningIds(body.jobIds, 'Source jobs', 2), clientIds = learningIds(body.clientIds, 'Clients');
  const sources = await Promise.all(jobIds.map(jobId => learningJobEvidence(db, actor, jobId)));
  insist(new Set(sources.map(j => j.templateId)).size === 1, 'Source jobs must use the same template');
  insist(new Set(sources.map(j => j.periodStart)).size >= 2, 'Use source jobs from at least two different periods');
  insist(sources.every(j => j.status === 'signed_off'), 'Complete the source periods before preparing an improvement', 409);
  insist(clientIds.every(clientId => sources.some(j => j.clientId === clientId)), 'Choose only clients observed in the source jobs');
  const refs = supportingLearningRefs(body.supportingRefs, sources), template = await sourceTemplate(db, sources[0].templateId);
  const input = body.improvement;
  insist(input && typeof input === 'object' && !Array.isArray(input), 'Supply a structured improvement');
  const work = await templateWork(db, input);
  const clients = await clientState(db, template.id, clientIds);
  const currentTemplates = await Promise.all(clientIds.map(clientId => learningTemplate(db, clientId, template)));
  insist(currentTemplates.every((t, n) => (t.learningVersionId ?? null) === clients[n].versionId), 'A client version changed; refresh and prepare again', 409);
  if (input.organizer === undefined) insist(new Set(currentTemplates.map(t => t.organizer ?? null)).size === 1,
    'Selected clients have different organizers; explicitly supply the intended organizer');
  const previousOrganizer = organizerTemplate(currentTemplates[0].organizer);
  let organizer = input.organizer === undefined ? previousOrganizer : organizerTemplate(input.organizer);
  validateOrganizerWorkflow(organizer, work.questions);
  if (organizer) {
    const same = previousOrganizer && JSON.stringify({ ...organizer, version: 0 }) === JSON.stringify({ ...previousOrganizer, version: 0 });
    organizer = { ...organizer, version: same ? previousOrganizer!.version : (previousOrganizer?.version ?? 0) + 1 };
  }
  const improvement = { steps: JSON.stringify(work.steps), requests: JSON.stringify(work.requests), questions: JSON.stringify(work.questions), organizer: organizer ? JSON.stringify(organizer) : null };
  insist(Object.entries(improvement).some(([key,value]) => (template[key] ?? null) !== value), 'The improvement must change the checklist, requests, questions or organizer');
  const proposalId = id(), at = now();
  const sourceState = sources.map(s => ({ jobId: s.jobId, stamp: s.stamp }));
  const checks = freshnessStatements(db, template.id, templateState(template), sourceState, clients);
  await atomic(db, actor, [
    ...checks,
    stmt(db, `INSERT INTO b_learning_proposals(id,source_template_id,title,expected_benefit,exceptions,assumptions,improvement,template_state,source_state,client_state,for_email,agent_label,created_channel,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, proposalId, template.id, text(body.title, 'Improvement title', 120),
      text(body.expectedBenefit, 'Expected benefit', 2000), text(body.exceptions, 'Exceptions', 2000), text(body.assumptions, 'Original assumptions', 2000),
      JSON.stringify(improvement), JSON.stringify(templateState(template)), JSON.stringify(sourceState), JSON.stringify(clients), actor.email, actor.label ?? 'Prepared by a person', actor.channel, at),
    ...jobIds.map(jobId => stmt(db, 'INSERT INTO b_learning_sources(proposal_id,job_id) VALUES(?,?)', proposalId, jobId)),
    ...refs.map(ref => stmt(db, 'INSERT INTO b_learning_refs(id,proposal_id,kind,audit_id,question_id,request_id) VALUES(?,?,?,?,?,?)',
      id(), proposalId, ref.kind, ref.kind === 'review_return' ? ref.id : null, ref.kind === 'portal_question' ? ref.id : null, ref.kind === 'missing_request' ? ref.id : null)),
    audit(db, actor, 'learning.prepared', proposalId, `${template.id}; ${jobIds.length} source periods; ${clientIds.length} selected clients`),
  ]);
  return learningDetail(db, actor, proposalId);
}

function freshnessStatements(db: D1Database, templateId: string, template: Data, sources: Data[], clients: Data[]) {
  const statements: D1PreparedStatement[] = [];
  statements.push(...guard(db, `EXISTS(SELECT 1 FROM b_templates WHERE id=? AND ${TEMPLATE_FIELDS.map(field => `${field} IS ?`).join(' AND ')})`,
    templateId, ...TEMPLATE_FIELDS.map(key => template[key])));
  for (const s of sources) statements.push(...guard(db, `(${learningStampSql}) IS ?`, s.jobId, s.stamp));
  for (const c of clients) statements.push(...guard(db, `(SELECT version_id FROM b_learning_clients WHERE client_id=? AND source_template_id=?) IS ?
    AND EXISTS(SELECT 1 FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL)`, c.clientId, templateId, c.versionId, c.clientId));
  return statements;
}

export async function decideLearning(db: D1Database, actor: Actor, proposalId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const proposal = await ownedProposal(db, actor, proposalId);
  insist(proposal.status === 'pending', 'This learning proposal was already decided', 409);
  insist(body.decision === 'approve' || body.decision === 'decline', 'Choose approve or decline');
  const reason = text(body.reason, 'Decision reason', 2000), at = now();
  const [pending, done] = guard(db, "EXISTS(SELECT 1 FROM b_learning_proposals WHERE id=? AND for_email=? AND status='pending')", proposalId, actor.email);
  if (body.decision === 'decline') {
    await atomic(db, actor, [pending,
      stmt(db, "UPDATE b_learning_proposals SET status='declined',decided_by=?,decided_at=?,decision_note=? WHERE id=?", actor.email, at, reason, proposalId),
      done, audit(db, actor, 'learning.declined', proposalId)]);
    return learningDetail(db, actor, proposalId);
  }
  const sources = await sourceEvidence(db, actor, proposalId);
  const refs = await rows(db, 'SELECT kind,COALESCE(audit_id,question_id,request_id) id FROM b_learning_refs WHERE proposal_id=? ORDER BY kind,id', proposalId);
  supportingLearningRefs(refs, sources);
  const template = JSON.parse(proposal.template_state) as Data, improvement = JSON.parse(proposal.improvement) as Data;
  const clients = JSON.parse(proposal.client_state) as Data[];
  // Approval may narrow the prepared deviations, never add an unrelated client.
  const chosen = body.clientIds === undefined ? clients.map(c => c.clientId) : learningIds(body.clientIds, 'Approved clients');
  insist(chosen.every(clientId => clients.some(c => c.clientId === clientId)), 'Approve only clients selected in this preparation');
  const versionId = id(), priorVersion = Number(await stmt(db, 'SELECT COALESCE(MAX(version),0) version FROM b_learning_versions WHERE source_template_id=?', proposal.source_template_id).first<number>('version'));
  const snapshot = { ...template, ...improvement };
  const statements: D1PreparedStatement[] = [pending,
    ...freshnessStatements(db, proposal.source_template_id, template, JSON.parse(proposal.source_state), clients),
    ...guard(db, '(SELECT COALESCE(MAX(version),0) FROM b_learning_versions WHERE source_template_id=?)=?', proposal.source_template_id, priorVersion)];
  // Named task grants must still be legitimate when the owner approves.
  for (const task of JSON.parse(improvement.steps)) if (typeof task === 'object' && task.assigneeEmail) statements.push(...guard(db,
    `EXISTS(SELECT 1 FROM b_members WHERE email=? AND active=1 AND role IN ('preparer','reviewer')) OR EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active')`, task.assigneeEmail, task.assigneeEmail));
  statements.push(stmt(db, `INSERT INTO b_learning_versions(id,source_template_id,version,proposal_id,snapshot,client_ids,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?)`, versionId, proposal.source_template_id, priorVersion+1, proposalId, JSON.stringify(snapshot), JSON.stringify(chosen), actor.email, at));
  for (const clientId of chosen) statements.push(stmt(db, `INSERT INTO b_learning_clients(id,client_id,source_template_id,version_id) VALUES(?,?,?,?)
    ON CONFLICT(client_id,source_template_id) DO UPDATE SET version_id=excluded.version_id`, id(), clientId, proposal.source_template_id, versionId));
  statements.push(stmt(db, "UPDATE b_learning_proposals SET status='approved',decided_by=?,decided_at=?,decision_note=? WHERE id=?", actor.email, at, reason, proposalId),
    done, audit(db, actor, 'learning.approved', proposalId, `${versionId}; version ${priorVersion+1}; clients ${chosen.join(',')}`));
  await atomic(db, actor, statements);
  return learningDetail(db, actor, proposalId);
}

export async function learningDetail(db: D1Database, actor: Actor, proposalId: string) {
  const proposal = await ownedProposal(db, actor, proposalId), evidence = await sourceEvidence(db, actor, proposalId);
  const refs = await rows(db, 'SELECT kind,COALESCE(audit_id,question_id,request_id) id FROM b_learning_refs WHERE proposal_id=? ORDER BY kind,id', proposalId);
  const version = await stmt(db, 'SELECT id,version,approved_by,approved_at,snapshot,client_ids FROM b_learning_versions WHERE proposal_id=?', proposalId).first<Data>();
  const improvement = JSON.parse(proposal.improvement) as Data;
  const clientIds = await learningClientIds(db, version?.client_ids ?? JSON.stringify((JSON.parse(proposal.client_state) as Data[]).map(c => c.clientId)));
  return { id: proposal.id, status: proposal.status, proposal: { id: proposal.id, status: proposal.status, title: proposal.title, sourceTemplateId: proposal.source_template_id,
    expectedBenefit: proposal.expected_benefit, exceptions: proposal.exceptions, assumptions: proposal.assumptions,
    improvement: Object.fromEntries(Object.entries(improvement).map(([key,value]) => [key, value === null ? null : JSON.parse(value)])), clientIds,
    preparedBy: proposal.for_email, preparedChannel: proposal.created_channel, agentLabel: proposal.agent_label, createdAt: proposal.created_at,
    decidedBy: proposal.decided_by, decidedAt: proposal.decided_at, decisionNote: proposal.decision_note },
    evidence: { jobs: evidence }, supportingRefs: refs, version: version ? { id: version.id, version: version.version, approved_by: version.approved_by, approved_at: version.approved_at, snapshot: JSON.parse(version.snapshot) } : null,
    comparison: await learningComparison(db, actor, proposal, evidence) };
}

/** Keep the source identity for recurrence, work types and period uniqueness;
 * the copied operational definition is immutable and snapshotted into the job. */
export async function learningTemplate(db: D1Database, clientId: string, template: Data): Promise<Data> {
  const approved = await stmt(db, `SELECT v.id,v.snapshot FROM b_learning_clients c JOIN b_learning_versions v ON v.id=c.version_id
    JOIN b_learning_proposals p ON p.id=v.proposal_id AND p.status='approved'
    WHERE c.client_id=? AND c.source_template_id=?`, clientId, template.id).first<Data>();
  return approved ? { ...template, ...JSON.parse(approved.snapshot), id: template.id, learningVersionId: approved.id } : template;
}

/** Include with the job insert: refuse an approval racing a creation, and
 * retain which definition was actually applied without inferring on restore. */
export function learningJobStatements(db: D1Database, clientId: string, sourceTemplateId: string, jobId: string, versionId?: string) {
  return [...guard(db, '(SELECT version_id FROM b_learning_clients WHERE client_id=? AND source_template_id=?) IS ?', clientId, sourceTemplateId, versionId ?? null),
    ...(versionId ? [stmt(db, 'INSERT INTO b_learning_job_versions(job_id,version_id) VALUES(?,?)', jobId, versionId)] : [])];
}
