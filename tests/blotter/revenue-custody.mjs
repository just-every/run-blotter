import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {assertRevenueAudit} from './revenue-proof.mjs';

const archivedRevenue=archive=>archive.trim().split('\n').map(line=>JSON.parse(line)).flatMap(part=>part.items??[]).filter(item=>item.table==='b_revenue_proposals').map(item=>item.row).sort((a,b)=>a.id.localeCompare(b.id));

export async function assertRevenueCustody(h,s,read) {
 let map=await read();
 const finding=map.exceptions.find(e=>e.kind==='amendment'&&e.jobId===s.extra.id);
 const reviewed=await h.json('/revenue/proposals',{clientId:s.client.id,planId:s.plan.id,fingerprint:map.fingerprint,exceptionId:finding.id},h.owner);
 const scopeBefore=await(await h.request(map.scope.source.href,undefined,h.owner)).text();
 const entitlementsBefore=(await h.json('/invoices',undefined,h.owner)).entitlements;
 const before=await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner),mails=h.mails.length;
 await h.json(`/revenue/proposals/${reviewed.id}/decide`,{decision:'approve',reason:'Reviewed amendment draft; client agreement still required'},h.owner);
 assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,before.balance_cents);assert.equal(h.mails.length,mails);
 assert.equal(await(await h.request(map.scope.source.href,undefined,h.owner)).text(),scopeBefore);
 assert.ok(entitlementsBefore.length>=3);assert.deepEqual((await h.json('/invoices',undefined,h.owner)).entitlements,entitlementsBefore);
 await h.json(`/jobs/${s.extra.id}/time`,{date:'2026-11-09',minutes:1,description:'Fresh evidence after draft review'},s.prep);map=await read();
 const draft=await h.json('/revenue/proposals',{clientId:s.client.id,planId:s.plan.id,fingerprint:map.fingerprint,exceptionId:finding.id},h.owner);
 await h.json(`/jobs/${s.extra.id}/time`,{date:'2026-11-09',minutes:1,description:'Additional context changes the evidence snapshot'},s.prep);
 await h.json(`/revenue/proposals/${draft.id}/decide`,{decision:'approve',reason:'Stale evidence must refuse'},h.owner,409);
 await h.json(`/revenue/proposals/${draft.id}/decide`,{decision:'decline',reason:'Refresh the evidence first'},h.owner);
 map=await read();
 const pending=await h.json('/revenue/proposals',{clientId:s.client.id,planId:s.plan.id,fingerprint:map.fingerprint,exceptionId:finding.id},h.owner);
 for(const proposal of [reviewed,draft,pending])await assertRevenueAudit(h,s.client.id,'revenue.prepared',{proposalId:proposal.id,kind:'amendment',sourceId:s.letter.id},s.revenueWriteStart);
 assert.equal((await h.json(`/clients/${s.client.id}/history`,undefined,h.owner)).history.filter(e=>e.action==='revenue.prepared').length,5);
 const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
 const portable=archivedRevenue(archive);assert.equal(portable.length,5);assert.equal(portable.find(p=>p.id===pending.id).status,'held');assert.equal(portable.find(p=>p.id===reviewed.id).status,'approved');assert.ok(portable.some(p=>p.decision_note==='Reviewed both and confirmed duplicate'));
 const copy=await harness();
 try {
  await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},copy.owner);
  await copy.json(`/revenue/proposals/${pending.id}/decide`,{decision:'approve',reason:'Restored drafts cannot execute'},copy.owner,409);
  await copy.json(`/revenue?clientId=${s.client.id}&planId=${s.plan.id}`,undefined,copy.owner,409);
  const restored=await(await copy.request('/api/blotter/backup',undefined,copy.owner)).text();
  assert.deepEqual(archivedRevenue(restored),portable);
  const observedRows=data=>data.trim().split('\n').flatMap(line=>JSON.parse(line).items??[]).filter(i=>i.table==='b_revenue_accounting').map(i=>i.row).sort((a,b)=>a.id.localeCompare(b.id));
  assert.equal(observedRows(restored).length,3);assert.deepEqual(observedRows(restored),observedRows(archive));
 }finally{await copy.close();}
 const archiveRows=archive.trim().split('\n').flatMap(line=>JSON.parse(line).items??[]);
 const observed=archiveRows.filter(item=>item.table==='b_revenue_accounting').map(item=>item.row);
 assert.equal(observed.length,3);assert.deepEqual(observed.map(o=>JSON.parse(o.facts).receiptCents).sort((a,b)=>a-b),[0,0,10000]);
 const history=await h.json(`/clients/${s.client.id}/history`,undefined,h.owner);
 assert.equal(history.history.filter(e=>e.action==='revenue.approved').length,2);
 assert.equal(history.history.filter(e=>e.action==='revenue.declined').length,2);
 const expected=[...s.revenueDecisions,{id:reviewed.id,kind:'amendment',status:'approved',reason:'Reviewed amendment draft; client agreement still required'},{id:draft.id,kind:'amendment',status:'declined',reason:'Refresh the evidence first'}];assert.equal(expected.length,4);
 for(const proposal of expected) {
  const events=history.history.filter(e=>e.action===`revenue.${proposal.status}`&&JSON.parse(e.detail).proposalId===proposal.id);
  assert.equal(events.length,1);const event=events[0];
  assert.equal(event.actor,'owner@example.test');assert.equal(event.object_id,s.client.id);
  assert.deepEqual(JSON.parse(event.detail),{proposalId:proposal.id,kind:proposal.kind,reason:proposal.reason});
  const recorded=portable.find(p=>p.id===proposal.id);assert.equal(recorded.decided_by,'owner@example.test');assert.equal(recorded.decision_note,proposal.reason);assert.equal(recorded.status,proposal.status);
  assert.ok(Date.parse(event.at)>=s.revenueDecisionStart&&Date.parse(event.at)<=Date.now());assert.ok(Math.abs(Date.parse(event.at)-Date.parse(recorded.decided_at))<1000);
 }
 const preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
 assert.ok(preview.retained.some(r=>r.key==='billing_revenue_accounting'&&r.count===3));
 assert.ok(preview.blockers.some(b=>/Open balance/.test(b)));
 assert.ok(preview.erase.some(step=>step.table==='b_revenue_proposals'&&step.count===5));
 const hold=await h.json(`/clients/${s.client.id}/retention`,{scope:'class',class:'derived_ai',kind:'hold',owner:'owner@example.test',reviewDate:'2999-01-01',reason:'Preserve revenue review drafts'},h.owner);
 const held=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
 assert.ok(!held.erase.some(step=>step.table==='b_revenue_proposals'&&step.count>0));
 await h.json(`/retention/${hold.id}/release`,{reason:'Revenue custody proof complete'},h.owner);
 await assertRevenueRevocation(h,s,pending,read);
 await h.json(`/files/${s.letter.id}/erase`,{confirm:'scope.txt',reason:'Remove expired synthetic source'},h.owner);
 await h.json(`/revenue?clientId=${s.client.id}&planId=${s.plan.id}`,undefined,h.owner,404);
}

