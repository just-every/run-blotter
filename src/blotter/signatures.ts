import { requireClient } from './permissions';
// Staff create immutable document/field versions, then explicitly send, resend or void.
import { runtimeBindings, type Bindings } from '../auth.server';
import { recipientFor, contactGuard } from './client-recipients';
import { decodeFile, issueLink, sendMail } from './documents';
import { base64, preparePdf } from './signatures-pdf';
import { openSignatureJob, sameRequest, signatureDetail, signatureEvent, signerRows, staffSignature, voidSignature } from './signatures-store';
import { canAccessClient } from './permissions';
import { classifyForm } from './signatures-forms';
import { staffRef } from './signatures-staff';
import { isLanguage, tr, type Key } from '../i18n/catalog';
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
/** A staff member who may sign as a representative: an active practice member or the principal who holds the client and may work. */
async function staffSigner(db:D1Database,actor:Actor,clientId:string,address:string) {
  const email=address.trim().toLowerCase();
  const member=await stmt(db,"SELECT m.email,m.name FROM b_members m WHERE m.email=? AND m.active=1 UNION SELECT o.email,o.display_name FROM oa_operators o WHERE o.email=? AND o.role='owner' AND o.status='active'",email,email).first<Data>();
  insist(member&&await canAccessClient(db,email,clientId)&&!await stmt(db,'SELECT 1 FROM b_access_members WHERE email=? AND read_only=1',email).first(),'A staff signer must be an active member with working access to this client',409);
  return {email,name:String(member!.name||email)};
}
export async function prepareSignatureDraft(db:D1Database,actor:Actor,jobId:string,body:Data) {
  human(actor);need(actor,'owner','reviewer','preparer');insist(!actor.automation,'A person must approve signature requests',403);
  const j=await job(db,actor,jobId),title=text(body.title,'Document title',200),formKind=text(body.formKind??'general','Form kind',100);
  insist(body.requiresKba===undefined||typeof body.requiresKba==='boolean','Requires KBA must be true or false');
  insist(!body.requiresKba,'This form requires the SIGN-001 KBA provider. Electronic signing is unavailable until it is configured.',409);
  const mode=body.mode;insist(mode==='sequential'||mode==='parallel','Choose sequential or parallel signing');
  insist(Array.isArray(body.contactIds)&&body.contactIds.length>0&&body.contactIds.length<=10&&new Set(body.contactIds).size===body.contactIds.length,'Choose 1–10 distinct signers in order');
  // A signer is a client contact (a portal link) or a staff member named as `staff:<email>` who signs in their own session.
  const people=await Promise.all(body.contactIds.map(async(ref:string)=>{
    if(typeof ref==='string'&&ref.startsWith('staff:')){const m=await staffSigner(db,actor,j.client_id,ref.slice(6));return {staff:true,id:staffRef(m.email),...m,revision:''};}
    return {staff:false,...await recipientFor(db,j.client_id,'signature',text(ref,'Signer'))};
  }));
  insist(people.every((c:Data)=>c.staff||(c.portal&&c.request_consent)),'Every contact signer must have portal permission and request consent',409);
  const file=decodeFile(body.file??{});insist(file.mime==='application/pdf','Choose a PDF');
  // The document's own text decides, not only its labels: an IRS e-file authorization is never signed here.
  const kind=await classifyForm([formKind,title,file.name],file.bytes);
  insist(!kind.eFile,'This form requires the SIGN-001 KBA provider. Electronic signing is unavailable until it is configured.',409);
  const prepared=await preparePdf(file.bytes,body.fields,people.map((c:Data)=>c.id)),requestId=id(),at=now(),revision=id();
  const contacts=people.filter((c:Data)=>!c.staff),guards=contacts.map((c:Data)=>contactGuard(db,j.client_id,c.id,'signature',c.revision)),[open,done]=openSignatureJob(db,j.id,actor);
  const statements=[open,...guards.map(g=>g[0]),stmt(db,`INSERT INTO b_signatures(id,job_id,title,requester_email,original_requester,mode,status,revision,form_kind,source_name,source_sha256,source_base64,fields,pages,created_at,attestation_required) VALUES(?,?,?,?,?,?,'draft',?,?,?,?,?,?,?,?,?)`,requestId,j.id,title,actor.email,actor.email,mode,revision,formKind,file.name,await digest(file.bytes),base64(file.bytes),JSON.stringify(prepared.fields),JSON.stringify(prepared.pages),at,kind.attestation?1:0),
    ...people.map((c:Data,i:number)=>stmt(db,'INSERT INTO b_signature_signers(request_id,attempt,contact_id,ordinal,contact_revision,name,email,signer_kind) VALUES(?,1,?,?,?,?,?,?)',requestId,c.id,i+1,c.revision??'',c.name,c.email,c.staff?'staff':'contact')),
    ...signatureEvent(db,{id:requestId,job_id:j.id,attempt:1,requester_email:actor.email},'created',actor.email,'Document and PDF fields frozen'),...guards.map(g=>g[1]),done];
  return {requestId,statements};
}
export async function createSignature(db:D1Database,actor:Actor,jobId:string,body:Data) {
  const prepared=await prepareSignatureDraft(db,actor,jobId,body);
  await atomic(db,actor,prepared.statements);
  return signatureDetail(db,actor,prepared.requestId);
}
/** Invitations are claimed once with the request, before contacting the provider.
 * A lost provider result is uncertain and is never silently retried. */
