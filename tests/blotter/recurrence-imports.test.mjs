import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { recurrenceImportJourney } from './recurrence-imports-ui.mjs';

async function fixture(h) {
  for (const [email, name, role] of [['prep@example.test','Jordan Wells','preparer'],['reviewer@example.test','Morgan Lee','reviewer']]) {
    await h.json('/team', { email, name, role }, h.owner); await h.json('/team/invite', { email }, h.owner);
  }
  const prep = await h.login('prep@example.test'), reviewer = await h.login('reviewer@example.test');
  const client = await h.json('/clients', { name: 'Cedar Grove Design LLC', contactName: 'Alex Rivera', contactEmail: 'alex@example.test' }, h.owner);
  const template = await h.json('/templates', { name: 'Monthly bookkeeping close', recurrence: 'monthly', steps: 'Reconcile bank\nReview close', requests: 'Bank statement' }, h.owner);
  const people = { preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' };
  const jobs = [];
  for (const periodStart of ['2031-01-01','2031-02-01','2031-03-01']) jobs.push(await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart, dueDate: '2031-05-20', dueNote: 'Retained source edit: client board meeting', ...people }, h.owner));
  const definition = { source: 'karbon', practiceId: 'cedar-practice', seriesId: 'monthly-cedar', sourceNote: 'Reviewed source schedule and item IDs against practice export', ownerEmail: 'owner@example.test',
    mapping: { clientId: client.id, templateId: template.id, frequency: 'monthly', firstPeriod: '2031-01-01', endPeriod: '2031-06-01', leadMonths: 3, dueDays: 20, dueNote: 'Firm close target after period end', budgetMinutes: 240, ...people },
    items: jobs.map((j, i) => ({ sourceItemId: 'cedar-close-' + (i+1), jobId: j.id })) };
  return { prep, reviewer, client, template, people, jobs, definition };
}
const preview = (h, body, cookie = h.owner) => h.json('/recurrence-imports/preview', body, cookie);
const commit = async (h, body) => h.json('/recurrence-imports/commit', { ...body, previewToken: (await preview(h,body)).previewToken }, h.owner);

test('MIGRATE-006 / BASE-001: reviewed source series claim existing future work, preserve edits, hold unsupported mappings and resume once across cutover', async () => {
  const h = await harness();
  try {
    const s = await fixture(h), original = await Promise.all(s.jobs.map(j => h.json('/jobs/'+j.id,undefined,h.owner)));
    const p = await preview(h,s.definition);
    assert.equal(p.disposition,'ready');assert.deepEqual(p.items.map(i=>i.periodStart),['2031-01-01','2031-02-01','2031-03-01']);
    assert.equal((await h.json('/rules',undefined,h.owner)).rules.length,0,'Preview creates no rule');
    assert.equal((await h.json('/recurrence-imports',undefined,h.owner)).series.length,0,'Preview creates no import record');
    const mapped = await h.json('/recurrence-imports/commit',{...s.definition,previewToken:p.previewToken},h.owner);
    assert.equal(mapped.disposition,'mapped');
    const again = await commit(h,s.definition); assert.equal(again.id,mapped.id);assert.equal(again.ruleId,mapped.ruleId);assert.equal(again.replayed,true);
    await h.json('/recurrence-imports/commit',{...s.definition,mapping:{...s.definition.mapping,leadMonths:4},previewToken:p.previewToken},h.owner,409);
    const state = await h.json('/rules',undefined,h.owner), rule = state.rules.find(r=>r.id===mapped.ruleId);
    assert.equal(rule.status,'paused');assert.equal(rule.lead_months,3);assert.equal(rule.budget_minutes,240);assert.equal(rule.end_period,'2031-06-01');
    assert.deepEqual(state.held.filter(x=>x.rule_id===rule.id).map(x=>x.job_id).sort(),s.jobs.map(j=>j.id).sort());
    assert.deepEqual(await Promise.all(s.jobs.map(j=>h.json('/jobs/'+j.id,undefined,h.owner))),original,'Claims never rewrite native work or its edits');
    const report = await h.json('/recurrence-imports',undefined,h.owner);
    assert.deepEqual(report.items.map(i=>i.item_id),s.definition.items.map(i=>i.sourceItemId));
    assert.ok(report.items.every(i=>i.import_id===mapped.id));
    await h.scheduled('2031-01-01T12:00:00Z');assert.equal((await h.json('/state',undefined,h.owner)).jobs.length,3,'Paused import cannot generate work');
    await h.json(`/rules/${rule.id}/status`,{status:'active'},h.owner,409);
    if (process.env.BLOTTER_RECURRENCE_EVIDENCE) await recurrenceImportJourney(h,rule.id);
    else {const activation=await h.json(`/rules/${rule.id}/activation`,undefined,h.owner);await h.json(`/rules/${rule.id}/status`,{status:'active',previewToken:activation.token},h.owner);}
    await h.scheduled('2031-01-01T12:00:00Z');await h.scheduled('2031-01-01T12:00:00Z');
    const current = (await h.json('/state',undefined,h.owner)).jobs;
    assert.deepEqual(current.map(j=>j.period_start).sort(),['2031-01-01','2031-02-01','2031-03-01','2031-04-01']);
    const next=current.find(j=>j.period_start==='2031-04-01');assert.equal(next.budget_minutes,240);assert.equal(next.preparer_email,s.people.preparerEmail);
    assert.equal(h.mails.filter(m=>m.to.includes('alex@example.test')).length,0,'Carry-over does not replay client messages');
    for(const [frequency,name,firstPeriod] of [['quarterly','Form 941','2031-01-01'],['annual','Form 1120-S','2031-07-01']]) {
      const template=await h.json('/templates',{name,recurrence:frequency,steps:'Prepare\nReview',requests:'Source records'},h.owner);
      const result=await commit(h,{...s.definition,seriesId:frequency,mapping:{...s.definition.mapping,templateId:template.id,frequency,firstPeriod,endPeriod:null},items:[]});
      const r=(await h.json('/rules',undefined,h.owner)).rules.find(x=>x.id===result.ruleId);
      assert.equal(r.recurrence,frequency);assert.equal(r.first_period,firstPeriod);assert.equal(r.status,'paused');
    }
    const unsupported={...s.definition,seriesId:'unsupported-weekly',mapping:{...s.definition.mapping,frequency:'weekly'},items:[]};
    assert.equal((await preview(h,unsupported)).disposition,'held');
    const held=await commit(h,unsupported);assert.equal(held.ruleId,null);
    const heldRow=(await h.json('/recurrence-imports',undefined,h.owner)).series.find(x=>x.id===held.id);
    assert.equal(heldRow.owner_email,'owner@example.test');assert.match(heldRow.reason,/frequency/);
    const collision={...s.definition,seriesId:'second-native-pair',items:[]};assert.equal((await commit(h,collision)).disposition,'held');
    const missing={...s.definition,seriesId:'missing-template',mapping:{...s.definition.mapping,templateId:'not-mapped'},items:[]};
    const missingHold=await commit(h,missing);assert.equal(missingHold.disposition,'held');
    const correctionTemplate=await h.json('/templates',{name:'Corrected source mapping',recurrence:'monthly',steps:'Reconcile',requests:'Bank record'},h.owner);
    const corrected=await commit(h,{...missing,mapping:{...missing.mapping,templateId:correctionTemplate.id}});
    assert.equal(corrected.id,missingHold.id);assert.equal(corrected.disposition,'mapped');
    const audit=(await h.json('/team',undefined,h.owner)).audit;
    assert.ok((Array.isArray(audit)?audit:audit.actions??audit.audit).some(a=>a.action==='recurrence.import_mapped'&&a.object_id===mapped.id&&a.actor==='owner@example.test'));
  }finally{await h.close();}
});

