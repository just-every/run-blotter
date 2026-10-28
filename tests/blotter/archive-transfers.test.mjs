import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
const file = {name:'bank-statement.txt',mime:'text/plain',contentBase64:Buffer.from('Verified original statement bytes').toString('base64')};
const records = source => source.trim().split('\n').map(line=>JSON.parse(line));
const rowsOf = source => records(source).filter(r=>r.kind==='part').flatMap(p=>p.items).filter(i=>i.kind==='row'&&!(i.table==='b_audit'&&i.row.action.startsWith('archive.'))).map(i=>JSON.stringify({table:i.table,row:i.row})).sort();
async function exportAll(h) {
 const t=await h.json('/portability/exports',{},h.owner);
 let s=await h.json('/portability/exports/'+t.id,undefined,h.owner);
 while(s.phase==='building')s=await h.json(`/portability/exports/${t.id}/advance`,{expectedPart:s.completed},h.owner);
 return {t,s,archive:await(await h.request(`/api/blotter/portability/exports/${t.id}/download`,undefined,h.owner)).text()};
}

test('ARCHIVE-003 / BASE-001: interrupted multi-year native export and restore preserve every row, original, financial total and grant; schedules require reviewed activation without replay',async()=>{
 const h=await harness();let target;
 try{
  await h.json('/team',{email:'reviewer@example.test',name:'Rae Reviewer',role:'reviewer'},h.owner);
  await h.json('/team/invite',{email:'reviewer@example.test'},h.owner);const reviewer=await h.login('reviewer@example.test');
  const c=await h.json('/clients',{name:'Cedar & River LLC',contactName:'Alex Rivera',contactEmail:'alex@example.test'},h.owner);
  const t=await h.json('/templates',{name:'Monthly close',recurrence:'monthly',steps:'Reconcile cash\nReviewer exceptions',requests:'Bank statement\nLoan support',feeCents:12500,currency:'USD'},h.owner);
  const jobs=[];
  for(let year=2023;year<=2026;year++){
   const j=await h.json('/jobs',{clientId:c.id,templateId:t.id,periodStart:`${year}-01-01`,dueDate:`${year}-02-20`,dueNote:'Firm close target',preparerEmail:'owner@example.test',reviewerEmail:'reviewer@example.test'},h.owner);jobs.push(j);
   const d=await h.json('/jobs/'+j.id,undefined,h.owner);
   const f=await h.json(`/requests/${d.requests[0].id}/files`,file,h.owner);
   if(year===2026)jobs.latestFile=f.id;
  }
  const source=await h.json('/jobs/'+jobs.at(-1).id,undefined,h.owner), request=source.requests[0];
  await h.json('/team/rates',{scope:'staff',email:'owner@example.test',rateCents:15000,currency:'USD',effectiveFrom:'2020-01-01'},h.owner);
  const time=await h.json(`/jobs/${source.job.id}/time`,{date:'2026-01-05',minutes:45,description:'Reconcile bank statement',billable:true},h.owner);
  await h.json('/timesheets/submit',{weekStart:'2026-01-05'},h.owner);
  await h.json(`/time/${time.id}/review`,{decision:'approve'},reviewer);
  const billed=await h.json('/exports',{title:'January close extra',sourceKeys:['time:'+time.id]},reviewer);
  const billedView=(await h.json('/billing',undefined,h.owner)).exports.find(e=>e.id===billed.id);
  await h.json(`/exports/${billed.id}/approve`,{revision:billedView.revision,reviewNote:'Checked to recorded time'},h.owner);
  const csv=await(await h.request(`/api/blotter/exports/${billed.id}/csv`,undefined,h.owner)).text();
  assert.equal(billed.totalCents,11250);
  const rule=await h.json('/rules',{clientId:c.id,templateId:t.id,firstPeriod:'2026-01-01',endPeriod:'2026-12-01',leadMonths:0,dueDays:20,dueNote:'Firm close target',preparerEmail:'owner@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
  await h.json(`/rules/${rule.id}/claim`,{jobId:source.job.id},h.owner);
  const contact=(await h.json(`/clients/${c.id}/contacts`,undefined,h.owner))[0];
  await h.json(`/documents/${jobs.latestFile}/access`,{revision:null,visibility:'contacts',contactIds:[contact.id]},h.owner);
  const reminder=await h.json(`/jobs/${source.job.id}/reminders`,{},h.owner);
  const portalToken=new URL(reminder.portalUrl).pathname.split('/').at(-1);
  const closedStart=new Date(Date.now()+3600_000).toISOString().slice(11,16),closedEnd=new Date(Date.now()+3660_000).toISOString().slice(11,16);
  const firm={name:'Cedar Practice',ein:'123456789',entity:'LLC',address:'10 Main Street',city:'Boston',state:'MA',zip:'02108',fiscalYearEnd:'12-31',services:['Bookkeeping'],currency:'USD',timeZone:'UTC',notificationStart:closedStart,notificationEnd:closedEnd,calendars:[]};
  await h.json('/firm/settings',firm,h.owner);
  await h.json(`/jobs/${source.job.id}/threads`,{title:'Close evidence',body:'Please review the reconciled statement',mentions:['reviewer@example.test']},h.owner);
  assert.ok((await h.json('/notifications',undefined,reviewer)).some(n=>n.delivery==='deferred: outside firm notification hours'));
  const keys=await h.json('/keys',{label:'Native archive test agent'},h.owner);
  const started=await h.json('/portability/exports',{},h.owner);
  await h.json('/portability/exports',{},reviewer,403);
  await h.json('/portability',undefined,'',401);
  await h.json('/portability',undefined,'',401,{authorization:'Bearer '+keys.key});
  await h.json('/portability/exports',{},h.owner,403,{origin:'https://other.example.test'});
  let progress=await h.json(`/portability/exports/${started.id}/advance`,{expectedPart:0},h.owner);
  assert.equal(progress.completed,1);assert.equal(progress.phase,'building');
  // A lost response and a page reload retain the same snapshot and confirmed cursor.
  assert.equal((await h.json(`/portability/exports/${started.id}/advance`,{expectedPart:0},h.owner)).completed,1);
  assert.ok((await h.json('/portability',undefined,h.owner)).transfers.some(t=>t.id===started.id&&t.completed===1));
  await h.json(`/portability/exports/${started.id}/advance`,{expectedPart:1},reviewer,403);
  while(progress.phase==='building')progress=await h.json(`/portability/exports/${started.id}/advance`,{expectedPart:progress.completed},h.owner);
  const archive=await(await h.request(`/api/blotter/portability/exports/${started.id}/download`,undefined,h.owner)).text(), parts=records(archive), manifest=parts[0], closing=parts.at(-1);
  assert.ok(manifest.tables.some(t=>t.name==='b_document_grants'&&t.count>0));
  assert.ok(!archive.includes(keys.key)&&!archive.includes(portalToken));
  assert.ok(manifest.excludedTables.includes('b_portal_links')&&manifest.excludedTables.includes('b_agent_keys'));
  assert.ok((await h.json(`/portability/exports/${started.id}/inventory`,undefined,h.owner)).tables.some(t=>t.name==='b_clients'&&t.count===1));
  const selected=await(await h.request(`/api/blotter/portability/exports/${started.id}/download?table=b_clients`,undefined,h.owner)).text();
  assert.deepEqual(records(selected).slice(1).map(c=>c.id),[c.id]);assert.equal(records(selected)[0].restorable,false);
  await h.json(`/portability/exports/${started.id}/download?table=oa_sessions`,undefined,h.owner,404);
  target=await harness();
  await target.json('/portability/imports',{manifest,confirm:'NO'},target.owner,400);
  const restored=await target.json('/portability/imports',{manifest,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},target.owner);
  const first=parts.find(p=>p.kind==='part');
  let status=await target.json(`/portability/imports/${restored.id}/parts`,{part:first},target.owner);
  assert.equal(status.completed,1);
  assert.equal((await target.json(`/portability/imports/${restored.id}/parts`,{part:first},target.owner)).completed,1);
  assert.ok((await target.json('/portability',undefined,target.owner)).transfers.some(t=>t.id===restored.id&&t.completed===1));
  const wrong={...first,sha256:'0'.repeat(64)};
  await target.json(`/portability/imports/${restored.id}/parts`,{part:wrong},target.owner,400);
  for(const part of parts.filter(p=>p.kind==='part'&&p.index!==first.index))await target.json(`/portability/imports/${restored.id}/parts`,{part},target.owner);
  assert.equal((await target.json(`/portability/imports/${restored.id}/finalize`,{archiveHash:closing.archiveHash,contentHash:closing.contentHash,acknowledge: 'erasure history unverified: supply your latest erasure journal'},target.owner)).phase,'complete');
  const rt=await exportAll(target);assert.deepEqual(rowsOf(rt.archive),rowsOf(archive),'Every product record, count, relationship, currency amount and permission survives; new archive action attribution is checked separately');
  assert.ok((await target.json('/team',undefined,target.owner)).audit.some(a=>a.action==='archive.restored'&&a.actor==='owner@example.test'&&a.object_id===restored.id));
  assert.equal(await(await target.request('/api/blotter/files/'+jobs.latestFile,undefined,target.owner)).text(),Buffer.from(file.contentBase64,'base64').toString());
  assert.equal(await(await target.request(`/api/blotter/exports/${billed.id}/csv`,undefined,target.owner)).text(),csv);
  assert.equal((await target.json('/billing',undefined,target.owner)).exports.find(e=>e.id===billed.id).total_cents,11250);
  await target.json('/portal/'+portalToken,undefined,'',404);
  await target.json('/agent/context',undefined,'',401,{authorization:'Bearer '+keys.key});
  const restoredRules=await target.json('/rules',undefined,target.owner), restoredRule=restoredRules.rules.find(r=>r.id===rule.id);
  assert.equal(restoredRule.status,'paused');assert.equal(restoredRule.restore_review,1);
  assert.equal((await h.json('/rules',undefined,h.owner)).rules.find(r=>r.id===rule.id).status,'active','The source rule stays active');
  const historicalAlerts=parts.filter(p=>p.kind==='part').flatMap(p=>p.items).filter(i=>i.kind==='row'&&i.table==='b_notifications');
  assert.ok(historicalAlerts.some(i=>i.row.delivery==='held after restore: deferred: outside firm notification hours'));
  await target.json('/firm/settings',{...firm,notificationStart:'00:00',notificationEnd:'00:00'},target.owner);
  const before=(await target.json('/state',undefined,target.owner)).jobs.length,mails=target.mails.length;
  await target.scheduled('2026-12-01T09:17:00Z');
  assert.equal((await target.json('/state',undefined,target.owner)).jobs.length,before);assert.equal(target.mails.length,mails);
  await target.json(`/rules/${rule.id}/status`,{status:'active'},target.owner,409);
  const preview=await target.json(`/rules/${rule.id}/activation`,undefined,target.owner);
  assert.ok(preview.held.some(p=>p.job_id===source.job.id));assert.ok(preview.pending.every(p=>p.periodStart!=='2026-01-01'));
  await target.json(`/rules/${rule.id}/status`,{status:'active',previewToken:preview.token},target.owner);
  await target.scheduled('2026-12-01T09:17:00Z');const count=(await target.json('/state',undefined,target.owner)).jobs.length;
  await target.scheduled('2026-12-01T10:17:00Z');assert.equal((await target.json('/state',undefined,target.owner)).jobs.length,count);assert.ok(count>before);
  assert.equal(target.mails.length,mails,'Reactivation creates fresh work and never replays old messages');
  const history=await target.json('/team',undefined,target.owner);assert.ok(history.audit.some(a=>a.action==='rule.resumed'));
 }finally{await target?.close();await h.close();}
});

test('ARCHIVE-004 / BASE-001: current erasure journal invalidates staged snapshots and refuses stale part-by-part restoration',async()=>{
 const h=await harness();let target;
 try{
  const c=await h.json('/clients',{name:'Maple Tax LLC'},h.owner),t=await h.json('/templates',{name:'Annual return',recurrence:'annual',steps:'Review',requests:'Client evidence'},h.owner);
  const j=await h.json('/jobs',{clientId:c.id,templateId:t.id,periodStart:'2026-01-01',dueDate:'2027-04-15',dueNote:'Practitioner target',preparerEmail:'owner@example.test',reviewerEmail:'owner@example.test'},h.owner);
  const req=(await h.json('/jobs/'+j.id,undefined,h.owner)).requests[0],f=await h.json(`/requests/${req.id}/files`,file,h.owner);
  const old=await exportAll(h);
  await h.json(`/files/${f.id}/erase`,{confirm:file.name,reason:'Client request'},h.owner);
  await h.json(`/portability/exports/${old.t.id}/download`,undefined,h.owner,404);
  const fresh=await exportAll(h);assert.ok(!fresh.archive.includes(file.contentBase64));
  const journal=records(fresh.archive)[0],parts=records(old.archive),closing=parts.at(-1);
  target=await harness();const r=await target.json('/portability/imports',{manifest:parts[0],confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},target.owner);
  for(const part of parts.filter(p=>p.kind==='part'))await target.json(`/portability/imports/${r.id}/parts`,{part},target.owner);
  await target.json(`/portability/imports/${r.id}/finalize`,{archiveHash:closing.archiveHash,contentHash:closing.contentHash,laterJournal:{sourceIdentity:journal.sourceIdentity,epoch:journal.epoch,journal:journal.journal}},target.owner,409);
  await target.json(`/portability/imports/${r.id}/abort`,{},target.owner);
  assert.equal((await target.json('/state',undefined,target.owner)).jobs.length,0);
 }finally{await target?.close();await h.close();}
});
