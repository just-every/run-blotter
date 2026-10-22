// SIGN-002 adapters for ERASURE-002's existing preview/approval/journal engine.
import { lit, type Context, type Step } from './erasure-scope';
import { rows, type Data } from './model';
import { addYears, localDate, type Clocked } from './retention-clock';

export async function signatureClocks(db:D1Database,timeZone:string,years:number):Promise<Clocked[]> {
  return (await rows(db,`SELECT s.id,s.title,s.completed_at,j.client_id,j.signed_off_at,c.erased_at client_erased_at FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id JOIN b_clients c ON c.id=j.client_id WHERE s.status='completed' AND s.erased_at IS NULL`)).map(s=>{
    const clock=[localDate(s.completed_at,timeZone),...(s.signed_off_at?[localDate(s.signed_off_at,timeZone)]:[])].sort().at(-1)!;
    return {kind:'signature',id:s.id,cls:'signed_documents',clientIds:[s.client_id],label:s.client_erased_at?'Retained signed document '+s.id.slice(0,8):s.title,clock,years,expiry:addYears(clock,years)};
  });
}
export function signatureExpiryEffects(requestId:string,at:string) {
  const r=lit(requestId);
  return [
    {table:'b_signature_signers',label:'Signer personal fields, entered text, connection evidence and decline reasons',where:`request_id=${r}`,set:"name='[erased]',email='[erased]',values_json=NULL,portal_link_id=NULL,decline_reason=NULL,connection_ip=NULL,connection_user_agent=NULL",action:'redact' as const},
    {table:'b_signature_attestations',label:'Remote-authentication attestations: verifier, items checked and notes (method, dates and recorder stay)',where:`request_id=${r}`,set:"verifier='[erased]',items='[]',secondary_document=NULL,note=NULL",action:'redact' as const},
    {table:'b_signature_events',label:'Signature event detail (action, author and time stay)',where:`request_id=${r}`,set:"detail='[erased]'",action:'redact' as const},
    {table:'b_signatures',label:'Original, signed PDF, certificate and field labels (ids, authors, dates and SHA-256 stay)',where:`id=${r} AND erased_at IS NULL`,set:`title='[erased]',source_name='[erased]',source_base64=NULL,signed_base64=NULL,certificate_base64=NULL,fields='[]',void_reason=NULL,erased_at=${lit(at)}`,action:'redact' as const},
  ];
}
export function signatureErasureSteps(x:Context):Step[] {
  const heldJobs=x.held.jobs.length?x.held.jobs.map(lit).join(','):"''",heldRequests=x.held.files.length?x.held.files.map(lit).join(','):"''";
  const requests=`(SELECT s.id FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE j.client_id=${lit(x.client)} AND s.status<>'completed' AND j.id NOT IN (${heldJobs}) AND s.id NOT IN (${heldRequests}))`;
  const own=`id IN ${requests}`,child=`request_id IN ${requests}`;
  const list:Step[]=[
    {cls:'signed_documents',table:'b_signature_signers',action:'redact',label:'Uncompleted signature attempts: signer personal fields and entered values',where:child,set:"name='[erased]',email='[erased]',values_json=NULL,portal_link_id=NULL,decline_reason=NULL,connection_ip=NULL,connection_user_agent=NULL"},
    {cls:'signed_documents',table:'b_signature_attestations',action:'redact',label:'Uncompleted signature attestations: verifier, items checked and notes',where:child,set:"verifier='[erased]',items='[]',secondary_document=NULL,note=NULL"},
    {cls:'signed_documents',table:'b_signature_events',action:'redact',label:'Uncompleted signature timeline details',where:child,set:"detail='[erased]'"},
    {cls:'signed_documents',table:'b_signature_deliveries',action:'redact',label:'Signature invitation provider details',where:child,set:"delivery='[erased]'"},
    {cls:'signed_documents',table:'b_signatures',action:'redact',label:'Uncompleted signature request PDFs and fields',where:own,set:`title='[erased]',source_name='[erased]',source_base64=NULL,signed_base64=NULL,certificate_base64=NULL,fields='[]',void_reason=NULL,erased_at=${lit(x.at)}`},
  ];
  // Preserve row ordering so held/free preview counts refer to the same steps.
  return x.held.client||x.held.classes.includes('signed_documents')?list.map(s=>({...s,held:true,where:'0'})):list;
}
export function signatureRetained(x:Context) {
  return {key:'signed_documents',cls:'signed_documents' as const,label:'Completed signed PDFs, certificates and signer evidence',reason:'Kept until completion or later work sign-off plus the signed-document retention period.',owner:'Principal',sql:`SELECT count(*) n FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE j.client_id=${lit(x.client)} AND s.status='completed' AND s.erased_at IS NULL`};
}
export async function signatureOpenWork(db:D1Database,clientId:string) {
  const pending=await rows(db,`SELECT s.id,s.title FROM b_signatures s JOIN b_jobs j ON j.id=s.job_id WHERE j.client_id=? AND s.status IN ('draft','pending','declined','held')`,clientId);
  return pending.map(s=>`Pending signature request: ${s.title}. Complete or void it first.`);
}
export async function signatureOutsideCopies(db:D1Database,clientId:string) {
  const out:Data[]=[],mail=await rows(db,`SELECT count(*) n FROM b_signature_deliveries d JOIN b_signatures s ON s.id=d.request_id JOIN b_jobs j ON j.id=s.job_id WHERE j.client_id=? AND d.delivery LIKE 'accepted by %'`,clientId);
  if(Number(mail[0].n)){out.push({source:'signature-invitations',label:'Signature invitations delivered through the mail provider',owner:'The mail provider (provider-retained)',count:Number(mail[0].n),kind:'observed'},{source:'signature-recipient-mail',label:'Signature invitations in recipients’ mailboxes',owner:'The recipients (recipient-controlled)',count:Number(mail[0].n),kind:'observed'});}
  const downloads=await rows(db,`SELECT a.actor,count(*) n FROM b_audit a WHERE a.action='signature.downloaded' AND a.object_id IN (SELECT id FROM b_jobs WHERE client_id=?) GROUP BY a.actor`,clientId);
  for(const d of downloads)out.push({source:'signature-downloads',label:'Signature PDFs and certificates downloaded',owner:d.actor,count:Number(d.n),kind:'observed'});
  // The native PDF engine has no signing provider; only observed mail and
  // downloaded copies leave this installation.
  return out;
}
