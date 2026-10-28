import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {harness} from './harness.mjs';
import {pdfText} from './pdf-text.mjs';
import {authorizationJourney,authorizationLifecycleJourney,signatureAppJourney,signatureAuthorityJourney,signatureOwnerJourney} from './signatures-ui.mjs';
const prepEmail='synthetic-blotter-1@example.test',successorEmail='synthetic-blotter-2@example.test',outsideEmail='synthetic-blotter-3@example.test';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const noticeSettings={timeZone:'UTC',quietStart:'00:00',quietEnd:'00:00',digestTime:'07:00',digestEnabled:false,leadDays:1,emailKinds:['signature']};
const contact=n=>({name:({5:'Mia Chen',6:'Jonah Chen',7:'Avery Lane'})[n],firstName:({5:'Mia',6:'Jonah',7:'Avery'})[n],email:`synthetic-blotter-${n}@example.test`,roles:['primary'],authorized:true,signer:true,portal:true,requestConsent:true,emailConsent:true,consentNote:'Explicit synthetic entity and signer authority'});
async function fixture(h,clientValues={}){
  const sessions={};for(const [email,name] of [[prepEmail,'Pat Harper'],[successorEmail,'Cameron Morgan'],[outsideEmail,'Casey Drew']]){await h.json('/team',{email,name,role:'preparer'},h.owner);await h.json('/team/invite',{email},h.owner);sessions[email]=await h.login(email);}
  const client=await h.json('/clients',{name:'Cedar Lane Manufacturing LLC',...clientValues,contacts:[contact(5),contact(6),contact(7)]},h.owner);
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
const browser={'user-agent':'synthetic-blotter-browser/1'};
const sign=(h,t,id,v,expected=200,extra={},headers=browser)=>h.json(`/portal/${t}/signatures/${id}/sign`,{...signBody(v),...extra},'',expected,headers);
async function sent(h,f,extra={}){const d=await draft(h,f,extra);return h.json(`/signatures/${d.id}/send`,{revision:d.revision},f.prep);}
async function complete(h,r){for(const i of r.invitations){const t=token(i),v=await open(h,t,r.id);await sign(h,t,r.id,v);}return h.json(`/signatures/${r.id}`,undefined,h.owner);}
async function finishJob(h,f){let d=await h.json(`/jobs/${f.job.id}`,undefined,f.prep);for(const r of d.requests){await h.json(`/requests/${r.id}/files`,{name:'synthetic-blotter-11.txt',mime:'text/plain',contentBase64:Buffer.from('Evidence').toString('base64')},f.prep);await h.json(`/requests/${r.id}/decide`,{decision:'accept'},f.prep);}for(const s of d.steps)await h.json(`/jobs/${f.job.id}/steps`,{ordinal:s.ordinal,done:true},f.prep);d=await h.json(`/jobs/${f.job.id}/submit`,{revision:(await h.json(`/jobs/${f.job.id}`,undefined,f.prep)).job.revision},f.prep);await h.json(`/jobs/${f.job.id}/review`,{revision:d.job.revision,decision:'signoff',note:'Inspected the evidence'},h.owner);}

test('SIGN-002 / BASE-001 / NOTIFY-001 / NOTIFY-002 / NOTIFY-003: real PDF fields, consent, authorized sequential and parallel signers, decline/resend, void, filed certificate/timeline, notification preferences and atomic offboarding',async()=>{
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
  const done=await h.json(`/signatures/${r.id}`,undefined,f.prep);assert.equal(done.status,'completed');assert.ok(done.hasSigned&&done.hasCertificate);assert.deepEqual(done.signers.map(s=>s.status),['signed','signed']);assert.ok(done.signers.every(s=>s.consent_text&&s.consent_version&&s.connection_ip==='192.0.2.1'&&s.connection_user_agent==='synthetic-blotter-browser/1'&&s.portal_link_id));
  const signedBytes=Buffer.from(await(await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,f.prep)).arrayBuffer()),certBytes=Buffer.from(await(await h.request(`/api/blotter/signatures/${r.id}/files/certificate`,undefined,f.prep)).arrayBuffer());
  assert.equal((await PDFDocument.load(signedBytes)).getPageCount(),1);assert.equal(sha(signedBytes),done.signed_sha256);assert.equal(sha(certBytes),done.certificate_sha256);assert.notDeepEqual(signedBytes,f.bytes);for(const value of [...f.client.contacts.slice(0,2).map(c=>c.name),'SB','2026-10-22','Reviewed'])assert.ok((await pdfText(signedBytes)).includes(value));
  const certificate=await pdfText(certBytes);for(const value of [done.signed_sha256,'192.0.2.1','synthetic-blotter-browser/1','identity not verified'])assert.ok(certificate.includes(value),`Certificate contains ${value}`);
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
  const retainedHistory=await h.json(`/clients/${f.client.id}/history`,undefined,h.owner);
  assert.ok(retainedHistory.history.some(e=>e.action==='signature.retained_read'),'Principal retained-document reads are attributed');
  assert.ok(!JSON.stringify(retainedHistory.history).includes(f.client.name),'Normal client history excludes retained signed identity');assert.equal((await h.request(`/api/blotter/signatures/${pending.id}/files/original`,undefined,h.owner)).status,404);
  assert.ok((await h.json(`/signatures/${r.id}`,undefined,h.owner)).signers.every(s=>s.connection_ip&&s.connection_user_agent),'Connection evidence is retained with the signed record');
  await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Retention period ended'},f.prep,403);
  const expiry=await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Retention period ended'},h.owner);assert.ok(expiry.effects.some(e=>e.table==='b_signatures'&&e.count>0));const erased=await h.json(`/signatures/${r.id}`,undefined,h.owner);assert.equal(erased.signed_sha256,done.signed_sha256);assert.ok(erased.signers.every(s=>s.connection_ip===null&&s.connection_user_agent===null),'Expiry erases connection evidence with the signed record');assert.equal(erased.hasSigned,false);assert.equal(erased.hasCertificate,false);assert.equal((await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,h.owner)).status,404);assert.ok(!(await h.json('/retention/ready',undefined,h.owner)).ready.some(x=>x.kind==='signature'&&x.id===r.id));
  const latest=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();copy=await harness();await copy.json('/restore',{archive:stale,journal:latest,confirm:'RESTORE'},copy.owner,409);const journal=await h.json('/erasure-journal',undefined,h.owner);assert.ok(journal.epoch>0&&journal.receipts.some(x=>x.id===receipt.id));
 }finally{await copy?.close();await h.close();}
});

