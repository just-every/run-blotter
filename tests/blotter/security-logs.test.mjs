import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {enroll} from './erasure-fixture.mjs';
import {securityLogsJourney} from './security-logs-ui.mjs';
const base='/api/blotter/security/access-log.csv';
const range='?from=2026-03-08&to=2026-03-08';
const csv=text=>text.trimEnd().split('\r\n').map(line=>[...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(m=>m[1].replace(/""/g,'"')));
const records=text=>{const [header,...rows]=csv(text);return rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));};
const audit=async h=>(await h.db.prepare("SELECT * FROM b_audit WHERE action='file.downloaded' ORDER BY id").all()).results;
async function fixture(h) {
 for(const [email,role] of [['=synthetic-blotter-1@example.test','preparer'],['reviewer@example.test','reviewer']]) {
  await h.json('/team',{email,name:email,role},h.owner);await h.json('/team/invite',{email},h.owner);
 }
 const prep=await h.login('=synthetic-blotter-1@example.test'),reviewer=await h.login('reviewer@example.test');
 const client=await h.json('/clients',{name:'synthetic-blotter-2',contacts:[{name:'synthetic-blotter-3',email:'contact@example.test',roles:['primary'],authorized:true,portal:true,requestConsent:true,emailConsent:true}]},h.owner);
 const template=await h.json('/templates',{name:'synthetic-blotter-4',recurrence:'annual',steps:'Review',requests:'Source'},h.owner);
 const job=await h.json('/jobs',{clientId:client.id,templateId:template.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Recorded deadline',preparerEmail:'=synthetic-blotter-1@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
 const request=(await h.json('/jobs/'+job.id,undefined,h.owner)).requests[0];
 const reminder=await h.json(`/jobs/${job.id}/reminders`,{contactId:client.contacts[0].id},h.owner);
 const file=await h.json(`/requests/${request.id}/files`,{name:'synthetic-blotter-5.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-6 private document').toString('base64')},prep);
 const door=`/documents/${file.id}`;
 const access=await h.json(door+'/access',undefined,h.owner);
 const grant=await h.json(door+'/access',{revision:access.revision,visibility:'contacts',contactIds:[client.contacts[0].id]},h.owner);
 const share=await h.json(door+'/shares',{revision:grant.revision,contactId:client.contacts[0].id},h.owner);
 const token=new URL(reminder.portalUrl).pathname.split('/').at(-1);
 const doors=[['staff',`/api/blotter/files/${file.id}`,prep],['contact_portal',`/api/blotter/portal/${token}/files/${file.id}`,''],['bearer','/api/blotter/shared-files/'+share.token,'']];
 return {client,job,request,file,prep,reviewer,doors,share,token};
}
async function downloadAt(h,door,at) {
 const before=new Set((await audit(h)).map(row=>row.id));
 const response=await h.request(door[1],undefined,door[2]);assert.equal(response.status,200);assert.equal(await response.text(),'synthetic-blotter-6 private document');
 const added=(await audit(h)).filter(row=>!before.has(row.id));assert.equal(added.length,1);
 await h.db.prepare('UPDATE b_audit SET at=? WHERE id=?').bind(at,added[0].id).run();
 return added[0].id;
}

test('Recorded access-log export selects exact UTC instants across DST, preserves sources and bearer attribution, and escapes spreadsheet fields',async()=>{
 const h=await harness();
 try {
  const s=await fixture(h),ids=[];
  ids.push(await downloadAt(h,s.doors[0],'2026-03-07T23:59:59.999Z'));
  ids.push(await downloadAt(h,s.doors[0],'2026-03-08T00:00:00.000Z'));
  ids.push(await downloadAt(h,s.doors[1],'2026-03-08T01:59:59-05:00'));
  ids.push(await downloadAt(h,s.doors[2],'2026-03-08T03:00:00-04:00'));
  ids.push(await downloadAt(h,s.doors[2],'2026-03-08T23:59:59.999Z'));
  ids.push(await downloadAt(h,s.doors[0],'2026-03-09T00:00:00.000Z'));
  const before=await audit(h),response=await h.request(base+range,undefined,h.owner);
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/csv/);assert.match(response.headers.get('content-disposition'),/attachment/);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('x-access-log-coverage'),/Not a complete access history/);
  const text=await response.text(),rows=records(text);
  assert.deepEqual(rows.map(r=>r.event_id),ids.slice(1,5));
  assert.deepEqual(rows.map(r=>r.channel),['staff','contact_portal','bearer','bearer']);
  assert.deepEqual(rows.map(r=>r.occurred_at_utc),['2026-03-08T00:00:00.000Z','2026-03-08T06:59:59.000Z','2026-03-08T07:00:00.000Z','2026-03-08T23:59:59.999Z']);
  assert.equal(rows[0].actor,"'=synthetic-blotter-1@example.test");assert.equal(rows[0].identity,'authenticated staff session');
  assert.deepEqual(rows.slice(1).map(r=>[r.actor,r.identity]),[['contact portal bearer (identity not verified)','bearer; identity not verified'],['document bearer (identity not verified)','bearer; identity not verified'],['document bearer (identity not verified)','bearer; identity not verified']]);
  assert.deepEqual([...new Set(rows.map(r=>r.resource_id))],[s.file.id]);
  assert.deepEqual([...new Set(rows.map(r=>r.range_start_utc))],['2026-03-08T00:00:00.000Z']);assert.deepEqual([...new Set(rows.map(r=>r.range_end_exclusive_utc))],['2026-03-09T00:00:00.000Z']);
  for(const secret of ['synthetic-blotter-5.txt','synthetic-blotter-6 private document',s.client.contacts[0].id,s.share.token,s.token,'sha256','contentBase64'])assert.ok(!text.includes(secret),secret);
  assert.deepEqual(await audit(h),before,'export never changes a source event');
  const exports=(await h.db.prepare("SELECT * FROM b_audit WHERE action='security.access_log_exported'").all()).results;
  assert.equal(exports.length,1);assert.equal(exports[0].actor,'owner@example.test');assert.equal(exports[0].object_id,'access-log');assert.deepEqual(JSON.parse(exports[0].detail),{from:'2026-03-08T00:00:00.000Z',endExclusive:'2026-03-09T00:00:00.000Z',rows:4});assert.ok(Number.isFinite(Date.parse(exports[0].at)));
  const fall=[];fall.push(await downloadAt(h,s.doors[0],'2026-11-01T01:30:00-04:00'));fall.push(await downloadAt(h,s.doors[2],'2026-11-01T01:30:00-05:00'));
  const fallRows=records(await(await h.request(base+'?from=2026-11-01&to=2026-11-01',undefined,h.owner)).text());assert.deepEqual(fallRows.map(r=>r.event_id),fall);assert.deepEqual(fallRows.map(r=>r.occurred_at_utc),['2026-11-01T05:30:00.000Z','2026-11-01T06:30:00.000Z']);
  const empty=await h.request(base+'?from=2026-03-10&to=2026-03-10',undefined,h.owner);assert.equal(empty.status,200);assert.equal(records(await empty.text()).length,0);
  for(const query of ['','?from=2026-02-30&to=2026-03-08','?from=2026-03-09&to=2026-03-08','?from=2026-03-08T00:00:00Z&to=2026-03-08','?from=2026-03-08&to=9999-12-31'])assert.equal((await h.request(base+query,undefined,h.owner)).status,400,query);
  await securityLogsJourney(h,s,range,ids.slice(1,5));
 }finally{await h.close();}
});

