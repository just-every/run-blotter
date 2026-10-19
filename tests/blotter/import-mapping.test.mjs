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
  const edited=state.clients.find(c=>c.name==='Client 1'),detail=await h.json(`/clients/${edited.id}/detail`,undefined,h.owner);
  await h.json(`/clients/${edited.id}/contacts`,{id:detail.contacts[0].id,revision:detail.contacts[0].revision,name:'Corrected Contact'},h.owner);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE'},restored.owner);
  const restoredJournal=await restored.json('/import/status',{id:jobId},restored.owner);assert.equal(Buffer.from(restoredJournal.originals[0].original.base64,'base64').toString(),body.csv);assert.equal((await restored.json(`/clients/${imported.id}/contacts`,undefined,restored.owner)).length,2);
  let undone=await h.json('/import/undo',{id:jobId},h.owner);while(undone.job.state==='undoing')undone=await h.json('/import/undo',{id:jobId},h.owner);
  const after=await h.json('/state',undefined,h.owner);assert.equal(after.clients.length,before+2);assert.ok(after.clients.some(c=>c.id===imported.id));assert.ok(after.clients.some(c=>c.id===edited.id));assert.equal((await h.json(`/jobs/${work.id}`,undefined,h.owner)).job.id,work.id);
  const undo=await h.json('/import/status',{id:jobId},h.owner);assert.equal(undo.job.state,'undone');assert.ok(undo.undo.dispositions.some(d=>d.disposition==='retained'));assert.ok(undo.undo.dispositions.some(d=>d.disposition==='reversed'));
 }finally{await restored?.close();await h.close()}
});
