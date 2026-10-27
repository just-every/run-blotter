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
  await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'History unverified: supply your latest erasure journal'},copy.owner);
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
 const hold=await h.json('/retention',{scope:'class',clientId:s.client.id,class:'derived_ai',kind:'hold',owner:'owner@example.test',reviewDate:'2027-01-01',reason:'Preserve revenue review drafts'},h.owner);
 const held=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
 assert.ok(!held.erase.some(step=>step.table==='b_revenue_proposals'&&step.count>0));
 await h.json(`/retention/${hold.id}/release`,{reason:'Revenue custody proof complete'},h.owner);
 await h.json(`/files/${s.letter.id}/erase`,{confirm:'scope.txt',reason:'Remove expired synthetic source'},h.owner);
 await h.json(`/revenue?clientId=${s.client.id}&planId=${s.plan.id}`,undefined,h.owner,404);
}
