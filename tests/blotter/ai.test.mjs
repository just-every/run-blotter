import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {harness} from './harness.mjs';
import {aiBindings,aiEdge,aiFixture,noticeText,invoiceText,statementText} from './ai-fixture.mjs';
import {aiJourney} from './ai-ui.mjs';
const archiveRows=(text,table)=>text.trim().split('\n').map(JSON.parse).flatMap(p=>p.items??[]).filter(x=>x.table===table).map(x=>x.row);

test('AI assistance requires owner enablement, an authorized explicit click and masked selected source, retaining metadata and only human-saved output',async()=>{
 const h=await harness({bindings:aiBindings,aiResponse:aiEdge});try{
  const s=await aiFixture(h),before=h.mails.length;
  assert.equal((await h.json('/ai/settings',undefined,h.owner)).enabled,false);
  await s.request('summary',s.prep,{},403);assert.equal(h.aiCalls.length,0);
  await h.json('/ai/settings',{enabled:true,attestationRef:''},h.owner,400);
  await h.json('/ai/settings',{enabled:true,attestationRef:'synthetic-blotter-3'},s.reviewer,403);await s.enable(true,1);
  await s.request('summary',s.prep,{confirm:false},400);assert.equal(h.aiCalls.length,0);
  await h.json(`/jobs/${s.j.id}/threads`,{title:'Internal private discussion',body:'synthetic-blotter-private-thread',anchor:'job'},s.prep);
  const outside=await s.start(s.outside.id);await h.json(`/jobs/${outside.id}/portal/messages`,{body:'synthetic-blotter-outside-context'},s.prep);
  await h.json(`/clients/${s.client.id}/credentials`,{label:'Private bank portal',url:'https://bank.example.test',username:'synthetic-blotter-6',password:'synthetic-blotter-7',notes:'Private vault context'},h.owner);
  const state=await h.json(`/jobs/${s.j.id}/ai`,undefined,s.prep);assert.ok(!JSON.stringify(state).includes('private-thread'));assert.equal(h.aiCalls.length,0);
  const r=await s.request(),payload=h.aiCalls[0],wire=JSON.stringify(payload),source=JSON.parse(payload.messages[1].content).source;
  for(const forbidden of ['123-45-6789','12-3456789','123456789012','987-65-4321','7654321','GB82 WEST','private-thread','outside-context','synthetic-blotter-7'])assert.ok(!wire.includes(forbidden));
  assert.ok(source.includes('2027-02-28'));assert.equal(payload.store,false);assert.equal(payload.tools,undefined);
  const metadata=await h.db.prepare('SELECT * FROM b_ai_requests WHERE id=?').bind(r.requestId).first();
  assert.equal(metadata.input_hash,createHash('sha256').update(source).digest('hex'));assert.equal(metadata.input_bytes,Buffer.byteLength(source));assert.equal(metadata.requested_by,'prep@example.test');
  assert.deepEqual(JSON.parse(metadata.source_ids),[s.file.id]);assert.equal(metadata.provider,'openai');assert.ok(metadata.model);assert.ok(metadata.requested_at);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM b_ai_drafts').first()).n,0);
  const audits=(await h.json('/team',undefined,h.owner)).audit.filter(a=>a.action==='ai.request');assert.equal(audits.length,1);assert.equal(audits[0].actor,'prep@example.test');assert.ok(!JSON.stringify(audits).includes('CP2000'));
  const draft=await h.json(`/ai/requests/${r.requestId}/draft`,{output:{...r.output,reply:'My reviewed reply, still a draft.'}},s.prep);
  assert.equal(draft.output.reply,'My reviewed reply, still a draft.');assert.equal(h.mails.length,before);
  await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'reply',decision:'reject'},s.prep);assert.equal(h.mails.length,before);
  await s.request('summary',s.prep,{},409);assert.equal(h.aiCalls.length,1,'Exhausted approval never sends another request');
  await s.enable(false);await s.request('summary',s.prep,{},403);assert.equal(h.aiCalls.length,1);
 }finally{await h.close();}
});

