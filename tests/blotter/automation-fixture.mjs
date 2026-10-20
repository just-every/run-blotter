import assert from 'node:assert/strict';
export async function automationFixture(h) {
 for(const [email,role] of [['prep@example.test','preparer'],['reviewer@example.test','reviewer'],['other@example.test','preparer']]) {
  await h.json('/team',{email,name:email,role},h.owner);await h.json('/team/invite',{email},h.owner);
 }
 const prep=await h.login('prep@example.test'), reviewer=await h.login('reviewer@example.test');
 const client=await h.json('/clients',{name:'Cedar Lane LLC',contactName:'Alex Rivera',contactEmail:'alex@example.test'},h.owner);
 const outside=await h.json('/clients',{name:'Outside scope LLC'},h.owner);
 const template=await h.json('/templates',{name:'1040 preparation',recurrence:'annual',steps:'Prepare return',requests:'W-2'},h.owner);
 const model=await h.json('/work-types',undefined,h.owner),workType=model.workTypes.find(t=>t.template_id===template.id);
 const sub=await h.json('/sub-statuses',{name:'on 8879 signature',stage:'waiting',workTypeIds:[workType.id]},h.owner);
 const docs=await h.json('/sub-statuses',{name:'on client documents',stage:'waiting',workTypeIds:[workType.id]},h.owner);
 const message=await h.json('/messages/templates',{name:'Client document request',scope:'firm',subject:'Documents for {{client_name}}',body:'Please upload {{outstanding_requests}} at {{portal_link}}'},h.owner);
 const start=(clientId=client.id,periodStart='2026-01-01')=>h.json('/jobs',{clientId,templateId:template.id,periodStart,dueDate:'2027-04-15',dueNote:'Recorded client engagement',preparerEmail:'prep@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
 const rule=async(trigger,action,budget=10,extra={})=>{
  const body={name:trigger.kind+' to '+action.kind,clientIds:[client.id],trigger,action,budget,...extra};
  const preview=await h.json('/automation/preview',body,h.owner);
  assert.ok(preview.jobs.every(j=>j.client!=='Outside scope LLC'));
  await h.json('/automation',{...body,fingerprint:'changed'},h.owner,409);
  const saved=await h.json('/automation',{...body,fingerprint:preview.fingerprint},h.owner);
  await h.json(`/automation/${saved.id}/activate`,{},h.owner);return saved;
 };
 const state=()=>h.json('/automation',undefined,h.owner);
 const run=()=>h.json('/automation/run',{},h.owner);
 const detail=id=>h.json('/jobs/'+id,undefined,h.owner);
 const move=async(id,stage,subStatusId)=>h.json(`/jobs/${id}/status`,{stage,subStatusId,revision:(await detail(id)).job.revision},prep);
 return {prep,reviewer,client,outside,template,sub,docs,message,start,rule,state,run,detail,move};
}

