import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {harness} from './harness.mjs';
import {pdfText} from './pdf-text.mjs';
import {stripeEdge} from './stripe-edge.mjs';
import {engagementJourney} from './engagement-proposals-ui.mjs';
const address=n=>'synthetic-blotter-'+n+String.fromCharCode(64)+'example.test';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const token=i=>new URL(i.portalUrl).pathname.split('/').at(-1);
const file=async(h,id,kind,cookie=h.owner)=>{const r=await h.request(`/api/blotter/signatures/${id}/files/${kind}`,undefined,cookie);assert.equal(r.status,200);return Buffer.from(await r.arrayBuffer());};
const open=(h,t,id)=>h.json(`/portal/${t}/signatures/${id}`);
const signBody=v=>({revision:v.revision,attempt:v.attempt,consent:true,intent:true,consentVersion:v.consentVersion,values:Object.fromEntries(v.fields.map(f=>[f.id,v.signerName]))});
const sign=(h,t,id,v,expected=200,extra={})=>h.json(`/portal/${t}/signatures/${id}/sign`,{...signBody(v),...extra},'',expected,{'user-agent':'synthetic-blotter-browser'});
async function fixture(h){
 const staff=address(1),foreign=address(2);for(const email of [staff,foreign]){await h.json('/team',{email,name:email===staff?'Pat Harper':'Cameron Morgan',role:'preparer'},h.owner);await h.json('/team/invite',{email},h.owner);}
 const prep=await h.login(staff),outside=await h.login(foreign);
 const contacts=['Mia Chen','Jonah Chen','Avery Lane'].map((name,i)=>({name,email:address(i+5),roles:['primary','billing'],authorized:true,signer:true,portal:true,requestConsent:true,emailConsent:true,consentNote:'Explicit synthetic entity signer authority'}));
 const client=await h.json('/clients',{name:'Cedar Lane Manufacturing',contacts},h.owner),template=await h.json('/templates',{name:'Annual scope',recurrence:'annual',steps:'Inspect evidence',requests:'Evidence'},h.owner);
 const state=await h.json('/state',undefined,h.owner),job=await h.json('/jobs',{clientId:client.id,templateId:template.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Client agreed date',preparerEmail:staff,reviewerEmail:state.actor.email},h.owner);
 const terms={title:'Annual services agreement',scope:'Prepare the corporate return and monthly bookkeeping reports.',exclusions:'No audit or legal advice.',currency:'USD',feeCents:125000,retainerTerms:'USD 25000 cents held as a deposit only after separate invoice approval.',renewalRules:'No automatic renewal. Both contacts review a new version.',amendmentRules:'An unfinished version is superseded only by explicit practitioner amendment.',contactIds:client.contacts.slice(0,2).map(c=>c.id)};
 return {client,template,job,prep,outside,staff,terms,principal:state.actor.email};
}
async function seedIndependentApprovals(h,f){
 await h.json('/firm/settings',{name:'Cedar Practice',ein:'123456789',entity:'LLC',address:'10 Main Street',city:'Boston',state:'MA',zip:'02108',fiscalYearEnd:'12-31',services:['Bookkeeping'],currency:'USD',timeZone:'UTC',notificationStart:'00:00',notificationEnd:'00:00',calendars:[]},h.owner);
 await h.json('/invoices/authority',{authority:'blotter',reason:'Principal selected invoice authority'},h.owner);
 const contactId=f.client.contacts[0].id,source=await h.json('/invoice-entitlements',{jobId:f.job.id,kind:'fixed',reference:'synthetic-blotter-existing-fee',description:'Previously approved separate fee',amountCents:10000,authorization:'Separate signed scope'},h.owner);
 const input={title:'Previously approved invoice',issueDate:'2026-10-01',jobId:f.job.id,sourceKeys:[source.sourceKey],contactId,dueDate:'2027-04-15',terms:'Separate billing approval',taxCents:0,taxTreatment:'No sales tax under supplied treatment',taxAuthorization:'Principal reviewed client instruction'};
 const preview=await h.json('/invoices/preview',input,h.owner),draft=await h.json('/invoices',{...input,previewHash:preview.previewHash},h.owner);
 await h.json(`/invoices/${draft.id}/issue`,{revision:draft.revision,snapshotHash:draft.snapshotHash,reviewNote:'Independent principal billing approval'},h.owner);
 const send=await h.json(`/invoices/${draft.id}/delivery-preview`,{contactId},h.owner),delivery=await h.json(`/invoices/${draft.id}/send`,{contactId,previewHash:send.previewHash},h.owner),bearer=new URL(delivery.portalUrl).pathname.split('/').at(-1);
 const payment=await h.json(`/invoice-portal/${bearer}/pay`,{amountCents:100,confirm:true,saveMethod:true,authorizeSaved:true,requestId:'synthetic-blotter-existing-payment'});
 await h.json(`/payments/${payment.paymentId}/reconcile`,{},h.owner);
 const state=await h.json(`/invoices/${draft.id}/payments`,undefined,h.owner);assert.ok(state.mandates.some(m=>m.status==='active'));
 const recorded=await h.json(`/clients/${f.client.id}/engagements`,{title:'Previously recorded signed scope',signers:['Mia Chen','Jonah Chen'],signedDate:'2026-01-02',file:{name:'synthetic-blotter-recorded-scope.txt',mime:'text/plain',contentBase64:Buffer.from(f.terms.scope).toString('base64')}},h.owner);
 assert.equal(recorded.label,'practitioner-recorded, not signed through Blotter');
 const map={source:{kind:'engagement',id:recorded.id},services:[{kind:'tax',quote:f.terms.scope,templateId:f.template.id,authorization:'8821'}]},setup=await h.json(`/clients/${f.client.id}/onboarding/preview`,map,h.owner);
 await h.json(`/clients/${f.client.id}/onboarding/plans`,{...map,fingerprint:setup.fingerprint,selectedItemIds:setup.items.map(i=>i.id),reason:'Prior explicit review; no execution'},h.owner);
}
async function enroll(h,cookie){
 const start=await h.json('/mfa/totp/start',{},cookie);let bits=0,value=0;const bytes=[];
 for(const char of start.secret){value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)-1));const mac=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=mac[19]&15;
 return h.json('/mfa/totp/confirm',{id:start.id,code:String((mac.readUInt32BE(offset)&0x7fffffff)%1e6).padStart(6,'0')},cookie);
}
const draft=(h,f,extra={})=>h.json(`/jobs/${f.job.id}/engagement-proposals`,{...f.terms,...extra},h.owner);
const send=(h,f,r)=>h.json(`/signatures/${r.id}/send`,{revision:r.revision},h.owner);
async function finishJob(h,f){const d=await h.json(`/jobs/${f.job.id}`,undefined,f.prep);for(const r of d.requests){await h.json(`/requests/${r.id}/files`,{name:'synthetic-blotter-11.txt',mime:'text/plain',contentBase64:Buffer.from('Evidence').toString('base64')},f.prep);await h.json(`/requests/${r.id}/decide`,{decision:'accept'},f.prep);}for(const s of d.steps)await h.json(`/jobs/${f.job.id}/steps`,{ordinal:s.ordinal,done:true},f.prep);const submitted=await h.json(`/jobs/${f.job.id}/submit`,{revision:(await h.json(`/jobs/${f.job.id}`,undefined,f.prep)).job.revision},f.prep);await h.json(`/jobs/${f.job.id}/review`,{revision:submitted.job.revision,decision:'signoff',note:'Inspected evidence'},h.owner);}