test('SIGN-002: Form 2848 needs a staff remote-authentication attestation, the representative signs in their own session, connection evidence is certified, and IRS e-file forms are refused by their PDF text',async()=>{
 const h=await harness();try{
  const f=await fixture(h),rep='staff:'+prepEmail;
  const pdfWith=async lines=>{const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([612,792]);lines.forEach((line,i)=>page.drawText(line,{x:40,y:740-i*20,font,size:12}));return Buffer.from(await pdf.save()).toString('base64');};
  // An e-file authorization named only inside the PDF is refused for SIGN-001, whatever its title and file name.
  const plain=(contentBase64,extra={})=>({title:'Engagement',formKind:'general',requiresKba:false,mode:'sequential',contactIds:[f.client.contacts[0].id],fields:fields(f).slice(0,4),file:{name:'engagement.pdf',mime:'application/pdf',contentBase64},...extra});
  for(const form of ['Form 8879 IRS e-file Signature Authorization','Form 8879-S IRS e-file Signature Authorization for Form 1120-S','Form 8878 IRS e-file Signature Authorization for Form 4868'])
   assert.match((await h.json(`/jobs/${f.job.id}/signatures`,plain(await pdfWith([form])),f.prep,409)).error,/SIGN-001/);
  // A Form 2848 named only in its text: the client signs after a staff attestation, then the representative in session.
  const repFields=[{type:'signature',contactId:rep,page:1,x:40,y:400,width:240,height:28,label:'Representative signature'},{type:'date',contactId:rep,page:1,x:320,y:400,width:240,height:28,label:'Representative date'}];
  const poa={...plain(await pdfWith(['Form 2848 Power of Attorney and Declaration of Representative','Taxpayer: Mia Chen'])),title:'Power of attorney',contactIds:[f.client.contacts[0].id,rep],fields:[...fields(f).slice(0,4),...repFields]};
  const d=await h.json(`/jobs/${f.job.id}/signatures`,poa,f.prep);assert.equal(d.attestation_required,1);
  const r=await h.json(`/signatures/${d.id}/send`,{revision:d.revision},f.prep);assert.equal(r.invitations.length,1,'The staff representative gets no portal invitation');
  const t=token(r.invitations[0]);let v=await open(h,t,r.id);assert.equal(v.attestationRequired,true);assert.equal(v.canSign,false);
  assert.match((await sign(h,t,r.id,v,409)).error,/remote-authentication attestation/);
  const attest={contactId:f.client.contacts[0].id,method:'photo_id_video',verifier:'Pat Harper',verifiedOn:'2026-10-21',items:['name','ssn_or_itin','address','date_of_birth'],secondaryDocument:'Utility bill matching name and address'};
  await h.json(`/signatures/${r.id}/attestations`,{...attest,items:['name']},f.prep,400);
  await h.json(`/signatures/${r.id}/attestations`,attest,f.outside,404);
  await h.json(`/signatures/${r.id}/attestations`,attest,f.prep);await h.json(`/signatures/${r.id}/attestations`,attest,f.prep,409);
  let mine=await h.json(`/signatures/${r.id}/signing`,undefined,f.prep);assert.equal(mine.canSign,false,'Sequential: the client signs first');
  await h.json(`/signatures/${r.id}/staff-sign`,signBody(mine),f.prep,409);
  v=await open(h,t,r.id);assert.equal(v.canSign,true);await sign(h,t,r.id,v,200,{},{'user-agent':'synthetic-blotter-browser/2','CF-Connecting-IP':'198.51.100.7'});
  await h.json(`/signatures/${r.id}/signing`,undefined,f.outside,404);await h.json(`/signatures/${r.id}/staff-sign`,signBody(mine),f.outside,404);
  assert.deepEqual((await h.json('/signatures/awaiting',undefined,f.prep)).map(x=>[x.id,x.canSign]),[[r.id,true]]);
  mine=await h.json(`/signatures/${r.id}/signing`,undefined,f.prep);
  await h.json(`/signatures/${r.id}/staff-sign`,{...signBody(mine),consent:false},f.prep,400);
  await h.json(`/signatures/${r.id}/staff-sign`,signBody(mine),f.prep,200,{'user-agent':'synthetic-blotter-staff/3'});
  const done=await h.json(`/signatures/${r.id}`,undefined,f.prep);assert.equal(done.status,'completed');
  assert.deepEqual(done.signers.map(s=>[s.signer_kind,s.connection_ip,s.connection_user_agent]),[['contact','198.51.100.7','synthetic-blotter-browser/2'],['staff','192.0.2.1','synthetic-blotter-staff/3']]);
  const certificate=await pdfText(Buffer.from(await(await h.request(`/api/blotter/signatures/${r.id}/files/certificate`,undefined,f.prep)).arrayBuffer()));
  for(const value of ['IRS.gov/Submit2848','198.51.100.7','synthetic-blotter-browser/2','synthetic-blotter-staff/3','photo id video','Pat Harper','Utility bill matching name and address','identity not verified'])assert.ok(certificate.includes(value),value);
  // Non-signer and void denials still hold for these forms.
  const nonSigner=await h.json(`/jobs/${f.job.id}/reminders`,{contactId:f.client.contacts[2].id},h.owner);await h.json(`/portal/${token(nonSigner)}/signatures/${r.id}`,undefined,'',404);
  const second=await h.json(`/jobs/${f.job.id}/signatures`,{...poa,title:'Replacement power of attorney'},f.prep),out=await h.json(`/signatures/${second.id}/send`,{revision:second.revision},f.prep);
  await h.json(`/signatures/${second.id}/attestations`,attest,f.prep);const t2=token(out.invitations[0]),v2=await open(h,t2,second.id);
  await h.json(`/signatures/${second.id}/void`,{revision:(await h.json(`/signatures/${second.id}`,undefined,f.prep)).revision,reason:'Superseded'},f.prep);
  await sign(h,t2,second.id,v2,409);await h.json(`/signatures/${second.id}/staff-sign`,signBody(await h.json(`/signatures/${second.id}/signing`,undefined,f.prep)),f.prep,409);
  await signatureAuthorityJourney(h,f,poa);
 }finally{await h.close();}
});

