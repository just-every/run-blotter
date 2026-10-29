// Principal inspection only: signed scope never becomes agent context or execution authority.
import { reviewedOnboardingMapping } from './onboarding';
import { readiness } from './readiness';
import { atomic, audit, guard, human, insist, job, stmt, text, type Actor, type Data } from './model';

export async function readinessScope(db: D1Database, actor: Actor, jobId: string, selectedPlan: unknown) {
  human(actor);
  insist(actor.role === 'owner' && actor.sessionId && !actor.automation, 'Only a signed-in principal can inspect readiness scope', 403);
  const planId = text(selectedPlan, 'Reviewed onboarding mapping', 100), j = await job(db, actor, jobId);
  insist(j.status === 'open' || j.status === 'review', 'Scope inspection requires active work', 409);
  const { review, services, source } = await reviewedOnboardingMapping(db, actor, j.client_id, planId);
  insist(source.kind === 'signature', 'Select a completed native proposal, not a practitioner-recorded letter', 409);
  const proposal = await stmt(db, `SELECT p.*,s.job_id,s.status,s.source_sha256,s.signed_sha256,s.completed_at,s.form_kind
    FROM b_engagement_proposals p JOIN b_signatures s ON s.id=p.id WHERE p.id=? AND s.erased_at IS NULL`, source.record.id).first<Data>();
  insist(proposal && proposal.job_id === j.id, 'The reviewed source must be an ordinary proposal on this job', 409);
  insist(proposal.status === 'completed' && !proposal.superseded_by && proposal.terms && proposal.form_kind === 'ordinary engagement proposal',
    'Select the completed current ordinary proposal version', 409);
  const service = services.find(s => s.template.id === j.template_id);
  insist(service, 'The reviewed scope does not map this job template; applicability is not inferred', 409);
  const map = await readiness(db, actor, j.id);
  await atomic(db, actor, [
    ...guard(db, "EXISTS(SELECT 1 FROM b_onboarding_plans WHERE id=? AND client_id=? AND revision=? AND status='reviewed')", planId, j.client_id, review.revision),
    ...guard(db, 'EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?)', j.id, j.revision),
    audit(db, actor, 'readiness.scope_inspected', j.id, JSON.stringify({ planId, sourceId: proposal.id, version: proposal.version, sha256: source.record.sha256 })),
  ]);
  return { ...map, signedScope: {
    source: { id: proposal.id, kind: source.kind, rootId: proposal.root_id, version: proposal.version, predecessorId: proposal.predecessor_id,
      sourceSha256: proposal.source_sha256, sha256: source.record.sha256, completedAt: proposal.completed_at, href: source.href, label: source.record.label },
    mapping: { planId, fingerprint: review.fingerprint, decidedBy: review.decidedBy, decidedAt: review.decidedAt, reason: review.reason,
      kind: service.kind, quote: service.scope.quote, template: { id: service.template.id, name: service.template.name, recurrence: service.template.recurrence },
      items: review.items.filter((item: Data) => item.scope.index === service.scope.index).map((item: Data) => ({ id: item.id, selected: item.selected })),
      provenance: 'Practitioner-declared mapping of exact signed text; applicability and scope completeness require human judgment.' },
    execution: 'Inspection only. No onboarding, question, sign-off, message, fee, signature or provider action is authorized.' },
    coverage: { ...map.coverage, signedScope: 'Principal-selected reviewed ordinary proposal; no agent scope authority' } };
}
