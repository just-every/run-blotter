import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { reportFixture } from './reports-fixture.mjs';
import { reportAppJourney } from './reports-ui.mjs';
const filters={from:'2026-01-01',to:'2026-03-31'};
const path=f=>'/reports/performance?'+new URLSearchParams(f);

test('REPORT-001 / WORK-007 / BASE-001: period/team/client/service analytics, source drill-down, approved financial inputs and private CSV/PDF exports',async()=>{
 const h=await harness();try{
  const s=await reportFixture(h),f={...filters,client:s.client.id,workType:s.type.id,assignee:'prep@example.test'};
  const report=await h.json(path(f),undefined,h.owner);
  assert.deepEqual(report.jobs.map(j=>j.id).sort(),[s.complete.id,s.open.id].sort());
  assert.equal(report.totals.blocked,1);assert.ok(report.jobs.find(j=>j.id===s.open.id).blockers.length);
  assert.deepEqual([report.totals.jobs,report.totals.completed,report.totals.overdue,report.totals.reviewReturns],[2,1,1,1]);
  const done=report.jobs.find(j=>j.id===s.complete.id);
  assert.ok(done.turnaroundMinutes>=0);assert.equal(done.reviewReturns[0].detail,'Reconcile the withheld amount');
  assert.equal(done.source,'/app?job='+s.complete.id);assert.equal(done.dueSource,'Practitioner recorded engagement target');
  assert.ok(done.requestDelays[0].asked_at&&done.requestDelays[0].responded_at);assert.ok(done.requestDelays[0].delayMinutes>=0);
  assert.deepEqual(report.money,[{currency:'USD',approvedTimeCents:6000,fixedFeeCents:5000,expenseChargeCents:1100,expenseCostCents:1000,marginBeforeStaffCostCents:11100,unbilledCents:0,approvedExportCents:12100}]);
  assert.equal(done.financial.sources.time[0].id,s.time.id);assert.equal(done.financial.sources.expenses[0].id,s.expense.id);assert.ok(done.financial.sources.exports.every(e=>e.exportId===s.exp.id));
  const current=report.statuses.find(t=>t.subStatus==='Waiting for tax documents');assert.equal(current.current,1);assert.ok(current.entries>=1&&current.minutes>=0);assert.deepEqual(current.jobIds,[s.open.id]);
  assert.ok(report.statuses.some(t=>t.stage==='completed'&&t.workTypeId===s.type.id&&t.current===1));
  const person=report.people.find(p=>p.email==='prep@example.test');assert.equal(person.billableMinutes,60);assert.ok(person.availableMinutes>0);assert.ok(person.utilizationPercent>0);assert.equal(person.timeSources[0].id,s.time.id);
  assert.equal((await h.json(path({...filters,from:'2026-02-01',to:'2026-02-01',client:s.client.id}),undefined,h.owner)).totals.jobs,1);
  assert.equal((await h.json(path({...filters,assignee:'nobody@example.test'}),undefined,h.owner)).totals.jobs,0);
  assert.equal((await h.json(path({...filters,client:s.other.id}),undefined,h.owner)).totals.jobs,1);
  assert.equal((await h.json(path({...filters,workType:'absent'}),undefined,h.owner)).totals.jobs,0);
  await h.json(path(f),undefined,s.prep,403);await h.json(path(f),undefined,'',401);await h.json(path(f),undefined,s.liveToken,401);
  await h.json(path({...filters,to:'2025-01-01'}),undefined,h.owner,400);
  for(const format of ['csv','pdf']){
   const url='/api/blotter/reports/performance/'+format+'?'+new URLSearchParams(f);
   const response=await h.request(url,undefined,s.reviewer);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),new RegExp(format==='pdf'?'application/pdf':'text/csv'));
   const data=await response.text();assert.ok(data.includes('12100')&&data.includes('11100')&&data.includes(s.complete.id));if(format==='pdf'){assert.ok(data.startsWith('%PDF-'));assert.ok(data.includes('%%EOF'));assert.ok(data.includes('/Subtype /Link')&&data.includes('/URI ('+h.origin+'/app?job='));}
   assert.equal((await h.request(url,undefined,s.prep)).status,403);assert.equal((await h.request(url)).status,401);
  }
  const portal=await h.json('/portal/'+s.liveToken);assert.ok(portal.progress);assert.ok(!JSON.stringify(portal).includes('financial'));assert.ok(!JSON.stringify(portal).includes('6000'));
  await reportAppJourney(h,s);
 }finally{await h.close();}
});