test('Document proposals require individual review, retain the source, copy only to an authorized same-job request and name unreadable sources',async()=>{
 const h=await harness({bindings:aiBindings,aiResponse:aiEdge});try{
  const s=await aiFixture(h);await s.enable();const original=await(await h.request(`/api/blotter/documents/${s.file.id}/file`,undefined,s.prep)).text();
  const r=await s.request('document');assert.match(r.output.validation[0],/2024.*2026/);
  const draft=await h.json(`/ai/requests/${r.requestId}/draft`,{output:r.output},s.prep);
  await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'name',decision:'accept',value:'Reviewed-2024-notice.txt'},s.prep);
  const outside=await s.start(s.outside.id),other=(await s.detail(outside.id)).requests[0];
  await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'routing',decision:'accept',targetRequestId:other.id},s.prep,404);
  const copied=await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'routing',decision:'accept',targetRequestId:s.d.requests[0].id},s.prep);
  const copyId=copied.decisions.find(d=>d.field==='routing').result_id;
  assert.equal(await(await h.request(`/api/blotter/documents/${copyId}/file`,undefined,s.prep)).text(),original);
  const d=await s.detail(s.j.id),copy=d.requests[0].files.find(f=>f.id===copyId);assert.equal(copy.name,'Reviewed-2024-notice.txt');assert.equal(d.requests[0].files.find(f=>f.id===s.file.id).name,'synthetic-blotter-notice.txt');
  assert.equal((await h.json(`/documents/${copyId}/access`,undefined,h.owner)).visibility,'internal');
  await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'routing',decision:'accept',targetRequestId:s.d.requests[0].id},s.prep,409);
  await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'validation:0',decision:'reject'},s.prep);
  const unreadable=await h.json(`/requests/${s.d.requests[0].id}/files`,{name:'illegible.png',mime:'image/png',contentBase64:Buffer.from('synthetic-blotter-4 unreadable scan').toString('base64')},s.prep);
  const failure=await s.request('document',s.prep,{sourceId:unreadable.id},422);assert.match(failure.error,/Unsupported or unreadable document: illegible.png/);assert.equal(h.aiCalls.length,1);
  const statement=await h.json(`/requests/${s.d.requests[0].id}/files`,{name:'wrong-period.txt',mime:'text/plain',contentBase64:Buffer.from(statementText).toString('base64')},s.prep);
  const wrong=await s.request('document',s.prep,{sourceId:statement.id});assert.match(wrong.output.validation[0],/Wrong-period/);assert.equal(wrong.source.expected.period,s.d.job.period_label);
  const wrongDraft=await h.json(`/ai/requests/${wrong.requestId}/draft`,{output:wrong.output},s.prep);await h.json(`/ai/drafts/${wrongDraft.id}/decisions`,{field:'validation:0',decision:'reject'},s.prep);
  assert.equal((await s.detail(s.j.id)).requests[0].status,'received','Mismatched evidence remains unaccepted for human review');
  const invoice=await h.json(`/requests/${s.d.requests[0].id}/files`,{name:'invoice.txt',mime:'text/plain',contentBase64:Buffer.from(invoiceText).toString('base64')},s.prep);
  const correct=await s.request('document',s.prep,{sourceId:invoice.id});assert.equal(correct.output.extraction.find(e=>e.field==='Period').value,'2026');
  const invoiceDraft=await h.json(`/ai/requests/${correct.requestId}/draft`,{output:correct.output},s.prep);
  await h.json(`/ai/drafts/${invoiceDraft.id}/decisions`,{field:'extraction:2',decision:'accept',value:'2025'},s.prep,400);
  await h.json(`/ai/drafts/${invoiceDraft.id}/decisions`,{field:'extraction:2',decision:'accept'},s.prep);await h.json(`/ai/drafts/${invoiceDraft.id}/decisions`,{field:'name',decision:'reject'},s.prep);
  assert.equal(await(await h.request(`/api/blotter/documents/${invoice.id}/file`,undefined,s.prep)).text(),invoiceText);assert.equal((await s.detail(s.j.id)).requests[0].files.length,5,'Only the explicitly accepted routing created a copy');
  const otherLogin=await h.login('other@example.test');await s.request('document',otherLogin,{},404);await h.json(`/ai/drafts/${draft.id}`,undefined,otherLogin,404);
  const key=await h.json('/keys',{label:'No model authority'},h.owner);await h.json(`/jobs/${s.j.id}/ai`,{purpose:'summary',sourceKind:'document',sourceId:s.file.id,confirm:true},'',401,{authorization:'Bearer '+key.key});
  assert.equal(await(await h.request(`/api/blotter/documents/${s.file.id}/file`,undefined,s.prep)).text(),noticeText);
  await h.json(`/files/${invoice.id}/erase`,{confirm:'invoice.txt',reason:'Withdraw this source and its derived draft'},h.owner);
  await h.json(`/ai/drafts/${invoiceDraft.id}`,undefined,h.owner,404);
 }finally{await h.close();}
});

test('Notice reading is practitioner-only, quotes each extracted value, records question choices and never changes deadlines or sends',async()=>{
 const h=await harness({bindings:aiBindings,aiResponse:aiEdge});try{
  const s=await aiFixture(h);await s.enable();const before=h.mails.length;
  await s.request('notice',s.prep,{},403);assert.equal(h.aiCalls.length,0);
  const r=await s.request('notice',s.reviewer);for(const item of r.output.extraction){assert.ok(noticeText.includes(item.quote));assert.ok(item.quote.includes(item.value));}
  const draft=await h.json(`/ai/requests/${r.requestId}/draft`,{output:r.output},s.reviewer);
  await h.json(`/ai/drafts/${draft.id}`,undefined,s.prep,403);
  await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'question:0',decision:'accept'},s.reviewer);
  await h.json(`/ai/drafts/${draft.id}/decisions`,{field:'question:1',decision:'reject'},s.reviewer);
  assert.equal(h.mails.length,before);assert.equal((await s.detail(s.j.id)).job.due_date,'2027-04-15');assert.equal((await h.json('/notices',undefined,h.owner)).length,0);
  assert.equal((await h.json(`/jobs/${s.j.id}/ai`,undefined,s.prep)).drafts.some(d=>d.id===draft.id),false);
 }finally{await h.close();}
});

