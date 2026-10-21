// Configurable least-privilege authority through the built Worker's public doors.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {harness} from './harness.mjs';
import {permissionsJourney} from './permissions-ui.mjs';
const totp=(secret,offset=0)=>{
 let bits=0,value=0;const key=[];for(const c of secret){value=(value<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);bits+=5;if(bits>=8){key.push((value>>>(bits-8))&255);bits-=8;}}
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)+offset));const mac=createHmac('sha1',Buffer.from(key)).update(counter).digest(),o=mac[19]&15;return String((mac.readUInt32BE(o)&0x7fffffff)%1e6).padStart(6,'0');
};
async function enroll(h,cookie){const x=await h.json('/mfa/totp/start',{},cookie);return (await h.json('/mfa/totp/confirm',{id:x.id,code:totp(x.secret,-1)},cookie)).recoveryCodes;}

test('Client teams overlap; read-only and sensitive workpaper authority, revocation, exports, background delivery and coverage use live grants',async()=>{
 const h=await harness();let destination,stale;
 try{
  for(const [email,role] of [['a@example.test','reviewer'],['b@example.test','reviewer'],['read@example.test','reviewer'],['prep@example.test','preparer'],['outside@example.test','reviewer']]){await h.json('/team',{email,name:email,role},h.owner);await h.json('/team/invite',{email},h.owner);}
  const a=await h.login('a@example.test'),b=await h.login('b@example.test'),read=await h.login('read@example.test');
  const clients=[];for(const name of ['Cedar Lane LLC','Harbor Studio LLC','Maple Partners LLC'])clients.push(await h.json('/clients',{name,ein:'123456789',contacts:[{name:'Alex Client',email:`client${clients.length}@example.test`,authorized:true,portal:true,requestConsent:true,emailConsent:true,roles:['primary']}]},h.owner));
  const spare=await h.json('/clients',{name:'Juniper Archive LLC'},h.owner);
  const t=await h.json('/templates',{name:'Monthly close',recurrence:'monthly',steps:'Review ledger',requests:'Workpaper',feeCents:12000},h.owner);
  const jobs=[];for(const client of clients)jobs.push(await h.json('/jobs',{clientId:client.id,templateId:t.id,periodStart:'2026-10-01',dueDate:'2026-10-28',dueNote:'Client schedule',preparerEmail:'prep@example.test',reviewerEmail:'a@example.test'},h.owner));
  const detail=await h.json('/jobs/'+jobs[0].id,undefined,h.owner),request=detail.requests[0];
  const file=await h.json(`/requests/${request.id}/files`,{name:'Confidential return.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-1 private taxpayer workpaper').toString('base64')},h.owner);
  const fileId=file.id??(await h.json('/jobs/'+jobs[0].id,undefined,h.owner)).requests[0].files[0].id;
  const contact=clients[0].contacts[0];
  let access=await h.json(`/documents/${fileId}/access`,undefined,h.owner);
  access=await h.json(`/documents/${fileId}/access`,{revision:access.revision,visibility:'contacts',contactIds:[contact.id]},h.owner);
  const share=await h.json(`/documents/${fileId}/shares`,{revision:access.revision,contactId:contact.id},h.owner);
  assert.equal((await h.request('/api/blotter/shared-files/'+share.token)).status,200);
  const codes=await enroll(h,h.owner);
  await h.json('/access/teams',{name:'Tax team',emails:['a@example.test'],clientIds:[clients[0].id,clients[1].id]},h.owner,403);
  await h.json('/access/step-up',{recoveryCode:codes[0]},h.owner);
  const tax=await h.json('/access/teams',{name:'Tax team',emails:['a@example.test'],clientIds:[clients[0].id,clients[1].id]},h.owner);
  await h.json('/access/teams',{name:'Bookkeeping team',emails:['b@example.test'],clientIds:[clients[1].id,clients[2].id]},h.owner);
  await h.json('/access/people',{email:'read@example.test',readOnly:true,clientIds:[clients[0].id,spare.id]},h.owner);
  await h.json('/access/people',{email:'prep@example.test',readOnly:false,clientIds:clients.map(c=>c.id)},h.owner);
  assert.deepEqual((await h.json('/state',undefined,a)).clients.map(c=>c.name).sort(),[clients[0].name,clients[1].name].sort());
  assert.deepEqual((await h.json('/v1/clients',undefined,b)).items.map(c=>c.id).sort(),[clients[1].id,clients[2].id].sort());
  await h.json('/jobs/'+jobs[2].id,undefined,a,404);
  assert.deepEqual((await h.json('/v1/work',undefined,read)).items.map(j=>j.id),[jobs[0].id]);
  await h.json(`/jobs/${jobs[0].id}/steps`,{ordinal:1,done:true},read,403);
  await h.json('/clients',{name:'Cannot write'},read,403);
  await h.json(`/access/documents/${fileId}`,{classification:'Tax return',reason:'Private return restricted to tax reviewer',emails:['a@example.test']},h.owner);
  assert.equal((await h.request('/api/blotter/files/'+fileId,undefined,a)).status,200);
  await h.json('/files/'+fileId,undefined,read,404);
  await h.json(`/document-packets/${fileId}/annotations`,undefined,read,404);
  const readDetail=JSON.stringify(await h.json('/jobs/'+jobs[0].id,undefined,read));
  assert.ok(!readDetail.includes('Confidential return')&&!readDetail.includes('123456789'));
  assert.equal((await h.json('/search?q=private',undefined,read)).results.length,0);
  assert.equal((await h.request('/api/blotter/shared-files/'+share.token)).status,404);
  await h.json(`/documents/${fileId}/access`,{revision:(await h.json(`/documents/${fileId}/access`,undefined,h.owner)).revision,visibility:'contacts',contactIds:[contact.id]},h.owner,403);
  // The same signed-in session loses its grant on its very next request.
  await h.json('/access/teams',{id:tax.id,name:'Tax team',emails:['a@example.test'],clientIds:[]},h.owner);
  await h.json('/jobs/'+jobs[0].id,undefined,a,404);
  await h.json('/files/'+fileId,undefined,a,404);
  assert.equal((await h.json('/state',undefined,a)).jobs.length,0);
  assert.equal((await h.json('/search?q=Cedar',undefined,a)).results.length,0);
  // A background task rechecks recipient authority before provider submission.
  const at=new Date().toISOString();
  await h.db.prepare("INSERT INTO b_notifications(id,to_email,kind,job_id,summary,delivery,created_at) VALUES('synthetic-blotter-1','a@example.test','mention',?,'synthetic-blotter-1 private notification','deferred: outside firm notification hours',?)").bind(jobs[0].id,at).run();
  const before=h.mails.length;await h.scheduled('2026-10-28T15:00:00Z');
  assert.ok(!h.mails.slice(before).some(m=>JSON.stringify(m).includes('synthetic-blotter-1 private notification')));
  assert.ok(!(await h.json('/notifications',undefined,a)).some(n=>n.id==='synthetic-blotter-1'));
  const plan=await h.json('/coverage/preview',{email:'prep@example.test',startsOn:'2026-10-26',endsOn:'2026-10-30'},h.owner);
  assert.ok(plan.lines.every(l=>l.to?.preparer!=='outside@example.test'&&l.to?.reviewer!=='outside@example.test'));
  const denied=await h.json('/coverage/preview',{email:'prep@example.test',startsOn:'2026-10-26',endsOn:'2026-10-30',choices:[{jobId:jobs[0].id,preparerEmail:'outside@example.test'}]},h.owner);
  assert.ok(denied.lines.some(l=>l.action==='conflict'&&l.reasons.some(r=>/client grant/.test(r))));
  await h.json('/coverage',{email:'prep@example.test',startsOn:'2026-10-26',endsOn:'2026-10-30',choices:[{jobId:jobs[0].id,preparerEmail:'outside@example.test'}],fingerprint:denied.fingerprint},h.owner,409);
  // Fresh export authority belongs to this session, not its sign-in check.
  const other=await h.login('owner@example.test');await h.json('/mfa/verify',{recoveryCode:codes[1]},other);
  await h.json('/backup',undefined,other,403);
  await h.json('/access/step-up',{recoveryCode:codes[2]},other);
  const archive=await(await h.request('/api/blotter/backup',undefined,other)).text();
  const archiveRows=archive.trim().split('\n').map(JSON.parse).filter(r=>r.kind==='part').flatMap(p=>p.items).filter(r=>r.kind==='row');
  assert.ok(archiveRows.some(r=>r.table==='b_access_team_clients')&&!archiveRows.some(r=>r.table==='b_access_stepups'));
  await h.json('/backup',undefined,a,403);
  const audit=(await h.json('/team',undefined,h.owner)).audit;
  assert.ok(audit.some(e=>e.action==='access.document_restricted')&&audit.some(e=>e.action==='access.step_up'));
  // New stores participate in the registry and client erasure scope.
  const preview=await h.json(`/clients/${clients[0].id}/erasure/preview`,undefined,h.owner);
  assert.ok(!preview.blockers.some(b=>/Unclassified/.test(b)));
  assert.ok(preview.erase.some(s=>s.table==='b_access_grants'));
  destination=await harness();await destination.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},destination.owner);
  const restored=await destination.json('/access',undefined,destination.owner);
  assert.equal(restored.teams.length,2);assert.ok(restored.members.find(m=>m.email==='read@example.test').read_only);
  await h.json(`/clients/${spare.id}/lifecycle`,{revision:(await h.json(`/clients/${spare.id}/detail`,undefined,h.owner)).revision,lifecycle:'archived'},h.owner);
  const scope=await h.json(`/clients/${spare.id}/erasure/preview`,undefined,h.owner);
  assert.equal(scope.eligible,true,JSON.stringify(scope.blockers));
  const erased=await h.json(`/clients/${spare.id}/erasure`,{planHash:scope.planHash,confirm:spare.name,reason:'Client request'},h.owner);
  assert.ok(erased.steps.some(s=>s.table==='b_access_grants'&&s.count===1));
  assert.ok(!(await h.json('/access',undefined,h.owner)).grants.some(g=>g.client_id===spare.id));
  const newer=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  stale=await harness();await stale.json('/restore',{archive,journal:newer,confirm:'RESTORE'},stale.owner,409);
  if(process.env.BLOTTER_PERMISSION_EVIDENCE)await permissionsJourney(h,clients[0].name,read,codes[3]);
 }finally{await stale?.close();await destination?.close();await h.close();}
});
