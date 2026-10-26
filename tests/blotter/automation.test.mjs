import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {automationFixture as fixture} from './automation-fixture.mjs';
import {automationAppJourney,followupOffboardingJourney,followupPortalJourney} from './automation-ui.mjs';


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
  const restored=await harness();copies.push(restored);await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},restored.owner);
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


test('AUTOMATE-001 / ACCESS-006 / WORK-006 / WORK-007: principal previews, saves and enables rules in the app, board actions run once and completed/held outcomes render at 1440 and 390',async()=>{
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
  await s.rule({kind:'due',at:'2027-01-01T00:00:00Z'},{kind:'assign',role:'manager',email:'reviewer@example.test'});await h.scheduled('2027-01-01T12:00:00Z');
  const sequence=await h.json('/followups',{name:'Interrupted sequence',jobId:job.id,ownerEmail:'prep@example.test',contactId:s.client.contacts[0].id,steps:[s.message.id,s.message.id],maximumSends:2,cadenceHours:24,startAt:'2027-01-04T14:00:00Z',timezone:'America/New_York',weekdays:[1,2,3,4,5],startHour:9,endHour:17,escalateAfter:2,confirm:'APPROVE'},h.owner);
  const arriving=new Promise(resolve=>{accepted=resolve;});block=true;
  const inFlight=h.scheduled('2027-01-04T14:00:00Z').catch(error=>({interrupted:error.message}));await arriving;
  const acceptedCount=h.mails.length;await h.restart();release?.();await inFlight;
  assert.equal((await h.json('/followups',undefined,h.owner)).attempts.find(a=>a.sequence_id===sequence.id).status,'dispatching');
  await h.scheduled('2027-01-04T15:00:00Z');assert.equal(h.mails.length,acceptedCount);
  const recovered=await h.json('/followups',undefined,h.owner);assert.equal(recovered.sequences.find(f=>f.id===sequence.id).status,'held');assert.equal(recovered.attempts.find(a=>a.sequence_id===sequence.id).status,'held');

 } finally {release?.();await h.close();}
});

