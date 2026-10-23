import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {automationFixture} from './automation-fixture.mjs';
import {enroll} from './erasure-fixture.mjs';
import {serviceAgentsJourney} from './service-agents-ui.mjs';
export async function price(h,cents=25,limit=1000){
 const p=await h.json('/costs/prices',{service:'agent_plan',included:0,unitCents:cents,basisPoints:0,source:'synthetic-blotter-1: native plan cost estimate'},h.owner);
 await h.json('/costs/budget',{limitCents:limit,thresholdCents:limit,reason:'Explicit lifetime optional-action budget'},h.owner);
 await h.json('/costs/services/agent_plan',{revision:p.revision,enabled:true,reason:'Approve this native plan estimate'},h.owner);
 return p;
}
export async function rule(h,s,key,extra={}) {return h.json('/agent-rules',{name:'Cedar supervised plans',clientId:s.client.id,keyId:key.id,trigger:'file',tool:'reminder',budget:20,...extra},h.owner);}
export async function upload(h,s,job,label='source.txt') {const d=await s.detail(job.id);return h.json(`/requests/${d.requests[0].id}/files`,{name:label,mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-2').toString('base64')},s.prep);}

test('COST-001 / BASE-001: sourced USD seasonal estimates, included quantities, payment rounding and unavailable-provider activation',async()=>{
 const h=await harness();try{
  const s=await automationFixture(h);await h.json('/costs',undefined,s.prep,403);await h.json('/costs/prices',{},s.reviewer,403);
  const empty=await h.json('/costs/estimate',{items:[{service:'ai',quantity:4}]},h.owner);assert.equal(empty.totalCents,null);await h.json('/costs/estimate',{items:[{service:'ai',quantity:2},{service:'ai',quantity:2}]},h.owner,400);
  const services=['subscription','seats','storage','ai','signatures','kba','email','sms','ach','card'];
  for(const service of services)await h.json('/costs/prices',{service,included:2,unitCents:15,basisPoints:['ach','card'].includes(service)?125:0,source:'synthetic-blotter-3: dated vendor quote, USD'},h.owner);
  const estimate=await h.json('/costs/estimate',{items:services.map(service=>({service,quantity:5,amountCents:['ach','card'].includes(service)?101:0}))},h.owner);
  assert.equal(estimate.totalCents,454);for(const i of estimate.items){assert.equal(i.included,2);assert.equal(i.unitCents,15);assert.equal(i.enabled,false);assert.equal(i.estimatedCents,['ach','card'].includes(i.service)?47:45);assert.match(i.source,/dated vendor quote/);}
  await h.json('/costs/services/card',{revision:estimate.items.at(-1).revision,enabled:true,reason:'Cannot enable missing payment capability'},h.owner,409);
  const fresh=await h.login('owner@example.test');const refused=await h.send('/api/blotter/costs/export',undefined,fresh);assert.equal(refused.status,403);assert.equal((await refused.json()).mfa,'step-up');
  const exported=await h.request('/api/blotter/costs/export',undefined,fresh);assert.equal(exported.status,200);assert.match(exported.headers.get('content-disposition'),/blotter-service-usage/);const portable=await exported.json();assert.equal(portable.currency,'USD');assert.equal(portable.priceVersions.length,10);assert.equal(portable.prices.length,10);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.match(archive,/cost.exported/);
  const bad=await h.request('/api/blotter/costs/budget',{limitCents:100,thresholdCents:100,reason:'Cross-site'},h.owner,{origin:'https://outside.example.test'});assert.equal(bad.status,403);
 }finally{await h.close();}
});

test('COST-001 / AI-003 / BASE-001: budget exception notifies its owner; approved increase retries the same optional action without duplicate plan or usage',async()=>{
 const h=await harness();try{
  const s=await automationFixture(h),j=await s.start(),key=await h.json('/keys',{label:'Budgeted native agent'},h.owner);
  await h.json('/agent-rules',{name:'Unpriced agent',clientId:s.client.id,keyId:key.id,trigger:'file',tool:'reminder',budget:1},h.owner,409);await price(h,25,0);await rule(h,s,key);const file=await upload(h,s,j);
  await h.json('/agent-rules/run',{},h.owner);await h.json('/agent-rules/run',{},h.owner);
  let state=await h.json('/agent-rules',undefined,h.owner);assert.equal(state.runs.length,1);assert.equal(state.runs[0].status,'blocked');assert.match(state.runs[0].event_key,new RegExp(file.id));
  let costs=await h.json('/costs',undefined,h.owner);assert.equal(costs.usage.length,1);assert.equal(costs.usage[0].status,'blocked');assert.equal(costs.reservedCents,0);
  const notices=await h.json('/notifications',undefined,h.owner);assert.equal(notices.filter(n=>n.kind==='service_budget').length,1);
  await h.json('/costs/budget',{limitCents:100,thresholdCents:25,reason:'Principal approves additional native preparation'},h.owner);
  await h.json('/agent-rules/run',{},h.owner);await h.json('/agent-rules/run',{},h.owner);state=await h.json('/agent-rules',undefined,h.owner);
  assert.equal(state.runs.length,1);assert.equal(state.runs[0].status,'prepared');assert.equal(state.rules[0].used,1);assert.equal(state.runs[0].decision,'pending');
  costs=await h.json('/costs',undefined,h.owner);assert.equal(costs.usage.length,1);assert.equal(costs.reservedCents,25);
  await h.json(`/costs/usage/${costs.usage[0].action_id}/reconcile`,{cents:0,receipt:'Native execution: no external provider charge'},h.owner);
  await h.json(`/costs/usage/${costs.usage[0].action_id}/reconcile`,{cents:0,receipt:'Duplicate reconciliation'},h.owner,409);
  costs=await h.json('/costs',undefined,h.owner);assert.equal(costs.usage[0].confirmed_cents,0);assert.equal(costs.reservedCents,25,'Conservative reservation stays bounded even after reconciliation');
  await h.json('/costs/prices',{service:'agent_plan',included:0,unitCents:50,basisPoints:0,source:'synthetic-blotter-4: replacement quote'},h.owner);const revised=await h.json('/costs',undefined,h.owner);assert.equal(revised.priceVersions.find(p=>p.revision===costs.usage[0].price_revision).unit_cents,25);assert.equal(revised.prices[0].enabled,0,'Price changes need fresh enablement');
  assert.equal((await s.detail(j.id)).job.status,'open');assert.equal((await s.detail(j.id)).job.due_date,'2027-04-15','A budget exception never hides or changes the deadline');assert.equal((await s.detail(j.id)).requests[0].files.length,1);
  const mailBefore=h.mails.length;await h.json(`/proposals/${state.runs[0].proposal_id}/decide`,{decision:'decline',reason:'No chase needed'},h.owner);assert.equal(h.mails.length,mailBefore);
 }finally{await h.close();}
});

test('AI-003 / BASE-001: scoped file and scheduled plans de-duplicate, refuse ungranted tools, stop on live key revocation and preserve attributed outcomes',async()=>{
 const h=await harness();try{
  const s=await automationFixture(h),j=await s.start(),outside=await s.start(s.outside.id),key=await h.json('/keys',{label:'One-client agent'},h.owner);await price(h);
  await h.json('/agent-rules',{},s.reviewer,403);
  await h.json('/agent-rules',{name:'No sending',clientId:s.client.id,keyId:key.id,trigger:'file',tool:'send-message',budget:1},h.owner,400);
  const fileRule=await rule(h,s,key,{budget:1});await upload(h,s,j);await upload(h,s,outside);await h.json('/agent-rules/run',{},h.owner);await h.json('/agent-rules/run',{},h.owner);
  let state=await h.json('/agent-rules',undefined,h.owner);assert.equal(state.runs.length,1);assert.equal(state.runs[0].job_id,j.id);assert.equal(state.rules[0].used,1);assert.match(state.rules[0].model_policy,/no model or external provider/i);
  const context=await h.json('/agent/context',undefined,'',200,{authorization:'Bearer '+key.key});assert.equal(context.jobs.length,1);assert.equal(context.jobs[0].id,j.id);assert.deepEqual(context.unbilled,[]);
  await h.json('/agent/prepare-reminder',{jobId:j.id},'',403,{authorization:'Bearer '+key.key});
  await upload(h,s,j,'second.txt');await h.json('/agent-rules/run',{},h.owner);state=await h.json('/agent-rules',undefined,h.owner);assert.ok(state.runs.some(r=>r.status==='refused'&&/budget/.test(r.outcome)));
  const schedule=await rule(h,s,key,{trigger:'schedule',startsAt:'2027-01-02T09:00:00-05:00',everyHours:24,budget:3});
  await h.scheduled('2027-01-02T13:59:59Z');assert.equal((await h.json('/agent-rules',undefined,h.owner)).runs.filter(r=>r.rule_id===schedule.id).length,0);
  await h.scheduled('2027-01-02T14:00:00Z');await h.scheduled('2027-01-02T14:00:00Z');state=await h.json('/agent-rules',undefined,h.owner);assert.equal(state.runs.filter(r=>r.rule_id===schedule.id).length,1);
  const pending=state.runs.find(r=>r.rule_id===fileRule.id&&r.proposal_id),before=h.mails.length;
  await h.json(`/keys/${key.id}/revoke`,{},h.owner);await h.json(`/proposals/${pending.proposal_id}/decide`,{decision:'approve'},h.owner,409);assert.equal(h.mails.length,before);
  await h.json('/agent/context',undefined,'',401,{authorization:'Bearer '+key.key});await h.scheduled('2027-01-03T14:00:00Z');state=await h.json('/agent-rules',undefined,h.owner);assert.ok(state.runs.some(r=>r.rule_id===schedule.id&&r.status==='refused'&&/revoked/.test(r.outcome)));
  await h.json(`/proposals/${pending.proposal_id}/decide`,{decision:'decline',reason:'Key revoked during review'},h.owner);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.match(archive,/agent.plan_prepared/);assert.match(archive,/Cedar supervised plans/);assert.ok(!archive.includes(key.key));
 }finally{await h.close();}
});

test('AI-003 / BASE-001: question and completed-task events prepare once, human approval alone sends, and revoked grants refuse pending effects',async()=>{
 const h=await harness();try{
  const s=await automationFixture(h),j=await s.start(),key=await h.json('/keys',{label:'Questions and tasks'},h.owner);await price(h);
  const questions=await rule(h,s,key,{trigger:'question'}),tasks=await rule(h,s,key,{trigger:'tasks_complete'});
  const link=await h.json(`/jobs/${j.id}/reminders`,{},h.owner),token=new URL(link.portalUrl).pathname.split('/').at(-1);
  await h.json(`/portal/${token}/messages`,{body:'What should I upload?'},undefined);
  await h.json(`/jobs/${j.id}/steps`,{ordinal:1,done:true},s.prep);
  const before=h.mails.length;await h.json('/agent-rules/run',{},h.owner);await h.json('/agent-rules/run',{},h.owner);
  let state=await h.json('/agent-rules',undefined,h.owner);assert.equal(state.runs.length,2);assert.equal(h.mails.length,before);
  assert.equal(state.runs.filter(r=>r.rule_id===questions.id).length,1);assert.equal(state.runs.filter(r=>r.rule_id===tasks.id).length,1);
  const plan=state.runs.find(r=>r.rule_id===questions.id);await h.json(`/proposals/${plan.proposal_id}/decide`,{decision:'approve'},h.owner);
  assert.equal(h.mails.length,before+1);await h.json(`/proposals/${plan.proposal_id}/decide`,{decision:'approve'},h.owner,409);assert.equal(h.mails.length,before+1);
  await h.json(`/agent-rules/${tasks.id}/revoke`,{},h.owner);const pending=state.runs.find(r=>r.rule_id===tasks.id);
  await h.json(`/proposals/${pending.proposal_id}/decide`,{decision:'approve'},h.owner,409);assert.equal(h.mails.length,before+1);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();const portable=archive.trim().split('\n').map(line=>JSON.parse(line)).flatMap(part=>part.items??[]);const approved=portable.find(item=>item.table==='b_proposals'&&item.row?.id===plan.proposal_id);assert.equal(approved.row.status,'approved');assert.equal(approved.row.decided_by,'owner@example.test');assert.match(archive,/agent.rule_revoked/);
 }finally{await h.close();}
});

test('AI-003 / COST-001 / BASE-001: archives retain plans and costs, restore schedules and service grants inactive, and erased sources fence old restores',async()=>{
 const h=await harness(),copies=[];try{
  const s=await automationFixture(h),j=await s.start(),key=await h.json('/keys',{label:'Portable agent'},h.owner);await price(h);await rule(h,s,key);const f=await upload(h,s,j);await h.json('/agent-rules/run',{},h.owner);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();const restored=await harness();copies.push(restored);
  await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
  const r=await restored.json('/agent-rules',undefined,restored.owner);assert.equal(r.rules[0].status,'paused');assert.equal(r.runs.length,1);
  assert.equal((await restored.json('/costs',undefined,restored.owner)).prices[0].enabled,0);
  await restored.scheduled('2028-01-01T00:00:00Z');assert.equal((await restored.json('/agent-rules',undefined,restored.owner)).runs.length,1);
  const old=(await h.json('/agent-rules',undefined,h.owner)).runs[0];await h.json(`/files/${f.id}/erase`,{confirm:'source.txt',reason:'Source withdrawn'},h.owner);
  await h.json(`/proposals/${old.proposal_id}/decide`,{decision:'approve'},h.owner,409);
  const later=await(await h.request('/api/blotter/backup',undefined,h.owner)).text(),denied=await harness();copies.push(denied);await denied.json('/restore',{archive,journal:later,confirm:'RESTORE'},denied.owner,409);
 }finally{await h.close();for(const h of copies)await h.close();}
});

test('AI-003 / BASE-001: client erasure revokes scheduled grants, removes derived rule text and retains attributed run and cost references',async()=>{
 const h=await harness();try{
  const s=await automationFixture(h),j=await s.start(),key=await h.json('/keys',{label:'Erasure-bound agent'},h.owner);await price(h);
  await rule(h,s,key,{name:'synthetic-blotter-5 private rule text',mode:'external',providerName:'synthetic-blotter-201 private policy',modelName:'Owner runtime',dataUse:'Private policy',providerRetention:'Owner account'});const f=await upload(h,s,j);await h.json('/agent-rules/run',{},h.owner);
  let state=await h.json('/agent-rules',undefined,h.owner);const external=await h.json('/agent/plans/'+state.runs[0].id,{message:'synthetic-blotter-202 derived draft'},'',200,{authorization:'Bearer '+key.key});await h.json(`/proposals/${external.id}/decide`,{decision:'decline',reason:'No longer needed'},h.owner);
  const d=await s.detail(j.id);await h.json(`/requests/${d.requests[0].id}/decide`,{decision:'accept'},s.prep);await h.json(`/jobs/${j.id}/steps`,{ordinal:1,done:true},s.prep);
  const submitted=await h.json(`/jobs/${j.id}/submit`,{revision:(await s.detail(j.id)).job.revision},s.prep);await h.json(`/jobs/${j.id}/review`,{revision:submitted.job.revision,decision:'signoff',note:'Complete'},s.reviewer);
  const current=await h.json(`/clients/${s.client.id}/detail`,undefined,h.owner);await h.json(`/clients/${s.client.id}/lifecycle`,{revision:current.revision,lifecycle:'archived',reason:'Client exit'},h.owner);
  const preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.equal(preview.eligible,true,JSON.stringify(preview.blockers));assert.ok(preview.erase.some(x=>x.table==='b_agent_rules'));
  const receipt=await h.json(`/clients/${s.client.id}/erasure`,{planHash:preview.planHash,confirm:s.client.name,reason:'Erase client-derived preparations'},h.owner);assert.ok(receipt.steps.some(x=>x.table==='b_agent_rules'&&x.count>0));
  state=await h.json('/agent-rules',undefined,h.owner);assert.equal(state.rules[0].status,'revoked');assert.equal(state.rules[0].name,'[erased]');assert.equal(state.runs.length,1);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.ok(!archive.includes('synthetic-blotter-5 private rule text'));assert.ok(!archive.includes('synthetic-blotter-201 private policy'));assert.ok(!archive.includes('synthetic-blotter-202 derived draft'));assert.equal(state.runs[0].preparation_hash,null);assert.match(archive,/agent.plan_prepared/);assert.equal((await h.json('/costs',undefined,h.owner)).usage.length,1);
 }finally{await h.close();}
});

test('AI-003: bounded event processing advances past completed plans without starvation or duplicate effects',async()=>{
 const h=await harness();try{
  const s=await automationFixture(h),j=await s.start(),key=await h.json('/keys',{label:'Bounded queue'},h.owner);await price(h,0,0);await rule(h,s,key,{budget:150});
  const d=await s.detail(j.id);for(let n=0;n<101;n++)await h.json(`/requests/${d.requests[0].id}/files`,{name:`synthetic-blotter-${n+10}.txt`,mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-10').toString('base64')},s.prep);
  const before=h.mails.length;await h.json('/agent-rules/run',{},h.owner);await h.json('/agent-rules/run',{},h.owner);await h.json('/agent-rules/run',{},h.owner);
  const state=await h.json('/agent-rules',undefined,h.owner);assert.equal(state.runs.length,101);assert.equal(state.rules[0].used,101);assert.equal(new Set(state.runs.map(r=>r.proposal_id)).size,101);assert.ok(state.runs.every(r=>r.status==='prepared'));assert.equal(h.mails.length,before);
 }finally{await h.close();}
});

test('AI-003 / BASE-001 / ACCESS-004: Cron plans stop when MFA is required until their supervisor enrolls a confirmed second factor',async()=>{
 const h=await harness();try{
  const s=await automationFixture(h),j=await s.start(),key=await h.json('/keys',{label:'MFA-bound schedule'},h.owner);await price(h);
  await rule(h,s,key,{trigger:'schedule',startsAt:'2027-01-01T00:00:00Z',everyHours:24});
  await h.json('/team/mfa-policy',{required:true},h.owner);
  await h.scheduled('2027-01-01T00:00:00Z');await h.json('/agent/context',undefined,'',403,{authorization:'Bearer '+key.key});
  await enroll(h,h.owner);let state=await h.json('/agent-rules',undefined,h.owner);assert.equal(state.runs.length,1);assert.equal(state.runs[0].status,'refused');assert.equal(state.rules[0].used,0);
  await h.scheduled('2027-01-02T00:00:00Z');state=await h.json('/agent-rules',undefined,h.owner);assert.equal(state.runs.filter(r=>r.status==='prepared').length,1);assert.equal(state.rules[0].used,1);assert.equal(state.runs.filter(r=>r.status==='refused').length,1);
 }finally{await h.close();}
});

test('AI-003 / BASE-001: keyed external plans enforce client, tool, immutable replay, live revocation and human decisions',async()=>{
 const h=await harness();try{
  const s=await automationFixture(h),j=await s.start(),outside=await s.start(s.outside.id),key=await h.json('/keys',{label:'External metadata planner'},h.owner),other=await h.json('/keys',{label:'Other caller'},h.owner);await price(h);
  const options={mode:'external',providerName:'synthetic-blotter-200',modelName:'Owner runtime',dataUse:'No training under owner contract',providerRetention:'Owner account; zero retention'};
  const r=await rule(h,s,key,options),scheduled=await rule(h,s,key,{...options,trigger:'schedule',startsAt:'2027-01-01T00:00:00Z',everyHours:24});
  await upload(h,s,j);await upload(h,s,outside);const before=h.mails.length;await h.json('/agent-rules/run',{},h.owner);await h.json('/agent-rules/run',{},h.owner);await h.scheduled('2027-01-01T00:00:00Z');await h.scheduled('2027-01-01T00:00:00Z');
  const auth={authorization:'Bearer '+key.key},otherAuth={authorization:'Bearer '+other.key};
  const plans=await h.json('/agent/plans',undefined,'',200,auth);assert.equal(plans.plans.length,2);assert.ok(plans.plans.every(p=>p.jobId===j.id&&p.clientId===s.client.id&&p.tool==='reminder'));assert.equal(h.mails.length,before);assert.match(plans.exclusions,/No document bytes/);assert.match(plans.plans[0].provider.verification,/not verified/);assert.equal(plans.plans[0].provider.dataUse,options.dataUse);
  assert.deepEqual((await h.json('/agent/plans',undefined,'',200,otherAuth)).plans,[]);
  const run=plans.plans[0];await h.json('/agent/plans/'+run.id,{message:'Other caller'},'',404,otherAuth);await h.json('/agent/plans/'+run.id,{jobId:outside.id},'',403,auth);await h.json('/agent/plans/'+run.id,{tool:'export'},'',403,auth);
  const filled=await h.json('/agent/plans/'+run.id,{message:'Please upload the outstanding statement.'},'',200,auth);const replay=await h.json('/agent/plans/'+run.id,{message:'Please upload the outstanding statement.'},'',200,auth);assert.equal(replay.id,filled.id);assert.equal(replay.replayed,true);await h.json('/agent/plans/'+run.id,{message:'Different wording'},'',409,auth);
  assert.equal((await h.json('/agent-rules',undefined,h.owner)).rules.reduce((n,r)=>n+r.used,0),2);assert.equal((await h.json('/costs',undefined,h.owner)).usage.length,2);assert.equal(h.mails.length,before);
  await h.json('/proposals/'+filled.id+'/decide',{decision:'decline',reason:'Do not send'},h.owner);assert.equal(h.mails.length,before);
  const second=plans.plans[1];const pending=await h.json('/agent/plans/'+second.id,{message:'Needs review'},'',200,auth);await h.json('/agent-rules/'+scheduled.id+'/revoke',{},h.owner);await h.json('/agent-rules/'+r.id+'/revoke',{},h.owner);await h.json('/proposals/'+pending.id+'/decide',{decision:'approve'},h.owner,409);assert.deepEqual((await h.json('/agent/plans',undefined,'',200,auth)).plans,[]);assert.equal(h.mails.length,before);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.match(archive,/agent.plan_filled/);assert.ok(!archive.includes(key.key));assert.match(archive,/No training under owner contract/);
 }finally{await h.close();}
});

test('COST-001 / AI-003: operator estimates and supervised-agent screens at 1440 and 390, with keyboard and delayed hover tooltips',async()=>{
 const h=await harness();try{const s=await automationFixture(h);const j=await s.start();const key=await h.json('/keys',{label:'Browser agent'},h.owner);await price(h);await serviceAgentsJourney(h,s,key,j);}finally{await h.close();}
});
