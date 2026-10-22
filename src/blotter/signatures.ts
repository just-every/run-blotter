import { requireClient } from './permissions';
// Staff create immutable document/field versions, then explicitly send, resend or void.
import { runtimeBindings, type Bindings } from '../auth.server';
import { recipientFor, contactGuard } from './client-recipients';
import { decodeFile, issueLink, sendMail } from './documents';
import { base64, preparePdf } from './signatures-pdf';
import { openSignatureJob, sameRequest, signatureDetail, signatureEvent, signerRows, staffSignature, voidSignature } from './signatures-store';
import { atomic, audit, digest, human, id, insist, job, need, now, rows, stmt, text, type Actor, type Data } from './model';
export { signatureDetail, pendingSignatures, transferSignatures } from './signatures-store';

export async function jobSignatures(db:D1Database,actor:Actor,jobId:string) {
  need(actor,'owner','reviewer','preparer');await job(db,actor,jobId);
  return rows(db,'SELECT id,title,status,mode,attempt,requester_email,created_at,sent_at,completed_at,revision,signed_sha256,certificate_sha256,erased_at FROM b_signatures WHERE job_id=? AND EXISTS(SELECT 1 FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=b_signatures.job_id AND c.erased_at IS NULL) ORDER BY created_at,id',jobId);
}
export async function clientSignatures(db:D1Database,actor:Actor,clientId:string) {
  await requireClient(db,actor,clientId);
  need(actor,'owner','reviewer','preparer');
  const jobs=await rows(db,"SELECT id FROM b_jobs WHERE client_id=? AND EXISTS(SELECT 1 FROM b_clients c WHERE c.id=b_jobs.client_id AND c.erased_at IS NULL) AND (? IN ('owner','reviewer') OR preparer_email=?)",clientId,actor.role,actor.email);
  insist(jobs.length||actor.role!=='preparer','Client not found',404);
  return rows(db,'SELECT s.id,s.job_id,s.title,s.status,s.mode,s.attempt,s.requester_email,s.completed_at,s.revision,s.signed_sha256,s.certificate_sha256 FROM b_signatures s WHERE s.job_id IN (SELECT value FROM json_each(?)) ORDER BY s.created_at,s.id',JSON.stringify(jobs.map(j=>j.id)));
}
export async function createSignature(db:D1Database,actor:Actor,jobId:string,body:Data) {
  human(actor);need(actor,'owner','reviewer','preparer');insist(!actor.automation,'A person must approve signature requests',403);
  const j=await job(db,actor,jobId),title=text(body.title,'Document title',200),formKind=text(body.formKind??'general','Form kind',100);
  insist(body.requiresKba===undefined||typeof body.requiresKba==='boolean','Requires KBA must be true or false');
  insist(!body.requiresKba&&!/\b(?:8879(?:-S|-PE|-C|-F)?|8878)\b/i.test(formKind+' '+title+' '+String(body.file?.name??'')),'This form requires the SIGN-001 KBA provider. Electronic signing is unavailable until it is configured.',409);
  const mode=body.mode;insist(mode==='sequential'||mode==='parallel','Choose sequential or parallel signing');
  insist(Array.isArray(body.contactIds)&&body.contactIds.length>0&&body.contactIds.length<=10&&new Set(body.contactIds).size===body.contactIds.length,'Choose 1–10 distinct signer contacts in order');
  const contacts=await Promise.all(body.contactIds.map((contactId:string)=>recipientFor(db,j.client_id,'signature',text(contactId,'Signer'))));
  insist(contacts.every(c=>c.portal&&c.request_consent),'Every signer must have portal permission and request consent',409);
  const file=decodeFile(body.file??{});insist(file.mime==='application/pdf','Choose a PDF');
  const prepared=await preparePdf(file.bytes,body.fields,contacts.map(c=>c.id)),requestId=id(),at=now(),revision=id();
  const guards=contacts.map(c=>contactGuard(db,j.client_id,c.id,'signature',c.revision)),[open,done]=openSignatureJob(db,j.id,actor);
  await atomic(db,actor,[open,...guards.map(g=>g[0]),stmt(db,`INSERT INTO b_signatures(id,job_id,title,requester_email,original_requester,mode,status,revision,form_kind,source_name,source_sha256,source_base64,fields,pages,created_at) VALUES(?,?,?,?,?,?,'draft',?,?,?,?,?,?,?,?)`,requestId,j.id,title,actor.email,actor.email,mode,revision,formKind,file.name,await digest(file.bytes),base64(file.bytes),JSON.stringify(prepared.fields),JSON.stringify(prepared.pages),at),
    ...contacts.map((c,i)=>stmt(db,'INSERT INTO b_signature_signers(request_id,attempt,contact_id,ordinal,contact_revision,name,email) VALUES(?,1,?,?,?,?,?)',requestId,c.id,i+1,c.revision,c.name,c.email)),
    ...signatureEvent(db,{id:requestId,job_id:j.id,attempt:1,requester_email:actor.email},'created',actor.email,'Document and PDF fields frozen'),...guards.map(g=>g[1]),done]);
  return signatureDetail(db,actor,requestId);
}
/** Invitations are claimed once with the request, before contacting the provider.
 * A lost provider result is uncertain and is never silently retried. */
