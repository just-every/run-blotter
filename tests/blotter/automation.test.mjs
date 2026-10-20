import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';

async function fixture(h) {
 for(const [email,role] of [['prep@example.test','preparer'],['reviewer@example.test','reviewer'],['other@example.test','preparer']]) {
  await h.json('/team',{email,name:email,role},h.owner);await h.json('/team/invite',{email},h.owner);
 }
 const prep=await h.login('prep@example.test'), reviewer=await h.login('reviewer@example.test');
 const client=await h.json('/clients',{name:'Cedar Lane LLC',contactName:'Alex Rivera',contactEmail:'alex@example.test'},h.owner);
 const outside=await h.json('/clients',{name:'Outside scope LLC'},h.owner);
 const template=await h.json('/templates',{name:'1040 preparation',recurrence:'annual',steps:'Prepare return',requests:'W-2'},h.owner);
 const model=await h.json('/work-types',undefined,h.owner),workType=model.workTypes.find(t=>t.template_id===template.id);
 const sub=await h.json('/sub-statuses',{name:'on 8879 signature',stage:'waiting',workTypeIds:[workType.id]},h.owner);
 const docs=await h.json('/sub-statuses',{name:'on client documents',stage:'waiting',workTypeIds:[workType.id]},h.owner);
 const message=await h.json('/messages/templates',{name:'Client document request',scope:'firm',subject:'Documents for {{client_name}}',body:'Please upload {{outstanding_requests}} at {{portal_link}}'},h.owner);
 const start=(clientId=client.id,periodStart='2026-01-01')=>h.json('/jobs',{clientId,templateId:template.id,periodStart,dueDate:'2027-04-15',dueNote:'Recorded client engagement',preparerEmail:'prep@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
 const rule=async(trigger,action,budget=10,extra={})=>{
  const body={name:trigger.kind+' to '+action.kind,clientIds:[client.id],trigger,action,budget,...extra};
  const preview=await h.json('/automation/preview',body,h.owner);
  assert.ok(preview.jobs.every(j=>j.client!=='Outside scope LLC'));
  await h.json('/automation',{...body,fingerprint:'changed'},h.owner,409);
  const saved=await h.json('/automation',{...body,fingerprint:preview.fingerprint},h.owner);
  await h.json(`/automation/${saved.id}/activate`,{},h.owner);return saved;
 };
 const state=()=>h.json('/automation',undefined,h.owner);
 const run=()=>h.json('/automation/run',{},h.owner);
 const detail=id=>h.json('/jobs/'+id,undefined,h.owner);
 const move=async(id,stage,subStatusId)=>h.json(`/jobs/${id}/status`,{stage,subStatusId,revision:(await detail(id)).job.revision},prep);
 return {prep,reviewer,client,outside,template,sub,docs,message,start,rule,state,run,detail,move};
}

test('AUTOMATE-001 / WORK-006 / WORK-007 / BASE-001: approved native rules, board entries, all-task review gates, source events, budgets, pause/revoke, attribution and safe portable history',async()=>{
 const h=await harness(),copies=[];
 try {
  const s=await fixture(h),a=await s.start(),b=await s.start(s.outside.id);
  await h.json('/automation',{},s.prep,403);await h.json('/automation/run',{},s.reviewer,403);
  const key=await h.json('/keys',{label:'No automatic authority'},h.owner);
  await h.json('/automation',{},'',401,{authorization:'Bearer '+key.key});
  const r=await s.rule({kind:'tasks_complete'},{kind:'status',stage:'in_review'});
  await h.json(`/jobs/${a.id}/steps`,{ordinal:1,done:true},s.prep);await s.run();
  assert.equal((await s.detail(a.id)).job.status,'open','Accepted documents are still required for review');
  let attempts=(await s.state()).attempts.filter(x=>x.rule_id===r.id);assert.equal(attempts.length,1);assert.equal(attempts[0].status,'failed');assert.match(attempts[0].outcome,/document/i);
  let d=await s.detail(a.id);const original=await h.json(`/requests/${d.requests[0].id}/files`,{name:'W2.txt',mime:'text/plain',contentBase64:Buffer.from('W2 evidence').toString('base64')},s.prep);
  await h.json(`/requests/${d.requests[0].id}/decide`,{decision:'accept'},s.prep);
  await h.json(`/jobs/${a.id}/steps`,{ordinal:1,done:false},s.prep);await h.json(`/jobs/${a.id}/steps`,{ordinal:1,done:true},s.prep);
  await s.run();await s.run();d=await s.detail(a.id);assert.equal(d.job.status,'review');assert.equal(d.statusHistory.filter(x=>x.to_stage==='in_review').length,1);
  assert.equal((await s.detail(b.id)).job.status,'open');
  attempts=(await s.state()).attempts.filter(x=>x.rule_id===r.id);assert.deepEqual(attempts.map(x=>x.status).sort(),['failed','succeeded']);
  assert.ok(d.statusHistory.some(x=>x.to_stage==='in_review'&&x.by==='owner@example.test'));
  await h.json(`/jobs/${a.id}/review`,{revision:d.job.revision,decision:'return',note:'Review needs correction'},s.reviewer);
  const entry=await s.rule({kind:'status',stage:'waiting',subStatusId:s.sub.id},{kind:'request',label:'Signed 8879'},1);
  // This is the same public status door used by board cards and personal plans.
  const board=await h.json('/board?group=status',undefined,s.prep);assert.ok(JSON.stringify(board).includes(a.id));
  await s.move(a.id,'waiting',s.sub.id);await s.run();await h.scheduled('2027-01-02T17:00:00Z');
  assert.equal((await s.detail(a.id)).requests.filter(x=>x.label==='Signed 8879').length,1);
  await s.move(a.id,'in_progress');await s.move(a.id,'waiting',s.sub.id);await s.run();
  attempts=(await s.state()).attempts.filter(x=>x.rule_id===entry.id);assert.deepEqual(attempts.map(x=>x.status).sort(),['refused','succeeded']);
  const paused=await s.rule({kind:'status',stage:'ready'},{kind:'request',label:'Must remain absent'});
  await h.json(`/automation/${paused.id}/pause`,{},h.owner);await s.move(a.id,'ready');await s.run();assert.ok(!(await s.detail(a.id)).requests.some(x=>x.label==='Must remain absent'));
  await h.json(`/automation/${paused.id}/activate`,{},h.owner);await s.run();assert.ok(!(await s.detail(a.id)).requests.some(x=>x.label==='Must remain absent'),'Reapproval does not replay pre-approval entries');
  await h.json(`/automation/${paused.id}/revoke`,{},h.owner);await s.move(a.id,'in_progress');await s.move(a.id,'ready');await s.run();assert.ok(!(await s.detail(a.id)).requests.some(x=>x.label==='Must remain absent'));
  await h.json(`/automation/${paused.id}/activate`,{},h.owner,409);
  const fileRule=await s.rule({kind:'file'},{kind:'request',label:'File follow-up'});
  await h.json(`/requests/${d.requests[0].id}/files`,{name:'Correction.txt',mime:'text/plain',contentBase64:Buffer.from('Correction').toString('base64')},s.prep);await s.run();assert.equal((await s.detail(a.id)).requests.filter(x=>x.label==='File follow-up').length,1);
  const erasedFile=await h.json(`/requests/${d.requests[0].id}/files`,{name:'Erase pending.txt',mime:'text/plain',contentBase64:Buffer.from('Erase pending').toString('base64')},s.prep);
  const stale=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  await h.json(`/files/${erasedFile.id}/erase`,{confirm:'Erase pending.txt',reason:'Client request'},h.owner);await s.run();
  assert.ok((await s.state()).attempts.some(x=>x.rule_id===fileRule.id&&/erased/.test(x.outcome)));
  const due=await s.rule({kind:'due',at:'2027-01-03T09:00:00-05:00'},{kind:'assign',role:'manager',email:'reviewer@example.test'});
  await h.scheduled('2027-01-03T13:59:59Z');assert.equal((await s.detail(a.id)).job.manager_email,null);
  await h.scheduled('2027-01-03T14:00:00Z');await h.scheduled('2027-01-03T14:00:00Z');assert.equal((await s.detail(a.id)).job.manager_email,'reviewer@example.test');assert.equal((await s.state()).attempts.filter(x=>x.rule_id===due.id).length,1);
  const revocation=await s.rule({kind:'due',at:'2027-01-04T00:00:00Z'},{kind:'assign',role:'manager',email:'other@example.test'}).catch(()=>null);assert.equal(revocation,null,'An ineligible reviewer/manager is refused at preview');
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.ok(archive.includes('automation.effect'));assert.ok(archive.includes('automation:'));assert.ok(!archive.includes(key.key));assert.ok(!archive.includes('W2 evidence'));
  const restored=await harness();copies.push(restored);await restored.json('/restore',{archive,confirm:'RESTORE'},restored.owner);
  const after=await restored.json('/automation',undefined,restored.owner);assert.ok(after.rules.every(x=>x.status==='paused'||x.status==='revoked'));assert.ok(after.rules.every(x=>x.principal_id===null));assert.equal(after.attempts.length,(await s.state()).attempts.length);
  await restored.scheduled('2027-01-10T12:00:00Z');assert.equal((await restored.json(`/jobs/${a.id}`,undefined,restored.owner)).requests.length,(await s.detail(a.id)).requests.length);
  const later=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();const denied=await harness();copies.push(denied);await denied.json('/restore',{archive:stale,journal:later,confirm:'RESTORE'},denied.owner,409);
  assert.ok(original.id);
 } finally {await h.close();for(const copy of copies)await copy.close();}
});

test('AUTOMATE-001 / BASE-001: templated status mail acceptance, provider-response interruption, worker restart, retained ambiguity and human reconciliation never replay',async()=>{
 let interrupt=false;
 const h=await harness({mailResponse:(mail,mails)=>{
  // Network edge: provider accepts, but its response is lost before the Worker sees it.
  if(interrupt&&mail.subject.startsWith('Documents for')) {interrupt=false;throw new Error('Connection lost after provider acceptance');}
  return Response.json({id:'accepted-'+mails.length});
 }});
 try {
  const s=await fixture(h),a=await s.start();
  const reminder=await s.rule({kind:'status',stage:'waiting',subStatusId:s.docs.id},{kind:'reminder',templateId:s.message.id});
  await s.move(a.id,'waiting',s.docs.id);const before=h.mails.length;await s.run();await s.run();
  assert.equal(h.mails.length,before+1);let attempts=(await s.state()).attempts.filter(x=>x.rule_id===reminder.id);assert.equal(attempts.length,1);assert.equal(attempts[0].status,'succeeded');assert.match(attempts[0].outcome,/accepted by/);
  assert.match(h.mails.at(-1).text,/W-2/);assert.match(h.mails.at(-1).text,/\/portal\/up_/);
  await s.move(a.id,'in_progress');await s.move(a.id,'waiting',s.docs.id);interrupt=true;await s.run();
  const accepted=h.mails.length;await h.restart();await s.run();assert.equal(h.mails.length,accepted,'Restart never repeats a provider-accepted message with a lost response');
  attempts=(await s.state()).attempts.filter(x=>x.rule_id===reminder.id);const held=attempts.find(x=>x.status==='held');assert.ok(held);assert.match(held.next_action,/reconciliation/i);
  await h.json(`/automation/attempts/${held.id}/reconcile`,{outcome:'accepted',reason:'Provider dashboard message id accepted-42'},s.reviewer,403);
  await h.json(`/automation/attempts/${held.id}/reconcile`,{outcome:'accepted',reason:'Provider dashboard confirms acceptance'},h.owner);
  await h.json(`/automation/attempts/${held.id}/reconcile`,{outcome:'not_accepted',reason:'Duplicate decision'},h.owner,409);
  await s.run();assert.equal(h.mails.length,accepted);assert.equal((await s.state()).attempts.find(x=>x.id===held.id).status,'succeeded');
  // Mutable dependencies cannot silently change what the principal approved.
  await h.json(`/messages/templates/${s.message.id}`,{subject:'Changed subject',body:'Changed message {{portal_link}}'},h.owner);
  await s.move(a.id,'in_progress');await s.move(a.id,'waiting',s.docs.id);await s.run();assert.equal(h.mails.length,accepted);assert.ok((await s.state()).attempts.some(x=>x.rule_id===reminder.id&&/template changed/.test(x.outcome)));
  const assignment=await s.rule({kind:'due',at:'2027-02-01T12:00:00Z'},{kind:'assign',role:'manager',email:'reviewer@example.test'});
  await h.json('/team',{email:'reviewer@example.test',name:'Former reviewer',role:'preparer',active:true},h.owner);
  await h.scheduled('2027-02-01T12:00:00Z');assert.equal((await s.detail(a.id)).job.manager_email,null);assert.ok((await s.state()).attempts.some(x=>x.rule_id===assignment.id&&/authority changed/.test(x.outcome)));
 }finally{await h.close();}
});