test('Revoking firm enablement during a provider request discards its result and retains one attributed failed attempt without retry',async()=>{
 let s;
 const h=await harness({bindings:aiBindings,aiResponse:async payload=>{await s.enable(false);return aiEdge(payload);}});try{
  s=await aiFixture(h);await s.enable();const result=await s.request('summary',s.prep,{},409);
  assert.equal(result.output,undefined);assert.equal(h.aiCalls.length,1);
  assert.equal((await h.db.prepare('SELECT status FROM b_ai_requests').first()).status,'failed');
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM b_ai_drafts').first()).n,0);
  assert.equal((await h.db.prepare("SELECT COUNT(*) n FROM b_audit WHERE action='ai.request'").first()).n,1);
 }finally{await h.close();}
});

test('AI drafts travel with attributed history, restore disabled, honor holds and erasure, and fence stale restores',async()=>{
 const h=await harness({bindings:aiBindings,aiResponse:aiEdge}),copies=[];try{
  const s=await aiFixture(h);await s.enable();const r=await s.request('document'),draft=await h.json(`/ai/requests/${r.requestId}/draft`,{output:r.output},s.prep);
  const download=await h.request('/api/blotter/backup',undefined,h.owner),archive=await download.text();assert.equal(download.status,200,archive.slice(0,1000));
  const restored=await harness({bindings:aiBindings,aiResponse:aiEdge});copies.push(restored);
  await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
  assert.equal((await restored.json('/ai/settings',undefined,restored.owner)).enabled,false);
  assert.equal((await restored.json(`/ai/drafts/${draft.id}`,undefined,restored.owner)).output.summary,r.output.summary);
  await restored.json(`/jobs/${s.j.id}/ai`,{purpose:'summary',sourceKind:'document',sourceId:s.file.id,confirm:true},restored.owner,403);assert.equal(restored.aiCalls.length,0);
  assert.deepEqual(archiveRows(await(await restored.request('/api/blotter/backup',undefined,restored.owner)).text(),'b_ai_requests'),archiveRows(archive,'b_ai_requests'));
  let d=await s.detail(s.j.id);await h.json(`/requests/${d.requests[0].id}/decide`,{decision:'accept'},s.prep);await h.json(`/jobs/${s.j.id}/steps`,{ordinal:1,done:true},s.prep);
  d=await h.json(`/jobs/${s.j.id}/submit`,{revision:(await s.detail(s.j.id)).job.revision},s.prep);await h.json(`/jobs/${s.j.id}/review`,{revision:d.job.revision,decision:'signoff',note:'Reviewed original'},s.reviewer);
  const hold=await h.json(`/clients/${s.client.id}/retention`,{scope:'class',class:'derived_ai',kind:'hold',owner:'owner@example.test',reviewDate:'2999-01-01',reason:'Retain draft during review'},h.owner);
  await h.json(`/clients/${s.client.id}/lifecycle`,{revision:(await h.json(`/clients/${s.client.id}/detail`,undefined,h.owner)).revision,lifecycle:'archived'},h.owner);
  let preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.ok(preview.classes.find(c=>c.class==='derived_ai').held>0);assert.ok(preview.externalCopies.some(c=>c.source==='ai-provider'));
  await h.json(`/retention/${hold.id}/release`,{reason:'Review complete'},h.owner);
  const fileHold=await h.json(`/clients/${s.client.id}/retention`,{scope:'file',targetId:s.file.id,kind:'hold',owner:'owner@example.test',reviewDate:'2999-01-01',reason:'Preserve notice-derived evidence'},h.owner);
  preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.ok(preview.held.some(e=>e.table==='b_ai_drafts'&&e.count===1));
  await h.json(`/retention/${fileHold.id}/release`,{reason:'Source review complete'},h.owner);
  preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.equal(preview.eligible,true,JSON.stringify(preview.blockers));assert.ok(preview.erase.some(e=>e.table==='b_ai_drafts'&&e.count===1));
  const receipt=await h.json(`/clients/${s.client.id}/erasure`,{planHash:preview.planHash,confirm:s.client.name,reason:'Erase derived drafts'},h.owner);assert.ok(receipt.steps.some(e=>e.table==='b_ai_drafts'&&e.count===1));
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM b_ai_drafts').first()).n,0);await h.json(`/ai/drafts/${draft.id}`,undefined,h.owner,404);
  const later=await(await h.request('/api/blotter/backup',undefined,h.owner)).text(),denied=await harness();copies.push(denied);await denied.json('/restore',{archive,journal:later,confirm:'RESTORE'},denied.owner,409);
 }finally{await h.close();for(const copy of copies)await copy.close();}
});

test('Staff AI settings, selected-source proposals, saved decisions and portal disclosure work at desktop and phone widths',async()=>{
 const h=await harness({bindings:aiBindings,aiResponse:aiEdge});try{const s=await aiFixture(h);await aiJourney(h,s);}finally{await h.close();}
});