export async function assertRevenueErasure(h) {
 const name='Synthetic revenue erasure client',client=await h.json('/clients',{name},h.owner);
 const mappedTemplate=await h.json('/templates',{name:'Accepted annual scope',recurrence:'annual',steps:'Review',requests:'Evidence',feeCents:0,currency:'USD'},h.owner);
 const extraTemplate=await h.json('/templates',{name:'Additional cleanup',recurrence:'annual',steps:'Review',requests:'Evidence',feeCents:5000,currency:'USD'},h.owner);
 const letter=await h.json(`/clients/${client.id}/engagements`,{title:'Accepted scope',signers:['Synthetic principal'],signedDate:'2026-10-01',file:{name:'accepted.txt',mime:'text/plain',contentBase64:Buffer.from('Annual service only').toString('base64')}},h.owner);
 const mapped={source:{kind:'engagement',id:letter.id},services:[{kind:'tax',quote:'Annual service only',templateId:mappedTemplate.id,authorization:'8821'}]};
 const p=await h.json(`/clients/${client.id}/onboarding/preview`,mapped,h.owner),plan=await h.json(`/clients/${client.id}/onboarding/plans`,{...mapped,fingerprint:p.fingerprint,selectedItemIds:p.items.map(i=>i.id),reason:'Principal mapped signed annual scope'},h.owner);
 const j=await h.json('/jobs',{clientId:client.id,templateId:extraTemplate.id,periodStart:'2026-01-01',dueDate:'2026-12-15',dueNote:'Client supplied target',preparerEmail:'owner@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
 let work=await h.json(`/jobs/${j.id}`,undefined,h.owner);
 for(const r of work.requests){await h.json(`/requests/${r.id}/files`,{name:'source.txt',mime:'text/plain',contentBase64:Buffer.from('Synthetic source').toString('base64')},h.owner);await h.json(`/requests/${r.id}/decide`,{decision:'accept'},h.owner);}
 for(const step of work.steps)await h.json(`/jobs/${j.id}/steps`,{ordinal:step.ordinal,done:true},h.owner);
 work=await h.json(`/jobs/${j.id}`,undefined,h.owner);work=await h.json(`/jobs/${j.id}/submit`,{revision:work.job.revision},h.owner);
 await h.json(`/jobs/${j.id}/review`,{revision:work.job.revision,decision:'signoff',note:'Human signed off the additional cleanup'},await h.login('reviewer@example.test'));
 const map=(await h.json(`/revenue?clientId=${client.id}&planId=${plan.id}`,undefined,h.owner)).map;
 assert.equal(map.exceptions[0].amountCents,5000);
 const draft=await h.json('/revenue/proposals',{clientId:client.id,planId:plan.id,fingerprint:map.fingerprint,exceptionId:map.exceptions[0].id},h.owner);
 await h.json(`/revenue/proposals/${draft.id}/decide`,{decision:'decline',reason:'Principal declined amendment'},h.owner);
 const contact=await h.json(`/clients/${client.id}/contacts`,{name:'Synthetic billing contact',email:'synthetic@example.test',roles:['billing'],authorized:true,emailConsent:true,consentNote:'Explicit test invoice authority'},h.owner);
 const entitlement=await h.json('/invoice-entitlements',{jobId:j.id,kind:'milestone',reference:'synthetic-blotter-95',description:'Sourced one-cent correction',amountCents:2,authorization:'Explicit principal authority'},h.owner);
 const credit=await h.json('/invoice-credits',{clientId:client.id,kind:'credit',reference:'synthetic-blotter-97',amountCents:1,reason:'Separately approved applied credit'},h.owner);
 const input={credits:[{creditId:credit.id,amountCents:1}],jobId:j.id,title:'Synthetic accounting erasure',issueDate:'2026-11-02',dueDate:'2026-12-15',contactId:contact.id,sourceKeys:[entitlement.sourceKey],terms:'Explicit invoice authority',taxCents:0,taxTreatment:'No supplied tax',taxAuthorization:'Principal reviewed'};
 const invoicePreview=await h.json('/invoices/preview',input,h.owner),invoice=await h.json('/invoices',{...input,previewHash:invoicePreview.previewHash},h.owner);
 await h.json(`/invoices/${invoice.id}/issue`,{revision:invoice.revision,snapshotHash:invoice.snapshotHash,reviewNote:'Explicit principal invoice approval'},h.owner);
 await h.json(`/invoices/${invoice.id}/write-off`,{amountCents:1,reason:'Explicit principal approval for the erasure fixture'},h.owner);
 const facts={invoiceId:invoice.id,currency:'USD',source:'Synthetic erasure ledger',reference:'synthetic-blotter-96',grossCents:2,receiptCents:0,creditCents:1,writeoffCents:1,reason:'Practitioner-recorded ledger match'};
 const observation=await h.json('/revenue/accounting',facts,h.owner);
 const matched=(await h.json(`/revenue?clientId=${client.id}&planId=${plan.id}`,undefined,h.owner)).map.accounting.comparisons;
 assert.deepEqual(matched,[{observationId:observation.id,invoiceId:invoice.id,recorded:{grossCents:2,receiptCents:0,creditCents:1,writeoffCents:1},native:{grossCents:2,receiptCents:0,creditCents:1,writeoffCents:1},differences:[]}]);
 const accountingHold=await h.json(`/clients/${client.id}/retention`,{scope:'class',class:'billing',kind:'hold',owner:'owner@example.test',reviewDate:'2999-01-01',reason:'Preserve accounting evidence'},h.owner);
 const holdPreview=await h.json(`/clients/${client.id}/erasure/preview`,undefined,h.owner);
 assert.ok(!holdPreview.erase.some(s=>s.table==='b_revenue_accounting'&&s.count>0));
 await h.json(`/retention/${accountingHold.id}/release`,{reason:'Accounting hold proof complete'},h.owner);
 const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
 await h.json(`/clients/${client.id}/lifecycle`,{lifecycle:'archived',revision:(await h.json(`/clients/${client.id}/detail`,undefined,h.owner)).revision},h.owner);
 const preview=await h.json(`/clients/${client.id}/erasure/preview`,undefined,h.owner);
 assert.deepEqual(preview.blockers,[]);assert.ok(preview.erase.some(s=>s.table==='b_revenue_proposals'&&s.count===1));
 const receipt=await h.json(`/clients/${client.id}/erasure`,{planHash:preview.planHash,confirm:name,reason:'Erase derived revenue drafts'},h.owner);
 assert.ok(receipt.steps.some(s=>s.table==='b_revenue_proposals'&&s.count===1));
 assert.ok(receipt.steps.some(s=>s.table==='b_revenue_accounting'&&s.count===1));
 await h.json(`/revenue/proposals/${draft.id}/decide`,{decision:'approve',reason:'Erased drafts cannot execute'},h.owner,404);
 const later=await(await h.request('/api/blotter/backup',undefined,h.owner)).text(),copy=await harness();
 const retained=later.trim().split('\n').flatMap(line=>JSON.parse(line).items??[]).find(i=>i.table==='b_revenue_accounting'&&i.row.id===observation.id).row;
 assert.equal(retained.source,'[erased]');assert.equal(retained.reason,'[erased]');assert.equal(retained.reference,'erased:'+observation.id);assert.deepEqual(JSON.parse(retained.facts),{grossCents:2,receiptCents:0,creditCents:1,writeoffCents:1});assert.equal(retained.recorded_by,'owner@example.test');assert.ok(!archivedRevenue(later).some(p=>p.id===draft.id));
 try{await copy.json('/restore',{archive,journal:later,confirm:'RESTORE'},copy.owner,409);}finally{await copy.close();}
}

async function assertRevenueRevocation(h,s,pending,read) {
 let r=await h.request('/auth/step-up',{action:'owner:transfer',returnTo:'/app'},h.owner);assert.equal(r.status,202);
 const proof=h.mails.at(-1).text.match(/\/auth\/confirm\?token=([^\s"&<]+)/)[1];r=await h.request('/auth/confirm',{token:proof},h.owner);assert.equal(r.status,303);
 const operators=await(await h.request('/auth/operators',undefined,h.owner)).json(),old=operators.find(o=>o.email==='owner@example.test'),next=operators.find(o=>o.email==='reviewer@example.test');
 assert.equal((await h.request('/auth/operator/role',{operatorId:next.id,role:'owner'},h.owner)).status,200);
 const snapshot=await read();
 assert.equal((await h.request('/auth/operator/role',{operatorId:old.id,role:'member'},h.owner)).status,200);
 for(const decision of ['approve','decline'])assert.ok([401,403].includes((await h.request(`/api/blotter/revenue/proposals/${pending.id}/decide`,{decision,reason:'Former principal has no decision authority'},h.owner)).status));
 assert.ok([401,403].includes((await h.request('/api/blotter/revenue?clientId='+s.client.id+'&planId='+s.plan.id,undefined,h.owner)).status));
 assert.ok([401,403].includes((await h.request('/api/blotter/revenue/proposals',{clientId:s.client.id,planId:s.plan.id,fingerprint:snapshot.fingerprint,exceptionId:pending.payload.id},h.owner)).status));
 const successor=await h.login('reviewer@example.test');
 const current=(await h.json(`/revenue?clientId=${s.client.id}&planId=${s.plan.id}`,undefined,successor)).map;
 assert.equal(current.proposals.find(p=>p.id===pending.id).status,'pending');
 r=await h.request('/auth/step-up',{action:'owner:transfer',returnTo:'/app'},successor);assert.equal(r.status,202);
 const restore=h.mails.at(-1).text.match(/\/auth\/confirm\?token=([^\s"&<]+)/)[1];assert.equal((await h.request('/auth/confirm',{token:restore},successor)).status,303);
 assert.equal((await h.request('/auth/operator/role',{operatorId:old.id,role:'owner'},successor)).status,200);
 h.owner=await h.login('owner@example.test');
}