test('FOLLOWUP-001: bounded document sequences re-render current templates, recheck missing items, pause without replay, escalate and transfer the next sender',async()=>{
 const h=await harness();
 try {
  const s=await fixture(h),a=await s.start();
  const add=await s.rule({kind:'due',at:'2027-01-01T00:00:00Z'},{kind:'request',label:'1099 interest'});await h.scheduled('2027-01-01T12:00:00Z');
  await h.json(`/automation/${add.id}/pause`,{},h.owner);
  await s.rule({kind:'due',at:'2027-01-01T00:00:00Z'},{kind:'assign',role:'manager',email:'reviewer@example.test'});await h.scheduled('2027-01-01T12:00:00Z');
  const template=await h.json('/messages/templates',{name:'Month-end close request',scope:'firm',subject:'Documents for {{client_name}} {{period}}',body:'{{sender_name}} requests {{outstanding_requests}} at {{portal_link}}',attachments:[{name:'synthetic-blotter-7.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-7').toString('base64')}]},h.owner);
  const input={name:'Close documents',jobId:a.id,ownerEmail:'prep@example.test',contactId:s.client.contacts[0].id,steps:[template.id,template.id,template.id],maximumSends:3,cadenceHours:24,startAt:'2027-01-04T14:00:00Z',timezone:'America/New_York',weekdays:[1,2,3,4,5],startHour:9,endHour:17,escalateAfter:2,confirm:'APPROVE'};
  await h.json('/followups',input,s.prep,403);await h.json('/followups',input,'',401);
  const otherClient=await h.json('/clients',{name:'Maple Ridge LLC',contactName:'Taylor Chen',contactEmail:'synthetic-blotter-3@example.test'},h.owner),otherJob=await s.start(otherClient.id,'2025-01-01');
  await s.rule({kind:'due',at:'2027-01-01T00:00:00Z'},{kind:'assign',role:'manager',email:'reviewer@example.test'},1,{clientIds:[otherClient.id]});await h.scheduled('2027-01-01T12:00:00Z');
  const f=await h.json('/followups',input,h.owner),otherSequence=await h.json('/followups',{...input,name:'Maple documents',jobId:otherJob.id,contactId:otherClient.contacts[0].id},h.owner);
  const clientMail=()=>h.mails.toReversed().find(m=>m.to.includes('alex@example.test')),otherMail=()=>h.mails.toReversed().find(m=>m.to.includes('synthetic-blotter-3@example.test'));
  const state=()=>h.json('/followups',undefined,h.owner),get=async()=>(await state()).sequences.find(x=>x.id===f.id);
  const before=h.mails.length;
  await h.scheduled('2027-01-04T13:59:59Z');assert.equal(h.mails.length,before,'No send before local business hours');
  await h.scheduled('2027-01-04T14:00:00Z');const first=clientMail();assert.match(first.text,/- W-2\n- 1099 interest/);assert.match(first.subject,/Cedar Lane LLC/);assert.match(first.text,/prep@example.test/);assert.match(otherMail().subject,/Maple Ridge LLC/);assert.notEqual(first.subject,otherMail().subject,'Each client and period is rendered independently');assert.notEqual((await s.detail(a.id)).job.period_label,(await s.detail(otherJob.id)).job.period_label);
  assert.equal((await get()).used,1);assert.equal((await state()).attempts.filter(x=>x.sequence_id===f.id).length,1);
  assert.deepEqual(first.attachments.map(f=>[f.filename,Buffer.from(f.content,'base64').toString()]),[['synthetic-blotter-7.txt','synthetic-blotter-7']]);
  const afterFirst=h.mails.length;await h.scheduled('2027-01-04T14:00:00Z');assert.equal(h.mails.length,afterFirst);
  const detail=await s.detail(a.id),w2=detail.requests.find(x=>x.label==='W-2');
  await h.json(`/requests/${w2.id}/files`,{name:'synthetic-blotter-1.txt',contentBase64:Buffer.from('synthetic-blotter-1').toString('base64')},s.prep);
  await h.json(`/requests/${w2.id}/decide`,{decision:'accept'},s.prep);
  await h.json(`/messages/templates/${template.id}`,{subject:'Updated {{client_name}} {{period}}',body:'Later wording from {{sender_name}}: {{outstanding_requests}} {{portal_link}}',attachments:[{name:'synthetic-blotter-8.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-8').toString('base64')}]},h.owner);
  await h.json(`/followups/${f.id}/paused`,{revision:(await get()).revision},h.owner);
  await h.json(`/followups/${otherSequence.id}/paused`,{revision:(await state()).sequences.find(x=>x.id===otherSequence.id).revision},h.owner);
  await h.scheduled('2027-01-05T14:00:00Z');assert.equal(h.mails.length,afterFirst);
  await h.json(`/followups/${f.id}/active`,{revision:(await get()).revision,confirm:'APPROVE'},h.owner);
  await h.json(`/followups/${otherSequence.id}/active`,{revision:(await state()).sequences.find(x=>x.id===otherSequence.id).revision,confirm:'APPROVE'},h.owner);
  await h.scheduled('2027-01-05T14:00:00Z');const second=clientMail();assert.match(otherMail().subject,/^Updated Maple Ridge LLC/);assert.match(otherMail().text,/W-2/);assert.doesNotMatch(otherMail().text,/1099 interest/);assert.match(second.subject,/^Updated Cedar Lane LLC/);assert.match(second.text,/1099 interest/);assert.doesNotMatch(second.text,/W-2/);assert.equal(second.attachments[0].filename,'synthetic-blotter-8.txt');assert.equal(first.attachments[0].filename,'synthetic-blotter-7.txt');
  const notifications=await h.json('/notifications',undefined,s.reviewer);assert.equal(notifications.filter(x=>x.kind==='followup_escalated'&&x.job_id===a.id).length,1);
  await followupOffboardingJourney(h);
  const off={email:'prep@example.test',workSuccessor:'other@example.test',reviewSuccessor:'owner@example.test'};
  const preview=await h.json('/team/offboard/preview',off,h.owner);assert.deepEqual(preview.followups.map(x=>x.id).sort(),[f.id,otherSequence.id].sort());
  const committed=await h.json('/team/offboard',{...off,fingerprint:preview.fingerprint},h.owner);assert.equal(committed.moved.followups,2);
  await h.scheduled('2027-01-06T14:00:00Z');assert.equal((await get()).status,'completed',JSON.stringify(await state()));assert.match(clientMail().text,/other@example.test/);assert.equal((await get()).status,'completed');
  const attempts=(await state()).attempts.filter(x=>x.sequence_id===f.id);assert.deepEqual(attempts.map(x=>[x.step,x.sender,x.status]).sort((a,b)=>a[0]-b[0]),[[1,'prep@example.test','accepted'],[2,'prep@example.test','accepted'],[3,'other@example.test','accepted']]);
  const history=(await s.detail(a.id)).reminders;assert.equal(history.find(x=>x.id===attempts.find(x=>x.step===1).id).sent_by,'prep@example.test');assert.match(history.find(x=>x.template_version===1).message,/W-2/);assert.equal(first.subject,history.find(x=>x.template_version===1).subject);
  const final=h.mails.length;await h.scheduled('2027-01-07T14:00:00Z');assert.equal(h.mails.length,final,'Maximum attempts is a lifetime bound');
 }finally{await h.close();}
});