test('Ordinary proposals freeze terms, supersede partial signatures atomically, complete once and preserve native authority without billing or onboarding effects',async()=>{
 const edge=stripeEdge(),h=await harness({bindings:{STRIPE_SECRET_KEY:'synthetic-blotter-proposal-key',STRIPE_WEBHOOK_SECRET:'synthetic-blotter-proposal-events'},stripeResponse:edge.respond});let copy;try{
  const f=await fixture(h);await seedIndependentApprovals(h,f);const providerCalls=edge.calls.length,before=await h.json('/state',undefined,h.owner);
  const inert=async()=>{const snapshot={};for(const table of ['b_invoices','b_payment_mandates','b_onboarding_plans','b_marketing_consents','b_engagements'])snapshot[table]=(await h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;return snapshot;};
  const baseline=await inert();
  const agent=await h.json('/keys',{label:'synthetic-blotter-proposal-agent'},h.owner);
  await h.json(`/jobs/${f.job.id}/engagement-proposals`,f.terms,'',401,{authorization:'Bearer '+agent.key});
  await h.json(`/jobs/${f.job.id}/engagement-proposals`,f.terms,f.prep,403,{origin:'https://foreign.invalid'});
  await h.json('/access/people',{email:f.staff,readOnly:true,clientIds:[f.client.id]},h.owner);
  await h.json(`/jobs/${f.job.id}/engagement-proposals`,f.terms,f.prep,403);
  await h.json('/access/people',{email:f.staff,readOnly:false,clientIds:[]},h.owner);
  await h.json(`/jobs/${f.job.id}/engagement-proposals`,f.terms,f.prep,404);
  await h.json('/access/people',{email:f.staff,readOnly:false,clientIds:[f.client.id]},h.owner);
  await enroll(h,h.owner);await h.json('/team/mfa-policy',{required:true},h.owner);
  assert.equal((await h.json(`/jobs/${f.job.id}/engagement-proposals`,f.terms,f.prep,403)).mfa,'enroll');
  const factor=await enroll(h,f.prep);await h.json('/team/mfa-policy',{required:false},h.owner);
  const fresh=await h.login(f.staff);assert.equal((await h.json(`/jobs/${f.job.id}/engagement-proposals`,f.terms,fresh,403)).mfa,'verify');
  await h.json('/mfa/verify',{recoveryCode:factor.recoveryCodes[0]},fresh);f.prep=fresh;await h.json(`/jobs/${f.job.id}/engagement-proposals`,f.terms,f.prep,403);

  await h.json(`/jobs/${f.job.id}/engagement-proposals`,f.terms,f.outside,404);
  await h.json(`/jobs/${f.job.id}/engagement-proposals`,{...f.terms,currency:'AUD'},h.owner,400);
  await h.json(`/jobs/${f.job.id}/engagement-proposals`,{...f.terms,feeCents:1.2},h.owner,400);
  let first=await draft(h,f);await h.json(`/signatures/${first.id}/send`,{revision:first.revision},f.prep,403);await h.json(`/signatures/${first.id}/void`,{revision:first.revision,reason:'Staff has no proposal authority'},f.prep,403);const original=await file(h,first.id,'original',f.prep);
  assert.equal(sha(original),first.source_sha256);const words=await pdfText(original);for(const value of [f.terms.scope,f.terms.exclusions,'125000','Retainer terms','Renewal rules','Amendment rules'])assert.ok(words.includes(value));
  assert.deepEqual(first.proposal.terms,Object.fromEntries(Object.entries(f.terms).filter(([k])=>k!=='contactIds')));
  first=await send(h,f,first);const t1=token(first.invitations[0]),t2=token(first.invitations[1]),stale=await open(h,t2,first.id);
  const beforeSignatureMail=h.mails.length;
  await sign(h,t1,first.id,await open(h,t1,first.id));assert.equal(h.mails.length,beforeSignatureMail,'Signature notices default to in-app only');
  assert.equal((await h.json('/notifications',undefined,h.owner)).filter(n=>n.kind==='signature'&&n.delivery.startsWith('not enabled')).length,1);
  await h.json('/notifications/settings',{timeZone:'UTC',quietStart:'00:00',quietEnd:'00:00',digestTime:'07:00',digestEnabled:false,leadDays:1,emailKinds:['signature']},h.owner);
  const partial=await h.json(`/engagement-proposals/${first.id}`,undefined,f.prep);
  const amend={...f.terms,scope:'Prepare the corporate return only.',feeCents:95000,revision:partial.revision};
  const outcomes=await Promise.all([h.request(`/api/blotter/engagement-proposals/${first.id}/amend`,amend,h.owner),h.request(`/api/blotter/engagement-proposals/${first.id}/amend`,amend,h.owner)]);
  assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);let replacement=await outcomes.find(r=>r.status===200).json();
  const superseded=await h.json(`/engagement-proposals/${first.id}`,undefined,f.prep);assert.equal(superseded.status,'voided');assert.equal(superseded.proposal.superseded_by,replacement.id);assert.equal(superseded.signers[0].status,'signed');assert.equal(superseded.signers[1].status,'pending');assert.deepEqual(await file(h,first.id,'original',f.prep),original);
  await sign(h,t2,first.id,stale,409);await h.json(`/signatures/${first.id}/send`,{revision:superseded.revision},h.owner,409);
  assert.equal(replacement.proposal.version,2);assert.equal(replacement.proposal.predecessor_id,first.id);assert.equal(replacement.proposal.terms.scope,amend.scope);
  replacement=await send(h,f,replacement);assert.equal((await h.request(`/api/blotter/portal/${t1}/signatures/${first.id}`)).status,404);
  const a=token(replacement.invitations[0]),b=token(replacement.invitations[1]),foreign=token(await h.json(`/jobs/${f.job.id}/reminders`,{contactId:f.client.contacts[2].id},h.owner));
  await h.json(`/portal/${foreign}/signatures/${replacement.id}`,undefined,'',404);
  const v=await open(h,a,replacement.id);await sign(h,a,replacement.id,v,400,{consent:false});await sign(h,a,replacement.id,v);
  const last=await open(h,b,replacement.id),duplicates=await Promise.all([h.request(`/api/blotter/portal/${b}/signatures/${replacement.id}/sign`,signBody(last)),h.request(`/api/blotter/portal/${b}/signatures/${replacement.id}/sign`,signBody(last))]);assert.deepEqual(duplicates.map(r=>r.status).sort(),[200,409]);
  const done=await h.json(`/engagement-proposals/${replacement.id}`,undefined,f.prep);
  const notices=(await h.json('/notifications',undefined,h.owner)).filter(n=>n.kind==='signature');assert.equal(notices.filter(n=>n.delivery.startsWith('accepted by')).length,3);
  assert.equal(done.status,'completed');assert.equal(done.events.filter(e=>e.action==='completed').length,1);assert.ok(done.signers.every(s=>s.consent_text.includes('does not include marketing')&&s.signed_at&&s.contact_revision&&s.portal_link_id));
  const signed=await file(h,done.id,'signed',f.prep),certificate=await file(h,done.id,'certificate',f.prep);assert.equal(sha(signed),done.signed_sha256);assert.equal(sha(certificate),done.certificate_sha256);
  const certText=await pdfText(certificate);for(const value of ['version 2','authority revision',done.source_sha256,done.signed_sha256,'identity not verified',f.client.contacts[0].name,f.client.contacts[1].name])assert.ok(certText.includes(value),value);
  const downloaded=await h.request(`/api/blotter/portal/${b}/signatures/${done.id}/files/certificate`);assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),certificate);const portalSigned=await h.request(`/api/blotter/portal/${b}/signatures/${done.id}/files/signed`);assert.equal(portalSigned.status,200);assert.deepEqual(Buffer.from(await portalSigned.arrayBuffer()),signed);
  await h.json(`/engagement-proposals/${done.id}/amend`,{...amend,revision:done.revision},h.owner,409);
  assert.deepEqual(await inert(),baseline);assert.equal(edge.calls.length,providerCalls,'Proposal terms cause no payment-provider call');assert.equal((await h.json('/state',undefined,h.owner)).jobs.length,before.jobs.length);assert.equal(Number((await h.db.prepare('SELECT count(*) n FROM b_automation_events WHERE source LIKE ?').bind('signature:'+done.id+':%').first()).n),0);
  const mailCount=h.mails.length;await h.restart();await h.scheduled('2026-11-01T12:00:00Z');await h.json('/notifications',undefined,h.owner);assert.equal(h.mails.length,mailCount,'Restart and scheduler replay do not resend signature notices');
  const history=await h.json(`/clients/${f.client.id}/history`,undefined,f.prep);assert.ok(history.history.some(e=>e.action==='proposal.amended'&&JSON.parse(e.detail).requestId===done.id&&e.actor===f.principal));assert.ok(history.history.some(e=>e.action==='signature.completed'&&e.at&&e.source===`/api/blotter/signatures/${done.id}/files/signed`));assert.ok(!history.unresolved.some(e=>e.id===done.id||e.id===first.id));
  await engagementJourney(h,f,done,replacement.invitations);
  // Completion and amendment contend on the same native request revision.
  const racing=await send(h,f,await draft(h,f)),ra=token(racing.invitations[0]),rb=token(racing.invitations[1]);await sign(h,ra,racing.id,await open(h,ra,racing.id));
  const raceView=await open(h,rb,racing.id),raceRecord=await h.json(`/engagement-proposals/${racing.id}`,undefined,f.prep);
  const race=await Promise.all([h.request(`/api/blotter/engagement-proposals/${racing.id}/amend`,{...f.terms,feeCents:75000,revision:raceRecord.revision},h.owner),h.request(`/api/blotter/portal/${rb}/signatures/${racing.id}/sign`,signBody(raceView))]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  const afterRace=await h.json(`/engagement-proposals/${racing.id}`,undefined,f.prep);assert.ok(['voided','completed'].includes(afterRace.status));assert.ok(afterRace.versions.filter(v=>v.status==='completed').length<=1);
  await h.json(`/engagement-proposals/${done.id}/amend`,{...f.terms,revision:done.revision},f.prep,403);
  const pending=await draft(h,f),unresolved=(await h.json(`/clients/${f.client.id}/history`,undefined,f.prep)).unresolved.find(e=>e.id===pending.id);assert.equal(unresolved.owner,f.principal);assert.ok(unresolved.nextAction&&unresolved.due.includes(f.job.due_date));
  const third=await send(h,f,pending),oldToken=token(third.invitations[0]),oldView=await open(h,oldToken,third.id),c=f.client.contacts[0];
  await h.json(`/clients/${f.client.id}/contacts`,{...c,id:c.id,revision:c.revision,authorized:true,portal:true,active:true,requestConsent:true,emailConsent:true,consentNote:'Signer revoked',signer:false},h.owner);await h.json(`/portal/${oldToken}/signatures/${third.id}/sign`,signBody(oldView),'',404);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();copy=await harness();await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},copy.owner);
  const restored=await copy.json(`/engagement-proposals/${third.id}`,undefined,copy.owner);assert.equal(restored.status,'held');assert.equal(restored.proposal.terms.title,f.terms.title);assert.equal((await copy.request(`/api/blotter/portal/${oldToken}/signatures/${third.id}`)).status,404);assert.deepEqual(await file(copy,done.id,'signed'),signed);assert.deepEqual(await file(copy,first.id,'original'),original);
  await copy.close();copy=null;
  await h.json('/access/people',{email:f.staff,readOnly:false,clientIds:[]},h.owner);await h.json(`/engagement-proposals/${done.id}`,undefined,f.prep,404);await h.json('/access/people',{email:f.staff,readOnly:false,clientIds:[f.client.id]},h.owner);
  await h.json('/team',{email:f.staff,name:'Pat Harper',role:'preparer',active:false},h.owner);await h.json(`/engagement-proposals/${done.id}`,undefined,f.prep,401);


 }finally{await copy?.close();await h.close();}
});

