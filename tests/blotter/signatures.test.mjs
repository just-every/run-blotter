import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {harness} from './harness.mjs';
import {signatureAppJourney,signatureOwnerJourney} from './signatures-ui.mjs';
const prepEmail='synthetic-blotter-1@example.test',successorEmail='synthetic-blotter-2@example.test',outsideEmail='synthetic-blotter-3@example.test';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const noticeSettings={timeZone:'UTC',quietStart:'00:00',quietEnd:'00:00',digestTime:'07:00',digestEnabled:false,leadDays:1,emailKinds:['signature']};
const contact=n=>({name:({5:'Mia Chen',6:'Jonah Chen',7:'Avery Lane'})[n],firstName:({5:'Mia',6:'Jonah',7:'Avery'})[n],email:`synthetic-blotter-${n}@example.test`,roles:['primary'],authorized:true,signer:true,portal:true,requestConsent:true,emailConsent:true,consentNote:'Explicit synthetic entity and signer authority'});
async function fixture(h){
  const sessions={};for(const [email,name] of [[prepEmail,'Pat Harper'],[successorEmail,'Cameron Morgan'],[outsideEmail,'Casey Drew']]){await h.json('/team',{email,name,role:'preparer'},h.owner);await h.json('/team/invite',{email},h.owner);sessions[email]=await h.login(email);}
  const client=await h.json('/clients',{name:'Cedar Lane Manufacturing LLC',contacts:[contact(5),contact(6),contact(7)]},h.owner);
  const template=await h.json('/templates',{name:'Annual financial statement review',recurrence:'annual',steps:'Inspect evidence',requests:'Evidence'},h.owner);
  const job=await h.json('/jobs',{clientId:client.id,templateId:template.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Client agreed date',preparerEmail:prepEmail,reviewerEmail:'owner@example.test'},h.owner);
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([612,792]).drawText('Management representation for the annual review',{x:40,y:740,font,size:12});
  return {client,template,job,prep:sessions[prepEmail],successor:sessions[successorEmail],outside:sessions[outsideEmail],bytes:Buffer.from(await pdf.save())};
}
const fields=f=>f.client.contacts.slice(0,2).flatMap((c,n)=>['signature','initials','date','text'].map((type,i)=>({type,contactId:c.id,page:1,x:40+n*280,y:100+i*50,width:240,height:28,label:`${type} ${n+1}`})));
const draft=(h,f,extra={},who=f.prep)=>h.json(`/jobs/${f.job.id}/signatures`,{title:'synthetic-blotter-10 representation',formKind:'management representation',requiresKba:false,mode:'sequential',contactIds:f.client.contacts.slice(0,2).map(c=>c.id),fields:fields(f),file:{name:'synthetic-blotter-9.pdf',mime:'application/pdf',contentBase64:f.bytes.toString('base64')},...extra},who);
const token=i=>new URL(i.portalUrl).pathname.split('/').at(-1);
const open=(h,t,id)=>h.json(`/portal/${t}/signatures/${id}`);
const signBody=v=>({revision:v.revision,attempt:v.attempt,consent:true,intent:true,consentVersion:v.consentVersion,values:Object.fromEntries(v.fields.map(f=>[f.id,f.type==='date'?'2026-10-22':f.type==='initials'?'SB':f.type==='signature'?v.signerName:'Reviewed']))});
const sign=(h,t,id,v,expected=200,extra={})=>h.json(`/portal/${t}/signatures/${id}/sign`,{...signBody(v),...extra},'',expected);
async function sent(h,f,extra={}){const d=await draft(h,f,extra);return h.json(`/signatures/${d.id}/send`,{revision:d.revision},f.prep);}
async function complete(h,r){for(const i of r.invitations){const t=token(i),v=await open(h,t,r.id);await sign(h,t,r.id,v);}return h.json(`/signatures/${r.id}`,undefined,h.owner);}
function pdfText(bytes){let text='';const raw=Buffer.from(bytes).toString('latin1');for(const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)){let content;try{content=inflateSync(Buffer.from(m[1],'latin1')).toString('latin1');}catch{content=m[1];}for(const t of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g))text+=Buffer.from(t[1],'hex').toString('latin1');}return text;}
async function finishJob(h,f){let d=await h.json(`/jobs/${f.job.id}`,undefined,f.prep);for(const r of d.requests){await h.json(`/requests/${r.id}/files`,{name:'synthetic-blotter-11.txt',mime:'text/plain',contentBase64:Buffer.from('Evidence').toString('base64')},f.prep);await h.json(`/requests/${r.id}/decide`,{decision:'accept'},f.prep);}for(const s of d.steps)await h.json(`/jobs/${f.job.id}/steps`,{ordinal:s.ordinal,done:true},f.prep);d=await h.json(`/jobs/${f.job.id}/submit`,{revision:(await h.json(`/jobs/${f.job.id}`,undefined,f.prep)).job.revision},f.prep);await h.json(`/jobs/${f.job.id}/review`,{revision:d.job.revision,decision:'signoff',note:'Inspected the evidence'},h.owner);}

