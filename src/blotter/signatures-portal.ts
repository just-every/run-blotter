// Signatures use the native contact-scoped portal. Every access and write rechecks
// link, entity, contact signer authority, frozen contact revision and request state.
import { portalJob } from './documents';
import { CONSENT_VERSION, SIGNING_CONSENT, fieldValues, finishPdf, unbase64 } from './signatures-pdf';
import { sameRequest, signatureEvent, signatureRecord, signerRows, staffSignature } from './signatures-store';
import { atomic, audit, Fault, guard, id, insist, now, rows, stmt, text, type Actor, type Data } from './model';

async function portalSignature(db:D1Database,token:string,requestId:string) {
  const p=await portalJob(db,token),r=await signatureRecord(db,requestId);
  insist(r.job_id===p.job.id&&r.status!=='draft'&&!r.erased_at,'Signature request not found',404);
  const signers=await signerRows(db,r),s=signers.find(s=>s.contact_id===p.contact.id);
  insist(s&&s.contact_revision===p.contact.revision&&p.contact.signer,'Signature request not found or signer authority changed',404);
  return {...p,r,s,signers};
}
function portalFence(db:D1Database,p:Awaited<ReturnType<typeof portalSignature>>) {
  return guard(db,`EXISTS(SELECT 1 FROM b_portal_links l JOIN b_jobs j ON j.id=l.job_id JOIN b_clients c ON c.id=j.client_id
    JOIN b_client_contacts k ON k.id=l.contact_id JOIN b_signature_signers s ON s.contact_id=k.id
    JOIN b_signatures r ON r.id=s.request_id AND r.attempt=s.attempt AND r.job_id=j.id
    WHERE l.id=? AND l.digest=? AND l.revoked_at IS NULL AND l.expires_at>? AND j.status<>'signed_off'
    AND c.lifecycle='active' AND c.merged_into IS NULL AND c.erased_at IS NULL AND k.client_id=j.client_id
    AND k.active=1 AND k.authorized=1 AND k.signer=1 AND k.portal=1 AND k.request_consent=1
    AND k.revision=s.contact_revision AND r.id=? AND r.revision=? AND r.erased_at IS NULL)`,p.link.id,p.link.digest,now(),p.r.id,p.r.revision);
}
async function portalBatch(db:D1Database,statements:D1PreparedStatement[]) {
  try {await db.batch(statements);}catch(error){if(/b_guard|constraint/i.test(String(error)))throw new Fault('This request or your authority changed. Reload before continuing.',409);throw error;}
}
export async function portalSignatures(db:D1Database,token:string) {
  const p=await portalJob(db,token);
  return rows(db,`SELECT r.id,r.title,r.status,r.mode,r.attempt,r.completed_at,r.revision,s.status signer_status FROM b_signatures r
    JOIN b_signature_signers s ON s.request_id=r.id AND s.attempt=r.attempt
    WHERE r.job_id=? AND s.contact_id=? AND s.contact_revision=? AND r.status<>'draft' AND r.erased_at IS NULL AND ?=1 ORDER BY r.created_at,r.id`,p.job.id,p.contact.id,p.contact.revision,p.contact.signer);
}
export async function portalSignatureDetail(db:D1Database,token:string,requestId:string) {
  const p=await portalSignature(db,token,requestId),[check,done]=portalFence(db,p);
  await portalBatch(db,[check,...signatureEvent(db,p.r,'opened','contact portal bearer (identity not verified)','Signer reviewed request',p.contact.id),done]);
  const fields:Data[]=JSON.parse(p.r.fields),earlier=p.signers.some(s=>s.ordinal<p.s.ordinal&&s.status!=='signed');
  return {id:p.r.id,title:p.r.title,status:p.r.status,mode:p.r.mode,attempt:p.r.attempt,revision:p.r.revision,contactId:p.contact.id,signerName:p.s.name,
    pages:JSON.parse(p.r.pages),fields:fields.filter(f=>f.contactId===p.contact.id),signerStatus:p.s.status,
    signers:p.signers.map(s=>({ordinal:s.ordinal,name:s.name,status:s.status,signedAt:s.signed_at})),canSign:p.r.status==='pending'&&p.s.status==='pending'&&(p.r.mode==='parallel'||!earlier),
    consentText:SIGNING_CONSENT,consentVersion:CONSENT_VERSION,hasSigned:p.r.status==='completed',
    events:(await rows(db,'SELECT action,contact_id,at FROM b_signature_events WHERE request_id=? ORDER BY at,id',p.r.id))};
}
export async function signSignature(db:D1Database,token:string,requestId:string,body:Data) {
  const p=await portalSignature(db,token,requestId),{r,s,signers}=p;
  insist(r.status==='pending'&&s.status==='pending','This request is not accepting this signature',409);
  insist(body.revision===r.revision&&body.attempt===r.attempt,'The request changed; review it again',409);
  insist(body.consent===true&&body.intent===true&&body.consentVersion===CONSENT_VERSION,'Explicit ESIGN/UETA consent and intent to sign are required');
  insist(r.mode==='parallel'||!signers.some(x=>x.ordinal<s.ordinal&&x.status!=='signed'),'Wait for earlier signers to finish',409);
  const values=await fieldValues(JSON.parse(r.fields).filter((f:Data)=>f.contactId===p.contact.id),body.values),at=now();
  const signed={...s,status:'signed',values_json:JSON.stringify(values),consent_text:SIGNING_CONSENT,consent_version:CONSENT_VERSION,signed_at:at,portal_link_id:p.link.id};
  const after=signers.map(x=>x.contact_id===s.contact_id?signed:x),complete=after.every(x=>x.status==='signed');
  // Rendering occurs before the guarded transaction; a parallel signer that
  // changed the revision makes this write fail instead of losing their data.
  const output=complete?await finishPdf({...r,completed_at:at},after):null,[check,done]=portalFence(db,p);
  const authorities=guard(db,`NOT EXISTS(SELECT 1 FROM b_signature_signers s LEFT JOIN b_client_contacts c ON c.id=s.contact_id AND c.client_id=? WHERE s.request_id=? AND s.attempt=? AND (c.id IS NULL OR c.revision<>s.contact_revision OR c.active<>1 OR c.authorized<>1 OR c.signer<>1 OR c.portal<>1 OR c.request_consent<>1))`,r.client_id,r.id,r.attempt);
  const current=guard(db,`EXISTS(SELECT 1 FROM b_signatures WHERE id=? AND revision=? AND status='pending' AND attempt=?) AND EXISTS(SELECT 1 FROM b_signature_signers WHERE request_id=? AND attempt=? AND contact_id=? AND status='pending')`,r.id,r.revision,r.attempt,r.id,r.attempt,p.contact.id);
  await portalBatch(db,[check,current[0],authorities[0],stmt(db,`UPDATE b_signature_signers SET status='signed',values_json=?,consent_text=?,consent_version=?,signed_at=?,portal_link_id=? WHERE request_id=? AND attempt=? AND contact_id=?`,signed.values_json,SIGNING_CONSENT,CONSENT_VERSION,at,p.link.id,r.id,r.attempt,p.contact.id),
    stmt(db,'UPDATE b_signatures SET status=?,revision=?,completed_at=?,signed_base64=?,signed_sha256=?,certificate_base64=?,certificate_sha256=? WHERE id=?',complete?'completed':'pending',id(),complete?at:null,output?.signed??null,output?.signedHash??null,output?.certificate??null,output?.certificateHash??null,r.id),
    ...signatureEvent(db,r,'signed','contact portal bearer (identity not verified)',`${s.name} signed with explicit ${CONSENT_VERSION} consent`,p.contact.id,at),
    ...(complete?[...signatureEvent(db,r,'completed','contact portal bearer (identity not verified)','Signed PDF and certificate filed to client and work',null,at),stmt(db,"INSERT INTO b_automation_events(source,job_id,kind,at) VALUES(?,?,'signature_complete',?)",'signature:'+r.id+':'+r.attempt,r.job_id,at)]:[]),authorities[1],current[1],done]);
  return {id:r.id,status:complete?'completed':'pending'};
}
export async function declineSignature(db:D1Database,token:string,requestId:string,body:Data) {
  const p=await portalSignature(db,token,requestId),{r}=p;
  insist(r.status==='pending'&&p.s.status==='pending','This request is not accepting a decline',409);
  insist(body.revision===r.revision,'Request changed; reload',409);
  const reason=text(body.reason,'Decline reason',1000),[check,done]=portalFence(db,p);
  await portalBatch(db,[check,stmt(db,"UPDATE b_signature_signers SET status='declined',decline_reason=? WHERE request_id=? AND attempt=? AND contact_id=?",reason,r.id,r.attempt,p.contact.id),
    stmt(db,"UPDATE b_signatures SET status='declined',revision=? WHERE id=?",id(),r.id),...signatureEvent(db,r,'declined','contact portal bearer (identity not verified)',reason,p.contact.id),done]);return {id:r.id,status:'declined'};
}
function pdfResponse(r:Data,kind:string) {
  insist(['original','signed','certificate'].includes(kind),'Choose original, signed or certificate',404);
  const encoded=kind==='original'?r.source_base64:kind==='signed'?r.signed_base64:r.certificate_base64;
  insist(encoded&&!r.erased_at,'PDF unavailable or erased',404);
  return new Response(unbase64(encoded),{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${String(r.title).replace(/[^A-Za-z0-9._ -]/g,'_')}-${kind}.pdf"`,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
}
export async function signatureDownload(db:D1Database,actor:Actor,requestId:string,kind:string) {
  const r=await staffSignature(db,actor,requestId),[check,done]=sameRequest(db,r,actor),response=pdfResponse(r,kind);
  await atomic(db,actor,[check,audit(db,actor,'signature.downloaded',r.job_id,JSON.stringify({requestId:r.id,kind,channel:'staff'})),done]);return response;
}
export async function portalSignatureDownload(db:D1Database,token:string,requestId:string,kind:string) {
  const p=await portalSignature(db,token,requestId),[check,done]=portalFence(db,p),response=pdfResponse(p.r,kind);
  await portalBatch(db,[check,...signatureEvent(db,p.r,'downloaded','contact portal bearer (identity not verified)',JSON.stringify({kind,channel:'portal'}),p.contact.id),done]);return response;
}
