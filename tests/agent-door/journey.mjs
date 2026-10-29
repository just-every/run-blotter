import assert from 'node:assert/strict';
import { http } from './http.mjs';
export default async function({request,origin,cookie,tool}){
 const api=http(request,origin,cookie);
 const ctx=await tool('blotter.context.read',{}),data=ctx.result.structuredContent;
 const open=data.jobs.find(job=>job.status==='open');
 assert.ok(open,'The real native fixture includes open work');
 const before=await api('/api/blotter/jobs/'+open.id);
 const stale=await tool('blotter.proposals.reminder',{jobId:open.id,message:'No send',expected_revision:'stale-native-revision',idempotency_key:crypto.randomUUID()});
 assert.equal(stale.result._meta['com.runeditrun/error'].code,'revision_conflict');
 const current=await api('/api/blotter/jobs/'+open.id);
 assert.equal(current.job.revision,before.job.revision,'Stale preparation leaves native state unchanged');
 assert.equal(current.reminders.length,before.reminders.length,'Preparations never send');

 const sourceJob=data.jobs.find(job=>job.status==='signed_off');
 const source=await api('/api/blotter/jobs/'+sourceJob.id),file=source.requests[0].files[0];
 const refused=await request(origin+`/api/blotter/files/${file.id}/erase`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({confirm:file.name,reason:'Verify retained-artifact custody hold'})});
 assert.equal(refused.status,409,'Native custody refuses erasure while shared-door evidence is retained');
 assert.equal((await api('/api/blotter/jobs/'+sourceJob.id)).requests[0].files[0].sha256,file.sha256,'Custody refusal preserves the original');

 const key=crypto.randomUUID(),args={jobId:open.id,message:'One exact internal preparation',idempotency_key:key};
 const once=await tool('blotter.proposals.reminder',args),again=await tool('blotter.proposals.reminder',args);
 assert.equal(once.result.structuredContent.id,again.result.structuredContent.id,'Same public key returns one native preparation');
 const conflict=await tool('blotter.proposals.reminder',{...args,message:'Changed intent'});
 assert.equal(conflict.result._meta['com.runeditrun/error'].code,'idempotency_conflict');
 const witness=await tool('blotter.context.read',{});
 assert.equal(witness.result.structuredContent.preparations.filter(item=>item.id===once.result.structuredContent.id).length,1,'Changed arguments cannot create another preparation');
 const state=await api('/agents/api/state');assert.equal(state.policy.source,'business');
 const audit=await api('/agents/api/audit');assert.equal(audit.differs_from_policy,0);
 assert.ok(audit.rows.every(row=>row.label.includes(' for ')),'Door attribution names agent and sponsor');
 const native=await api('/api/blotter/team');
 assert.ok(native.audit.some(row=>row.action==='proposal.prepared'&&row.actor.includes('Agent door conformance for Synthetic Base 1')),'Native proposal history retains the same agent and sponsor');

 // Native keys keep their original scopes when they enter the company door.
 const local=await api('/api/blotter/keys',{label:'Native scoped coordinator'});
 const localCall=async(name,args={})=>request(origin+'/mcp',{method:'POST',headers:{
  Authorization:`Bearer ${local.key}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream',
  'MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':name,
 },body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})});
 const scoped=await localCall('blotter.context.read');
 assert.equal(scoped.status,200);
 assert.equal((await scoped.json()).result.structuredContent.jobs.length,data.jobs.length,'A native key reads only its sponsor context');
 const outside=await localCall('blotter.events.list');
 assert.equal(outside.status,200);
 assert.equal((await outside.json()).result._meta['com.runeditrun/error'].code,'capability_not_declared','Undeclared events are refused even for a valid native key');

 // A native supervised-plan grant narrows this same live key immediately.
 const price=await api('/api/blotter/costs/prices',{service:'agent_plan',included:0,unitCents:0,source:'Disposable native scope-narrowing fixture; no execution'});
 await api('/api/blotter/costs/budget',{limitCents:0,thresholdCents:0,reason:'No execution or spending in the scope fixture'});
 await api('/api/blotter/costs/services/agent_plan',{revision:price.revision,enabled:true,reason:'Permit a native supervised-plan grant only'});
 await api('/api/blotter/agent-rules',{name:'Cedar scoped coordinator',clientId:before.job.client_id,keyId:local.id,trigger:'file',tool:'reminder',budget:1});
 const narrowed=await localCall('blotter.proposals.reminder',{...args,idempotency_key:crypto.randomUUID()});
 assert.equal(narrowed.status,403,'A supervised native key cannot bypass its original plan scope through MCP');
 assert.equal((await narrowed.json()).error.data.code,'insufficient_scope');
 const afterNarrowing=await tool('blotter.context.read',{});
 assert.deepEqual(afterNarrowing.result.structuredContent.preparations,witness.result.structuredContent.preparations,'Scope refusal creates no preparation');
 await api(`/api/blotter/keys/${local.id}/revoke`,{});
 const revoked=await localCall('blotter.context.read');
 assert.equal(revoked.status,401,'Revoking the native key stops its next MCP call');
 await revoked.body?.cancel();
}
