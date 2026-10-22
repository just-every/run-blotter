import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';

const mapping={client_id:'Account',client_name:'Entity',entity_type:'Type',ein:'Tax',contact_id:'Contact',contact_name:'Name',contact_email:'Email',contact_roles:'Role',authorized:'Authorized',portal:'Portal',request_consent:'Requests',email_consent:'Mail',tags:'Tags'};
const header='Account,Entity,Type,Tax,Contact,Name,Email,Role,Authorized,Portal,Requests,Mail,Tags';
const line=(i,c='one',extra={})=>[i,`Client ${i}`,extra.type??'business','',c,`Contact ${c}`,`${c}.${i}@example.test`,'primary','true','true','true','true','1040'].join(',');

test('BASE-001 / IMPORT-001 mapped entity/contact CSV: write-free errors and duplicate review, exact file/mapping commit, resume, source replay, native matching without grants, conflict-preserving undo and protected portable originals',async()=>{
 const h=await harness();let restored;
 try{
  const existing=await h.json('/clients',{name:'Client native',contacts:[{name:'Contact one',email:'one.native@example.test',roles:['primary'],authorized:true,portal:true,requestConsent:true,emailConsent:true}]},h.owner);
  const body={csv:[header,...Array.from({length:43},(_,n)=>line(String(n))),line('0','two'),line('native')].join('\n'),filename:'Exported clients.csv',mapping};
  const before=(await h.json('/state',undefined,h.owner)).clients.length;
  const columns=await h.json('/import/columns',{csv:body.csv},h.owner);assert.ok(columns.headers.includes('Account'));assert.ok(columns.fields.includes('contact_id'));
  await h.json('/import/columns',{csv:'A,A\nx,x'},h.owner,400);
  const duplicate=await h.json('/import/preview',body,h.owner);assert.match(duplicate.summary.errors.join(' '),/choose keep separate or match/);assert.equal(duplicate.summary.clients,44);assert.equal(duplicate.clients.find(c=>c.sourceId==='0').contacts.length,2);
  assert.equal((await h.json('/state',undefined,h.owner)).clients.length,before);
  const conflicting=await h.json('/import/preview',{...body,csv:[header,line('bad'),line('bad').replace('Client bad','Different name')].join('\n')},h.owner);assert.match(conflicting.summary.errors.join(' '),/conflicting entity fields/);
  const invalid=await h.json('/import/preview',{...body,csv:[header,line('bad').replace('one.bad@example.test','invalid-email')].join('\n')},h.owner);assert.match(invalid.summary.errors.join(' '),/email/i);
  const badContact=await h.json('/import/preview',{...body,csv:[header,line('bad'),line('bad').replace('Contact one','Different contact')].join('\n')},h.owner);assert.match(badContact.summary.errors.join(' '),/conflicting values/);
  const decisions={native:{action:'match',clientId:existing.id}},reviewed={...body,decisions};
  const preview=await h.json('/import/preview',reviewed,h.owner);assert.deepEqual(preview.summary.errors,[]);assert.equal(preview.clients.find(c=>c.sourceId==='native').matches.id,existing.id);
  await h.json('/import/commit',{...reviewed,csv:body.csv+'\n'+line('extra'),fingerprint:preview.fingerprint},h.owner,409);
  await h.json('/import/commit',{...reviewed,mapping:{...mapping,contact_id:'Name',contact_name:'Contact'},fingerprint:preview.fingerprint},h.owner,409);
  await h.json('/import/commit',{...reviewed,decisions:{native:{action:'create'}},fingerprint:preview.fingerprint},h.owner,409);
  let committed=await h.json('/import/commit',{...reviewed,fingerprint:preview.fingerprint},h.owner);const jobId=committed.job.id;
  assert.ok(committed.job.checkpoint>0&&committed.job.checkpoint<committed.job.total,'The first request deliberately stops at a durable checkpoint');
  while(committed.job.state!=='completed')committed=await h.json('/import/resume',{id:jobId},h.owner);
  const state=await h.json('/state',undefined,h.owner);assert.equal(state.clients.length,before+43);
  const imported=state.clients.find(c=>c.name==='Client 0'),contacts=await h.json(`/clients/${imported.id}/contacts`,undefined,h.owner);assert.equal(contacts.length,2);assert.ok(contacts.every(c=>c.authorized&&c.portal&&c.request_consent&&c.email_consent));
  assert.equal((await h.json(`/clients/${existing.id}/contacts`,undefined,h.owner)).length,1,'Matching never adds contacts or grants');
  assert.equal((await h.json('/import/commit',{...reviewed,fingerprint:preview.fingerprint},h.owner)).job.id,jobId);
  const unconsented=await h.json('/import/preview',{csv:'Entity,Name,Email\nUnconsented,New Contact,new@example.test',mapping:{client_name:'Entity',contact_name:'Name',contact_email:'Email'}},h.owner);assert.ok(unconsented.clients[0].contacts.every(c=>!c.authorized&&!c.portal&&!c.request_consent&&!c.email_consent));
  const conflictingMatch=await h.json('/import/preview',{...reviewed,csv:body.csv.replace('one.native@example.test','other.native@example.test')},h.owner);assert.match(conflictingMatch.summary.errors.join(' '),/does not exactly match/);
  const journal=await h.json('/import/status',{id:jobId},h.owner);assert.equal(Buffer.from(journal.originals[0].original.base64,'base64').toString(),body.csv);
  await h.json('/team',{email:'prep@example.test',name:'Assigned preparer',role:'preparer'},h.owner);await h.json('/team/invite',{email:'prep@example.test'},h.owner);
  const prep=await h.login('prep@example.test');await h.json('/import/status',{id:jobId},prep,403);await h.json('/import/preview',reviewed,prep,403);
  const template=await h.json('/templates',{name:'Annual tax return',recurrence:'annual',tasks:[{label:'Prepare',assignee:'preparer'}],requests:'State return'},h.owner);
  const work=await h.json('/jobs',{clientId:imported.id,templateId:template.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Firm recorded',preparerEmail:'prep@example.test',reviewerEmail:'owner@example.test'},h.owner);
  const request=(await h.json(`/jobs/${work.id}`,undefined,h.owner)).requests[0],original=Buffer.from('Imported client review packet');
  const file=await h.json(`/requests/${request.id}/files`,{name:'Imported review packet.txt',mime:'text/plain',contentBase64:original.toString('base64')},h.owner);
  const access=await h.json(`/documents/${file.id}/access`,{revision:null,visibility:'contacts',contactIds:[contacts[0].id]},h.owner);
  const share=await h.json(`/documents/${file.id}/shares`,{revision:access.revision,contactId:contacts[0].id,days:1},h.owner);
  assert.deepEqual(Buffer.from(await(await h.request('/api/blotter/shared-files/'+share.token)).arrayBuffer()),original,'Imported contact references work through the same private grant/share doors');
  await h.json(`/jobs/${work.id}/deliverables`,{title:'Imported client packet',name:'Client packet.txt',mime:'text/plain',contentBase64:original.toString('base64'),contactId:contacts[0].id},h.owner);
  assert.deepEqual(h.mails.at(-1).to,[contacts[0].email],'Imported contacts are routable without changing their identity or grants');
  const edited=state.clients.find(c=>c.name==='Client 1'),detail=await h.json(`/clients/${edited.id}/detail`,undefined,h.owner);
  await h.json(`/clients/${edited.id}/contacts`,{id:detail.contacts[0].id,revision:detail.contacts[0].revision,name:'Corrected Contact'},h.owner);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},restored.owner);
  const restoredJournal=await restored.json('/import/status',{id:jobId},restored.owner);assert.equal(Buffer.from(restoredJournal.originals[0].original.base64,'base64').toString(),body.csv);assert.equal((await restored.json(`/clients/${imported.id}/contacts`,undefined,restored.owner)).length,2);
  let undone=await h.json('/import/undo',{id:jobId},h.owner);while(undone.job.state==='undoing')undone=await h.json('/import/undo',{id:jobId},h.owner);
  const after=await h.json('/state',undefined,h.owner);assert.equal(after.clients.length,before+2);assert.ok(after.clients.some(c=>c.id===imported.id));assert.ok(after.clients.some(c=>c.id===edited.id));assert.equal((await h.json(`/jobs/${work.id}`,undefined,h.owner)).job.id,work.id);
  const undo=await h.json('/import/status',{id:jobId},h.owner);assert.equal(undo.job.state,'undone');assert.ok(undo.undo.dispositions.some(d=>d.disposition==='retained'));assert.ok(undo.undo.dispositions.some(d=>d.disposition==='reversed'));
 }finally{await restored?.close();await h.close()}
});

