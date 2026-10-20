import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {automationFixture as fixture} from './automation-fixture.mjs';
import {automationAppJourney} from './automation-ui.mjs';


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
  await h.json('/automation/preview',{name:'Ineligible manager',clientIds:[s.client.id],trigger:{kind:'due',at:'2027-01-04T00:00:00Z'},action:{kind:'assign',role:'manager',email:'other@example.test'},budget:1},h.owner,409);
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
  await s.move(a.id,'in_progress');await s.move(a.id,'waiting',s.docs.id);interrupt=true;await s.run();
  const secondHeld=(await s.state()).attempts.find(x=>x.rule_id===reminder.id&&x.status==='held');assert.ok(secondHeld);
  const noReplay=h.mails.length;await h.json(`/automation/attempts/${secondHeld.id}/reconcile`,{outcome:'not_accepted',reason:'Provider support confirms this delivery was rejected'},h.owner);await s.run();assert.equal(h.mails.length,noReplay);assert.equal((await s.state()).attempts.find(x=>x.id===secondHeld.id).status,'failed');
  const deliveredBeforeTemplateChange=h.mails.length;
  // Mutable dependencies cannot silently change what the principal approved.
  await h.json(`/messages/templates/${s.message.id}`,{subject:'Changed subject',body:'Changed message {{portal_link}}'},h.owner);
  await s.move(a.id,'in_progress');await s.move(a.id,'waiting',s.docs.id);await s.run();assert.equal(h.mails.length,deliveredBeforeTemplateChange);assert.ok((await s.state()).attempts.some(x=>x.rule_id===reminder.id&&/template changed/.test(x.outcome)));
  const consentRule=await s.rule({kind:'status',stage:'ready'},{kind:'reminder',templateId:s.message.id});
  const contact=(await h.json(`/clients/${s.client.id}/contacts`,undefined,h.owner))[0];
  await h.json(`/clients/${s.client.id}/contacts`,{id:contact.id,revision:contact.revision,requestConsent:false},h.owner);
  await s.move(a.id,'ready');const beforeConsent=h.mails.length;await s.run();assert.equal(h.mails.length,beforeConsent);assert.ok((await s.state()).attempts.some(x=>x.rule_id===consentRule.id&&x.status==='failed'));
  const assignment=await s.rule({kind:'due',at:'2027-02-01T12:00:00Z'},{kind:'assign',role:'manager',email:'reviewer@example.test'});
  await h.json('/team',{email:'reviewer@example.test',name:'Former reviewer',role:'preparer',active:true},h.owner);
  await h.scheduled('2027-02-01T12:00:00Z');assert.equal((await s.detail(a.id)).job.manager_email,null);assert.ok((await s.state()).attempts.some(x=>x.rule_id===assignment.id&&/authority changed/.test(x.outcome)));
 }finally{await h.close();}
});

