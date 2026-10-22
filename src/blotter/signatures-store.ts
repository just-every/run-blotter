// Shared scope, race fences and attributable signature events.
import { atomic, audit, guard, human, id, insist, job, need, now, rows, stmt, visibleJobSql, visibleJobParams, type Actor, type Data } from './model';
export async function signatureRecord(db:D1Database,requestId:string) {
  const r=await stmt(db,'SELECT s.*,j.client_id,c.erased_at client_erased_at FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id JOIN b_clients c ON c.id=j.client_id WHERE s.id=?',requestId).first<Data>();
  insist(r,'Signature request not found',404);return r;
}
export async function staffSignature(db:D1Database,actor:Actor,requestId:string,write=false) {
  need(actor,'owner','reviewer','preparer');if(write){human(actor);insist(!actor.automation,'A person must approve signature requests',403);}
  const r=await signatureRecord(db,requestId);await job(db,actor,r.job_id);
  // Erased-client retained evidence has a separate principal-only door.
  if(r.client_erased_at)need(actor,'owner');return r;
}
export const signerRows=(db:D1Database,r:Data)=>rows(db,'SELECT * FROM b_signature_signers WHERE request_id=? AND attempt=? ORDER BY ordinal',r.id,r.attempt);
export function sameRequest(db:D1Database,r:Data,actor?:Actor) {
  return guard(db,`EXISTS(SELECT 1 FROM b_signatures s JOIN b_jobs ON b_jobs.id=s.job_id JOIN b_clients c ON c.id=b_jobs.client_id
    WHERE s.id=? AND s.revision=? ${actor?`AND ${visibleJobSql}`:''})`,r.id,r.revision,...(actor?visibleJobParams(actor):[]));
}
export function openSignatureJob(db:D1Database,jobId:string,actor:Actor) {
  return guard(db,`EXISTS(SELECT 1 FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id WHERE b_jobs.id=? AND b_jobs.status<>'signed_off' AND c.lifecycle='active' AND c.merged_into IS NULL AND c.erased_at IS NULL AND ${visibleJobSql})`,jobId,...visibleJobParams(actor));
}
export function signatureEvent(db:D1Database,r:Data,action:string,actor:string,detail:string,contactId:string|null=null,at=now()) {
  const eventId=id();
  return [stmt(db,'INSERT INTO b_signature_events(id,request_id,attempt,action,actor,contact_id,detail,at) VALUES(?,?,?,?,?,?,?,?)',eventId,r.id,r.attempt,action,actor,contactId,detail,at),
    stmt(db,'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)',id(),actor,'signature.'+action,r.job_id,JSON.stringify({requestId:r.id,attempt:r.attempt,contactId,detail}),at),
    // The established notification dispatcher applies live job authority, event
    // preferences, quiet hours and deduplication to this safe summary.
    ...(['signed','declined','completed'].includes(action)?[stmt(db,`INSERT OR IGNORE INTO b_notifications(id,to_email,kind,job_id,summary,delivery,created_at)
      VALUES(?,?,'signature',?,'Signature request updated','deferred: outside firm notification hours',?)`,'signature:'+eventId,r.requester_email,r.job_id,at)]:[])];
}
export async function signatureDetail(db:D1Database,actor:Actor,requestId:string) {
  const r=await staffSignature(db,actor,requestId);
  if(r.client_erased_at)await audit(db,actor,'signature.retained_read',r.job_id,JSON.stringify({requestId:r.id,note:'Principal read retained signed document'})).run();
  const {source_base64,signed_base64,certificate_base64,...safe}=r;
  return {...safe,fields:JSON.parse(r.fields),pages:JSON.parse(r.pages),signers:await signerRows(db,r),events:await rows(db,'SELECT * FROM b_signature_events WHERE request_id=? ORDER BY at,id',r.id),deliveries:await rows(db,'SELECT * FROM b_signature_deliveries WHERE request_id=? ORDER BY sent_at,id',r.id),attestations:await rows(db,'SELECT * FROM b_signature_attestations WHERE request_id=? ORDER BY attempt,contact_id',r.id),hasSigned:!!signed_base64,hasCertificate:!!certificate_base64};
}
export async function pendingSignatures(db:D1Database,email:string) {
  return rows(db,`SELECT s.id,s.title,s.job_id,s.status,s.revision,s.attempt FROM b_signatures s WHERE s.requester_email=? AND s.status IN ('draft','pending','declined','held') ORDER BY s.created_at,s.id`,email);
}
/** Include the returned statements in offboarding's own atomic approval batch. */
export function transferSignatures(db:D1Database,actor:Actor,pending:Data[],from:string,to:string) {
  const [unchanged,counted]=guard(db,"(SELECT count(*) FROM b_signatures WHERE requester_email=? AND status IN ('draft','pending','declined','held'))=?",from,pending.length);
  return [unchanged,...pending.flatMap(r=>{const [check,done]=guard(db,"EXISTS(SELECT 1 FROM b_signatures WHERE id=? AND revision=? AND requester_email=? AND status IN ('draft','pending','declined','held'))",r.id,r.revision,from);
    return [check,stmt(db,'UPDATE b_signatures SET requester_email=?,revision=? WHERE id=?',to,id(),r.id),...signatureEvent(db,{...r,requester_email:to},'transferred',actor.email,`offboarding ${from}: pending request to ${to}`),done];}),counted];
}
export async function voidSignature(db:D1Database,actor:Actor,requestId:string,reason:string,revision:string) {
  const r=await staffSignature(db,actor,requestId,true);insist(r.revision===revision,'Request changed; refresh',409);
  insist(!['completed','voided'].includes(r.status),'This request cannot be voided',409);
  const [check,done]=sameRequest(db,r,actor);
  await atomic(db,actor,[check,stmt(db,"UPDATE b_signatures SET status='voided',void_reason=?,revision=? WHERE id=?",reason,id(),r.id),...signatureEvent(db,r,'voided',actor.email,reason),audit(db,actor,'signature.voided_reason',r.job_id,reason),done]);return {id:r.id,status:'voided'};
}
