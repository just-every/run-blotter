import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readArchive } from '@runeditrun/rer/modules/portability';
import { harness } from './harness.mjs';
import { integrationTaskJourney } from './integration-ui.mjs';
import { enroll } from './erasure-fixture.mjs';

const bearer=key=>({authorization:'Bearer '+key.key});
const mint=(h,clients,actions=['clients:read','work:read','time:read','tasks:create'])=>h.json('/integration-keys',{label:'synthetic-blotter-1',reason:'Reviewed accounting workflow',clientIds:clients.map(c=>c.id),actions},h.owner);
async function fixture(h) {
 const clients=[];for(const name of ['Allowed one','Allowed two','Outside scope'])clients.push(await h.json('/clients',{name},h.owner));
 await h.json('/team',{email:'prep@example.test',name:'Preparer',role:'preparer'},h.owner);
 await h.json('/team/invite',{email:'prep@example.test'},h.owner);
 const prep=await h.login('prep@example.test');
 await h.json('/team/rates',{email:'prep@example.test',rateCents:6000,effectiveFrom:'2026-01-01'},h.owner);
 const template=await h.json('/templates',{name:'Integration work',recurrence:'monthly',steps:'Prepare',requests:'Statement'},h.owner);
 const jobs=[];for(const [n,c] of clients.entries()) {
  const j=await h.json('/jobs',{clientId:c.id,templateId:template.id,periodStart:`2026-0${n+1}-01`,dueDate:'2026-11-30',dueNote:'Practitioner recorded',preparerEmail:'prep@example.test',reviewerEmail:'owner@example.test'},h.owner);jobs.push(j);
  await h.json(`/jobs/${j.id}/time`,{date:'2026-10-01',minutes:15,description:'Integration time'},prep);
 }
 return {clients,jobs,prep};
}

test('API-002 / BASE-001 integration lifecycle: principal step-up, bounded paginated reads, action denial, revocation, audit and inactive restore',async()=>{
 const h=await harness();let restored;
 try {
  const {clients,jobs,prep}=await fixture(h);
  await h.json('/integration-keys',{label:'synthetic-blotter-1',reason:'Reviewed workflow',clientIds:[clients[0].id],actions:['clients:read']},h.owner,403);
  const factor=await enroll(h,h.owner);
  const second=await h.login('owner@example.test');
  await h.json('/mfa/verify',{recoveryCode:factor.recovery[0]},second);
  const draft={label:'synthetic-blotter-2',reason:'Reviewed workflow',clientIds:[clients[0].id],actions:['clients:read']};
  assert.equal((await h.send('/api/blotter/integration-keys',draft,second)).status,403,'An MFA session also needs fresh sensitive step-up');
  await h.json('/access/step-up',{recoveryCode:factor.recovery[1]},second);
  const stepped=await h.json('/integration-keys',draft,second);
  await h.json('/integration-keys',draft,prep,403);
  await h.json('/integration-keys',draft,'',401);
  for(const invalid of [{actions:[]},{clientIds:[]},{actions:['billing:charge']},{clientIds:['missing']}])await h.json('/integration-keys',{...draft,...invalid},h.owner,invalid.clientIds?.[0]==='missing'?409:400);
  const key=await mint(h,clients.slice(0,2));
  for(const route of ['clients','work','time']) {
   const seen=[];let cursor;
   do {const result=await h.json(`/v1/${route}?limit=1${cursor?'&cursor='+cursor:''}`,undefined,'',200,bearer(key));seen.push(...result.items);cursor=result.nextCursor;}while(cursor);
   assert.equal(seen.length,2);assert.equal(new Set(seen.map(r=>r.id)).size,2);
   if(route==='clients')assert.deepEqual(seen.map(c=>c.id).sort(),clients.slice(0,2).map(c=>c.id).sort());
   else assert.deepEqual(seen.map(r=>route==='work'?r.id:r.job_id).sort(),jobs.slice(0,2).map(j=>j.id).sort());
  }
  assert.equal((await h.json('/v1/clients?client='+clients[2].id,undefined,'',200,bearer(key))).items.length,0);
  const readOnly=await mint(h,clients.slice(0,2),['clients:read']);
  await h.json('/v1/work',undefined,'',403,bearer(readOnly));
  await h.json('/v1/tasks',{jobId:jobs[0].id,label:'Refused'},'',403,bearer(readOnly));
  await h.json('/state',undefined,'',401,bearer(key));
  await h.json('/v1/billing/exports',undefined,'',403,bearer(key));
  const first=await h.json('/v1/work?limit=1',undefined,'',200,bearer(key));
  const another=await mint(h,clients.slice(0,2),['work:read']);
  await h.json('/v1/work?limit=1&cursor='+first.nextCursor,undefined,'',400,bearer(another));
  await h.json('/integration-keys/'+stepped.id+'/revoke',{reason:'Workflow retired'},h.owner);
  await h.json('/v1/clients',undefined,'',401,bearer(stepped));
  const state=await h.json('/integration-keys',undefined,h.owner);assert.ok(!JSON.stringify(state).includes(key.key));
  const audit=(await h.json('/team',undefined,h.owner)).audit;
  assert.ok(audit.some(a=>a.action==='integration.key_created'&&a.object_id===key.id&&a.actor==='owner@example.test'));
  assert.ok(audit.some(a=>a.action==='integration.read'&&a.object_id===key.id&&a.actor.includes(key.id)));
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  assert.ok(!archive.includes(key.key));
  // Schema evidence names excluded tables; their inventory and rows must stay out.
  for await (const record of readArchive(new Response(archive).body)) {
   if(record.kind==='manifest')assert.ok(!record.tables.some(table=>table.name==='b_integration_limits'));
   if(record.kind==='part')assert.ok(!record.items.some(item=>item.kind==='row'&&item.table==='b_integration_limits'));
  }
  restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
  const restoredKeys=await restored.json('/integration-keys',undefined,restored.owner);
  assert.equal(restoredKeys.keys.find(k=>k.id===key.id).status,'suspended');
  assert.equal(restoredKeys.clients.filter(c=>c.key_id===key.id).length,2);
  await restored.json('/v1/clients',undefined,'',401,bearer(key));
  await h.json('/integration-keys/'+key.id+'/revoke',{reason:'Stop integration'},h.owner);
  await h.json('/v1/work',undefined,'',401,bearer(key));
  assert.equal((await h.send('/auth/email',{email:'principal@example.test'},h.owner)).status,200);
  await h.json('/v1/work',undefined,'',403,bearer(another));
  await h.json('/v1/work',undefined,'',401,bearer(another));
  const changed=await h.json('/integration-keys',undefined,h.owner);assert.equal(changed.keys.find(k=>k.id===another.id).status,'suspended');
  assert.ok((await h.json('/team',undefined,h.owner)).audit.some(a=>a.action==='integration.key_suspended'&&a.object_id===another.id));
 }finally{await restored?.close();await h.close();}
});