test('SIGN-002 / BASE-001 / NOTIFY-001: real PDF fields, consent, authorized sequential and parallel signers, decline/resend, void, filed certificate/timeline, notification preferences and atomic offboarding',async()=>{
 const h=await harness();let copy;try{
  const f=await fixture(h),key=await h.json('/keys',{label:'synthetic-blotter-12'},h.owner);
  const empty={title:'Denied'};await h.json(`/jobs/${f.job.id}/signatures`,empty,f.outside,404);await h.json(`/jobs/${f.job.id}/signatures`,empty,'',401,{authorization:'Bearer '+key.key});
  const base={title:'synthetic-blotter-13',formKind:'8879',mode:'parallel',contactIds:[f.client.contacts[0].id],fields:fields(f).slice(0,4),file:{name:'synthetic-blotter-9.pdf',mime:'application/pdf',contentBase64:f.bytes.toString('base64')}};
  await h.json(`/jobs/${f.job.id}/signatures`,base,f.prep,409);await h.json(`/jobs/${f.job.id}/signatures`,{...base,formKind:'general',requiresKba:true},f.prep,409);
  await h.json(`/jobs/${f.job.id}/signatures`,{...base,formKind:'general',fields:[{...fields(f)[0],x:600}]},f.prep,400);
  let r=await sent(h,f),t1=token(r.invitations[0]),t2=token(r.invitations[1]);
  const nonSigner=await h.json(`/jobs/${f.job.id}/reminders`,{contactId:f.client.contacts[2].id},h.owner),t3=token(nonSigner);
  await h.json(`/portal/${t3}/signatures/${r.id}`,undefined,'',404);assert.equal((await h.request(`/api/blotter/portal/${t3}/signatures/${r.id}/files/original`)).status,404);
  let v2=await open(h,t2,r.id);assert.equal(v2.canSign,false);await sign(h,t2,r.id,v2,409);
  const v1=await open(h,t1,r.id);await sign(h,t1,r.id,v1,400,{consent:false});await sign(h,t1,r.id,v1,400,{intent:false});
  await h.json(`/portal/${t1}/signatures/${r.id}/decline`,{revision:v1.revision,reason:'Please confirm the authorized amount'});
  let declined=await h.json(`/signatures/${r.id}`,undefined,f.prep);assert.equal(declined.status,'declined');assert.equal(declined.signers[0].decline_reason,'Please confirm the authorized amount');await sign(h,t2,r.id,v2,409);
  const oldAttempt=declined.attempt;r=await h.json(`/signatures/${r.id}/send`,{revision:declined.revision},f.prep);assert.equal(r.attempt,oldAttempt+1);assert.equal(r.source_sha256,sha(f.bytes));
  await h.json(`/portal/${t1}/signatures/${r.id}`,undefined,'',404);t1=token(r.invitations[0]);t2=token(r.invitations[1]);
  const ruleBody={name:'synthetic-blotter-14',clientIds:[f.client.id],trigger:{kind:'signature_complete'},action:{kind:'request',label:'Inspect completed signature certificate'},budget:2};
  const p=await h.json('/automation/preview',ruleBody,h.owner);const rule=await h.json('/automation',{...ruleBody,fingerprint:p.fingerprint},h.owner);await h.json(`/automation/${rule.id}/activate`,{},h.owner);
  const hour=new Date().getUTCHours(),clock=h=>String((h+24)%24).padStart(2,'0')+':00';
  await h.json('/notifications/settings',{...noticeSettings,quietStart:clock(hour-1),quietEnd:clock(hour+1)},f.prep);
  const before=h.mails.length,a=await open(h,t1,r.id);await sign(h,t1,r.id,a);await sign(h,t1,r.id,a,409);
  let notices=(await h.json('/notifications',undefined,f.prep)).filter(n=>n.kind==='signature');assert.equal(notices.length,2);assert.equal(notices.filter(n=>n.delivery.startsWith('deferred:')).length,1);assert.equal(notices.filter(n=>n.delivery.startsWith('not enabled')).length,1);assert.equal(h.mails.length,before);
  const b=await open(h,t2,r.id);assert.equal(b.canSign,true);await sign(h,t2,r.id,b);await sign(h,t2,r.id,b,409);
  const done=await h.json(`/signatures/${r.id}`,undefined,f.prep);assert.equal(done.status,'completed');assert.ok(done.hasSigned&&done.hasCertificate);assert.deepEqual(done.signers.map(s=>s.status),['signed','signed']);assert.ok(done.signers.every(s=>s.consent_text&&s.consent_version&&!Object.hasOwn(s,'ip')&&s.portal_link_id));
  const signedBytes=Buffer.from(await(await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,f.prep)).arrayBuffer()),certBytes=Buffer.from(await(await h.request(`/api/blotter/signatures/${r.id}/files/certificate`,undefined,f.prep)).arrayBuffer());
  assert.equal((await PDFDocument.load(signedBytes)).getPageCount(),1);assert.equal(sha(signedBytes),done.signed_sha256);assert.equal(sha(certBytes),done.certificate_sha256);assert.notDeepEqual(signedBytes,f.bytes);for(const value of [...f.client.contacts.slice(0,2).map(c=>c.name),'SB','2026-10-22','Reviewed'])assert.ok(pdfText(signedBytes).includes(value));
  const certificate=pdfText(certBytes);assert.ok(certificate.includes(done.signed_sha256)&&!certificate.includes('192.0.2.1')&&certificate.includes('identity not verified'));
  assert.equal((await h.json(`/clients/${f.client.id}/signatures`,undefined,f.prep)).filter(x=>x.id===r.id).length,1);
  assert.ok((await h.json(`/clients/${f.client.id}/history`,undefined,f.prep)).history.some(e=>e.action==='signature.completed'&&e.object_id===f.job.id));assert.ok(done.events.some(e=>e.action==='declined')&&done.events.some(e=>e.action==='resent'));
  assert.equal((await h.request(`/api/blotter/portal/${t1}/signatures/${r.id}/files/certificate`)).status,200);
  await h.json(`/signatures/${r.id}`,undefined,f.outside,404);assert.equal((await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,f.outside)).status,404);
  await h.json('/automation/run',{},h.owner);await h.json('/automation/run',{},h.owner);assert.equal((await h.json(`/jobs/${f.job.id}`,undefined,f.prep)).requests.filter(q=>q.label==='Inspect completed signature certificate').length,1);assert.equal((await h.json('/automation',undefined,h.owner)).attempts.filter(a=>a.rule_id===rule.id).length,1);
  await h.json('/notifications/settings',noticeSettings,f.prep);notices=(await h.json('/notifications',undefined,f.prep)).filter(n=>n.kind==='signature');assert.equal(notices.length,4);assert.equal(notices.filter(n=>n.delivery.startsWith('accepted by')).length,3);const after=h.mails.length;await h.json('/notifications',undefined,f.prep);assert.equal(h.mails.length,after);
  const parallel=await sent(h,f,{mode:'parallel',title:'synthetic-blotter-15'});const second=token(parallel.invitations[1]);assert.equal((await open(h,second,parallel.id)).canSign,true);await sign(h,second,parallel.id,await open(h,second,parallel.id));const first=token(parallel.invitations[0]);await sign(h,first,parallel.id,await open(h,first,parallel.id));
  const voided=await sent(h,f,{title:'synthetic-blotter-16'}),vt=token(voided.invitations[0]),vv=await open(h,vt,voided.id);await h.json(`/signatures/${voided.id}/void`,{revision:voided.revision,reason:'Document replaced'},f.prep);await sign(h,vt,voided.id,vv,409);
  if(process.env.BLOTTER_SIGNATURE_EVIDENCE)await signatureAppJourney(h,f);
  const pending=await sent(h,f,{title:'2026 management confirmation'}),transfer={email:prepEmail,workSuccessor:successorEmail,reviewSuccessor:'owner@example.test'};
  await signatureOwnerJourney(h,f,pending,transfer);
  const preview=await h.json('/team/offboard/preview',transfer,h.owner);
  assert.ok(preview.signatures.some(s=>s.id===pending.id));assert.ok(!preview.signatures.some(s=>s.id===done.id));await h.json('/team/offboard',{...transfer,fingerprint:preview.fingerprint},h.owner);
  assert.equal((await h.json(`/signatures/${pending.id}`,undefined,f.successor)).requester_email,successorEmail);const old=await h.json(`/signatures/${done.id}`,undefined,h.owner);assert.equal(old.requester_email,prepEmail);assert.equal(old.original_requester,prepEmail);assert.equal((await h.json('/team/offboard/preview',transfer,h.owner)).signatures.length,0);await h.json(`/signatures/${pending.id}`,undefined,f.prep,401);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();copy=await harness();await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},copy.owner);const restored=await copy.json(`/signatures/${pending.id}`,undefined,copy.owner);assert.equal(restored.status,'held');assert.equal((await copy.request(`/api/blotter/portal/${token(pending.invitations[0])}/signatures/${pending.id}`)).status,404);assert.equal(sha(Buffer.from(await(await copy.request(`/api/blotter/signatures/${done.id}/files/signed`,undefined,copy.owner)).arrayBuffer())),done.signed_sha256);
 }finally{await copy?.close();await h.close();}
});

