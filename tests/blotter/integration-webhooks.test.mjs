import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { harness } from './harness.mjs';
import { enroll } from './erasure-fixture.mjs';

async function setup(h) {
 for(const [email,role] of [['prep@example.test','preparer'],['reviewer@example.test','reviewer']]){await h.json('/team',{email,name:role,role},h.owner);await h.json('/team/invite',{email},h.owner);}
 const prep=await h.login('prep@example.test'),reviewer=await h.login('reviewer@example.test');
 const client=await h.json('/clients',{name:'Never in a webhook payload'},h.owner);
 const other=await h.json('/clients',{name:'Outside webhook scope'},h.owner);
 const template=await h.json('/templates',{name:'Webhook completion',recurrence:'monthly',steps:'Prepare',requests:'Statement'},h.owner);
 const start=(c,month)=>h.json('/jobs',{clientId:c.id,templateId:template.id,periodStart:`2026-${month}-01`,dueDate:'2026-11-30',dueNote:'Practitioner recorded',preparerEmail:'prep@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
 const finish=async j=>{let d=await h.json('/jobs/'+j.id,undefined,prep);await h.json(`/requests/${d.requests[0].id}/files`,{name:'private.txt',mime:['text','plain'].join('/'),contentBase64:Buffer.from('Never in a webhook body').toString('base64')},prep);await h.json(`/requests/${d.requests[0].id}/decide`,{decision:'accept'},prep);await h.json(`/jobs/${j.id}/steps`,{ordinal:1,done:true},prep);d=await h.json('/jobs/'+j.id,undefined,prep);d=await h.json(`/jobs/${j.id}/submit`,{revision:d.job.revision},prep);await h.json(`/jobs/${j.id}/review`,{revision:d.job.revision,decision:'signoff',note:'Private reviewer note'},reviewer);};
 await enroll(h,h.owner);
 const key=await h.json('/integration-keys',{label:'synthetic-blotter-10',reason:'Completion integration only',actions:['webhooks:completion'],clientIds:[client.id]},h.owner);
 return {client,other,key,start,finish,prep,reviewer};
}

test('API-002 / BASE-001 thin signed completion webhooks: no backfill, scoped events, once-only delivery, uncertain recovery, revocation, erasure and inactive restore',async()=>{
 const received=[];let reply=200;
 const h=await harness({webhookResponse:async request=>{received.push({body:await request.text(),signature:request.headers.get('blotter-signature'),event:request.headers.get('blotter-event-id')});if(reply==='lost')throw new Error('Synthetic network interruption');return new Response('',{status:reply});}});let restored;
 try{
  const s=await setup(h),historic=await s.start(s.client,'01');await s.finish(historic);
  const config={keyId:s.key.id,label:'synthetic-blotter-11',url:'https://hooks.zapier.com/synthetic-blotter-12',reason:'Explicit completion notices, metadata only'};
  await h.json('/integration-webhooks',config,s.prep,403);
  for(const url of ['http://hooks.zapier.com/','https://127.0.0.1/','https://localhost/','https://hooks.zapier.com:8443/','https://user:password@hooks.zapier.com/'])await h.json('/integration-webhooks',{...config,url},h.owner,400);
  const hook=await h.json('/integration-webhooks',config,h.owner);
  assert.ok(hook.signingSecret);
  const retiredHook=await h.json('/integration-webhooks',{...config,label:'Retired endpoint'},h.owner);
  await h.json('/integration-webhooks/'+retiredHook.id+'/revoke',{reason:'Destination retired before activation'},h.owner);
  await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,0,'No historical completion backfill');
  const outside=await s.start(s.other,'02');await s.finish(outside);await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,0,'No event outside key scope');
  const live=await s.start(s.client,'03');await s.finish(live);
  await Promise.all([h.json('/integration-webhook-run',{},h.owner),h.json('/integration-webhook-run',{},h.owner)]);assert.equal(received.length,1);
  const event=JSON.parse(received[0].body);assert.deepEqual(Object.keys(event).sort(),['clientId','id','occurredAt','type','version','workId']);assert.equal(event.workId,live.id);assert.equal(event.clientId,s.client.id);assert.equal(event.type,'work.completed');assert.equal(received[0].event,event.id);
  const [timestamp,mac]=received[0].signature.split(',');assert.equal(mac,'v1='+createHmac('sha256',hook.signingSecret).update(timestamp.slice(2)+'.'+received[0].body).digest('hex'));assert.ok(!received[0].body.includes('Private'));
  await h.restart();await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,1,'Restart never repeats accepted events');
  reply=503;const refused=await s.start(s.client,'04');await s.finish(refused);await h.json('/integration-webhook-run',{},h.owner);
  let history=await h.json('/integration-webhooks',undefined,h.owner),held=history.deliveries.find(d=>d.job_id===refused.id);assert.equal(held.status,'held');assert.match(held.next_action,/confirm nonacceptance/);
  await h.json(`/integration-deliveries/${held.id}/replay`,{reason:'Blind retry'},h.owner,409);
  await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,2,'Non-success never retries automatically');
  await h.json(`/integration-deliveries/${held.id}/reconcile`,{outcome:'not_accepted',reason:'Receiver confirmed no event was accepted'},h.owner);
  await h.json(`/integration-deliveries/${held.id}/replay`,{reason:'Receiver repaired and nonacceptance confirmed'},h.owner);reply=200;
  await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,3);assert.equal(received[2].event,received[1].event,'Replay keeps a stable receiver deduplication id');
  reply='lost';const uncertain=await s.start(s.client,'05');await s.finish(uncertain);await h.json('/integration-webhook-run',{},h.owner);history=await h.json('/integration-webhooks',undefined,h.owner);held=history.deliveries.find(d=>d.job_id===uncertain.id);assert.equal(held.status,'held');
  await h.restart();await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,4,'Uncertain network outcome stays held after restart');
  await h.json(`/integration-deliveries/${held.id}/reconcile`,{outcome:'accepted',reason:'Receiver confirmed acceptance despite lost response'},h.owner);await h.json(`/integration-deliveries/${held.id}/replay`,{reason:'Must not repeat'},h.owner,409);
  assert.ok(!JSON.stringify(history).includes(hook.signingSecret));assert.ok(!JSON.stringify(history).includes(config.url));
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.ok(!archive.includes(hook.signingSecret));assert.ok(!archive.includes(config.url));
  restored=await harness({webhookResponse:async()=>assert.fail('Restored webhook must be inactive')});await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
  assert.equal((await restored.json('/integration-webhooks',undefined,restored.owner)).hooks.find(r=>r.id===hook.id).status,'inactive');await restored.json('/integration-webhook-run',{},restored.owner);
  reply=503;const erasedEvent=await s.start(s.client,'06');await s.finish(erasedEvent);await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,5);
  const client=await h.json(`/clients/${s.client.id}/detail`,undefined,h.owner);await h.json(`/clients/${s.client.id}/lifecycle`,{lifecycle:'archived',revision:client.revision},h.owner);
  const preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.equal(preview.eligible,true);assert.ok(preview.externalCopies.some(c=>c.source==='integration-webhooks'));
  const receipt=await h.json(`/clients/${s.client.id}/erasure`,{planHash:preview.planHash,confirm:s.client.name,reason:'Confirmed integration subject erasure'},h.owner);assert.equal(receipt.keys.suspended,1);
  history=await h.json('/integration-webhooks',undefined,h.owner);assert.equal(history.deliveries.find(d=>d.job_id===erasedEvent.id).status,'record_erased');
  await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,5,'Erased records cannot be replayed');
  await h.json('/restore',{archive,confirm:'RESTORE'},h.owner,409);
  await h.json('/integration-keys/'+s.key.id+'/revoke',{reason:'Integration retired'},h.owner);await h.json('/integration-webhook-run',{},h.owner);assert.equal(received.length,5);
  const audit=(await h.json('/team',undefined,h.owner)).audit;assert.ok(audit.some(a=>a.action==='integration.webhook_registered'&&a.object_id===hook.id));assert.ok(audit.some(a=>a.action==='integration.webhook_reconciled'&&a.object_id===held.id));
 }finally{await restored?.close();await h.close();}
});