test('API-002 integration task events commit once per key, reject changed intent and outside jobs, and never inherit human approval',async()=>{
 const h=await harness();
 try{
  const {clients,jobs}=await fixture(h);await enroll(h,h.owner);
  const key=await mint(h,[clients[0]]),other=await mint(h,[clients[0]]);
  const body={jobId:jobs[0].id,label:'Review synthetic-blotter-3'},headers={...bearer(key),'idempotency-key':'synthetic-blotter-4'};
  const write=(data=body,extra=headers,expected=200)=>h.json('/v1/tasks',data,'',expected,extra);
  const [a,b]=await Promise.all([write(),write()]);assert.equal(a.ordinal,b.ordinal);assert.deepEqual([a.replayed,b.replayed].sort(),[false,true]);
  assert.equal((await write(Object.fromEntries(Object.entries(body).reverse()))).replayed,true);
  await write({...body,label:'Changed intent'},headers,409);
  const second=await write(body,{...headers,...bearer(other)});assert.notEqual(second.ordinal,a.ordinal,'Key replay spaces are independent');
  await write({...body,jobId:jobs[2].id},headers,404);
  await write({...body,label:''},{...headers,'idempotency-key':'synthetic-blotter-5'},400);
  const corrected=await write({...body,label:'Corrected label'},{...headers,'idempotency-key':'synthetic-blotter-5'});assert.equal(corrected.replayed,false);
  await h.json('/v1/clients',{name:'No create grant'},'',403,headers);
  const creator=await mint(h,[clients[0]],['clients:create','clients:read']),creatorTwo=await mint(h,[clients[0]],['clients:create']);
  const creationHeaders={...bearer(creator),'idempotency-key':'synthetic-blotter-8'},entity={name:'Created by approved integration',ein:'927654321'};
  const [created,repeated]=await Promise.all([h.json('/v1/clients',entity,'',200,creationHeaders),h.json('/v1/clients',entity,'',200,creationHeaders)]);
  assert.equal(created.clientId,repeated.clientId);assert.deepEqual([created.replayed,repeated.replayed].sort(),[false,true]);
  assert.deepEqual(Object.keys(created).sort(),['clientId','replayed']);
  const independentlyCreated=await h.json('/v1/clients',entity,'',200,{...creationHeaders,...bearer(creatorTwo)});assert.notEqual(independentlyCreated.clientId,created.clientId);
  await h.json('/v1/clients',{...entity,name:'Changed'},'',409,creationHeaders);
  await h.json('/v1/clients',{...entity,contacts:[{name:'Must need a person'}]},'',400,{...creationHeaders,'idempotency-key':'synthetic-blotter-9'});
  assert.ok((await h.json('/v1/clients',undefined,'',200,bearer(creator))).items.some(c=>c.id===created.clientId));
  const createdDetail=await h.json('/clients/'+created.clientId+'/detail',undefined,h.owner);assert.equal(createdDetail.contacts.length,0);
  await h.json(`/jobs/${jobs[0].id}/review`,{decision:'approve'},'',401,headers);
  let detail=await h.json('/jobs/'+jobs[0].id,undefined,h.owner);assert.equal(detail.steps.filter(s=>s.label===body.label).length,2);
  const history=await h.json('/clients/'+clients[0].id+'/history',undefined,h.owner);assert.ok(JSON.stringify(history).includes(key.id));
  const before=detail.steps.length;
  // Race a real revocation against requests, then prove all requests after its acknowledgment are refused.
  await Promise.all([h.json('/integration-keys/'+key.id+'/revoke',{reason:'Stop events'},h.owner),write({...body,label:'Concurrent event'},{...headers,'idempotency-key':'synthetic-blotter-6'},200).catch(e=>{assert.match(e.message,/401|409|revoked|no longer allowed/);})]);
  await write({...body,label:'After revoke'},{...headers,'idempotency-key':'synthetic-blotter-7'},401);
  detail=await h.json('/jobs/'+jobs[0].id,undefined,h.owner);assert.ok(detail.steps.length===before||detail.steps.length===before+1);assert.ok(!detail.steps.some(s=>s.label==='After revoke'));
  assert.ok((await h.json('/reports/status-time',undefined,h.owner)).length>0);
  assert.deepEqual(await h.json('/reports/status-time?workType=missing',undefined,h.owner),[]);
  await integrationTaskJourney(h,jobs[0].id,body.label);
 }finally{await h.close();}
});

