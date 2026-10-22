// Native PDF parsing, field geometry and final, flattened signature evidence.
import { PDFDocument, PDFSignature, StandardFonts, rgb } from 'pdf-lib';
import { insist, integer, text, digest, type Data } from './model';
export const CONSENT_VERSION = 'esign-ueta-v1';
export const SIGNING_CONSENT = 'I consent to use electronic records and signatures for this document under the ESIGN Act and UETA. I can download and retain this PDF and its completion certificate. I may decline electronic signing and ask the practice for a paper copy or another way to sign. I can withdraw consent before signing by declining this request. My consent applies only to this document and does not include marketing. I have reviewed this document, am authorized to sign for this client, and intend my entered signature and initials to sign it.';
export const unbase64 = (v:string) => Uint8Array.from(atob(v), c=>c.charCodeAt(0));
export function base64(bytes:Uint8Array) { let out=''; for(let i=0;i<bytes.length;i+=32768)out+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(out); }
export async function openPdf(bytes:Uint8Array) {
  insist(bytes.length<=1048576,'Signature PDFs must be at most 1 MiB');
  insist(new TextDecoder().decode(bytes.subarray(0,5))==='%PDF-','Choose a PDF document');
  let pdf:PDFDocument;
  try { pdf=await PDFDocument.load(bytes,{updateMetadata:false}); } catch { insist(false,'This PDF cannot be opened. Supply an unencrypted, valid PDF.'); }
  insist(!pdf.isEncrypted,'Encrypted PDFs cannot be signed');
  insist(pdf.getPageCount()>0&&pdf.getPageCount()<=200,'Signature PDFs need 1–200 pages');
  // A previous digital signature would be invalidated by an overlay; refuse it.
  insist(!pdf.getForm().getFields().some(f=>f instanceof PDFSignature),'PDF already contains a digital signature field; supply an unsigned original');
  return pdf;
}
export async function preparePdf(bytes:Uint8Array,input:unknown,contactIds:string[]) {
  const pdf=await openPdf(bytes),pages=pdf.getPages().map(p=>({width:p.getWidth(),height:p.getHeight(),rotation:p.getRotation().angle}));
  insist(Array.isArray(input)&&input.length>0&&input.length<=100,'Place between 1 and 100 fields');
  const fields=input.map((f:Data,i:number)=>{
    const type=text(f.type,'Field type',20); insist(['signature','initials','date','text'].includes(type),'Choose signature, initials, date or text');
    const contactId=text(f.contactId,'Field signer');insist(contactIds.includes(contactId),'Every field must belong to a selected signer');
    const page=integer(f.page,'Page',1,pages.length),p=pages[page-1];
    insist(p.rotation===0,'Rotate PDF pages upright before placing fields');
    const x=integer(f.x,'Left',0,20000),y=integer(f.y,'Top',0,20000),width=integer(f.width,'Width',40,2000),height=integer(f.height,'Height',16,200);
    insist(x+width<=p.width&&y+height<=p.height,'The field must fit entirely on its PDF page');
    return {id:'field-'+(i+1),type,contactId,page,x,y,width,height,label:text(f.label??type,'Field label',100)};
  });
  for(const contactId of contactIds)insist(fields.some(f=>f.contactId===contactId&&f.type==='signature'),'Place a signature field for every signer');
  return {fields,pages};
}
export async function fieldValues(fields:Data[],input:Data) {
  const font=await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  insist(input&&typeof input==='object'&&!Array.isArray(input),'Complete the fields');
  insist(Object.keys(input).every(k=>fields.some(f=>f.id===k)),'Only your own fields may be filled');
  return Object.fromEntries(fields.map(f=>{
    const value=text(input[f.id],f.label, f.type==='initials'?12:f.type==='date'?10:200);
    insist(!/[\r\n]/.test(value),'Use one line per field');
    insist(/^[\x20-\x7e\xa0-\xff]+$/.test(value),'Use Latin characters supported by this PDF font');
    if(f.type==='date')insist(/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value,'Use a valid YYYY-MM-DD date');
    let width=Infinity;try{width=font.widthOfTextAtSize(value,5);}catch{insist(false,'Use characters supported by this PDF font');}
    insist(width<=f.width-8,'Text does not fit its field; use a shorter value');
    return [f.id,value];
  }));
}
export async function finishPdf(request:Data,signers:Data[],attestations:Data[]=[]) {
  const pdf=await openPdf(unbase64(request.source_base64)),font=await pdf.embedFont(StandardFonts.Helvetica),fields:Data[]=JSON.parse(request.fields);
  for(const f of fields){const s=signers.find(s=>s.contact_id===f.contactId)!,value=JSON.parse(s.values_json)[f.id],page=pdf.getPage(f.page-1);
    const size=Math.min(f.type==='signature'?16:11,(f.width-8)/Math.max(font.widthOfTextAtSize(value,1),1),f.height-6);
    insist(size>=5,'Text does not fit its field; use a shorter value');
    page.drawRectangle({x:f.x,y:page.getHeight()-f.y-f.height,width:f.width,height:f.height,borderWidth:0.5,borderColor:rgb(.3,.4,.5),color:rgb(.97,.98,1)});
    page.drawText(value,{x:f.x+4,y:page.getHeight()-f.y-f.height+4,size,font,color:rgb(.08,.12,.2)});
  }
  const signed=await pdf.save(),signedHash=await digest(signed),certificate=await PDFDocument.create(),cf=await certificate.embedFont(StandardFonts.Helvetica);
  let page=certificate.addPage([612,792]),y=750;
  const line=(value:string)=>{const printable=value.replace(/[^\x20-\x7e\xa0-\xff]/g,'?');for(let start=0;start<printable.length;start+=87){if(y<45){page=certificate.addPage([612,792]);y=750;}page.drawText(printable.slice(start,start+87),{x:38,y,size:10,font:cf});y-=15;}};
  for(const value of ['Blotter electronic signature completion certificate',`Request: ${request.id}; attempt ${request.attempt}`,`Document: ${request.title}`,`Work: ${request.job_id}`,`Order: ${request.mode}`,`Requested by: ${request.original_requester}`,`Completed: ${request.completed_at}`,`Original SHA-256: ${request.source_sha256}`,`Signed PDF SHA-256: ${signedHash}`,'Authentication: entity/contact-scoped portal link possession or an authenticated staff session. Blotter did not itself verify personal identity (identity not verified).','Signature method: typed electronic signature; no KBA or cryptographic digital signature.','Consent: '+CONSENT_VERSION,SIGNING_CONSENT])line(value);
  if(request.attestation_required)for(const v of ['Form status: this form is electronically signed and may be submitted only online at IRS.gov/Submit2848.','Remote authentication: a staff member recorded the attestation below for each remote signer before that signer could sign.'])line(v);
  for(const s of signers){line('');const a=attestations.find(a=>a.contact_id===s.contact_id);
    for(const v of [`Signer ${s.ordinal}: ${s.name} <${s.email}>`,s.signer_kind==='staff'?`Staff signer: ${s.email}; signed in their own authenticated staff session`:`Contact: ${s.contact_id}; authorized entity signer at execution`,`Signed: ${s.signed_at}; ${s.signer_kind==='staff'?'session':'portal login/link'} ID: ${s.portal_link_id}`,
      `Consent and signature from connection IP: ${s.connection_ip}`,`Consent and signature from user agent: ${s.connection_user_agent}`,`Consent version: ${s.consent_version}`,
      ...(a?[`Remote-authentication attestation: ${String(a.method).replaceAll('_',' ')}; verified by ${a.verifier} on ${a.verified_on}; recorded by ${a.recorded_by} at ${a.recorded_at}`,`Items checked: ${JSON.parse(a.items).join(', ')||'none (personal knowledge)'}${a.secondary_document?`; secondary document: ${a.secondary_document}`:''}${a.note?`; note: ${a.note}`:''}`]:[]),
      `Entered fields: ${s.values_json}`])line(v);}
  const cert=await certificate.save();return {signed:base64(signed),signedHash,certificate:base64(cert),certificateHash:await digest(cert)};
}