test('AUTHZ-001 / SIGN-002 / DUE-002: prepare official IRS forms, sign and attest a 2848, record online submission and CAF status, scope transcripts and agency contact, alert once and withdraw',async()=>{
 const h=await harness();try{
  const f=await fixture(h,{name:'Mia Chen',entityType:'individual'}),client=f.client.contacts.find(c=>c.name==='Mia Chen');
  const body={kind:'2848',representative:'Pat Harper',representativeEmail:prepEmail,matters:[{form:'Form 1040',from:2022,to:2025}]};
  await h.json(`/clients/${f.client.id}/authorizations`,body,f.prep,403);
  let a=await h.json(`/clients/${f.client.id}/authorizations`,body,h.owner);assert.deepEqual(a.matters,[{form:'1040',from:2022,to:2025,matter:'Income'}]);
  const agent=await h.json('/keys',{label:'synthetic-blotter-32'},h.owner);
  const doors=[[`/clients/${f.client.id}/authorizations`,undefined],[`/clients/${f.client.id}/authorizations`,{}],[`/clients/${f.client.id}/transcript-requests`,{}],...['prepare','signature','submission','status','withdraw'].map(action=>[`/authorizations/${a.id}/${action}`,{}])];
  for(const [path,payload] of doors){await h.json(path,payload,'',401);await h.json(path,payload,'',401,{authorization:'Bearer '+agent.key});if(payload)await h.json(path,payload,h.owner,403,{origin:'https://outside.example.test'});}

  const input={revision:a.revision,jobId:f.job.id,contactId:client.id,taxpayerName:f.client.name,taxpayerAddress:'123 Cedar Lane\nDenver CO 80202',tinType:'ssn',taxpayerTin:'111-22-3333',taxpayerTitle:'',representativeAddress:'456 Review Avenue\nDenver CO 80203',representativePhone:'303-555-0142',designation:'b',jurisdiction:'Colorado',licenseNumber:'synthetic-blotter-31',reviewed:true};
  await h.json(`/authorizations/${a.id}/prepare`,input,f.prep,403);
  await h.json(`/authorizations/${a.id}/prepare`,{...input,reviewed:false},h.owner,400);
  const before=h.mails.length,d=await h.json(`/authorizations/${a.id}/prepare`,input,h.owner);
  assert.equal(d.status,'draft');assert.equal(h.mails.length,before,'Preparation sends no invitations');assert.equal(d.attestation_required,1);
  const original=Buffer.from(await(await h.request(`/api/blotter/signatures/${d.id}/files/original`,undefined,h.owner)).arrayBuffer()),prepared=await PDFDocument.load(original);
  assert.equal(prepared.getPageCount(),2);assert.equal(prepared.getForm().getFields().length,0);
  for(const value of [f.client.name,'123 Cedar Lane','111-22-3333','Pat Harper','1040','2022-2025','Colorado'])assert.ok((await pdfText(original)).includes(value),value);
  if(process.env.BLOTTER_SIGNATURE_EVIDENCE){const {mkdir,writeFile}=await import('node:fs/promises');await mkdir(process.env.BLOTTER_SIGNATURE_EVIDENCE,{recursive:true});await writeFile(process.env.BLOTTER_SIGNATURE_EVIDENCE+'/prepared-2848.pdf',original);}
  await h.json(`/authorizations/${a.id}/prepare`,input,f.outside,403);
  await h.json(`/clients/${f.client.id}/authorizations`,undefined,f.outside,404);
  await h.json(`/clients/${f.client.id}/transcript-requests`,{form:'1040',year:2024},f.outside,404);
  const r=await h.json(`/signatures/${d.id}/send`,{revision:d.revision},h.owner),t=token(r.invitations[0]);
  await sign(h,t,r.id,await open(h,t,r.id),409);
  await h.json(`/signatures/${r.id}/attestations`,{contactId:client.id,method:'personal_knowledge',verifier:'Pat Harper',verifiedOn:'2026-10-20',items:[],note:'Long-standing client met in person each year'},f.prep);
  await sign(h,t,r.id,await open(h,t,r.id));await h.json(`/signatures/${r.id}/staff-sign`,signBody(await h.json(`/signatures/${r.id}/signing`,undefined,f.prep)),f.prep);
  const signedForm=Buffer.from(await(await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,h.owner)).arrayBuffer());
  for(const signer of [client.name,'Pat Harper'])assert.ok((await pdfText(signedForm)).includes(signer));
  if(process.env.BLOTTER_SIGNATURE_EVIDENCE){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.BLOTTER_SIGNATURE_EVIDENCE+'/signed-2848.pdf',signedForm);}
  const general=await sent(h,f,{title:'synthetic-blotter-20'});await complete(h,general);
  await h.json(`/authorizations/${a.id}/submission`,{revision:a.revision,method:'irs_online',submittedOn:'2026-10-22'},h.owner,409);
  await h.json(`/authorizations/${a.id}/signature`,{revision:a.revision,signatureId:general.id},h.owner,409);
  a=await h.json(`/authorizations/${a.id}/signature`,{revision:a.revision,signatureId:r.id},h.owner);assert.equal(a.signature_id,r.id);
  await authorizationLifecycleJourney(h,f,'Record submission');
  assert.match((await h.json(`/authorizations/${a.id}/submission`,{revision:a.revision,method:'fax',submittedOn:'2026-10-22'},h.owner,409)).error,/IRS\.gov\/Submit2848/);
  a=await h.json(`/authorizations/${a.id}/submission`,{revision:a.revision,method:'irs_online',submittedOn:'2026-10-22'},h.owner);
  await h.json(`/clients/${f.client.id}/transcript-requests`,{form:'1040',year:2024},f.prep,409);
  await authorizationLifecycleJourney(h,f,'Record agency answer');
  a=await h.json(`/authorizations/${a.id}/status`,{revision:a.revision,status:'recorded',cafNumber:'0300-12345R'},h.owner);assert.deepEqual([a.status,a.caf_number],['recorded','0300-12345R']);
  // Scope: a 2021 transcript is refused, a 2024 transcript proceeds.
  assert.match((await h.json(`/clients/${f.client.id}/transcript-requests`,{form:'1040',year:2021},f.prep,409)).error,/outside the authorization's scope/);
  const transcript=await h.json(`/clients/${f.client.id}/transcript-requests`,{form:'1040',year:2024,transcriptType:'Account transcript'},f.prep);assert.equal(transcript.status,'requested');
  // Agency contact on notices follows the same scope.
  const file=(await h.json(`/requests/${(await h.json(`/jobs/${f.job.id}`,undefined,f.prep)).requests[0].id}/files`,{name:'cp2000.pdf',mime:'application/pdf',contentBase64:Buffer.from('%PDF synthetic-blotter-21').toString('base64')},f.prep));
  const fileId=file.id??(await h.json(`/jobs/${f.job.id}`,undefined,f.prep)).requests[0].files.at(-1).id;
  const notice=period=>h.json('/notices',{fileId,agency:'IRS',jurisdiction:'federal',noticeType:'CP2000',taxPeriod:period,noticeDate:'2026-10-01',responseDue:'2026-10-30',assigneeEmail:prepEmail},h.owner);
  const covered=(await notice('2023')).notice.id,outside=(await notice('2021')).notice.id,overlapping=(await notice('2024-2026')).notice.id;
  await h.json(`/notices/${overlapping}/events`,{kind:'agency_contact',taxForm:'1040',note:'Uncovered last year in a range'},f.prep,409);
  await h.json(`/notices/${covered}/events`,{kind:'agency_contact',taxForm:'1040',note:'Called the practitioner priority line about the 2023 CP2000'},f.prep);
  assert.match((await h.json(`/notices/${outside}/events`,{kind:'agency_contact',taxForm:'1040',note:'Call about 2021'},f.prep,409)).error,/outside the authorization's scope/);
  await h.json(`/notices/${covered}/events`,{kind:'agency_contact',taxForm:'1120',note:'Uncovered form'},f.prep,409);
  // Continuing work: one alert from October 1 of the last covered year, to the staff representative.
  await h.scheduled('2025-09-30T15:00:00Z');assert.ok(!(await h.json('/notifications',undefined,f.prep)).some(n=>n.kind==='authorization_expiring'));
  await h.scheduled('2025-10-02T15:00:00Z');await h.scheduled('2025-10-02T16:00:00Z');
  const alerts=(await h.json('/notifications',undefined,f.prep)).filter(n=>n.kind==='authorization_expiring');
  assert.equal(alerts.length,1);assert.match(alerts[0].summary,/Form 2848 for Mia Chen covers through 2025/);
  await authorizationLifecycleJourney(h,f,'Withdraw authorization');
  // Withdrawal flags the dependent notice work and refuses new transcript requests.
  const withdrawn=await h.json(`/authorizations/${a.id}/withdraw`,{revision:a.revision,reason:'Client revoked the power of attorney'},h.owner);
  assert.deepEqual(new Set(withdrawn.flaggedNotices),new Set([covered,overlapping]));
  assert.ok((await h.json(`/notices/${covered}`,undefined,f.prep)).events.some(e=>e.kind==='note'&&/Authorization withdrawn/.test(e.note)));
  await h.json(`/clients/${f.client.id}/transcript-requests`,{form:'1040',year:2024},f.prep,409);
  await h.json(`/notices/${covered}/events`,{kind:'agency_contact',taxForm:'1040',note:'Follow-up call'},f.prep,409);
  const state=await h.json(`/clients/${f.client.id}/authorizations`,undefined,f.prep);
  assert.deepEqual([state.authorizations[0].status,state.transcripts[0].status],['withdrawn','withdrawn']);
  const history=(await h.json(`/clients/${f.client.id}/history`,undefined,h.owner)).history.map(e=>e.action);
  for(const action of ['authorization.created','authorization.signed','authorization.submitted','authorization.recorded','authorization.transcript_requested','authorization.withdrawn'])assert.ok(history.includes(action),action);
  // Form 8821 prepares the official one-page information authorization with no representative signature.
  const info=await h.json(`/clients/${f.client.id}/authorizations`,{...body,kind:'8821'},h.owner);
  await h.json(`/authorizations/${info.id}/signature`,{revision:info.revision,signatureId:r.id},h.owner,409);
  const infoDraft=await h.json(`/authorizations/${info.id}/prepare`,{...input,revision:info.revision},h.owner);
  const infoPdf=Buffer.from(await(await h.request(`/api/blotter/signatures/${infoDraft.id}/files/original`,undefined,h.owner)).arrayBuffer());
  assert.equal((await PDFDocument.load(infoPdf)).getPageCount(),1);assert.equal(infoDraft.signers.length,1);assert.ok(infoDraft.fields.every(f=>f.contactId===client.id));
  for(const value of [f.client.name,'111-22-3333','Pat Harper','1040','2022-2025'])assert.ok((await pdfText(infoPdf)).includes(value),value);
  if(process.env.BLOTTER_SIGNATURE_EVIDENCE){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.BLOTTER_SIGNATURE_EVIDENCE+'/prepared-8821.pdf',infoPdf);}
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  const copy=await harness();try{
   await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},copy.owner);
   const restored=await copy.json(`/clients/${f.client.id}/authorizations`,undefined,copy.owner);
   assert.equal(restored.authorizations.find(x=>x.id===a.id).status,'withdrawn');assert.equal(restored.transcripts[0].status,'withdrawn');
   assert.equal((await copy.json(`/signatures/${d.id}`,undefined,copy.owner)).signed_sha256,(await h.json(`/signatures/${d.id}`,undefined,h.owner)).signed_sha256);
   await copy.json(`/clients/${f.client.id}/transcript-requests`,{form:'1040',year:2024},copy.owner,409);
   await copy.json('/team/invite',{email:prepEmail},copy.owner);
   const staff=await copy.login(prepEmail);
   await copy.json('/access/people',{email:prepEmail,readOnly:false,clientIds:[f.client.id]},copy.owner);
   assert.equal((await copy.json(`/clients/${f.client.id}/authorizations`,undefined,staff)).authorizations.length,2);
   await copy.json('/access/people',{email:prepEmail,readOnly:false,clientIds:[]},copy.owner);
   await copy.json(`/clients/${f.client.id}/authorizations`,undefined,staff,404);
   await copy.json(`/clients/${f.client.id}/transcript-requests`,{form:'1040',year:2024},staff,404);
   await copy.json(`/authorizations/${a.id}/withdraw`,{revision:a.revision,reason:'Denied after client grant revoked'},staff,404);

  }finally{await copy.close();}
  // State equivalents carry their agency, matters, signed copy, submission and answer too.
  let stateAuthorization=await h.json(`/clients/${f.client.id}/authorizations`,{kind:'state',agency:'Colorado Department of Revenue',representative:'Pat Harper',matters:[{form:'DR 0104',from:2022,to:2025,matter:'Individual income tax'}]},h.owner);
  assert.equal(stateAuthorization.agency,'Colorado Department of Revenue');
  const statePdf=await PDFDocument.create(),stateFont=await statePdf.embedFont(StandardFonts.Helvetica);statePdf.addPage([612,792]).drawText('State tax authorization: DR 0104, 2022-2025',{x:40,y:740,font:stateFont,size:12});
  const stateDraft=await h.json(`/jobs/${f.job.id}/signatures`,{title:'Colorado tax authorization',formKind:'state authorization',mode:'sequential',contactIds:[client.id],fields:[{type:'signature',contactId:client.id,page:1,x:40,y:300,width:240,height:28,label:'Taxpayer signature'}],file:{name:'state-authorization.pdf',mime:'application/pdf',contentBase64:Buffer.from(await statePdf.save()).toString('base64')}},h.owner);
  const stateSent=await h.json(`/signatures/${stateDraft.id}/send`,{revision:stateDraft.revision},h.owner),stateToken=token(stateSent.invitations[0]);
  await sign(h,stateToken,stateSent.id,await open(h,stateToken,stateSent.id));
  stateAuthorization=await h.json(`/authorizations/${stateAuthorization.id}/signature`,{revision:stateAuthorization.revision,signatureId:stateSent.id},h.owner);
  stateAuthorization=await h.json(`/authorizations/${stateAuthorization.id}/submission`,{revision:stateAuthorization.revision,method:'fax',submittedOn:'2026-10-22'},h.owner);
  stateAuthorization=await h.json(`/authorizations/${stateAuthorization.id}/status`,{revision:stateAuthorization.revision,status:'rejected',reason:'Agency requested its updated form'},h.owner);
  assert.equal(stateAuthorization.status,'rejected');assert.equal(stateAuthorization.status_reason,'Agency requested its updated form');assert.equal(stateAuthorization.submission_method,'fax');
  assert.ok(!(await h.json(`/clients/${f.client.id}/history`,undefined,h.owner)).history.some(e=>String(e.detail).includes('111-22-3333')),'The TIN stays out of audit detail');
  await authorizationJourney(h,f,info);
  // BASE-001 activation: the real client-erasure door redacts this record kind,
  // retains signed source evidence behind the principal door and fences old archives.
  for(const pending of await h.json(`/clients/${f.client.id}/signatures`,undefined,h.owner))if(['draft','pending','declined','held'].includes(pending.status))
   await h.json(`/signatures/${pending.id}/void`,{revision:pending.revision,reason:'Authorization was withdrawn'},h.owner);
  for(const noticeId of [covered,outside,overlapping])await h.json(`/notices/${noticeId}/close`,{outcome:'exception',note:'Authorization withdrawn; no agency response will be submitted'},h.owner);
  await finishJob(h,f);
  const detail=await h.json(`/clients/${f.client.id}/detail`,undefined,h.owner);
  await h.json(`/clients/${f.client.id}/lifecycle`,{lifecycle:'archived',revision:detail.revision},h.owner);
  const erasureCount=(await h.json(`/clients/${f.client.id}/authorizations`,undefined,h.owner)).authorizations.length;
  const preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);assert.deepEqual(preview.blockers,[]);
  assert.ok(preview.erase.some(step=>step.table==='b_authorizations'&&step.count===erasureCount));
  const receipt=await h.json(`/clients/${f.client.id}/erasure`,{planHash:preview.planHash,confirm:f.client.name,reason:'Client requested erasure after withdrawal'},h.owner);
  assert.ok(receipt.steps.some(step=>step.table==='b_authorizations'&&step.count===erasureCount));
  await h.json(`/clients/${f.client.id}/authorizations`,undefined,h.owner,404);
  const latest=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  const exportedRows=latest.trim().split('\n').map(JSON.parse).filter(part=>part.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row');
  const erasedAuthorization=exportedRows.find(item=>item.table==='b_authorizations'&&item.row.id===a.id).row;
  assert.equal(erasedAuthorization.representative,'[erased]');assert.equal(erasedAuthorization.caf_number,null);assert.equal(erasedAuthorization.representative_email,null);
  assert.equal((await h.request(`/api/blotter/signatures/${d.id}/files/signed`,undefined,h.owner)).status,200);
  assert.equal((await h.request(`/api/blotter/signatures/${d.id}/files/signed`,undefined,f.prep)).status,403);
  const stale=await harness();try{await stale.json('/restore',{archive,journal:latest,confirm:'RESTORE'},stale.owner,409);}finally{await stale.close();}


 }finally{await h.close();}
});
