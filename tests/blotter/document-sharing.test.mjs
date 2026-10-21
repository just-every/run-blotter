import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const b64=x=>Buffer.from(x).toString('base64');
const person=(name,email)=>({name,email,roles:['primary'],authorized:true,portal:true,requestConsent:true,emailConsent:true});
const ref=x=>encodeURIComponent(x);
const linkToken=r=>new URL(r.portalUrl).pathname.split('/').at(-1);

test('BASE-001 / DOC-002 internal workpapers and selected-contact packets: public previews, scoped reads, expiring rotated/revoked shares, authority withdrawal, audit and portable grants without tokens',async()=>{
 const h=await harness();let target;
 try{
  for(const email of ['prep@example.test','outside@example.test']){await h.json('/team',{email,name:email,role:'preparer'},h.owner);await h.json('/team/invite',{email},h.owner)}
  const prep=await h.login('prep@example.test'),outside=await h.login('outside@example.test');
  const c=await h.json('/clients',{name:'Chen Tax LLC',contacts:[person('Mia Chen','mia@example.test'),person('Luis Garcia','luis@example.test')]},h.owner),a=c.contacts.find(x=>x.email==='mia@example.test'),b=c.contacts.find(x=>x.email==='luis@example.test');
  const other=await h.json('/clients',{name:'Unrelated Entity',contacts:[person('Other Contact','third@example.test')]},h.owner);
  const template=await h.json('/templates',{name:'Annual return',recurrence:'annual',tasks:[{label:'Prepare',assignee:'preparer',requiresAttachment:true}],requests:'Final packet\nTax payment confirmation'},h.owner);
  const job=await h.json('/jobs',{clientId:c.id,templateId:template.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Recorded deadline',preparerEmail:'prep@example.test',reviewerEmail:'owner@example.test'},h.owner);
  const request=(await h.json(`/jobs/${job.id}`,undefined,h.owner)).requests[0];
  const upload=async(name,bytes)=>h.json(`/requests/${request.id}/files`,{name,mime:'application/pdf',contentBase64:b64(bytes)},prep);
  const internal=await upload('Internal workpaper.pdf','Private analysis'),packet=await upload('Final packet.pdf','Client packet');
  const doc=(name,bytes)=>({name,mime:'application/pdf',contentBase64:b64(bytes)});
  await h.json(`/jobs/${job.id}/steps`,{ordinal:1,done:true,attachment:doc('Preparation memo.pdf','Task memo')},prep);
  const expense=await h.json(`/jobs/${job.id}/expenses`,{kind:'filing_fee',date:'2026-10-19',description:'Annual filing receipt',costCents:2500,billable:true,receipt:doc('Filing receipt.pdf','Receipt bytes')},prep);
  const notice=await h.json('/notices',{fileId:internal.id,agency:'IRS',jurisdiction:'federal',noticeType:'CP14',taxPeriod:'2025',noticeDate:'2026-10-01',responseDue:'2026-11-20',assigneeEmail:'prep@example.test'},h.owner);
  const event=await h.json(`/notices/${notice.notice.id}/events`,{kind:'transcript',note:'Recorded transcript source',file:doc('Transcript.pdf','Transcript bytes')},h.owner);
  const index=await h.json(`/jobs/${job.id}/documents`,undefined,h.owner);for(const kind of ['file','task','expense','notice'])assert.ok(index.some(f=>f.kind===kind),kind);
  for(const [key,door,bytes] of [[`task:${job.id}:1`,`/jobs/${job.id}/steps/1/attachment`,'Task memo'],['expense:'+expense.id,`/expenses/${expense.id}/receipt`,'Receipt bytes'],['notice:'+event.id,`/notices/${notice.notice.id}/events/${event.id}/file`,'Transcript bytes']]){
   assert.equal(await(await h.request('/api/blotter'+door,undefined,prep)).text(),bytes);
   const p=await h.json(`/documents/${ref(key)}/access`,undefined,h.owner);assert.equal(p.visibility,'internal');assert.ok(p.history.some(e=>e.action==='file.downloaded'));
   const grant=await h.json(`/documents/${ref(key)}/access`,{revision:p.revision,visibility:'contacts',contactIds:[a.id]},h.owner);
   const share=await h.json(`/documents/${ref(key)}/shares`,{revision:grant.revision,contactId:a.id,days:1},h.owner);assert.equal(await(await h.request('/api/blotter/shared-files/'+share.token)).text(),bytes);
  }
  const version=await h.json(`/jobs/${job.id}/deliverables`,{title:'Final return packet',...doc('Return v1.pdf','Return version one'),contactId:a.id},prep);
  const version2=await h.json(`/jobs/${job.id}/deliverables`,{deliverableId:version.deliverableId,...doc('Return v2.pdf','Return version two'),contactId:a.id},prep);
  const v2path='/documents/'+ref('deliverable:'+version2.id),v2access=await h.json(v2path+'/access',undefined,h.owner);assert.deepEqual(v2access.contacts.filter(c=>c.granted).map(c=>c.id),[a.id]);assert.ok(v2access.history.some(e=>e.action==='file.access_inherited'));
  await h.json(`/jobs/${job.id}/deliverables`,{deliverableId:version.deliverableId,...doc('Refused new recipient.pdf','Not sent'),contactId:b.id},prep,409);
  await h.json(v2path+'/access',{revision:v2access.revision,visibility:'contacts',contactIds:[a.id,b.id]},h.owner);
  const version3=await h.json(`/jobs/${job.id}/deliverables`,{deliverableId:version.deliverableId,...doc('Return v3.pdf','Return version three'),contactId:b.id},prep);
  assert.deepEqual((await h.json('/documents/'+ref('deliverable:'+version3.id)+'/access',undefined,h.owner)).contacts.filter(c=>c.granted).map(c=>c.id).sort(),[a.id,b.id].sort());
  const path=`/documents/${packet.id}`,preview=await h.json(path+'/access',undefined,h.owner);assert.equal(preview.visibility,'internal');assert.ok(preview.contacts.every(c=>!c.granted));
  await h.json(path+'/shares',{revision:null,contactId:a.id},h.owner,409);await h.json(path+'/access',{revision:null,visibility:'contacts',contactIds:[a.id]},prep,403);
  await h.json(path+'/access',{revision:null,visibility:'contacts',contactIds:[other.contacts[0].id]},h.owner,409);
  let access=await h.json(path+'/access',{revision:null,visibility:'contacts',contactIds:[a.id]},h.owner);assert.deepEqual(access.contacts.filter(x=>x.granted).map(x=>x.id),[a.id]);assert.match(access.bearerNotice,/does not verify/);
  await h.json(path+'/shares',{revision:access.revision,contactId:b.id},h.owner,409);
  const first=await h.json(path+'/shares',{revision:access.revision,contactId:a.id,days:7},h.owner);assert.match(first.token,/^ds_[0-9a-f]{64}$/);
  const download=token=>h.request('/api/blotter/shared-files/'+token);
  assert.equal(await(await download(first.token)).text(),'Client packet');
  assert.equal((await h.request('/api/blotter/files/'+internal.id,undefined,outside)).status,404);assert.equal(await(await h.request('/api/blotter/files/'+internal.id,undefined,prep)).text(),'Private analysis');
  const portalA=linkToken(await h.json(`/jobs/${job.id}/reminders`,{contactId:a.id},h.owner));assert.equal(await(await h.request(`/api/blotter/portal/${portalA}/files/${packet.id}`)).text(),'Client packet');assert.equal((await h.request(`/api/blotter/portal/${portalA}/files/${internal.id}`)).status,404);
  const portalB=linkToken(await h.json(`/jobs/${job.id}/reminders`,{contactId:b.id},h.owner));const versions=await h.json(`/portal/${portalB}/deliverables`,undefined);assert.deepEqual(versions[0].versions.map(v=>v.id),[version3.id,version2.id]);assert.equal((await h.request(`/api/blotter/portal/${portalB}/deliverables/${version.id}/file`)).status,404);await h.json(`/portal/${portalB}/deliverables/${version.id}/decide`,{sha256:version.sha256,name:'Luis Garcia',decision:'approve'},undefined,404);assert.equal(await(await h.request(`/api/blotter/portal/${portalB}/deliverables/${version3.id}/file`)).text(),'Return version three');assert.equal((await h.request(`/api/blotter/portal/${portalB}/files/${packet.id}`)).status,404);
  const rotated=await h.json(`${path}/shares/${first.id}/rotate`,{revision:access.revision,days:7},h.owner);assert.equal((await download(first.token)).status,404);assert.equal((await download(rotated.token)).status,200);
  await h.json(`${path}/shares/${rotated.id}/revoke`,{revision:access.revision},h.owner);assert.equal((await download(rotated.token)).status,404);
  const duplicate=await h.json('/clients',{name:'Chen imported record'},h.owner),comparison=await h.json(`/clients/compare?a=${duplicate.id}&b=${c.id}`,undefined,h.owner);
  const keep=Object.fromEntries(comparison.fields.filter(f=>!f.same&&f.key!=='source').map(f=>[f.key,'merged']));
  const merged=await h.json('/clients/merge',{survivor:duplicate.id,merged:c.id,keep,contactAuthority:Object.fromEntries(c.contacts.map(x=>[x.id,'Confirmed this contact represents the same entity']))},h.owner);
  assert.equal((await h.json(path+'/access',undefined,h.owner)).visibility,'contacts');assert.equal((await h.json(path+'/access',undefined,h.owner)).file.clientId,duplicate.id);
  await h.json(`/clients/merges/${merged.id}/undo`,{},h.owner);assert.equal((await h.json(path+'/access',undefined,h.owner)).file.clientId,c.id);assert.equal((await h.json(path+'/access',undefined,h.owner)).visibility,'contacts');
  const expired=await h.json(path+'/shares',{revision:access.revision,contactId:a.id,expiresAt:new Date(Date.now()+1500).toISOString()},h.owner);await new Promise(r=>setTimeout(r,1700));assert.equal((await download(expired.token)).status,404);
  const current=await h.json(`${path}/shares/${expired.id}/rotate`,{revision:access.revision,days:7},h.owner);await h.json(`/clients/${c.id}/contacts`,{id:a.id,revision:a.revision,portal:false},h.owner);assert.equal((await download(current.token)).status,404);
  const timeline=await h.json(`/clients/${c.id}/history`,undefined,h.owner);for(const action of ['file.access_changed','file.share_created','file.share_rotated','file.share_revoked','file.downloaded'])assert.ok(timeline.history.some(x=>x.action===action),action);assert.ok(!JSON.stringify(timeline).includes(first.token));
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.ok(!archive.includes(first.token));const archivedRows=archive.trim().split('\n').map(JSON.parse).filter(p=>p.kind==='part').flatMap(p=>p.items).filter(i=>i.kind==='row');assert.ok(!archivedRows.some(i=>i.table==='b_document_shares'));
  target=await harness();await target.json('/restore',{archive,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},target.owner);const restored=await target.json(path+'/access',undefined,target.owner);assert.equal(restored.visibility,'contacts');assert.ok(restored.contacts.some(x=>x.id===a.id&&x.granted));assert.equal(restored.shares.length,0);assert.equal((await target.request('/api/blotter/shared-files/'+current.token)).status,404);
 }finally{await target?.close();await h.close()}
});