const marketingMapping = { client_id: 'client_id', client_name: 'client_name', entity_type: 'entity_type', contact_name: 'contact_name', contact_email: 'contact_email', contact_roles: 'contact_roles', authorized: 'authorized', email_consent: 'email_consent', tags: 'tags', ...Object.fromEntries(['marketing_opt_in','marketing_status','marketing_captured_at','marketing_wording','marketing_wording_version','marketing_language','marketing_evidence'].map(k=>[k,k])) };
const marketingHeader = Object.keys(marketingMapping);
const consentCsv = records => [marketingHeader.join(','), ...records.map(r=>marketingHeader.map(k=>JSON.stringify(String(r[k]??''))).join(','))].join('\n');
const importedContact = (i, extra={}) => ({client_id:`consent-${i}`,client_name:`Consent client ${String(i).padStart(2,'0')}`,entity_type:'individual',contact_name:`Contact ${i}`,contact_email:`consent-${i}@example.test`,contact_roles:'primary',authorized:'true',email_consent:'true',tags:'tax',...extra});
const sourceGrant = { marketing_opt_in:'true',marketing_captured_at:'2026-10-01T10:00:00-04:00',marketing_wording:'Yes email me the practice tax newsletter.',marketing_wording_version:'newsletter-v1',marketing_language:'en',marketing_evidence:'Signed newsletter consent record 27' };

