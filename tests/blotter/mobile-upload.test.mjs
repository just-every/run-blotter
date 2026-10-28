import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { harness } from './harness.mjs';
import { accountingPacket } from './document-packet-fixture.mjs';
import { mobileUploadJourney } from './mobile-ui.mjs';
const hash = b => createHash('sha256').update(b).digest('hex');
const tokenOf = r => new URL(r.portalUrl).pathname.split('/').at(-1);
let serial=0;
const person = (name, email) => ({name,email,roles:['primary'],authorized:true,portal:true,requestConsent:true,emailConsent:true});
const chunk = (bytes, offset=0) => { const b=bytes.subarray(offset,offset+262144); return {offset,chunkId:'chunk-'+offset,sha256:hash(b),contentBase64:b.toString('base64')}; };
const meta = bytes => ({name:'synthetic-blotter-982.pdf',mime:'application/pdf',size:bytes.length,sha256:hash(bytes),pageCount:8});
async function fixture(h) {
 const seq=++serial;
 const client=await h.json('/clients',{name:'synthetic-blotter-982-'+seq,contacts:[person('First contact','first@example.test'),person('Other contact','other@example.test')]},h.owner);
 const template=await h.json('/templates',{name:'Upload recovery '+seq,recurrence:'monthly',steps:'Review',requests:'Multi-page statement\nOther evidence'},h.owner);
 const job=await h.json('/jobs',{clientId:client.id,templateId:template.id,periodStart:'2034-04-01',dueDate:'2034-05-15',dueNote:'Agreed',preparerEmail:'owner@example.test',reviewerEmail:'owner@example.test'},h.owner);
 const requests=(await h.json('/jobs/'+job.id,undefined,h.owner)).requests;
 const token=tokenOf(await h.json(`/jobs/${job.id}/reminders`,{contactId:client.contacts[0].id},h.owner));
 const root='/portal/'+token, path=root+'/requests/'+requests[0].id+'/packet-uploads';
 return {client,job,requests,token,root,path};
}
async function finish(h,f,u,bytes) {
 while(u.receivedBytes<bytes.length)u=await h.json(f.root+'/packet-uploads/'+u.id+'/chunks',chunk(bytes,u.receivedBytes));
 const results=await Promise.all(Array.from({length:3},()=>h.json(f.root+'/packet-uploads/'+u.id+'/complete',{})));
 assert.deepEqual(results.map(r=>r.fileId),[results[0].fileId,results[0].fileId,results[0].fileId],'Concurrent completion returns the same original');
 return results[0];
}
const archiveRows = archive => archive.trim().split('\n').map(JSON.parse).filter(p=>p.kind==='part').flatMap(p=>p.items).filter(i=>i.kind==='row');

test('MOBILE-001 browser recovery preserves one exact original, attributed custody, excluded staging and erased stale-restore fencing',async()=>{
 const h=await harness();let restored;
 try{
  const f=await fixture(h),bytes=accountingPacket(false,8);
  let u=await h.json(f.path,meta(bytes));
  const first=chunk(bytes);
  u=await h.json(f.root+'/packet-uploads/'+u.id+'/chunks',first);
  assert.equal(u.receivedBytes,262144);
  assert.equal((await h.json(f.root+'/packet-uploads/'+u.id+'/chunks',first)).receivedBytes,262144,'Lost chunk response replays without double counting');
  await h.json(f.root+'/packet-uploads/'+u.id+'/chunks',chunk(Buffer.alloc(bytes.length,1)),undefined,409);
  await h.json(f.root+'/packet-uploads/'+u.id+'/complete',{},undefined,409);
  assert.equal((await h.json(f.path))[0].receivedBytes,262144,'Fresh page discovers confirmed progress');
  u=await finish(h,f,u,bytes);
  const replay=await Promise.all([h.json(f.root+'/packet-uploads/'+u.id+'/complete',{}),h.json(f.root+'/packet-uploads/'+u.id+'/complete',{})]);
  assert.deepEqual(replay.map(r=>r.fileId),[u.fileId,u.fileId]);
  const d=await h.json('/jobs/'+f.job.id,undefined,h.owner);
  assert.deepEqual(d.requests.flatMap(r=>r.files).map(r=>[r.id,r.uploaded_by,r.channel]),[[u.fileId,'portal contact '+f.client.contacts[0].id,'portal']]);
  const history=await h.json('/clients/'+f.client.id+'/history',undefined,h.owner);
  assert.equal(history.history.filter(r=>r.action==='file.uploaded'&&r.object_id===u.fileId).length,1,'Completion audit occurs once');
  assert.deepEqual(Buffer.from(await(await h.request('/api/blotter/files/'+u.fileId,undefined,h.owner)).arrayBuffer()),bytes);
  const pending=await h.json(f.path,meta(bytes));await h.json(f.root+'/packet-uploads/'+pending.id+'/chunks',first);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  assert.equal(archiveRows(archive).some(r=>['b_document_uploads','b_document_upload_chunks','b_portal_links'].includes(r.table)),false);
  restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
  assert.deepEqual(Buffer.from(await(await restored.request('/api/blotter/files/'+u.fileId,undefined,restored.owner)).arrayBuffer()),bytes);
  await restored.json(f.root+'/packet-uploads/'+u.id,undefined,undefined,404);
  await h.json('/files/'+u.fileId+'/erase',{confirm:meta(bytes).name,reason:'Client retention request'},h.owner);
  assert.equal((await h.request('/api/blotter/files/'+u.fileId,undefined,h.owner)).status,404);
  await h.json(f.root+'/packet-uploads/'+pending.id,undefined,undefined,404);
  const journal=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  assert.equal(archiveRows(journal).some(r=>r.table==='b_document_chunks'&&r.row.file_id===u.fileId),false);
  await restored.close();restored=await harness();
  await restored.json('/restore',{archive,journal,confirm:'RESTORE'},restored.owner,409);
  const browserFixture=await fixture(h);await mobileUploadJourney(h,browserFixture,bytes);
 }finally{await restored?.close();await h.close();}
});