test('FOLLOWUP-001 / BASE-001: unresolved values and uncertain mail hold with owned alerts; consent loss, client response and inactive restored authority prevent sends',async()=>{
 let fail=false;
 const h=await harness({mailResponse:(mail,mails)=>{if(fail==='rejected'&&mail.subject.startsWith('Documents for'))return Response.json({name:'validation_error',message:'synthetic-blotter-2 rejected'},{status:422});if(fail&&mail.subject.startsWith('Documents for'))throw new Error('synthetic-blotter-2 response lost');return Response.json({id:'synthetic-blotter-'+mails.length});}}),copies=[];
 try {
  const s=await fixture(h),a=await s.start();
  await s.rule({kind:'due',at:'2027-01-01T00:00:00Z'},{kind:'assign',role:'manager',email:'reviewer@example.test'});await h.scheduled('2027-01-01T12:00:00Z');
  const input={name:'Document follow-up',jobId:a.id,ownerEmail:'prep@example.test',contactId:s.client.contacts[0].id,steps:[s.message.id,s.message.id],maximumSends:2,cadenceHours:24,startAt:'2027-01-04T14:00:00Z',timezone:'America/New_York',weekdays:[1,2,3,4,5],startHour:9,endHour:17,escalateAfter:2,confirm:'APPROVE'};
  const marketing=await h.json('/messages/templates',{name:'No marketing chase',scope:'firm',class:'marketing',subject:'News',body:'Firm news'},h.owner);
  await h.json('/followups',{...input,steps:[marketing.id]},h.owner,409);
  const f=await h.json('/followups',input,h.owner),key=await h.json('/keys',{label:'synthetic-blotter-no-followup-authority'},h.owner);
  for(const [path,body] of [['/followups',undefined],['/followups/run',{}],[`/followups/${f.id}/paused`,{}],[`/followups/${f.id}/active`,{}],[`/followups/${f.id}/stopped`,{}]]) {
   await h.json(path,body,s.reviewer,403);await h.json(path,body,'',401,{authorization:'Bearer '+key.key});
  }
  const originDenied=await h.send('/api/blotter/followups',input,h.owner,{origin:'https://outside.example.test'});assert.equal(originDenied.status,403);
  fail=true;const before=h.mails.length;await h.scheduled('2027-01-04T14:00:00Z');assert.equal(h.mails.length,before+1);
  let state=await h.json('/followups',undefined,h.owner);assert.equal(state.sequences.find(x=>x.id===f.id).status,'held');assert.equal(state.attempts.filter(x=>x.sequence_id===f.id).length,1);assert.equal(state.attempts.find(x=>x.sequence_id===f.id).delivery,'uncertain by resend');
  assert.ok((await h.json('/notifications',undefined,s.prep)).some(x=>x.kind==='followup_failed'&&/not confirmed/.test(x.summary)));
  await h.restart();await h.scheduled('2027-01-05T14:00:00Z');assert.equal(h.mails.length,before+1,'Uncertain accepted mail never replays after restart');fail=false;
  const heldAttempt=state.attempts.find(x=>x.sequence_id===f.id);
  await h.json(`/followups/attempts/${heldAttempt.id}/reconcile`,{outcome:'accepted',reason:'Provider dashboard confirms this exact delivery'},s.reviewer,403);
  await h.json(`/followups/attempts/${heldAttempt.id}/reconcile`,{outcome:'accepted',reason:'Provider dashboard confirms this exact delivery'},h.owner);
  await h.json(`/followups/attempts/${heldAttempt.id}/reconcile`,{outcome:'not_accepted',reason:'Duplicate decision'},h.owner,409);
  const rejected=await h.json('/followups',input,h.owner);fail='rejected';await h.scheduled('2027-01-04T14:00:00Z');fail=false;
  const rejectedAttempt=(await h.json('/followups',undefined,h.owner)).attempts.find(x=>x.sequence_id===rejected.id);assert.equal(rejectedAttempt.status,'failed');assert.equal(rejectedAttempt.delivery,'rejected by resend');
  assert.ok((await h.json('/notifications',undefined,s.prep)).some(x=>x.kind==='followup_failed'&&/rejected by resend/.test(x.summary)));
  const missing=await h.json('/messages/templates',{name:'Missing invoice amount',scope:'firm',subject:'Invoice {{invoice_amount}}',body:'Please send {{outstanding_requests}}'},h.owner);
  const held=await h.json('/followups',{...input,steps:[missing.id],maximumSends:1,escalateAfter:1},h.owner);
  const noSend=h.mails.length;await h.scheduled('2027-01-04T14:00:00Z');state=await h.json('/followups',undefined,h.owner);assert.equal(h.mails.length,noSend);assert.match(state.sequences.find(x=>x.id===held.id).reason,/Unresolved placeholders: invoice amount/);assert.equal(state.attempts.filter(x=>x.sequence_id===held.id).length,0);
  assert.ok((await h.json('/notifications',undefined,s.prep)).some(x=>x.kind==='followup_failed'&&/invoice amount/.test(x.summary)));
  const responding=await h.json('/followups',input,h.owner);
  const sent=await h.json(`/jobs/${a.id}/reminders`,{templateId:s.message.id},s.prep),token=new URL(sent.portalUrl).pathname.split('/').at(-1);
  await h.json(`/portal/${token}/messages`,{body:'I will send the remaining W-2 tomorrow.'});
  await h.scheduled('2027-01-04T14:00:00Z');state=await h.json('/followups',undefined,h.owner);assert.equal(state.sequences.find(x=>x.id===responding.id).status,'stopped');assert.equal(state.attempts.filter(x=>x.sequence_id===responding.id).length,0);
  const consent=await h.json('/followups',input,h.owner),contact=(await h.json(`/clients/${s.client.id}/contacts`,undefined,h.owner))[0];
  await h.json(`/clients/${s.client.id}/contacts`,{id:contact.id,revision:contact.revision,emailConsent:false},h.owner);
  const noConsent=h.mails.length;await h.scheduled('2027-01-04T14:00:00Z');assert.equal(h.mails.length,noConsent);assert.equal((await h.json('/followups',undefined,h.owner)).sequences.find(x=>x.id===consent.id).status,'held');
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.match(archive,/followup.approved/);assert.match(archive,/Human reconciliation: accepted/);assert.match(archive,/followup.reconciled/);
  const copy=await harness();copies.push(copy);await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},copy.owner);
  const restored=await copy.json('/followups',undefined,copy.owner);assert.ok(restored.sequences.length>=4);assert.ok(restored.sequences.every(x=>x.status==='paused'||x.status==='stopped'||x.status==='completed'));assert.ok(restored.sequences.every(x=>x.principal_id===null));
  const previous=copy.mails.length;await copy.scheduled('2027-01-05T14:00:00Z');assert.equal(copy.mails.length,previous);
  const changed=(await h.json(`/clients/${s.client.id}/contacts`,undefined,h.owner))[0];await h.json(`/clients/${s.client.id}/contacts`,{id:changed.id,revision:changed.revision,emailConsent:true},h.owner);
  const scoped=await h.json('/followups',input,h.owner);await h.json('/access/people',{email:'prep@example.test',readOnly:false,clientIds:[]},h.owner);
  const privateCount=h.mails.length;await h.scheduled('2027-01-04T14:00:00Z');assert.equal(h.mails.length,privateCount);assert.equal((await h.json('/followups',undefined,h.owner)).sequences.find(x=>x.id===scoped.id).status,'held');
  await h.json('/access/people',{email:'prep@example.test',readOnly:false,clientIds:[s.client.id]},h.owner);
  const readOnly=await h.json('/followups',input,h.owner);await h.json('/access/people',{email:'prep@example.test',readOnly:true,clientIds:[s.client.id]},h.owner);
  await h.scheduled('2027-01-04T14:00:00Z');assert.equal(h.mails.length,privateCount);assert.equal((await h.json('/followups',undefined,h.owner)).sequences.find(x=>x.id===readOnly.id).status,'held');
  await h.json('/access/people',{email:'prep@example.test',readOnly:false,clientIds:[s.client.id]},h.owner);
  const authority=await h.json('/followups',input,h.owner);
  let response=await h.request('/auth/step-up',{action:'owner:transfer',returnTo:'/app'},h.owner);assert.equal(response.status,202);
  const proof=h.mails.at(-1).text.match(/\/auth\/confirm\?token=([^\s"&<]+)/)[1];response=await h.request('/auth/confirm',{token:proof},h.owner);assert.equal(response.status,303);
  const operators=await(await h.request('/auth/operators',undefined,h.owner)).json();
  const principal=operators.find(x=>x.email==='owner@example.test'),successor=operators.find(x=>x.email==='reviewer@example.test');
  assert.equal((await h.request('/auth/operator/role',{operatorId:successor.id,role:'owner'},h.owner)).status,200);
  assert.equal((await h.request('/auth/operator/role',{operatorId:principal.id,role:'member'},h.owner)).status,200);
  const revokedCount=h.mails.length;await h.scheduled('2027-01-04T14:00:00Z');assert.equal(h.mails.length,revokedCount);
  const revoked=(await h.json('/followups',undefined,s.reviewer)).sequences.find(x=>x.id===authority.id);assert.equal(revoked.status,'held');assert.match(revoked.reason,/principal no longer has authority/);


 }finally{await h.close();for(const copy of copies)await copy.close();}
});

test('FOLLOWUP-001: portal steps expose only the recipient’s current actionable organizer, signature and client questions and stop completed or declined items',async()=>{
 const h=await harness();
 try {
  const s=await fixture(h),contact=(await h.json(`/clients/${s.client.id}/contacts`,undefined,h.owner))[0];
  await h.json(`/clients/${s.client.id}/contacts`,{id:contact.id,revision:contact.revision,signer:true},h.owner);
  const other=await h.json(`/clients/${s.client.id}/contacts`,{name:'Blair Bookkeeper',email:'synthetic-blotter-4@example.test',roles:['bookkeeping'],authorized:true,portal:true,requestConsent:true,emailConsent:true,signer:true},h.owner);
  const template=await h.json('/templates',{name:'Close with organizer',recurrence:'annual',steps:'Inspect response',requests:'Bank statement',organizer:{name:'Ownership',kind:'bookkeeping',questions:[{key:'owner',label:'Who owns the company?',type:'text',required:true},{key:'private',label:'Other contact only',type:'text',required:true}]}},h.owner);
  const a=await h.json('/jobs',{clientId:s.client.id,templateId:template.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Agreed engagement',preparerEmail:'prep@example.test',reviewerEmail:'reviewer@example.test',managerEmail:'reviewer@example.test'},h.owner);
  const organizer=(await h.json(`/jobs/${a.id}/organizers`,undefined,h.owner)).organizers[0];
  const invitations=await h.json(`/jobs/${a.id}/organizers/send`,{revision:organizer.revision,assignments:{owner:contact.id,private:other.id},templateId:s.message.id},s.prep);
  const tokenFor=id=>new URL(invitations.recipients.find(x=>x.contactId===id).portalUrl).pathname.split('/').at(-1);
  const {PDFDocument}=await import('pdf-lib'),pdf=await PDFDocument.create();pdf.addPage([612,792]);
  const signature=await h.json(`/jobs/${a.id}/signatures`,{title:'Management representation',formKind:'management representation',mode:'parallel',contactIds:[contact.id],fields:[{type:'signature',contactId:contact.id,page:1,x:40,y:100,width:240,height:28,label:'Client signature'}],file:{name:'synthetic-blotter-5.pdf',mime:'application/pdf',contentBase64:Buffer.from(await pdf.save()).toString('base64')}},s.prep);
  await h.json(`/signatures/${signature.id}/send`,{revision:signature.revision},s.prep);
  await h.json(`/jobs/${a.id}/portal/todos`,{body:'Confirm bank account ownership'},s.prep);
  const personal=await h.json(`/messages/templates/${s.message.id}/copy`,{name:'Personal close reminder'},s.prep);
  const input={name:'Portal close reminders',jobId:a.id,ownerEmail:'prep@example.test',contactId:contact.id,channel:'portal',steps:[personal.id,personal.id,personal.id],maximumSends:3,cadenceHours:24,startAt:'2027-01-04T14:00:00Z',timezone:'America/New_York',weekdays:[1,2,3,4,5],startHour:9,endHour:17,escalateAfter:3,confirm:'APPROVE'};
  const f=await h.json('/followups',input,h.owner),mailCount=h.mails.length;await h.scheduled('2027-01-04T14:00:00Z');assert.equal(h.mails.length,mailCount,'Portal steps do not claim email delivery');
  const reminders=(await h.json(`/jobs/${a.id}`,undefined,h.owner)).reminders;assert.equal(reminders.length,1);assert.deepEqual(JSON.parse(reminders[0].outstanding),['Bank statement','Who owns the company?','Management representation','Confirm bank account ownership']);
  assert.equal(reminders[0].delivery,'posted to portal (no email sent)');
  const currentLink=await h.json(`/jobs/${a.id}/reminders`,{contactId:contact.id},s.prep),ownToken=new URL(currentLink.portalUrl).pathname.split('/').at(-1);
  const own=await h.json(`/portal/${ownToken}`),outside=await h.json(`/portal/${tokenFor(other.id)}`);
  assert.equal(own.messages.filter(x=>x.id===reminders[0].id).length,1);assert.equal(outside.messages.filter(x=>x.id===reminders[0].id).length,0,'Other contacts cannot see a recipient-bound step');
  await followupPortalJourney(h,ownToken,tokenFor(other.id),own.messages.find(x=>x.id===reminders[0].id).body);
  let mine=(await h.json(`/portal/${ownToken}/organizers`)).organizers[0];
  await h.json(`/portal/${ownToken}/organizers/${organizer.id}`,{revision:mine.revision,answers:{owner:{value:'Alex Rivera',confirmed:true}},submit:true});
  let signing=await h.json(`/signatures/${signature.id}`,undefined,h.owner);
  await h.json(`/portal/${ownToken}/signatures/${signature.id}/decline`,{revision:signing.revision,reason:'Please correct the representation'});
  const todo=own.todos.find(x=>x.body==='Confirm bank account ownership');await h.json(`/portal/${ownToken}/todos/${todo.id}`,{});
  await h.scheduled('2027-01-05T14:00:00Z');
  const later=(await h.json(`/jobs/${a.id}`,undefined,h.owner)).reminders.find(x=>x.id!==reminders[0].id);assert.deepEqual(JSON.parse(later.outstanding),['Bank statement']);
  const req=(await h.json(`/jobs/${a.id}`,undefined,h.owner)).requests[0];await h.json(`/requests/${req.id}/files`,{name:'synthetic-blotter-6.txt',contentBase64:Buffer.from('synthetic-blotter-6').toString('base64')},s.prep);await h.json(`/requests/${req.id}/decide`,{decision:'accept'},s.prep);
  await h.scheduled('2027-01-06T14:00:00Z');const final=await h.json('/followups',undefined,h.owner);assert.equal(final.sequences.find(x=>x.id===f.id).status,'stopped');assert.deepEqual(final.attempts.filter(x=>x.sequence_id===f.id).map(x=>x.status),['posted','posted']);
 }finally{await h.close();}
});