test('Access-log export requires the live principal and a fresh confirmation in this session, refusing other roles, agents, deactivated and unconfirmed sessions',async()=>{
 const h=await harness();
 try {
  const s=await fixture(h),door=base+range;
  const denied=await h.send(door,undefined,await h.login('owner@example.test'));assert.equal(denied.status,403);assert.equal((await denied.json()).mfa,'step-up');
  for(const cookie of [s.prep,s.reviewer]){await h.stepUp(cookie);assert.equal((await h.send(door,undefined,cookie)).status,403);}
  await h.json('/access/delegations',{email:'reviewer@example.test',permissions:['manage_access','financial_authority'],reason:'synthetic-blotter-7'},h.owner);
  assert.equal((await h.send(door,undefined,s.reviewer)).status,403);
  const key=await h.json('/keys',{label:'synthetic-blotter-8'},h.owner);
  assert.equal((await h.send(door,undefined,'',{authorization:'Bearer '+key.key})).status,401);
  assert.equal((await h.send('/api/blotter/agent/security/access-log.csv'+range,undefined,'',{authorization:'Bearer '+key.key})).status,404);
  await h.json('/team',{email:'reviewer@example.test',name:'Reviewer',role:'reviewer',active:false},h.owner);
  assert.ok([401,403].includes((await h.send(door,undefined,s.reviewer)).status));
  const codes=await enroll(h,h.owner),fresh=await h.login('owner@example.test');
  const unconfirmed=await h.send(door,undefined,fresh);assert.equal(unconfirmed.status,403);assert.equal((await unconfirmed.json()).mfa,'verify');
  await h.json('/mfa/verify',{recoveryCode:codes.recovery[0]},fresh);
  const noStep=await h.send(door,undefined,fresh);assert.equal(noStep.status,403);assert.equal((await noStep.json()).mfa,'step-up');
  await h.json('/access/step-up',{recoveryCode:codes.recovery[1]},fresh);
  assert.equal((await h.send(door,undefined,fresh)).status,200);
  await h.db.prepare("UPDATE b_access_stepups SET verified_at='2000-01-01T00:00:00.000Z'").run();
  assert.equal((await h.send(door,undefined,fresh)).status,403);
 }finally{await h.close();}
});

