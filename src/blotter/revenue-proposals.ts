import { atomic, audit, guard, id, insist, now, rows, stmt, text, type Actor, type Data } from './model';
import { principalHuman } from './invoices-sources';
import { revenueMap, revenueStampSql } from './revenue-map';

function sourceGuards(db:D1Database,map:Data) {
  const source=map.scope.source;
  return [...guard(db,`(${revenueStampSql})=?`,map.clientId,map.stamp),
    ...guard(db,"EXISTS(SELECT 1 FROM b_onboarding_plans WHERE id=? AND status='reviewed')",map.planId),
    ...source.kind==='engagement'
      ? guard(db,'EXISTS(SELECT 1 FROM b_engagements WHERE id=? AND client_id=? AND sha256=? AND content_base64 IS NOT NULL AND erased_at IS NULL)',source.id,map.clientId,source.sha256)
      : guard(db,"EXISTS(SELECT 1 FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE s.id=? AND j.client_id=? AND s.signed_sha256=? AND s.status='completed' AND s.signed_base64 IS NOT NULL AND s.erased_at IS NULL)",source.id,map.clientId,source.sha256)];
}

export async function prepareRevenue(db:D1Database,actor:Actor,body:Data) {
  principalHuman(actor);
  const map=await revenueMap(db,actor,text(body.clientId,'Client',100),text(body.planId,'Reviewed scope',100));
  insist(body.fingerprint===map.fingerprint,'Revenue evidence changed; review the current findings',409);
  const finding=map.exceptions.find(e=>e.id===body.exceptionId);
  insist(finding?.canPrepare && ['amendment','duplicate'].includes(finding.kind),'This finding has no available draft correction',409);
  const prior=await stmt(db,'SELECT * FROM b_revenue_proposals WHERE client_id=? AND plan_id=? AND exception_id=? AND fingerprint=?',map.clientId,map.planId,finding.id,map.fingerprint).first<Data>();
  if(prior) return {...prior,payload:JSON.parse(prior.payload),replayed:true};
  const proposalId=id();
  await atomic(db,actor,[...sourceGuards(db,map),stmt(db,'INSERT INTO b_revenue_proposals(id,client_id,job_id,plan_id,exception_id,fingerprint,kind,payload,prepared_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    proposalId,map.clientId,finding.jobId,map.planId,finding.id,map.fingerprint,finding.kind,JSON.stringify(finding),actor.email,now()),audit(db,actor,'revenue.prepared',map.clientId,JSON.stringify({proposalId,kind:finding.kind,sourceId:map.scope.source.id}))]);
  return {id:proposalId,kind:finding.kind,status:'pending',payload:finding};
}

export async function decideRevenue(db:D1Database,actor:Actor,proposalId:string,body:Data) {
  principalHuman(actor);
  const p=await stmt(db,'SELECT * FROM b_revenue_proposals WHERE id=?',proposalId).first<Data>();
  insist(p,'Revenue proposal not found',404);
  insist(p.status==='pending','Only a pending native draft can be decided; restored drafts stay held',409);
  insist(['approve','decline'].includes(body.decision),'Choose approve or decline');
  const reason=text(body.reason,'Decision reason',1000),at=now(),changes:D1PreparedStatement[]=[];
  // Decline never executes a correction, and remains available when evidence is stale.
  if(body.decision==='approve') {
    const map=await revenueMap(db,actor,p.client_id,p.plan_id);
    insist(p.fingerprint===map.fingerprint,'Revenue evidence changed; prepare a fresh draft before approval',409);
    const finding=map.exceptions.find(e=>e.id===p.exception_id);
    insist(finding?.canPrepare,'This correction is no longer available',409);
    changes.push(...sourceGuards(db,map));
    if(p.kind==='duplicate') {
      // A paid or issued invoice is never voided by the assistant.
      changes.push(...guard(db,"EXISTS(SELECT 1 FROM b_invoices WHERE id=? AND status='draft' AND revision=?) AND NOT EXISTS(SELECT 1 FROM b_provider_payments WHERE invoice_id=?)",finding.invoiceId,finding.invoiceRevision,finding.invoiceId),
        stmt(db,"UPDATE b_invoices SET status='void',voided_by=?,voided_at=?,void_reason=?,revision=? WHERE id=?",actor.email,at,reason,id(),finding.invoiceId),
        stmt(db,'DELETE FROM b_invoice_sources WHERE invoice_id=?',finding.invoiceId),
        stmt(db,'DELETE FROM b_invoice_credit_uses WHERE invoice_id=?',finding.invoiceId),
        audit(db,actor,'invoice.voided',finding.invoiceId,`Revenue correction ${proposalId}; ${reason}`));
    }
  }
  const status=body.decision==='approve'?'approved':'declined';
  await atomic(db,actor,[...guard(db,"EXISTS(SELECT 1 FROM b_revenue_proposals WHERE id=? AND status='pending')",proposalId),...changes,
    stmt(db,'UPDATE b_revenue_proposals SET status=?,decided_by=?,decided_at=?,decision_note=? WHERE id=?',status,actor.email,at,reason,proposalId),
    audit(db,actor,`revenue.${status}`,p.client_id,JSON.stringify({proposalId,kind:p.kind,reason}))]);
  return {id:proposalId,status};
}