test('MSG-002 / IMPORT-001 / BASE-001: separately reviewed mapped opt-ins require principal attestation; withdrawals win firm-wide, subscribed alone grants nothing, exact replay/resume and undo retain attributed consent, and restore holds marketing', async()=>{
 const h=await harness();let restored;
 try {
  const native=await h.json('/clients',{name:'Existing shared address',contacts:[{name:'Existing contact',email:'withdrawn@example.test',roles:['primary'],authorized:true,emailConsent:true}]},h.owner);
  await h.json('/marketing-consents',{contactId:native.contacts[0].id,kind:'grant',actedAt:'2026-09-01T00:00:00Z',wording:'Send me tax newsletters',wordingVersion:'v1',evidence:'Existing written grant'},h.owner);
  const records=Array.from({length:45},(_,i)=>importedContact(i));
  records[0]=importedContact(0,sourceGrant);records[1]=importedContact(1,{marketing_status:'subscribed'});
  records[2]=importedContact(2,{contact_email:'withdrawn@example.test',marketing_status:'unsubscribed',marketing_captured_at:'2026-10-02T00:00:00Z'});
  records[3]=importedContact(3,{...sourceGrant,marketing_status:'bounced'});
  records[4]=importedContact(4,{marketing_status:'complained'});
  records[5]=importedContact(5,{...sourceGrant,email_consent:'false'});
  records[44]=importedContact(44,sourceGrant);
  const body={csv:consentCsv(records),mapping:marketingMapping,filename:'Consent records.csv'};
  const columns=await h.json('/import/columns',{csv:body.csv},h.owner);
  assert.ok(columns.fields.includes('marketing_opt_in'));assert.equal(columns.defaults.marketing_opt_in,undefined,'Marketing columns always need an explicit mapping');
  const log=()=>h.json('/marketing-consents',undefined,h.owner);
  const before=await log(),review=await h.json('/import/preview',body,h.owner);
  assert.deepEqual(review.summary.errors,[]);assert.equal(review.marketing.filter(e=>e.kind==='grant').length,3);assert.equal(review.marketing.filter(e=>e.kind==='withdraw').length,3);
  assert.equal(review.marketing.find(e=>e.client==='Consent client 01').kind,'not_granted');
  assert.equal(review.marketing.find(e=>e.client==='Consent client 03').kind,'withdraw','A withdrawal beats a simultaneous source opt-in');
  assert.equal(review.marketing.find(e=>e.client==='Consent client 00').actedAt,'2026-10-01T14:00:00.000Z');
  assert.deepEqual(await log(),before,'Preview creates no consent or client records');
  await h.json('/import/commit',{...body,fingerprint:review.fingerprint},h.owner,409);
  await h.json('/import/commit',{...body,fingerprint:review.fingerprint,marketingAttested:'true'},h.owner,409);
  for (const changes of [{marketing_captured_at:''},{marketing_wording:''},{marketing_evidence:''},{marketing_opt_in:'yes'},{marketing_captured_at:'2026-10-01'}]) {
    const invalid={...body,csv:consentCsv([importedContact('bad',{...sourceGrant,...changes})])};
    const bad=await h.json('/import/preview',invalid,h.owner);assert.ok(bad.summary.errors.length);await h.json('/import/commit',{...invalid,fingerprint:bad.fingerprint,marketingAttested:true},h.owner,409);
  }
  await h.json('/team',{email:'reviewer@example.test',name:'Reviewer',role:'reviewer'},h.owner);await h.json('/team/invite',{email:'reviewer@example.test'},h.owner);const reviewer=await h.login('reviewer@example.test');
  await h.json('/import/preview',body,reviewer,403);await h.json('/import/commit',{...body,fingerprint:review.fingerprint,marketingAttested:true},reviewer,403);
  await h.json('/import/commit',{...body,fingerprint:review.fingerprint,marketingAttested:true},h.owner,403,{origin:'https://foreign.example'});
  const key=await h.json('/keys',{label:'Import denied'},h.owner);await h.json('/import/preview',body,'',401,{authorization:'Bearer '+key.key});
  await h.json('/import/commit',{...body,csv:body.csv.replace('record 27','record 28'),fingerprint:review.fingerprint,marketingAttested:true},h.owner,409);
  const commit=await h.json('/import/commit',{...body,fingerprint:review.fingerprint,marketingAttested:true},h.owner),jobId=commit.job.id;
  assert.ok(commit.job.checkpoint>0&&commit.job.checkpoint<commit.job.total,'Consent is committed in the existing resumable chunks');
  const pendingArchive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  restored=await harness();await restored.json('/restore',{archive:pendingArchive,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},restored.owner);
  let resumed=(await restored.json('/import/resume',{id:jobId},restored.owner)).job;
  while(resumed.state!=='completed')resumed=(await restored.json('/import/resume',{id:jobId},restored.owner)).job;
  const resumedLog=await restored.json('/marketing-consents',undefined,restored.owner);
  assert.equal(resumedLog.events.filter(e=>e.source==='import').length,6);assert.match(resumedLog.hold,/off after a restore/);
  await restored.close();restored=undefined;
  await h.restart();let job=commit.job;while(job.state!=='completed')job=(await h.json('/import/resume',{id:jobId},h.owner)).job;
  assert.equal((await h.json('/import/commit',{...body,fingerprint:review.fingerprint,marketingAttested:true},h.owner)).job.id,jobId);
  const events=(await log()).events.filter(e=>e.source==='import');assert.equal(events.length,6);assert.equal(new Set(events.map(e=>e.id)).size,6);
  assert.ok(events.every(e=>e.actor==='owner@example.test'&&e.recorded_at));assert.ok(events.filter(e=>e.kind==='grant').every(e=>e.evidence.includes(review.marketingAttestation)));
  const states=(await h.json('/state',undefined,h.owner)).clients,byName=name=>states.find(c=>c.name===name);
  const client0=byName('Consent client 00'),client5=byName('Consent client 05');
  const permissions=await h.json(`/clients/${client5.id}/contacts`,undefined,h.owner);assert.equal(permissions[0].email_consent,0,'A marketing import cannot restore email consent');
  assert.equal((await h.json(`/marketing-consents?clientId=${native.id}`,undefined,h.owner)).contacts[0].marketing,false,'Source withdrawal applies to every relationship with that address');
  const withdrawn=events.find(e=>e.address==='withdrawn@example.test');await h.json(`/marketing-consents/${withdrawn.id}/correct`,{reason:'Try to void source withdrawal'},h.owner,409);
  assert.ok((await h.json(`/clients/${client0.id}/history?kind=messages`,undefined,h.owner)).history.some(e=>e.action==='consent.marketing_granted'&&e.actor==='owner@example.test'));
  await h.json('/firm/settings',{name:'Cardinal Tax & Books',address:'100 Main Street',city:'Raleigh',state:'NC',zip:'27601',ein:'123456789',entity:'LLC',fiscalYearEnd:'12-31',services:'tax',calendars:[],currency:'USD',timeZone:'America/New_York',notificationStart:'08:00',notificationEnd:'18:00'},h.owner);
  const template=await h.json('/messages/templates',{scope:'firm',class:'marketing',name:'Tax newsletter',subject:'Tax newsletter',body:'Hi {{contact_first_name}}, our tax newsletter is available.'},h.owner);
  const batch={class:'marketing',templateId:template.id,tag:'tax',topic:'tax',idempotencyKey:'imported-consents'};
  const recipients=await h.json('/bulk-messages/preview',batch,h.owner);
  assert.deepEqual(recipients.recipients.map(r=>r.address).sort(),['consent-0@example.test','consent-44@example.test']);
  assert.equal(recipients.exclusions.find(r=>r.address==='consent-5@example.test').reason,'email consent withdrawn');
  const journal=await h.json('/import/status',{id:jobId},h.owner);assert.equal(Buffer.from(journal.originals[0].original.base64,'base64').toString(),body.csv);
  const packetTemplate=await h.json('/templates',{name:'Imported evidence',recurrence:'annual',steps:'Check source',requests:'Consent source'},h.owner);
  const packetJob=await h.json('/jobs',{clientId:client0.id,templateId:packetTemplate.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Recorded review date',preparerEmail:'reviewer@example.test',reviewerEmail:'owner@example.test'},h.owner);
  const packetRequest=(await h.json(`/jobs/${packetJob.id}`,undefined,h.owner)).requests[0];
  const packet=await h.json(`/requests/${packetRequest.id}/files`,{name:'consent-source.txt',mime:'text/plain',contentBase64:Buffer.from('Stored consent source attachment').toString('base64')},h.owner);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},restored.owner);
  const restoredEvents=(await restored.json('/marketing-consents',undefined,restored.owner)).events.filter(e=>e.source==='import');
  assert.deepEqual(restoredEvents.map(({restored,...e})=>e),events.map(({restored,...e})=>e));assert.ok(restoredEvents.every(e=>e.restored===1));
  await restored.json('/bulk-messages/preview',{...batch,idempotencyKey:'after-restore'},restored.owner,409);
  await restored.json('/marketing-consents/confirm',{note:'Confirmed source evidence and withdrawals'},restored.owner);
  assert.deepEqual((await restored.json('/bulk-messages/preview',{...batch,idempotencyKey:'after-restore'},restored.owner)).recipients.map(r=>r.address).sort(),['consent-0@example.test','consent-44@example.test']);
  await h.json(`/files/${packet.id}/erase`,{confirm:'consent-source.txt',reason:'Source attachment withdrawn'},h.owner);
  await h.json(`/files/${packet.id}`,undefined,h.owner,404);
  const laterArchive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text(),stale=await harness();
  try {await stale.json('/restore',{archive,journal:laterArchive,confirm:'RESTORE'},stale.owner,409);}finally{await stale.close();}
  let undone=await h.json('/import/undo',{id:jobId},h.owner);while(undone.job.state==='undoing')undone=await h.json('/import/undo',{id:jobId},h.owner);
  assert.deepEqual((await log()).events.filter(e=>e.source==='import'),events,'Undo never deletes append-only consent or its dependent relationships');
  assert.ok((await h.json('/import/status',{id:jobId},h.owner)).undo.dispositions.some(e=>e.disposition==='retained'));
 }finally{await restored?.close();await h.close();}
});