test('MOBILE-001 portal upload effects refuse foreign, replaced, expired, revoked and closed authority; cancellation and expiry destroy staging',async()=>{
 const h=await harness();
 try{
  const f=await fixture(h),bytes=accountingPacket(false,8),u=await h.json(f.path,meta(bytes));
  await h.json('/packet-uploads/'+u.id,undefined,h.owner,404);
  assert.deepEqual(await h.json('/jobs/'+f.job.id+'/packet-uploads',undefined,h.owner),[],'Staff recovery never forwards portal authority');
  const other=tokenOf(await h.json('/jobs/'+f.job.id+'/reminders',{contactId:f.client.contacts[1].id},h.owner));
  for(const tail of ['', '/chunks','/complete','/cancel'])await h.json('/portal/'+other+'/packet-uploads/'+u.id+tail,tail?tail==='/chunks'?chunk(bytes):{}:undefined,undefined,404);
  const g=await fixture(h);
  await h.json(g.root+'/requests/'+f.requests[0].id+'/packet-uploads',meta(bytes),undefined,404);
  await h.json(f.path,meta(bytes),undefined,403,{origin:'https://outside.example.test'});
  const replacement=tokenOf(await h.json('/jobs/'+f.job.id+'/reminders',{contactId:f.client.contacts[0].id},h.owner));
  for(const tail of ['', '/chunks','/complete','/cancel'])await h.json(f.root+'/packet-uploads/'+u.id+tail,tail?tail==='/chunks'?chunk(bytes):{}:undefined,undefined,404);
  await h.json('/portal/'+replacement+'/packet-uploads/'+u.id,undefined,undefined,404,'');
  const cancelled=await h.json(g.path,meta(bytes));await h.json(g.root+'/packet-uploads/'+cancelled.id+'/chunks',chunk(bytes));
  await h.json(g.root+'/packet-uploads/'+cancelled.id+'/cancel',{});await h.json(g.root+'/packet-uploads/'+cancelled.id,undefined,undefined,404);
  const expiring=await h.json(g.path,meta(bytes));await h.json(g.root+'/packet-uploads/'+expiring.id+'/chunks',chunk(bytes));
  await h.scheduled(new Date(Date.now()+8*86400000).toISOString());await h.json(g.root+'/packet-uploads/'+expiring.id,undefined,undefined,404);
  const expired=await fixture(h),expiredUpload=await h.json(expired.path,meta(bytes));
  // Fixture clock: expire only this issued link, then assert every public effect refuses.
  await h.db.prepare('UPDATE b_portal_links SET expires_at=? WHERE job_id=?').bind('2000-01-01T00:00:00.000Z',expired.job.id).run();
  await h.json(expired.path,meta(bytes),undefined,404);
  for(const tail of ['', '/chunks','/complete','/cancel'])await h.json(expired.root+'/packet-uploads/'+expiredUpload.id+tail,tail?tail==='/chunks'?chunk(bytes):{}:undefined,undefined,404);
  const grant=await fixture(h),grantUpload=await h.json(grant.path,meta(bytes)),grantContact=grant.client.contacts[0].id;
  await h.json(`/clients/${grant.client.id}/contacts/${grantContact}/portal-invite`,{},h.owner);
  await h.json(`/clients/${grant.client.id}/contacts/${grantContact}/portal-revoke`,{reason:'Authority ended'},h.owner);
  await h.json(grant.path,meta(bytes),undefined,404);
  for(const tail of ['', '/chunks','/complete','/cancel'])await h.json(grant.root+'/packet-uploads/'+grantUpload.id+tail,tail?tail==='/chunks'?chunk(bytes):{}:undefined,undefined,404);
  await h.json(`/clients/${grant.client.id}/contacts/${grantContact}/portal-invite`,{},h.owner);
  await h.json(grant.root+'/packet-uploads/'+grantUpload.id,undefined,undefined,404);
  const revoked=await h.json(g.path,meta(bytes));
  const contact=(await h.json('/clients/'+g.client.id+'/contacts',undefined,h.owner))[0];
  await h.json('/clients/'+g.client.id+'/contacts',{id:contact.id,revision:contact.revision,portal:false},h.owner);
  for(const tail of ['', '/chunks','/complete','/cancel'])await h.json(g.root+'/packet-uploads/'+revoked.id+tail,tail?tail==='/chunks'?chunk(bytes):{}:undefined,undefined,404);
  const closed=await fixture(h),pending=await h.json(closed.path,meta(bytes));
  for(const request of closed.requests){await h.json('/requests/'+request.id+'/files',{name:'statement.txt',contentBase64:Buffer.from('synthetic-blotter-982').toString('base64')},h.owner);await h.json('/requests/'+request.id+'/decide',{decision:'accept'},h.owner);}
  await h.json('/jobs/'+closed.job.id+'/steps',{ordinal:1,done:true},h.owner);
  const d=await h.json('/jobs/'+closed.job.id,undefined,h.owner);await h.json('/jobs/'+closed.job.id+'/submit',{revision:d.job.revision},h.owner);
  await h.json(closed.path,meta(bytes),undefined,410);
  for(const tail of ['', '/chunks','/complete','/cancel'])await h.json(closed.root+'/packet-uploads/'+pending.id+tail,tail?tail==='/chunks'?chunk(bytes):{}:undefined,undefined,410);
 }finally{await h.close();}
});