test('MIGRATE-006 / BASE-001: stale mappings, denied authority, revoked staff and archive restoration retain provenance without replay or erased bytes', async () => {
  const h=await harness(), copies=[];
  try {
    const s=await fixture(h);
    const oldPreview=await preview(h,s.definition);
    await h.json(`/jobs/${s.jobs[0].id}/steps`,{ordinal:1,done:true},s.prep);
    await h.json('/recurrence-imports/commit',{...s.definition,previewToken:oldPreview.previewToken},h.owner,409);
    const p=await preview(h,s.definition);
    await h.json('/recurrence-imports',undefined,s.prep,403);await h.json('/recurrence-imports/preview',s.definition,s.reviewer,403);
    await h.json('/recurrence-imports/commit',{...s.definition,previewToken:p.previewToken},s.prep,403);
    await h.json('/recurrence-imports',undefined,'',401);
    const key=await h.json('/keys',{label:'Carry-over assistant'},h.owner);
    await h.json('/recurrence-imports/commit',{...s.definition,previewToken:p.previewToken},'',401,{authorization:'Bearer '+key.key});
    await h.json('/team',{email:'prep@example.test',name:'Jordan Wells',role:'preparer',active:false},h.owner);
    await h.json('/recurrence-imports/commit',{...s.definition,previewToken:p.previewToken},h.owner,409);
    assert.equal((await h.json('/rules',undefined,h.owner)).rules.length,0);
    const held=await commit(h,s.definition);assert.equal(held.disposition,'held');
    await h.json('/team',{email:'prep@example.test',name:'Jordan Wells',role:'preparer',active:true},h.owner);
    const mapped=await commit(h,s.definition);assert.equal(mapped.id,held.id);
    const wrong={...s.definition,seriesId:'wrong-item',items:[{sourceItemId:'foreign-item',jobId:s.jobs[0].id}],mapping:{...s.definition.mapping,templateId:'missing'}};
    assert.equal((await commit(h,wrong)).disposition,'held');
    const detail=await h.json('/jobs/'+s.jobs[0].id,undefined,h.owner);
    const file=await h.json(`/requests/${detail.requests[0].id}/files`,{name:'Bank evidence.txt',mime:'text/plain',contentBase64:Buffer.from('Erase this original statement').toString('base64')},h.owner);
    const old=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
    assert.ok(!old.includes(key.key));
    await h.json('/files/'+file.id+'/erase',{confirm:'Bank evidence.txt',reason:'Approved removal of statement bytes'},h.owner);
    const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
    const restored=await harness();copies.push(restored);await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},restored.owner);
    assert.deepEqual(await restored.json('/recurrence-imports',undefined,restored.owner),await h.json('/recurrence-imports',undefined,h.owner));
    const r=(await restored.json('/rules',undefined,restored.owner)).rules.find(r=>r.id===mapped.ruleId);
    assert.equal(r.status,'paused');await restored.scheduled('2031-01-01T12:00:00Z');assert.equal((await restored.json('/state',undefined,restored.owner)).jobs.length,3);
    await restored.json(`/rules/${r.id}/status`,{status:'active'},restored.owner,409);
    const replay=await commit(restored,s.definition);assert.equal(replay.ruleId,mapped.ruleId);assert.equal(replay.replayed,true);
    assert.equal((await restored.request('/api/blotter/files/'+file.id,undefined,restored.owner)).status,404);
    const stale=await harness();copies.push(stale);await stale.json('/restore',{archive:old,journal:archive,confirm:'RESTORE'},stale.owner,409);
  }finally{await h.close();for(const c of copies)await c.close();}
});
