import { requireClient } from './permissions';
import { prepareSignatureDraft } from './signatures';
import { base64 } from './signatures-pdf';
import { proposalPdf } from './engagement-proposal-pdf';
import { sameRequest, signatureDetail, signatureEvent, staffSignature } from './signatures-store';
import { atomic, audit, guard, human, id, insist, integer, job, need, now, rows, stmt, text, visibleJobParams, visibleJobSql, type Actor, type Data } from './model';

export async function clientProposals(db:D1Database,actor:Actor,clientId:string) {
  human(actor);need(actor,'owner','reviewer','preparer');await requireClient(db,actor,clientId);
  return rows(db,`SELECT p.id,p.root_id,p.version,p.predecessor_id,p.superseded_by,s.title,s.status,s.job_id,s.requester_email,s.revision,s.completed_at
    FROM b_engagement_proposals p JOIN b_signatures s ON s.id=p.id JOIN b_jobs ON b_jobs.id=s.job_id JOIN b_clients c ON c.id=b_jobs.client_id
    WHERE c.id=? AND c.erased_at IS NULL AND ${visibleJobSql} ORDER BY p.created_at,p.version`,clientId,...visibleJobParams(actor));
}
export async function proposalDetail(db:D1Database,actor:Actor,requestId:string):Promise<Data> {
  const signature=await signatureDetail(db,actor,requestId),p=await stmt(db,'SELECT * FROM b_engagement_proposals WHERE id=?',requestId).first<Data>();
  insist(p,'Proposal not found',404);
  return {...signature,proposal:{...p,terms:p.terms?JSON.parse(p.terms):null},versions:await rows(db,`SELECT p.id,p.version,p.superseded_by,s.status,s.source_sha256 FROM b_engagement_proposals p JOIN b_signatures s ON s.id=p.id WHERE p.root_id=? ORDER BY p.version`,p.root_id)};
}
export async function createProposal(db:D1Database,actor:Actor,jobId:string,body:Data,previousId?:string) {
  human(actor);need(actor,'owner');insist(!actor.automation,'A person must author proposal terms',403);
  const j=await job(db,actor,jobId),prior=previousId?await staffSignature(db,actor,previousId,true):null;
  const previous=previousId?await stmt(db,'SELECT * FROM b_engagement_proposals WHERE id=?',previousId).first<Data>():null;
  if(previousId){insist(previous&&prior?.job_id===jobId,'Proposal not found',404);insist(!previous.superseded_by&&!['completed','voided'].includes(prior!.status)&&!prior!.erased_at,'Only an available uncompleted current version can be amended',409);insist(body.revision===prior!.revision,'Proposal changed; review it again',409);}
  const terms={title:text(body.title,'Proposal title',160),scope:text(body.scope,'Scope',6000),exclusions:text(body.exclusions,'Exclusions',3000),currency:'USD',feeCents:integer(body.feeCents,'USD fee in integer cents'),retainerTerms:text(body.retainerTerms,'Retainer terms',3000),renewalRules:text(body.renewalRules,'Renewal rules',3000),amendmentRules:text(body.amendmentRules,'Amendment rules',3000)};
  insist(body.currency==='USD','Proposal fees require explicit USD');
  insist(Array.isArray(body.contactIds)&&body.contactIds.length===2&&body.contactIds.every((c:unknown)=>typeof c==='string'&&!c.startsWith('staff:')),'Choose two authorized contact signers');
  const version=previous?previous.version+1:1,pdf=await proposalPdf(terms,version,body.contactIds),draft=await prepareSignatureDraft(db,actor,jobId,{title:`${terms.title} - version ${version}`,formKind:'ordinary engagement proposal',mode:'sequential',contactIds:body.contactIds,fields:pdf.fields,file:{name:`engagement-version-${version}.pdf`,mime:'application/pdf',contentBase64:base64(pdf.bytes)}});
  const at=now(),root=previous?.root_id??draft.requestId,statements=[...draft.statements,
    stmt(db,"UPDATE b_signatures SET retention_class='engagement' WHERE id=?",draft.requestId),
    stmt(db,'INSERT INTO b_engagement_proposals(id,root_id,version,predecessor_id,terms,created_by,created_at) VALUES(?,?,?,?,?,?,?)',draft.requestId,root,version,previousId??null,JSON.stringify(terms),actor.email,at),
    audit(db,actor,previous?'proposal.amended':'proposal.created',j.id,JSON.stringify({requestId:draft.requestId,version,previousId:previousId??null,source:`/api/blotter/signatures/${draft.requestId}/files/original`}))];
  if(prior&&previous){const fence=sameRequest(db,prior,actor),current=guard(db,'EXISTS(SELECT 1 FROM b_engagement_proposals WHERE id=? AND superseded_by IS NULL)',prior.id);
    statements.unshift(fence[0],current[0]);statements.push(stmt(db,"UPDATE b_signatures SET status='voided',void_reason=?,revision=? WHERE id=?",`Superseded by proposal version ${version}`,id(),prior.id),stmt(db,'UPDATE b_engagement_proposals SET superseded_by=? WHERE id=?',draft.requestId,prior.id),...signatureEvent(db,prior,'superseded',actor.email,`Replaced by ${draft.requestId}; version ${version}; earlier signatures retained`),current[1],fence[1]);}
  await atomic(db,actor,statements);
  return proposalDetail(db,actor,draft.requestId);
}