test('REPORT-001 / BASE-001: saved scheduled partner reports, deduplicated hours-aware notices, revocation, portable paused schedules and erasure freshness',async()=>{
 const h=await harness();let restored,stale;try{
  const s=await reportFixture(h),f={...filters,client:s.client.id};
  const view=await h.json('/reports/views',{...f,name:'Partner tax-season report'},h.owner);
  await h.json('/reports/views',{...f,name:'Denied'},s.prep,403);
  await h.json('/reports/schedules',{viewId:view.id,recipient:'prep@example.test',nextDate:'2026-10-20',everyDays:7},h.owner,400);
  const schedule=await h.json('/reports/schedules',{viewId:view.id,recipient:'reviewer@example.test',nextDate:'2026-10-20',everyDays:7},h.owner);
  await h.json('/reports/schedules',{viewId:view.id,recipient:'reviewer@example.test',nextDate:'2026-10-20',everyDays:7},s.reviewer,403);
  const firm=await h.json('/firm/settings',undefined,h.owner);await h.json('/firm/settings',{...firm,name:'Cedar Practice',ein:'123456789',entity:'LLC',address:'10 Main St',city:'New York',state:'NY',zip:'10001',fiscalYearEnd:'12-31',services:['Tax'],timeZone:'America/New_York',notificationStart:'09:00',notificationEnd:'17:00',calendars:[]},h.owner);
  await h.scheduled('2026-10-20T02:00:00Z');let state=await h.json('/reports/views',undefined,h.owner);assert.equal(state.runs.length,0,'Firm date is still previous day');
  const before=h.mails.length;await h.scheduled('2026-10-20T11:00:00Z');await h.scheduled('2026-10-20T11:00:00Z');state=await h.json('/reports/views',undefined,h.owner);assert.equal(state.runs.length,1);assert.equal(h.mails.length,before,'Outside notification hours');
  await h.scheduled('2026-10-20T14:00:00Z');await h.scheduled('2026-10-20T14:00:00Z');
  const notices=h.mails.slice(before).filter(m=>(m.text??'').includes('/app?report='+view.id));assert.equal(notices.length,1);assert.ok(notices[0].to.includes('reviewer@example.test'));assert.ok(!JSON.stringify(notices[0]).includes('12100'));
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE'},restored.owner);
  const copy=await restored.json('/reports/views',undefined,restored.owner);assert.deepEqual(copy.views,state.views);assert.equal(copy.schedules[0].status,'paused');assert.equal(copy.schedules[0].principal_id,null);assert.deepEqual(copy.runs,state.runs);
  await restored.scheduled('2026-11-20T14:00:00Z');assert.equal((await restored.json('/reports/views',undefined,restored.owner)).runs.length,1);
  const projected=await restored.json(path(f),undefined,restored.owner);assert.equal(projected.money[0].approvedExportCents,12100);
  await h.json('/team',{email:'reviewer@example.test',name:'Morgan Chen',role:'preparer',active:true},h.owner);
  await h.scheduled('2026-11-20T14:00:00Z');state=await h.json('/reports/views',undefined,h.owner);assert.equal(state.schedules[0].status,'paused');assert.equal(state.runs.length,1);await h.json(path(f),undefined,s.reviewer,403);
  await h.json(`/reports/schedules/${schedule.id}/pause`,{},h.owner);
  await h.json(`/files/${s.file.id}/erase`,{confirm:'W-2.txt',reason:'Client requested source erasure'},h.owner);
  const fresh=await h.json(path(f),undefined,h.owner);assert.equal(fresh.jobs.find(j=>j.id===s.complete.id).requestDelays[0].responded_at,null);assert.ok(!JSON.stringify(fresh).includes('Retained tax source'));
  const journal=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.ok(journal.includes('report.view_saved')&&journal.includes('report.notification_queued'));
  stale=await harness();await stale.json('/restore',{archive,journal,confirm:'RESTORE'},stale.owner,409);
 }finally{await stale?.close();await restored?.close();await h.close();}
});