test('Proposal engagement custody retains version families, honors holds and clocks, reports outside copies and fences stale restoration after expiry',async()=>{
 const h=await harness();let copy;try{
  const f=await fixture(h);const first=await send(h,f,await draft(h,f));const one=token(first.invitations[0]);await sign(h,one,first.id,await open(h,one,first.id));const partial=await h.json(`/engagement-proposals/${first.id}`,undefined,f.prep),oldBytes=await file(h,first.id,'original',f.prep);
  let r=await send(h,f,await h.json(`/engagement-proposals/${first.id}/amend`,{...f.terms,scope:'Amended corporate return scope.',revision:partial.revision},h.owner));for(const i of r.invitations){const t=token(i);await sign(h,t,r.id,await open(h,t,r.id));}
  const done=await h.json(`/engagement-proposals/${r.id}`,undefined,f.prep);await file(h,r.id,'signed',f.prep);await finishJob(h,f);
  const held=await h.json(`/clients/${f.client.id}/retention`,{scope:'class',class:'engagement',kind:'hold',reason:'Engagement dispute',owner:(await h.json('/state',undefined,h.owner)).actor.email,reviewDate:'2999-01-01'},h.owner);
  let record=(await h.json(`/clients/${f.client.id}/retention`,undefined,h.owner)).records.find(x=>x.kind==='signature'&&x.id===r.id);assert.equal(record.cls??record.class,'engagement');assert.ok(record.expiry>record.clock);
  const date=new Date();date.setUTCFullYear(date.getUTCFullYear()-8);const triggers=(await h.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name='b_jobs_signed_off'").all()).results;for(const t of triggers)await h.db.prepare(`DROP TRIGGER ${t.name}`).run();await h.db.prepare('UPDATE b_jobs SET signed_off_at=? WHERE id=?').bind(date.toISOString(),f.job.id).run();await h.db.prepare('UPDATE b_signatures SET completed_at=? WHERE id=?').bind(date.toISOString(),r.id).run();for(const t of triggers)await h.db.prepare(t.sql).run();
  assert.ok((await h.json('/retention/ready',undefined,h.owner)).held.some(x=>x.id===r.id));await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Still held'},h.owner,409);
  const client=await h.json(`/clients/${f.client.id}/detail`,undefined,h.owner);await h.json(`/clients/${f.client.id}/lifecycle`,{lifecycle:'archived',revision:client.revision},h.owner);
  let preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);assert.deepEqual(preview.blockers,[]);assert.equal(preview.classes.find(x=>x.class==='engagement').retained,2);assert.ok(preview.records.some(x=>x.id===first.id&&x.class==='engagement'));assert.ok(preview.externalCopies.some(x=>x.source==='signature-invitations'));assert.ok(preview.externalCopies.some(x=>x.source==='signature-downloads'));
  await h.json(`/retention/${held.id}/release`,{reason:'Dispute resolved'},h.owner);preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);
  const stale=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);const receipt=await h.json(`/clients/${f.client.id}/erasure`,{planHash:preview.planHash,confirm:f.client.name,reason:'Client requested erasure'},h.owner);assert.ok(receipt.retained.records.some(x=>x.kind==='signature'&&x.class==='engagement'));assert.equal((await h.json(`/engagement-proposals/${r.id}`,undefined,h.owner)).proposal.terms.scope,'Amended corporate return scope.');await h.json(`/engagement-proposals/${r.id}`,undefined,f.prep,403);
  assert.deepEqual(await file(h,first.id,'original'),oldBytes);assert.equal((await h.json(`/engagement-proposals/${first.id}`,undefined,h.owner)).signers[0].status,'signed');
  await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Retention ended'},f.prep,403);
  const expired=await h.json('/retention/ready/confirm',{kind:'signature',id:r.id,reason:'Retention ended'},h.owner);assert.ok(expired.effects.some(x=>x.table==='b_engagement_proposals'&&x.count>0));const gone=await h.json(`/engagement-proposals/${r.id}`,undefined,h.owner);assert.equal(gone.proposal.terms,null);assert.equal(gone.hasSigned,false);assert.equal(gone.hasCertificate,false);assert.equal(gone.source_sha256,done.source_sha256);assert.equal((await h.request(`/api/blotter/signatures/${r.id}/files/signed`,undefined,h.owner)).status,404);
  await h.json('/retention/ready/confirm',{kind:'signature',id:first.id,reason:'Earlier version retention ended'},h.owner);assert.equal((await h.request(`/api/blotter/signatures/${first.id}/files/original`,undefined,h.owner)).status,404);
  const latest=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();copy=await harness();await copy.json('/restore',{archive:stale,journal:latest,confirm:'RESTORE'},copy.owner,409);
 }finally{await copy?.close();await h.close();}
});
