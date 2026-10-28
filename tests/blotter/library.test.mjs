import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

const jobFrom = (h, client, template, period = '2026-01-01') => h.json('/jobs', { clientId: client.id, templateId: template.templateId, periodStart: period, dueDate: '2026-04-15', dueNote: 'Principal reviewed engagement target, not an automated deadline', preparerEmail: 'owner@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
const view = async (h, id) => { const detail = await h.json('/jobs/' + id, undefined, h.owner); return { job: detail.job, steps: detail.steps, requests: detail.requests, starter: detail.starter, budget: detail.budget }; };

test('WORK-008 / WORK-014 starter library: adopt, tailor, start work, preview releases and choose changes without overwriting firm work', async () => {
 const h = await harness(); let restored;
 try {
  await h.json('/firm', {name:'Maple Practice LLC'}, h.owner);
  await h.json('/team', {email:'reviewer@example.test',name:'Reviewer',role:'reviewer'}, h.owner);
  await h.json('/team/invite', {email:'reviewer@example.test'}, h.owner);
  const reviewer = await h.login('reviewer@example.test');
  const client = await h.json('/clients', {name:'Cedar Lane LLC',ein:'12-3456789',contactName:'Alex Rivera',contactEmail:'alex@example.test'}, h.owner);
  const catalog = await h.json('/library', undefined, h.owner);
  // All contract workflows are genuinely adoptable firm templates, not a display-only catalog.
  const required = ['monthly-close','quarterly-941','state-withholding','unemployment','sales-tax','1040','1120s','1065','1120','1041','990','1099','w2','tax-notice','onboarding','offboarding'];
  const adopted = {};
  for (const key of required) {
   const item = catalog.templates.find(t=>t.id===key); assert.ok(item, key);
   assert.ok(item.versions.every(v=>v.tasks.every(t=>t.assignee && t.estimateMinutes>0 && t.startFrom && t.dueFrom) && v.requests.length && v.messages.length));
   adopted[key] = await h.json('/library/adopt', {libraryId:key,version:item.versions[0].version}, h.owner);
  }
  await h.json('/library/adopt', {libraryId:'1040'}, reviewer, 403);
  await h.json('/library/adopt', {libraryId:'unknown-workflow'}, h.owner, 404);
  const selected = (await h.json('/library', undefined, h.owner)).adoptions.find(a=>a.id===adopted['monthly-close'].id);
  const [key, originalTask] = Object.entries(selected.content.state.tasks)[0];
  const customized = {...originalTask,label:'Review Cedar Lane exceptions with the client',instructions:'Keep the firm-specific approval instructions; never overwrite these.'};
  const edited = await h.json(`/library/adoptions/${selected.id}/task`, {revision:selected.revision,key,task:customized}, h.owner);
  await h.json(`/library/adoptions/${selected.id}/task`, {revision:selected.revision,key,task:originalTask}, h.owner, 409);
  await h.json(`/library/adoptions/${selected.id}/task`, {revision:edited.revision,key,task:{...originalTask,estimateMinutes:-1}}, h.owner, 400);
  const customRequest = 'Cedar Lane approved exception schedule';
  const detailsEdited = await h.json(`/library/adoptions/${selected.id}/details`, {revision:edited.revision,requests:[...Object.values(selected.content.state.requests),customRequest],budgetMinutes:selected.content.state.budgetMinutes+25},h.owner);
  const messageId=selected.content.messages[0].id;
  const firmMessage=(await h.json('/messages/templates',undefined,h.owner)).templates.find(m=>m.id===messageId);
  await h.json('/messages/templates/'+messageId,{subject:firmMessage.subject,body:firmMessage.body+'\nFirm-specific client instructions.'},h.owner);
  const close = await jobFrom(h, client, adopted['monthly-close']), tax = await jobFrom(h, client, adopted['1040']);
  const originals = {};
  for (const [libraryId, job] of [['monthly-close',close],['1040',tax]]) {
   const detail = await view(h, job.id), content = detail.starter;
   assert.equal(content.libraryId, libraryId);
   assert.equal(content.libraryName,catalog.templates.find(t=>t.id===libraryId).name);
   assert.equal(detail.steps.length, Object.keys(content.state.tasks).length);
   assert.deepEqual(detail.requests.map(r=>r.label).sort(),Object.values(content.state.requests).sort());
   assert.equal(detail.budget.budgetMinutes,content.state.budgetMinutes);
   assert.ok(detail.steps.every(t=>t.owner==='owner@example.test'||t.owner==='reviewer@example.test'));
   for (const t of detail.steps) {
    const raw = Object.values(content.state.tasks).find(raw=>raw.label===t.label);
    const expected = new Date(Date.parse((raw.dueFrom==='due'?job.due_date:job.period_start)+'T00:00:00Z')+raw.dueDays*86400000).toISOString().slice(0,10);
    const expectedStart = new Date(Date.parse((raw.startFrom==='due'?job.due_date:job.period_start)+'T00:00:00Z')+raw.startDays*86400000).toISOString().slice(0,10);
    assert.equal(t.due_date,expected); assert.equal(t.start_date,expectedStart);
    assert.equal(t.owner,raw.assignee==='preparer'?'owner@example.test':'reviewer@example.test');
    assert.equal(t.instructions,raw.instructions);
   }
   const type=(await h.json('/state',undefined,h.owner)).statusModel.workTypes.find(t=>t.id===detail.job.work_type_id);
   assert.ok(type); assert.equal(type.template_id,job.template_id);
   const model=await h.json('/work-types',undefined,h.owner);
   assert.deepEqual(catalog.stages,model.stages);
   assert.deepEqual(model.stages.map(s=>s.key),['planned','ready','in_progress','waiting','in_review','completed']);
   assert.ok(model.stages.some(s=>s.key===detail.job.open_stage));
   for (const message of content.messages) {
    const preview=await h.json(`/jobs/${job.id}/reminders/preview`,{templateId:message.id},h.owner);
    assert.equal(preview.missing.length,0);assert.ok(preview.subject.includes(client.name)&&preview.body.includes('Maple Practice LLC')); assert.equal(preview.to, client.contactEmail);
   }
   originals[job.id]=detail;
  }
  assert.ok(originals[close.id].steps.some(t=>t.label===customized.label));
  assert.ok(originals[close.id].requests.some(r=>r.label===customRequest));
  assert.ok(originals[close.id].starter.messages.every(m=>m.body.endsWith('Firm-specific client instructions.')));
  const latest = catalog.templates.find(t=>t.id==='monthly-close').versions.at(-1);
  const packageRelease = {...latest,version:latest.version+1,description:'Maintainer update: request approval evidence',requests:[...latest.requests,'Year-end adjustment approval log']};
  await h.json('/library/releases',{libraryId:'monthly-close',source:'Reviewed practice library release',release:packageRelease},reviewer,403);
  await h.json('/library/releases',{libraryId:'monthly-close',source:'Reviewed practice library release',release:{...packageRelease,messages:[{name:'Invalid placeholder',subject:'{{unknown_field}}',body:'Request'}]}},h.owner,400);
  const published=await h.json('/library/releases',{libraryId:'monthly-close',source:'Reviewed practice library release',release:packageRelease},h.owner);
  await h.json('/library/releases',{libraryId:'monthly-close',source:'Attempt to rewrite a release',release:packageRelease},h.owner,409);
  assert.equal(published.version,packageRelease.version);
  const preview = await h.json(`/library/adoptions/${selected.id}/preview`,undefined,h.owner);
  assert.ok(preview.toVersion>preview.fromVersion);
  assert.ok(preview.changes.some(c=>c.conflict&&c.key==='tasks:'+key));
  const requestChange=preview.changes.find(c=>c.key.startsWith('requests:')&&c.before===null);
  const messageChange=preview.changes.find(c=>c.key.startsWith('messages:'));
  assert.ok(requestChange&&messageChange);
  const choices=Object.fromEntries(preview.changes.map(c=>[c.key,'ignore']));
  await h.json(`/library/adoptions/${selected.id}/update`, {token:preview.token,choices:{...choices,['tasks:'+key]:'accept'}},h.owner,409);
  choices[requestChange.key]='accept';
  await h.json(`/library/adoptions/${selected.id}/update`,{token:preview.token,choices},h.owner);
  await h.json(`/library/adoptions/${selected.id}/update`,{token:preview.token,choices},h.owner,409);
  const after=(await h.json('/library',undefined,h.owner)).adoptions.find(a=>a.id===selected.id);
  assert.equal(after.content.state.tasks[key].label,customized.label);
  assert.equal(after.content.state.requests[requestChange.key.slice('requests:'.length)],requestChange.after);
  assert.ok(Object.values(after.content.state.messages).every(m=>m.body.endsWith('Firm-specific client instructions.')),'firm MSG-001 edit survives the library update');
  assert.ok(Object.values(after.content.state.requests).includes(customRequest));
  assert.equal(after.content.state.budgetMinutes,selected.content.state.budgetMinutes+25);
  assert.equal((await h.json(`/library/adoptions/${selected.id}/preview`,undefined,h.owner)).changes.length,0);
  for (const job of [close,tax]) assert.deepEqual(await view(h,job.id), originals[job.id]);
  const future=await jobFrom(h,client,adopted['monthly-close'],'2026-02-01');
  assert.ok((await view(h,future.id)).requests.some(r=>r.label===requestChange.after));
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  restored=await harness();await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal'},restored.owner);
  assert.deepEqual((await restored.json('/library',undefined,restored.owner)).adoptions, (await h.json('/library',undefined,h.owner)).adoptions);
  assert.deepEqual(await view(restored,close.id),originals[close.id]);
 } finally {await restored?.close();await h.close();}
});