export async function sendSignature(env:Bindings,actor:Actor,requestId:string,body:Data,origin:string) {
  const bindings=runtimeBindings(env),db=bindings.DB,r=await staffSignature(db,actor,requestId,true);
  insist(body.revision===r.revision,'Request changed; refresh',409);
  insist(['draft','declined','held'].includes(r.status),'Only a draft, declined or restored request can be sent',409);
  const old=await signerRows(db,r),contacts=await Promise.all(old.map(s=>recipientFor(db,r.client_id,'signature',s.contact_id)));
  insist(contacts.every(c=>c.portal&&c.request_consent),'Every signer needs portal permission and request consent',409);
  const resend=r.status!=='draft',attempt=resend?r.attempt+1:r.attempt,next={...r,attempt,status:'pending'},at=now(),[same,done]=sameRequest(db,r,actor),[open,closed]=openSignatureJob(db,r.job_id,actor);
  const links=await Promise.all(contacts.map(c=>issueLink(db,actor,r.job_id,origin,c.id))),guards=contacts.map(c=>contactGuard(db,r.client_id,c.id,'signature',c.revision));
  // All selected contacts can review. Sequential completion is enforced on the
  // signing door itself; the invitation plainly describes whose turn it is.
  const deliveries=contacts.map((c,i)=>({id:id(),contact:c,url:links[i].url,ordinal:i+1}));
  await atomic(db,actor,[same,open,...guards.map(g=>g[0]),...(resend?contacts.map((c,i)=>stmt(db,'INSERT INTO b_signature_signers(request_id,attempt,contact_id,ordinal,contact_revision,name,email) VALUES(?,?,?,?,?,?,?)',r.id,attempt,c.id,i+1,c.revision,c.name,c.email)):contacts.map(c=>stmt(db,'UPDATE b_signature_signers SET contact_revision=?,name=?,email=? WHERE request_id=? AND attempt=? AND contact_id=?',c.revision,c.name,c.email,r.id,attempt,c.id))),
    stmt(db,"UPDATE b_signatures SET status='pending',attempt=?,sent_at=?,revision=? WHERE id=?",attempt,at,id(),r.id),...links.flatMap(l=>l.statements),
    ...deliveries.map(d=>stmt(db,"INSERT INTO b_signature_deliveries(id,request_id,attempt,contact_id,sent_by,sent_at,delivery) VALUES(?,?,?,?,?,?,'uncertain: provider outcome not recorded')",d.id,r.id,attempt,d.contact.id,actor.email,at)),
    ...signatureEvent(db,next,resend?'resent':'sent',actor.email,resend?'Fresh attempt; previous signatures and decline remain in timeline':'Signer invitations issued'),...guards.map(g=>g[1]),closed,done]);
  const result=[];
  for(const d of deliveries){const delivery=await sendMail(bindings,d.id,d.contact.email,'Document signature request',`Please review and sign ${r.title}.\n${d.url}\n${r.mode==='sequential'?`Sequential signing: you are signer ${d.ordinal} of ${contacts.length}. You may review now and sign when all earlier signers finish.`:'Parallel signing: you may sign now.'}\nElectronic signing is optional. You may decline with a reason and ask for paper signing.`);await stmt(db,'UPDATE b_signature_deliveries SET delivery=? WHERE id=?',delivery,d.id).run();result.push({contactId:d.contact.id,portalUrl:d.url,delivery});}
  return {...await signatureDetail(db,actor,r.id),invitations:result};
}
export async function cancelSignature(db:D1Database,actor:Actor,requestId:string,body:Data) {
  return voidSignature(db,actor,requestId,text(body.reason,'Void reason',1000),text(body.revision,'Revision'));
}