test('AUTOMATE-001 / BASE-001: request/organizer/proposal completion, roll-forward, immutable replacement versions and lost principal authority through native account administration',async()=>{
 const h=await harness();
 try {
  const s=await fixture(h),a=await s.start();
  const requests=await s.rule({kind:'request_complete'},{kind:'request',label:'Accepted-request follow-up'});
  const initial=(await s.detail(a.id)).requests[0];
  await h.json(`/requests/${initial.id}/files`,{name:'W2.txt',mime:'text/plain',contentBase64:Buffer.from('W2 evidence').toString('base64')},s.prep);
  await h.json(`/requests/${initial.id}/decide`,{decision:'accept'},s.prep);await s.run();await s.run();
  assert.equal((await s.detail(a.id)).requests.filter(x=>x.label==='Accepted-request follow-up').length,1);assert.equal((await s.state()).attempts.filter(x=>x.rule_id===requests.id).length,1);
  const proposals=await s.rule({kind:'proposal'},{kind:'rollforward',dueDate:'2028-04-15',dueNote:'Client-confirmed next-year engagement target'});
  await h.json('/agent/prepare-reminder',{jobId:a.id,message:'Prepared only'},'',401);
  const key=await h.json('/keys',{label:'Prepare reminder only'},h.owner);
  const p=await h.json('/agent/prepare-reminder',{jobId:a.id,message:'Prepared only'},'',200,{authorization:'Bearer '+key.key});
  await h.json(`/proposals/${p.id}/decide`,{decision:'decline',reason:'Use the approved follow-up instead'},h.owner);
  await s.run();await s.run();const next=(await s.detail(a.id)).nextJobId;assert.ok(next);assert.equal((await s.detail(next)).job.due_date,'2028-04-15');assert.equal((await s.state()).attempts.filter(x=>x.rule_id===proposals.id).length,1);
  const template=await h.json('/templates',{name:'Ownership organizer work',recurrence:'annual',steps:'Inspect response',requests:'Statement',organizer:{name:'Ownership questions',kind:'bookkeeping',questions:[{key:'owner',label:'Who owns the company?',type:'text',required:true}]}},h.owner);
  const job=await h.json('/jobs',{clientId:s.client.id,templateId:template.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Recorded client engagement',preparerEmail:'prep@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
  const organizer=(await h.json(`/jobs/${job.id}/organizers`,undefined,h.owner)).organizers[0];
  const contact=s.client.contacts[0];const sent=await h.json(`/jobs/${job.id}/organizers/send`,{revision:organizer.revision,assignments:{owner:contact.id},templateId:s.message.id},s.prep);
  const token=new URL(sent.recipients[0].portalUrl).pathname.split('/').at(-1);
  const organizerRule=await s.rule({kind:'organizer_complete'},{kind:'request',label:'Inspect submitted ownership'});
  let clientOrganizer=(await h.json(`/portal/${token}/organizers`)).organizers[0];
  await h.json(`/portal/${token}/organizers/${organizer.id}`,{revision:clientOrganizer.revision,answers:{owner:{value:'Alex Rivera',confirmed:true}},submit:false});await s.run();assert.ok(!(await s.detail(job.id)).requests.some(x=>x.label==='Inspect submitted ownership'));
  clientOrganizer=(await h.json(`/portal/${token}/organizers`)).organizers[0];
  await h.json(`/portal/${token}/organizers/${organizer.id}`,{revision:clientOrganizer.revision,answers:{},submit:true});await s.run();await s.run();assert.equal((await s.detail(job.id)).requests.filter(x=>x.label==='Inspect submitted ownership').length,1);assert.equal((await s.state()).attempts.filter(x=>x.rule_id===organizerRule.id).length,1);
  clientOrganizer=(await h.json(`/portal/${token}/organizers`)).organizers[0];
  await h.json(`/portal/${token}/organizers/${organizer.id}`,{revision:clientOrganizer.revision,answers:{owner:{value:'Alex Rivera, corrected ownership',confirmed:true}},submit:true});
  const beforeErasure=(await h.json(`/jobs/${job.id}/organizers`,undefined,h.owner)).organizers[0];
  await h.json(`/organizers/${organizer.id}/erase`,{revision:beforeErasure.revision,confirm:'Ownership questions',reason:'Client erasure request'},h.owner);
  await s.run();assert.equal((await s.detail(job.id)).requests.filter(x=>x.label==='Inspect submitted ownership').length,1);assert.ok((await s.state()).attempts.some(x=>x.rule_id===organizerRule.id&&/erased/.test(x.outcome)));
  const replacement=await s.rule({kind:'status',stage:'ready'},{kind:'request',label:'Replacement version'},10,{ruleId:requests.id});
  const state=await s.state();assert.equal(state.rules.find(x=>x.id===requests.id).status,'revoked');assert.equal(state.rules.find(x=>x.id===replacement.id).version,2);
  // Use Base's real fresh-proof and account-role doors to remove the approving principal's authority.
  let response=await h.request('/auth/step-up',{action:'owner:transfer',returnTo:'/app'},h.owner);assert.equal(response.status,202,await response.text());
  const proof=h.mails.at(-1).text.match(/\/auth\/confirm\?token=([^\s"&<]+)/)[1];response=await h.request('/auth/confirm',{token:proof},h.owner);assert.equal(response.status,303,await response.text());
  const operators=await(await h.request('/auth/operators',undefined,h.owner)).json();
  const owner=operators.find(x=>x.email==='owner@example.test'),successor=operators.find(x=>x.email==='reviewer@example.test');
  response=await h.request('/auth/operator/role',{operatorId:successor.id,role:'owner'},h.owner);assert.equal(response.status,200,await response.text());
  const authorityRule=await s.rule({kind:'due',at:'2028-01-01T00:00:00Z'},{kind:'request',label:'No authority, no action'});
  response=await h.request('/auth/operator/role',{operatorId:owner.id,role:'member'},h.owner);assert.equal(response.status,200,await response.text());
  const before=(await h.json(`/jobs/${job.id}`,undefined,s.prep)).requests.length;
  await h.scheduled('2028-01-01T00:00:00Z');
  assert.equal((await h.json(`/jobs/${job.id}`,undefined,s.prep)).requests.length,before);
  const successorCookie=await h.login('reviewer@example.test');
  assert.ok((await h.json('/automation',undefined,successorCookie)).attempts.some(x=>x.rule_id===authorityRule.id&&x.status==='refused'&&/principal.*authority/.test(x.outcome)));
 } finally {await h.close();}
});


test('AUTOMATE-001 / WORK-006 / WORK-007: principal previews, saves and enables rules in the app, board actions run once and completed/held outcomes render at 1440 and 390',async()=>{
 let uncertain=false;
 const h=await harness({mailResponse:(mail,mails)=>{if(uncertain&&mail.subject.startsWith('Documents for')){uncertain=false;throw new Error('Provider accepted; response interrupted');}return Response.json({id:'accepted-'+mails.length});}});
 try {const s=await fixture(h);await automationAppJourney(h,s,()=>{uncertain=true;});} finally {await h.close();}
});


test('AUTOMATE-001 / BASE-001: actual Worker interruption after provider acceptance retains dispatching and requires reconciliation after restart',async()=>{
 let block=false, release, accepted;
 const arrived=new Promise(resolve=>{accepted=resolve;});
 const h=await harness({mailResponse:(mail,mails,request)=>{
  if(block&&mail.subject.startsWith('Documents for')) {
   block=false;accepted();
   return new Promise(resolve=>{
    const finish=()=>resolve(Response.json({id:'provider-accepted-before-interruption'}));
    const timer=setTimeout(finish,20000);release=()=>{clearTimeout(timer);finish();};
    request.signal.addEventListener('abort',release,{once:true});
   });
  }
  return Response.json({id:'mail-'+mails.length});
 }});
 try {
  const s=await fixture(h),job=await s.start();
  const r=await s.rule({kind:'status',stage:'waiting',subStatusId:s.docs.id},{kind:'reminder',templateId:s.message.id});
  await s.move(job.id,'waiting',s.docs.id);block=true;
  const pending=s.run().catch(error=>({interrupted:error.message}));
  await arrived;const sends=h.mails.length;
  await h.restart();release?.();await pending;
  const interrupted=(await s.state()).attempts.find(a=>a.rule_id===r.id);
  assert.equal(interrupted.status,'dispatching','The old Worker stopped before recording the provider outcome');
  await s.run();assert.equal(h.mails.length,sends);assert.equal((await s.state()).attempts.find(a=>a.id===interrupted.id).status,'held');
 } finally {release?.();await h.close();}
});