export async function sendSignature(env:Bindings,actor:Actor,requestId:string,body:Data,origin:string) {
  const bindings=runtimeBindings(env),db=bindings.DB,r=await staffSignature(db,actor,requestId,true);
  insist(body.revision===r.revision,'Request changed; refresh',409);
  insist(['draft','declined','held'].includes(r.status),'Only a draft, declined or restored request can be sent',409);
  // Contact signers get a fresh portal invitation; a staff signer signs in their own session and is rechecked as a live member holding the client.
  const old=await signerRows(db,r),people:Data[]=await Promise.all(old.map(async s=>s.signer_kind==='staff'?{staff:true,...await staffSigner(db,actor,r.client_id,s.email),id:s.contact_id,revision:''}:{staff:false,...await recipientFor(db,r.client_id,'signature',s.contact_id)}));
  const contacts=people.filter(c=>!c.staff);
  insist(contacts.every(c=>c.portal&&c.request_consent),'Every contact signer needs portal permission and request consent',409);
  const resend=r.status!=='draft',attempt=resend?r.attempt+1:r.attempt,next={...r,attempt,status:'pending'},at=now(),[same,done]=sameRequest(db,r,actor),[open,closed]=openSignatureJob(db,r.job_id,actor);
  const links=await Promise.all(contacts.map(c=>issueLink(db,actor,r.job_id,origin,c.id))),guards=contacts.map(c=>contactGuard(db,r.client_id,c.id,'signature',c.revision));
  // All selected contacts can review. Sequential completion is enforced on the
  // signing door itself; the invitation plainly describes whose turn it is.
  const deliveries=contacts.map((c,i)=>({id:id(),contact:c,url:links[i].url,ordinal:people.indexOf(c)+1}));
  await atomic(db,actor,[same,open,...guards.map(g=>g[0]),...(resend?people.map((c,i)=>stmt(db,'INSERT INTO b_signature_signers(request_id,attempt,contact_id,ordinal,contact_revision,name,email,signer_kind) VALUES(?,?,?,?,?,?,?,?)',r.id,attempt,c.id,i+1,c.revision,c.name,c.email,c.staff?'staff':'contact')):contacts.map(c=>stmt(db,'UPDATE b_signature_signers SET contact_revision=?,name=?,email=? WHERE request_id=? AND attempt=? AND contact_id=?',c.revision,c.name,c.email,r.id,attempt,c.id))),
    stmt(db,"UPDATE b_signatures SET status='pending',attempt=?,sent_at=?,revision=? WHERE id=?",attempt,at,id(),r.id),...links.flatMap(l=>l.statements),
    ...deliveries.map(d=>stmt(db,"INSERT INTO b_signature_deliveries(id,request_id,attempt,contact_id,sent_by,sent_at,delivery) VALUES(?,?,?,?,?,?,'uncertain: provider outcome not recorded')",d.id,r.id,attempt,d.contact.id,actor.email,at)),
    ...signatureEvent(db,next,resend?'resent':'sent',actor.email,resend?'Fresh attempt; previous signatures and decline remain in timeline':'Signer invitations issued'),...guards.map(g=>g[1]),closed,done]);
  const result=[];
  for(const d of deliveries){
    // The invitation reads in the signer's language (PORTAL-005).
    const T=(key:Key,vars:Record<string,string|number>={})=>tr(isLanguage(d.contact.language)?d.contact.language:'en',key,vars);
    const delivery=await sendMail(bindings,d.id,d.contact.email,T('mail.signature.subject'),[T('mail.signature.review',{title:r.title}),d.url,r.mode==='sequential'?T('mail.signature.sequential',{n:d.ordinal,total:people.length}):T('mail.signature.parallel'),T('mail.signature.optional')].join('\n'));
    await stmt(db,'UPDATE b_signature_deliveries SET delivery=? WHERE id=?',delivery,d.id).run();result.push({contactId:d.contact.id,portalUrl:d.url,delivery});
  }
  return {...await signatureDetail(db,actor,r.id),invitations:result};
}
export async function cancelSignature(db:D1Database,actor:Actor,requestId:string,body:Data) {
  return voidSignature(db,actor,requestId,text(body.reason,'Void reason',1000),text(body.revision,'Revision'));
}