test('Current access logs remain portable, omit sealed and erased details, and reject a stale archive with the newer erasure journal',async()=>{
 const h=await harness();let copy,stale;
 try {
  const s=await fixture(h);const event=await downloadAt(h,s.doors[0],'2026-03-08T12:00:00Z');
  // Defensive historical data: only selected channel metadata may leave the audit store.
  await h.db.prepare('UPDATE b_audit SET detail=? WHERE id=?').bind(JSON.stringify({channel:'staff',sealed:'synthetic-blotter-9',erased:'synthetic-blotter-10',contactId:s.client.contacts[0].id}),event).run();
  const expected=await(await h.request(base+range,undefined,h.owner)).text();assert.ok(!expected.includes('synthetic-blotter-9')&&!expected.includes('synthetic-blotter-10'));
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  const items=archive.trim().split('\n').flatMap(line=>JSON.parse(line).items??[]);
  assert.ok(items.some(i=>i.table==='b_audit'&&i.row.id===event));assert.ok(items.some(i=>i.table==='b_audit'&&i.row.action==='security.access_log_exported'));
  assert.ok(!items.some(i=>['b_access_stepups','b_document_shares'].includes(i.table)));
  copy=await harness();await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},copy.owner);
  assert.equal((await copy.send(base+range,undefined,copy.owner)).status,403,'restored history carries no fresh confirmation');
  assert.equal(await(await copy.request(base+range,undefined,copy.owner)).text(),expected);
  // Complete the source work through its public workflow so client erasure is eligible.
  await h.json(`/requests/${s.request.id}/decide`,{decision:'accept'},s.prep);
  await h.json(`/jobs/${s.job.id}/steps`,{ordinal:1,done:true},s.prep);
  let job=await h.json(`/jobs/${s.job.id}`,undefined,s.prep);
  job=await h.json(`/jobs/${s.job.id}/submit`,{revision:job.job.revision},s.prep);
  await h.json(`/jobs/${s.job.id}/review`,{revision:job.job.revision,decision:'signoff',note:'synthetic-blotter-11'},s.reviewer);
  await h.json(`/clients/${s.client.id}/lifecycle`,{lifecycle:'archived',revision:(await h.json(`/clients/${s.client.id}/detail`,undefined,h.owner)).revision},h.owner);
  const preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.deepEqual(preview.blockers,[]);assert.ok(preview.externalCopies.some(item=>item.source==='access-log-downloads'&&item.holder.includes('owner@example.test')));
  await h.json(`/clients/${s.client.id}/erasure`,{planHash:preview.planHash,confirm:s.client.name,reason:'synthetic-blotter-12'},h.owner);
  const after=records(await(await h.request(base+range,undefined,h.owner)).text());assert.equal(after.length,1);assert.equal(after[0].event_id,event);assert.equal(after[0].actor,"'=synthetic-blotter-1@example.test");assert.ok(!JSON.stringify(after).includes(s.client.contacts[0].id));
  const latest=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  stale=await harness();await stale.json('/restore',{archive,journal:latest,confirm:'RESTORE'},stale.owner,409);
 }finally{await stale?.close();await copy?.close();await h.close();}
});
