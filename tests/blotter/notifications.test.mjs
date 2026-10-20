import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {notificationAppJourney} from './notifications-ui.mjs';
const base={timeZone:'America/New_York',quietStart:'00:00',quietEnd:'00:00',digestTime:'07:00',digestEnabled:false,leadDays:1,emailKinds:[]};
async function fixture(h){
 const sessions={};for(const [email,role] of [['prep@example.test','preparer'],['reviewer@example.test','reviewer'],['other@example.test','preparer']]){
  await h.json('/team',{email,name:email==='prep@example.test'?'Jordan Ellis':email==='reviewer@example.test'?'Morgan Chen':'Casey Wells',role},h.owner);await h.json('/team/invite',{email},h.owner);sessions[email]=await h.login(email);
 }
 const client=await h.json('/clients',{name:'Cedar Lane LLC',ein:'12-3456789',contactName:'Alex Rivera',contactEmail:'alex@example.test'},h.owner);
 const template=await h.json('/templates',{name:'Monthly close',recurrence:'monthly',tasks:[{label:'Inspect statement',assignee:'preparer'}],requests:'Bank statement'},h.owner);
 const start=(periodStart,dueDate)=>h.json('/jobs',{clientId:client.id,templateId:template.id,periodStart,dueDate,dueNote:'Client agreed close date',preparerEmail:'prep@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
 return {prep:sessions['prep@example.test'],reviewer:sessions['reviewer@example.test'],other:sessions['other@example.test'],client,template,start};
}

test('NOTIFY-001 / BASE-001: native assignments, opted-in events, mention mute, mandatory policy, read state, scoped links and source erasure',async()=>{
 const h=await harness();let stale;try{
  const s=await fixture(h),before=h.mails.length;
  await h.json('/notifications/defaults',{emailKinds:['work_assigned'],mandatoryKinds:[]},h.owner);
  const job=await s.start('2026-10-01','2026-10-22');
  assert.equal(h.mails.length,before,'Firm suggestions cannot silently enable new assignment emails');
  let alerts=await h.json('/notifications',undefined,s.prep);
  for(const kind of ['work_assigned','task_assigned'])assert.equal(alerts.filter(n=>n.job_id===job.id&&n.kind===kind).length,1);
  assert.equal((await h.json('/notifications',undefined,s.other)).length,0);
  assert.equal((await h.json('/notifications',undefined,s.reviewer)).filter(n=>n.kind==='work_assigned'&&n.job_id===job.id).length,1);
  const assigned=alerts.find(n=>n.kind==='work_assigned');assert.equal(assigned.read_at,null);
  await h.json(`/notifications/${assigned.id}/read`,{read:true},s.other,404);
  await h.json(`/notifications/${assigned.id}/read`,{read:true},s.prep);
  assert.ok((await h.json('/notifications',undefined,s.prep)).find(n=>n.id===assigned.id).read_at);
  await h.json(`/notifications/${assigned.id}/read`,{read:false},s.prep);
  assert.equal((await h.json('/notifications',undefined,s.prep)).find(n=>n.id===assigned.id).read_at,null);
  await h.json('/notifications/settings',{...base,timeZone:'Invalid/Zone'},s.prep,400);
  await h.json('/notifications/defaults',{emailKinds:[],mandatoryKinds:['mention']},s.reviewer,403);
  await h.json('/notifications/settings',{...base,emailKinds:['upload','work_assigned']},s.prep);
  const assignedMail=h.mails.length;const second=await s.start('2026-11-01','2026-11-22');
  assert.ok(h.mails.slice(assignedMail).some(m=>m.to.includes('prep@example.test')&&m.text.includes('/app?job='+second.id)));
  const mention=async title=>h.json(`/jobs/${job.id}/threads`,{title,body:'Please inspect the source',mentions:['prep@example.test']},h.owner);
  let at=h.mails.length;await mention('Tax IDs 123-45-6789 and 12-3456789');assert.equal(h.mails.length,at,'Muted mentions stay in-app');
  assert.ok((await h.json('/notifications',undefined,s.prep)).some(n=>n.kind==='mention'));
  await h.json('/notifications/defaults',{emailKinds:[],mandatoryKinds:['mention']},h.owner);
  await h.json('/notifications/settings',base,s.prep);
  at=h.mails.length;await mention('Tax IDs 123-45-6789 and 12-3456789');
  assert.equal(h.mails.length,at+1,'Principal-configured mandatory email overrides personal mute');
  assert.ok(h.mails.slice(at).every(m=>!m.subject.includes('123-45-6789')&&!m.subject.includes('12-3456789')&&!m.subject.includes('123456789')));
  await h.json('/notifications/settings',{...base,emailKinds:['upload']},s.prep);
  const send=await h.json(`/jobs/${job.id}/reminders`,{},s.prep),token=new URL(send.portalUrl).pathname.split('/').at(-1);
  const detail=await h.json('/jobs/'+job.id,undefined,s.prep);at=h.mails.length;
  const file=await h.json(`/portal/${token}/requests/${detail.requests[0].id}`,{name:'October.txt',mime:'text/plain',contentBase64:Buffer.from('Private taxpayer record').toString('base64')});
  assert.ok(h.mails.slice(at).some(m=>m.to.includes('prep@example.test')&&m.text.includes('/app?job='+job.id)));
  assert.equal((await h.json('/notifications',undefined,s.prep)).filter(n=>n.kind==='upload'&&n.job_id===job.id).length,1);
  await h.json(`/portal/${token}/messages`,{body:'Please explain the missing statement'},undefined);
  assert.ok((await h.json('/notifications',undefined,s.prep)).some(n=>n.kind==='client_question'&&n.job_id===job.id));
  let current=await h.json('/jobs/'+job.id,undefined,s.prep);
  await h.json(`/jobs/${job.id}/status`,{stage:'waiting',revision:current.job.revision},s.prep);
  assert.ok((await h.json('/notifications',undefined,s.prep)).some(n=>n.kind==='status_changed'&&n.job_id===job.id));
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  assert.ok(archive.includes('notifications.settings')&&archive.includes('notification.read'));
  await h.json(`/files/${file.id}/erase`,{confirm:'October.txt',reason:'Client requested erasure'},h.owner);
  assert.ok(!JSON.stringify(await h.json('/notifications',undefined,s.prep)).includes('Private taxpayer record'));
  const journal=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  stale=await harness();await stale.json('/restore',{archive,journal,confirm:'RESTORE'},stale.owner,409);
  // Named-task assignments grant only their existing task access, and revocation hides old alerts.
  let items=(await h.json(`/clients/${s.client.id}/history`,undefined,h.owner)).unresolved;
  const task=items.find(i=>i.kind==='task'&&i.jobId===job.id);
  await h.json(`/clients/${s.client.id}/unresolved/owner`,{kind:'task',id:task.id,owner:'other@example.test'},h.owner);
  assert.equal((await h.json('/notifications',undefined,s.other)).filter(n=>n.kind==='task_assigned'&&n.job_id===job.id).length,1);
  await h.json(`/clients/${s.client.id}/unresolved/owner`,{kind:'task',id:task.id,owner:'prep@example.test'},h.owner);
  assert.ok(!(await h.json('/notifications',undefined,s.other)).some(n=>n.job_id===job.id),'Revoked named-task access hides retained notification history');
  // Deactivation revokes every center read, including already-issued cookies.
  await h.json('/team',{email:'prep@example.test',name:'Jordan Ellis',role:'preparer',active:false},h.owner);
  await h.json('/notifications',undefined,s.prep,401);
 }finally{await stale?.close();await h.close();}
});

test('NOTIFY-001 / BASE-001: due thresholds, user-local quiet hours and once-daily DST digest, restart and paused restore',async()=>{
 const h=await harness();let restored;try{
  const s=await fixture(h);
  await h.json('/notifications/settings',{...base,quietStart:'22:00',quietEnd:'07:00',digestEnabled:true,emailKinds:['due_soon','overdue']},s.prep);
  const soon=await s.start('2026-01-01','2026-11-02'),late=await s.start('2026-02-01','2026-10-31');
  const outside=await s.start('2026-03-01','2026-11-03');
  let at=h.mails.length;await h.scheduled('2026-11-01T10:00:00Z');assert.equal(h.mails.length,at,'05:00 local falls inside quiet hours after DST');
  let alerts=await h.json('/notifications',undefined,s.prep);
  assert.ok(alerts.some(n=>n.job_id===soon.id&&n.kind==='due_soon'));assert.ok(alerts.some(n=>n.job_id===late.id&&n.kind==='overdue'));assert.ok(!alerts.some(n=>n.job_id===outside.id&&n.kind==='due_soon'));
  await h.scheduled('2026-11-01T12:00:00Z');await h.scheduled('2026-11-01T12:00:00Z');await h.restart();await h.scheduled('2026-11-01T13:00:00Z');
  const mails=h.mails.slice(at),digest=mails.filter(m=>m.subject==='Blotter: daily work digest');assert.equal(digest.length,1);
  assert.equal(digest[0].text.split('/app?job='+soon.id).length-1,1);assert.equal(digest[0].text.split('/app?job='+late.id).length-1,1);assert.ok(!digest[0].text.includes(outside.id));
  for(const [job,kind] of [[soon,'due_soon'],[late,'overdue']])assert.equal((await h.json('/notifications',undefined,s.prep)).filter(n=>n.job_id===job.id&&n.kind===kind).length,1);
  assert.ok(mails.some(m=>m.text.includes('/app?job='+soon.id)&&m.subject!=='Blotter: daily work digest'));
  await h.json('/notifications/settings',{...base,timeZone:'UTC',quietStart:'00:00',quietEnd:'23:59',emailKinds:['mention']},s.prep);
  await h.json(`/jobs/${soon.id}/threads`,{title:'Deferred source check',body:'Inspect source',mentions:['prep@example.test']},h.owner);
  assert.ok((await h.json('/notifications',undefined,s.prep)).some(n=>n.kind==='mention'&&n.delivery.startsWith('deferred:')));
  await h.json('/notifications/settings',{...base,digestEnabled:true},h.owner);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE'},restored.owner);
  assert.equal((await restored.json('/notifications/settings',undefined,restored.owner)).personal.digestEnabled,false);
  const copied=await(await restored.request('/api/blotter/backup',undefined,restored.owner)).text();assert.ok(copied.includes('held after restore: deferred: outside firm notification hours'));
  const sent=restored.mails.length;await restored.scheduled('2026-11-01T12:00:00Z');assert.equal(restored.mails.length,sent,'Restored delivery history cannot replay without staff authority');
 }finally{await restored?.close();await h.close();}
});

test('NOTIFY-001 / BASE-001: a real send failure creates an owned in-app exception without recursive retries',async()=>{
 const h=await harness({mailResponse:(mail,mails)=>mail.subject.startsWith('Documents needed:')?Response.json({message:'Provider unavailable'},{status:400}):Response.json({id:'test-'+mails.length})});
 try{
  const s=await fixture(h),job=await s.start('2026-04-01','2026-05-01');
  const result=await h.json(`/jobs/${job.id}/reminders`,{},s.prep);
  assert.match(result.delivery,/failed|rejected/);
  const alerts=await h.json('/notifications',undefined,s.prep);
  assert.equal(alerts.filter(n=>n.kind==='delivery_failed'&&n.job_id===job.id).length,1);
  const before=h.mails.length;await h.scheduled('2026-05-01T12:00:00Z');await h.scheduled('2026-05-01T13:00:00Z');assert.equal(h.mails.length,before,'No automatic retry of the failed client send');
  assert.equal((await h.json('/notifications',undefined,s.prep)).filter(n=>n.kind==='delivery_failed'&&n.job_id===job.id).length,1);
  assert.equal((await h.json('/notifications',undefined,s.other)).length,0);
 }finally{await h.close();}
});


test('NOTIFY-001 app: notification center, personal schedule and principal defaults at desktop and phone widths',async()=>{
 const h=await harness();try{
  const s=await fixture(h),job=await s.start('2026-10-01','2026-10-22');
  await s.start('2026-11-01','2026-11-22');
  await h.json('/notifications/defaults',{emailKinds:['work_assigned'],mandatoryKinds:['mention']},h.owner);
  await notificationAppJourney(h,s,job);
 }finally{await h.close();}
});