test('API-002 integration requests share a durable rolling limit per key without throttling another key',async()=>{
 const h=await harness();
 try{
  const client=await h.json('/clients',{name:'Rate scope'},h.owner);await enroll(h,h.owner);
  const key=await mint(h,[client],['clients:read']),other=await mint(h,[client],['clients:read']);
  const requests=Array.from({length:64},()=>h.send('/api/blotter/v1/clients',undefined,'',bearer(key)));
  const results=await Promise.all(requests);
  assert.equal(results.filter(r=>r.status===200).length,60);assert.equal(results.filter(r=>r.status===429).length,4);
  assert.equal((await results.find(r=>r.status===429).json()).retryAfter,60);
  await h.restart();await h.json('/v1/clients',undefined,'',429,bearer(key));
  assert.equal((await h.json('/v1/clients',undefined,'',200,bearer(other))).items[0].id,client.id);
 }finally{await h.close();}
});

test('API-002 / ERASURE-002 key scopes are removed with a client, single-client keys suspend, outside copies are named and stale restore is refused',async()=>{
 const h=await harness();
 try{
  const a=await h.json('/clients',{name:'Erase integration subject'},h.owner),b=await h.json('/clients',{name:'Retained integration subject'},h.owner);await enroll(h,h.owner);
  const solo=await mint(h,[a],['clients:read']),shared=await mint(h,[a,b],['clients:read']);
  await h.json('/v1/clients',undefined,'',200,bearer(shared));
  const twin=await h.json('/clients',{name:'Merged integration subject'},h.owner),childSolo=await mint(h,[twin],['clients:read']),childShared=await mint(h,[twin,b],['clients:read']);
  await h.json('/v1/clients',undefined,'',200,bearer(childShared));
  await h.json('/clients/merge',{survivor:a.id,merged:twin.id,keep:{name:'survivor'}},h.owner);
  assert.deepEqual((await h.json('/v1/clients',undefined,'',200,bearer(childShared))).items.map(c=>c.id),[b.id],'Merging never widens a key to the survivor');
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  let d=await h.json(`/clients/${a.id}/detail`,undefined,h.owner);await h.json(`/clients/${a.id}/lifecycle`,{lifecycle:'archived',revision:d.revision},h.owner);
  const preview=await h.json(`/clients/${a.id}/erasure/preview`,undefined,h.owner);assert.equal(preview.eligible,true);assert.ok(JSON.stringify(preview).includes('integration key'));
  const receipt=await h.json(`/clients/${a.id}/erasure`,{planHash:preview.planHash,confirm:a.name,reason:'Confirmed client erasure'},h.owner);
  assert.deepEqual(receipt.keys,{rescoped:2,suspended:2});
  const state=await h.json('/integration-keys',undefined,h.owner);assert.equal(state.keys.find(k=>k.id===solo.id).status,'suspended');assert.ok(!state.clients.some(c=>[a.id,twin.id].includes(c.client_id)));assert.equal(state.keys.find(k=>k.id===childSolo.id).status,'suspended');
  await h.json('/v1/clients',undefined,'',401,bearer(solo));
  assert.deepEqual((await h.json('/v1/clients',undefined,'',200,bearer(shared))).items.map(c=>c.id),[b.id]);
  await h.json('/restore',{archive,confirm:'RESTORE'},h.owner,409);
 }finally{await h.close();}
});