test('MSG-002 / IMPORT-001 native Move in at 1440 and 390: explicit mapping, separate consent review, unchecked principal attestation, stale-preview refusal and durable journal',async()=>{
 const h=await harness();
 try { const {importMarketingJourney}=await import('./import-marketing-ui.mjs');await importMarketingJourney(h,consentCsv([importedContact('ui-grant',sourceGrant),importedContact('ui-subscribed',{marketing_status:'subscribed'})])); }
 finally {await h.close();}
});

test('MSG-002 / IMPORT-001 / BASE-001 native-match consent: provenance never grants marketing, withdrawals keep native permissions unchanged and re-import after undo retains exactly one event; an empty-log restore still holds later imported grants',async()=>{
 const h=await harness();let restored;
 try {
  const native=await h.json('/clients',{name:'Matched source',contacts:[{name:'Matched contact',email:'matched@example.test',roles:['primary'],authorized:true,emailConsent:true}]},h.owner);
  const row=importedContact('match',{client_name:'Matched source',entity_type:'business',contact_name:'Matched contact',contact_email:'matched@example.test'});
  const decisions={'consent-match':{action:'match',clientId:native.id}},base={mapping:marketingMapping,decisions};
  const forbidden={...base,csv:consentCsv([{...row,...sourceGrant}])},review=await h.json('/import/preview',forbidden,h.owner);
  assert.match(review.summary.errors.join(' '),/provenance-only match never adds marketing grants/);
  await h.json('/import/commit',{...forbidden,fingerprint:review.fingerprint,marketingAttested:true},h.owner,409);
  const before=await h.json(`/clients/${native.id}/detail`,undefined,h.owner),body={...base,csv:consentCsv([{...row,marketing_status:'unsubscribed'}])};
  const preview=await h.json('/import/preview',body,h.owner);assert.deepEqual(preview.summary.errors,[]);
  const committed=await h.json('/import/commit',{...body,fingerprint:preview.fingerprint},h.owner);
  const events=(await h.json('/marketing-consents',undefined,h.owner)).events;assert.equal(events.length,1);assert.equal(events[0].contact_id,native.contacts[0].id);
  assert.deepEqual(await h.json(`/clients/${native.id}/detail`,undefined,h.owner),before);
  await h.json('/import/undo',{id:committed.job.id},h.owner);
  const again=await h.json('/import/preview',body,h.owner);await h.json('/import/commit',{...body,fingerprint:again.fingerprint},h.owner);
  assert.deepEqual((await h.json('/marketing-consents',undefined,h.owner)).events,events,'Re-import of the same withdrawn source is not a new withdrawal');
  // Use a separate empty source for the empty-log archive, without suppressing or altering this log.
  const empty=await harness();let archive;
  try {archive=await(await empty.request('/api/blotter/backup',undefined,empty.owner)).text();}finally{await empty.close();}
  restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},restored.owner);
  const fresh={mapping:marketingMapping,csv:consentCsv([importedContact('after-empty',sourceGrant)])};
  const next=await restored.json('/import/preview',fresh,restored.owner);await restored.json('/import/commit',{...fresh,fingerprint:next.fingerprint,marketingAttested:true},restored.owner);
  const log=await restored.json('/marketing-consents',undefined,restored.owner);assert.equal(log.events.length,1);assert.equal(log.events[0].restored,0);assert.match(log.hold,/off after a restore/);
  await restored.json('/marketing-consents/confirm',{note:'Confirmed the imported log after restore'},restored.owner);assert.equal((await restored.json('/marketing-consents',undefined,restored.owner)).hold,'');
 }finally{await restored?.close();await h.close();}
});


