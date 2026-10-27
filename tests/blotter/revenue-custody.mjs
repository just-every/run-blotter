import assert from 'node:assert/strict';
import {harness} from './harness.mjs';

export async function assertRevenueCustody(h,s,read) {
 let map=await read();
 const finding=map.exceptions.find(e=>e.kind==='amendment');
 const draft=await h.json('/revenue/proposals',{clientId:s.client.id,planId:s.plan.id,fingerprint:map.fingerprint,exceptionId:finding.id},h.owner);
 await h.json(`/jobs/${s.extra.id}/time`,{date:'2026-11-02',minutes:1,description:'Additional context changes the evidence snapshot'},s.prep);
 await h.json(`/revenue/proposals/${draft.id}/decide`,{decision:'approve',reason:'Stale evidence must refuse'},h.owner,409);
 await h.json(`/revenue/proposals/${draft.id}/decide`,{decision:'decline',reason:'Refresh the evidence first'},h.owner);
 map=await read();
 const pending=await h.json('/revenue/proposals',{clientId:s.client.id,planId:s.plan.id,fingerprint:map.fingerprint,exceptionId:finding.id},h.owner);
 const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
 assert.ok(archive.includes('b_revenue_proposals'));assert.ok(archive.includes(pending.id));assert.ok(archive.includes('Reviewed both and confirmed duplicate'));
 const copy=await harness();
 try {
  await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},copy.owner);
  await copy.json(`/revenue/proposals/${pending.id}/decide`,{decision:'approve',reason:'Restored drafts cannot execute'},copy.owner,409);
  await copy.json(`/revenue?clientId=${s.client.id}&planId=${s.plan.id}`,undefined,copy.owner,409);
  const restored=await(await copy.request('/api/blotter/backup',undefined,copy.owner)).text();
  assert.ok(restored.includes(pending.id));assert.ok(restored.includes('held'));
 }finally{await copy.close();}
 const history=await h.json(`/clients/${s.client.id}/history`,undefined,h.owner);
 assert.equal(history.history.filter(e=>e.action==='revenue.approved').length,1);
 assert.equal(history.history.filter(e=>e.action==='revenue.declined').length,2);
 const preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
 assert.ok(preview.blockers.some(b=>/Open balance/.test(b)));
 assert.ok(preview.erase.some(step=>step.table==='b_revenue_proposals'&&step.count===4));
 const hold=await h.json(`/clients/${s.client.id}/retention`,{scope:'class',class:'derived_ai',kind:'hold',owner:'owner@example.test',reviewDate:'2027-01-01',reason:'Preserve revenue review drafts'},h.owner);
 const held=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
 assert.ok(!held.erase.some(step=>step.table==='b_revenue_proposals'&&step.count>0));
 await h.json(`/retention/${hold.id}/release`,{reason:'Revenue custody proof complete'},h.owner);
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
 const j=await h.json('/jobs',{clientId:client.id,templateId:extraTemplate.id,periodStart:'2026-01-01',dueDate:'2026-12-15',dueNote:'Client supplied target',preparerEmail:'owner@example.test',reviewerEmail:'owner@example.test'},h.owner);
 let work=await h.json(`/jobs/${j.id}`,undefined,h.owner);
 for(const r of work.requests){await h.json(`/requests/${r.id}/files`,{name:'source.txt',mime:'text/plain',contentBase64:Buffer.from('Synthetic source').toString('base64')},h.owner);await h.json(`/requests/${r.id}/decide`,{decision:'accept'},h.owner);}
 for(const step of work.steps)await h.json(`/jobs/${j.id}/steps`,{ordinal:step.ordinal,done:true},h.owner);
 work=await h.json(`/jobs/${j.id}`,undefined,h.owner);work=await h.json(`/jobs/${j.id}/submit`,{revision:work.job.revision},h.owner);
 await h.json(`/jobs/${j.id}/review`,{revision:work.job.revision,decision:'signoff',note:'Human signed off the additional cleanup'},h.owner);
 const map=(await h.json(`/revenue?clientId=${client.id}&planId=${plan.id}`,undefined,h.owner)).map;
 assert.equal(map.exceptions[0].amountCents,5000);
 const draft=await h.json('/revenue/proposals',{clientId:client.id,planId:plan.id,fingerprint:map.fingerprint,exceptionId:map.exceptions[0].id},h.owner);
 await h.json(`/revenue/proposals/${draft.id}/decide`,{decision:'decline',reason:'Principal declined amendment'},h.owner);
 const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
 await h.json(`/clients/${client.id}/lifecycle`,{lifecycle:'archived',revision:(await h.json(`/clients/${client.id}/detail`,undefined,h.owner)).revision},h.owner);
 const preview=await h.json(`/clients/${client.id}/erasure/preview`,undefined,h.owner);
 assert.deepEqual(preview.blockers,[]);assert.ok(preview.erase.some(s=>s.table==='b_revenue_proposals'&&s.count===1));
 const receipt=await h.json(`/clients/${client.id}/erasure`,{planHash:preview.planHash,confirm:name,reason:'Erase derived revenue drafts'},h.owner);
 assert.ok(receipt.steps.some(s=>s.table==='b_revenue_proposals'&&s.count===1));
 await h.json(`/revenue/proposals/${draft.id}/decide`,{decision:'approve',reason:'Erased drafts cannot execute'},h.owner,404);
 const later=await(await h.request('/api/blotter/backup',undefined,h.owner)).text(),copy=await harness();
 try{await copy.json('/restore',{archive,journal:later,confirm:'RESTORE'},copy.owner,409);}finally{await copy.close();}
}