test('API-002 scoped document and billing metadata are paginated without bytes, snapshots, payment credentials or financial execution',async()=>{
 const h=await harness();
 try{
  const {clients,jobs,prep}=await fixture(h);await enroll(h,h.owner);
  const key=await mint(h,[clients[0]],['documents:metadata','billing:metadata']);
  const headers=bearer(key),fileIds=[];
  for(const [index,j] of jobs.entries()) {
   const detail=await h.json('/jobs/'+j.id,undefined,prep);
   for(let n=0;n<2;n++)fileIds.push(await h.json(`/requests/${detail.requests[0].id}/files`,{name:`synthetic-blotter-${20+index*2+n}.txt`,mime:['text','plain'].join('/'),contentBase64:Buffer.from('Private original bytes').toString('base64')},prep));
  }
  const first=await h.json('/v1/documents?limit=1',undefined,'',200,headers);assert.equal(first.items.length,1);assert.ok(first.nextCursor);
  const second=await h.json('/v1/documents?limit=1&cursor='+encodeURIComponent(first.nextCursor),undefined,'',200,headers);assert.notEqual(first.items[0].id,second.items[0].id);assert.equal(second.nextCursor,null);
  assert.ok([...first.items,...second.items].every(f=>f.client_id===clients[0].id&&f.name&&f.sha256&&!('content_base64'in f)));assert.ok(!JSON.stringify(first).includes('Private original bytes'));
  assert.equal((await h.json('/v1/documents?client='+clients[2].id,undefined,'',200,headers)).items.length,0);
  await h.json('/v1/billing/invoices?cursor='+encodeURIComponent(first.nextCursor),undefined,'',400,headers);
  await h.json('/firm',{name:'Synthetic Blotter Practice'},h.owner);
  await h.json('/invoices/authority',{authority:'blotter',reason:'Sole invoice authority'},h.owner);
  for(const [index,j]of jobs.entries()){
   const contact=await h.json(`/clients/${clients[index].id}/contacts`,{name:'Billing contact',email:`billing${index}@example.test`,roles:['billing'],authorized:true,portal:true,requestConsent:true,emailConsent:true},h.owner);
   const entitlement=await h.json('/invoice-entitlements',{jobId:j.id,kind:'fixed',reference:'synthetic-blotter-30',description:'Private agreed scope narrative',amountCents:1200,authorization:'Client accepted supplied scope'},h.owner);
   const input={jobId:j.id,sourceKeys:[entitlement.sourceKey],contactId:contact.id,title:'Private invoice title',issueDate:'2026-10-01',dueDate:'2026-11-30',terms:'Supplied payment terms',taxCents:0,taxTreatment:'No sales tax under supplied treatment',taxAuthorization:'Principal reviewed supplied tax instruction'};
   const preview=await h.json('/invoices/preview',input,h.owner);await h.json('/invoices',{...input,previewHash:preview.previewHash},h.owner);
  }
  const bills=await h.json('/v1/billing/invoices',undefined,'',200,headers);assert.equal(bills.items.length,1);assert.equal(bills.items[0].client_id,clients[0].id);assert.equal(bills.items[0].total_cents,1200);
  const withoutBilling=await mint(h,[clients[0]],['documents:metadata']);await h.json('/v1/billing/invoices',undefined,'',403,bearer(withoutBilling));
  for(const forbidden of ['snapshot','pdf_base64','customer_id','method_id','title'])assert.ok(!(forbidden in bills.items[0]));
  assert.ok(!JSON.stringify(bills).includes('Private'));
  await h.json('/invoice-credits',{clientId:clients[0].id,amountCents:100},'',401,headers);
  await h.json('/v1/billing/invoices',{amountCents:100},'',403,headers);
 }finally{await h.close();}
});