test('SIGN-002 / ERASURE-002: record/class/job holds, clocks, pending refusal, preview counts, retained signatures, named outside copies, approved expiry receipt and stale restore fence',async()=>{
 const h=await harness();let copy;try{
  const f=await fixture(h),r=await sent(h,f,{title:f.client.name+' management representation'}),done=await complete(h,r),pending=await sent(h,f,{title:'synthetic-blotter-18'});
  let preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);assert.ok(preview.blockers.some(b=>/Pending signature/.test(b)));
  await h.json(`/signatures/${pending.id}/void`,{revision:pending.revision,reason:'No longer required'},f.prep);
  await finishJob(h,f);
  const hold=await h.json(`/clients/${f.client.id}/retention`,{scope:'signature',targetId:r.id,kind:'hold',reason:'Signed document in dispute',owner:'owner@example.test',reviewDate:'2999-01-01'},h.owner);
  const retention=await h.json(`/clients/${f.client.id}/retention`,undefined,h.owner),record=retention.records.find(x=>x.kind==='signature'&&x.id===r.id);assert.ok(record);assert.equal(record.class??record.cls,'signed_documents');assert.ok(record.expiry>record.clock);
  await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Too soon'},h.owner,409);
  // Historical fixture setup only: the clock starts eight years earlier. All
  // policy decisions and erasure assertions use the same public HTTP doors.
  const past=new Date();past.setUTCFullYear(past.getUTCFullYear()-8);const triggers=(await h.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name='b_jobs_signed_off'").all()).results;
  for(const t of triggers)await h.db.prepare(`DROP TRIGGER ${t.name}`).run();await h.db.prepare('UPDATE b_jobs SET signed_off_at=? WHERE id=?').bind(past.toISOString(),f.job.id).run();await h.db.prepare('UPDATE b_signatures SET completed_at=? WHERE id=?').bind(past.toISOString(),r.id).run();for(const t of triggers)await h.db.prepare(t.sql).run();
  const ready=await h.json('/retention/ready',undefined,h.owner);assert.ok(ready.held.some(x=>x.kind==='signature'&&x.id===r.id));await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Still held'},h.owner,409);
  await h.json(`/retention/${hold.id}/release`,{reason:'Dispute settled'},h.owner);
  const jobHold=await h.json(`/clients/${f.client.id}/retention`,{scope:'job',targetId:f.job.id,kind:'hold',reason:'Review the filed work',owner:'owner@example.test',reviewDate:'2999-01-01'},h.owner);
  assert.ok((await h.json('/retention/ready',undefined,h.owner)).held.some(x=>x.kind==='signature'&&x.id===r.id));
  await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Work still held'},h.owner,409);
  await h.json(`/retention/${jobHold.id}/release`,{reason:'Work review complete'},h.owner);
  const classHold=await h.json(`/clients/${f.client.id}/retention`,{scope:'class',class:'signed_documents',kind:'hold',reason:'Class review',owner:'owner@example.test',reviewDate:'2999-01-01'},h.owner);
  const client=await h.json(`/clients/${f.client.id}/detail`,undefined,h.owner);await h.json(`/clients/${f.client.id}/lifecycle`,{lifecycle:'archived',revision:client.revision},h.owner);
  preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);assert.ok(preview.classes.find(c=>c.class==='signed_documents').held>0);assert.ok(preview.classes.find(c=>c.class==='signed_documents').retained>=1);assert.ok(preview.externalCopies.some(c=>c.source==='signature-invitations'));assert.deepEqual(preview.blockers,[]);
  await h.json(`/retention/${classHold.id}/release`,{reason:'Review complete'},h.owner);preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);assert.ok(preview.erase.some(s=>s.table==='b_signatures'&&s.count>0));
  const stale=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);
  const receipt=await h.json(`/clients/${f.client.id}/erasure`,{planHash:preview.planHash,confirm:f.client.name,reason:'Client requested erasure'},h.owner);assert.ok(receipt.steps.some(s=>s.table==='b_signatures'&&s.count>0));assert.ok(receipt.retained.records.some(x=>x.kind==='signature'));assert.ok(receipt.retained.externalCopies.some(x=>x.source==='signature-invitations'));
  assert.equal((await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,h.owner)).status,200);
  for(const path of [`/jobs/${f.job.id}/signatures`,`/clients/${f.client.id}/signatures`,'/retention/ready'])assert.ok(!JSON.stringify(await h.json(path,undefined,h.owner)).includes(f.client.name),'Normal lists and expiry queues hide retained signed identity');
  await h.json(`/signatures/${r.id}`,undefined,f.prep,403);assert.equal((await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,f.prep)).status,403);
  assert.equal((await h.json(`/signatures/${r.id}`,undefined,h.owner)).title,f.client.name+' management representation');
  assert.ok((await h.json(`/clients/${f.client.id}/history`,undefined,h.owner)).history.some(e=>e.action==='signature.retained_read'),'Principal retained-document reads are attributed');assert.equal((await h.request(`/api/blotter/signatures/${pending.id}/files/original`,undefined,h.owner)).status,404);
  await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Retention period ended'},f.prep,403);
  const expiry=await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Retention period ended'},h.owner);assert.ok(expiry.effects.some(e=>e.table==='b_signatures'&&e.count>0));const erased=await h.json(`/signatures/${r.id}`,undefined,h.owner);assert.equal(erased.signed_sha256,done.signed_sha256);assert.equal(erased.hasSigned,false);assert.equal(erased.hasCertificate,false);assert.equal((await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,h.owner)).status,404);assert.ok(!(await h.json('/retention/ready',undefined,h.owner)).ready.some(x=>x.kind==='signature'&&x.id===r.id));
  const latest=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();copy=await harness();await copy.json('/restore',{archive:stale,journal:latest,confirm:'RESTORE'},copy.owner,409);const journal=await h.json('/erasure-journal',undefined,h.owner);assert.ok(journal.epoch>0&&journal.receipts.some(x=>x.id===receipt.id));
 }finally{await copy?.close();await h.close();}
});