test('MSG-002 / ERASURE-002 / IMPORT-001: an erasure between import chunks refuses stale opt-ins atomically; only later consent survives the latest repeated erasure and restore', async()=>{
 const h=await harness();let restored;
 try {
  const address='synthetic-blotter-390@example.test';
  const native=async name=>h.json('/clients',{name,contacts:[{name:'Synthetic contact',email:address,roles:['primary'],authorized:true,emailConsent:true}]},h.owner);
  const withdraw=async c=>h.json('/marketing-consents',{contactId:c.contacts[0].id,kind:'withdraw',source:'staff_reply',actedAt:'2026-09-01T00:00:00Z',evidence:'Synthetic contact requested withdrawal'},h.owner);
  const erase=async c=>{
   const d=await h.json(`/clients/${c.id}/detail`,undefined,h.owner);
   await h.json(`/clients/${c.id}/lifecycle`,{lifecycle:'archived',revision:d.revision},h.owner);
   const p=await h.json(`/clients/${c.id}/erasure/preview`,undefined,h.owner);assert.deepEqual(p.blockers,[]);
   return h.json(`/clients/${c.id}/erasure`,{planHash:p.planHash,confirm:c.name,reason:'Synthetic deletion request'},h.owner);
  };
  const original=await native('synthetic-blotter-391');await withdraw(original);
  const records=Array.from({length:45},(_,i)=>importedContact('erasure-'+String(i).padStart(2,'0')));
  records[44]={...records[44],contact_email:address,...sourceGrant};
  const body={csv:consentCsv(records),mapping:marketingMapping,filename:'synthetic-blotter-392.csv'};
  const preview=await h.json('/import/preview',body,h.owner);assert.deepEqual(preview.summary.errors,[]);
  const first=await h.json('/import/commit',{...body,fingerprint:preview.fingerprint,marketingAttested:true},h.owner);
  assert.ok(first.job.checkpoint>0&&first.job.checkpoint<44,'The grant is beyond the first committed chunks');
  const oldArchive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  const receipt=await erase(original);assert.equal(receipt.retained.suppressionDigests,1);
  const before=(await h.json('/state',undefined,h.owner)).clients.map(c=>c.id);
  await h.json('/import/resume',{id:first.job.id},h.owner,409);
  assert.deepEqual((await h.json('/state',undefined,h.owner)).clients.map(c=>c.id),before,'No client or contact in the refused chunk is committed');
  assert.equal((await h.json('/import/status',{id:first.job.id},h.owner)).job.checkpoint,first.job.checkpoint,'The refused chunk cannot advance progress');
  assert.equal((await h.json('/marketing-consents',undefined,h.owner)).events.filter(e=>e.source==='import').length,0,'No stale grant or audit is committed');
  const blocked=await h.json('/import/preview',body,h.owner);assert.match(blocked.summary.errors.join(' '),/withdrew consent before a client erasure/);

  // Re-reviewing a genuinely later opt-in works; resuming the stale job never silently substitutes it.
  const later=new Date().toISOString();assert.ok(later>receipt.approvedAt);
  records[44]={...records[44],marketing_captured_at:later};
  const changed={...body,csv:consentCsv(records)},review=await h.json('/import/preview',changed,h.owner);assert.deepEqual(review.summary.errors,[]);
  let next=await h.json('/import/commit',{...changed,fingerprint:review.fingerprint,marketingAttested:true},h.owner);
  while(next.job.state!=='completed')next=await h.json('/import/resume',{id:next.job.id},h.owner);
  assert.equal((await h.json('/marketing-consents',undefined,h.owner)).events.filter(e=>e.source==='import'&&e.kind==='grant').length,1);
  const imported=(await h.json('/state',undefined,h.owner)).clients.find(c=>c.contact_email===address),contacts=await h.json(`/clients/${imported.id}/contacts`,undefined,h.owner);
  const second=await native('synthetic-blotter-393');await withdraw(second);
  const latestReceipt=await erase(second);assert.ok(latestReceipt.approvedAt>later);
  const oldGrant={contactId:contacts[0].id,kind:'grant',actedAt:later,wording:'Send the newsletter',wordingVersion:'synthetic-blotter-394',evidence:'Synthetic opt-in before the second erasure'};
  await h.json('/marketing-consents',oldGrant,h.owner,409);
  const latest=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  const suppressions=latest.trim().split('\n').map(JSON.parse).filter(p=>p.kind==='part').flatMap(p=>p.items).filter(i=>i.kind==='row'&&i.table==='b_erased_suppressions');
  assert.equal(suppressions.length,1);assert.ok(!JSON.stringify(suppressions).includes(address),'Suppression stores only the digest, never the erased address');
  restored=await harness();await restored.json('/restore',{archive:oldArchive,journal:latest,confirm:'RESTORE'},restored.owner,409);
  await restored.json('/restore',{archive:latest,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
  await restored.json('/marketing-consents',oldGrant,restored.owner,409);
  await restored.json('/marketing-consents',{...oldGrant,actedAt:new Date().toISOString(),evidence:'Synthetic opt-in after the latest erasure'},restored.owner);
  assert.equal((await restored.json(`/marketing-consents?clientId=${imported.id}`,undefined,restored.owner)).contacts[0].marketing,true,'A later explicit act remains usable under the existing rule');
 }finally{await restored?.close();await h.close();}
});
