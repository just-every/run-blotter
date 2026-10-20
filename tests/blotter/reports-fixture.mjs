export async function reportFixture(h) {
 for(const [email,role] of [['prep@example.test','preparer'],['reviewer@example.test','reviewer']]) {
  await h.json('/team',{email,name:role==='preparer'?'Jordan Ellis':'Morgan Chen',role},h.owner);await h.json('/team/invite',{email},h.owner);
 }
 const prep=await h.login('prep@example.test'),reviewer=await h.login('reviewer@example.test');
 const client=await h.json('/clients',{name:'Cedar Lane LLC',contactName:'Alex Rivera',contactEmail:'alex@example.test'},h.owner);
 const other=await h.json('/clients',{name:'Maple Grove Trust'},h.owner);
 const template=await h.json('/templates',{name:'1040 preparation',recurrence:'annual',steps:[{label:'Reconcile source',afterDocuments:[1]}],requests:'W-2 statement',feeCents:5000},h.owner);
 const type=(await h.json('/work-types',undefined,h.owner)).workTypes.find(t=>t.template_id===template.id);
 const start=(clientId,periodStart)=>h.json('/jobs',{clientId,templateId:template.id,periodStart,dueDate:'2026-04-15',dueNote:'Practitioner recorded engagement target',preparerEmail:'prep@example.test',reviewerEmail:'reviewer@example.test'},h.owner);
 const complete=await start(client.id,'2026-01-01'),open=await start(client.id,'2026-02-01');await start(other.id,'2026-03-01');
 await h.json('/team/rates',{email:'prep@example.test',rateCents:6000,effectiveFrom:'2026-01-01'},h.owner);
 const time=await h.json(`/jobs/${complete.id}/time`,{date:'2026-01-05',minutes:60,description:'Reconcile filing source'},prep);
 await h.json('/timesheets/submit',{weekStart:'2026-01-05'},prep);await h.json(`/time/${time.id}/review`,{decision:'approve'},reviewer);
 const expense=await h.json(`/jobs/${complete.id}/expenses`,{kind:'filing_fee',date:'2026-01-05',description:'Agency source fee',costCents:1000,billable:true,markupPercent:10},prep);
 await h.json(`/expenses/${expense.id}/decide`,{decision:'approve'},reviewer);
 const send=await h.json(`/jobs/${complete.id}/reminders`,{},prep),token=new URL(send.portalUrl).pathname.split('/').at(-1);
 let detail=await h.json(`/jobs/${complete.id}`,undefined,prep);const request=detail.requests[0];
 const file=await h.json(`/portal/${token}/requests/${request.id}`,{name:'W-2.txt',mime:'text/plain',contentBase64:Buffer.from('Retained tax source').toString('base64')});
 await h.json(`/requests/${request.id}/decide`,{decision:'accept'},prep);
 await h.json(`/jobs/${complete.id}/steps`,{ordinal:1,done:true},prep);
 const submit=async()=>h.json(`/jobs/${complete.id}/submit`,{revision:(await h.json(`/jobs/${complete.id}`,undefined,prep)).job.revision},prep);
 detail=await submit();await h.json(`/jobs/${complete.id}/review`,{revision:detail.job.revision,decision:'return',note:'Reconcile the withheld amount'},reviewer);
 detail=await submit();await h.json(`/jobs/${complete.id}/review`,{revision:detail.job.revision,decision:'signoff',note:'Source reviewed independently'},reviewer);
 const sources=(await h.json('/billing',undefined,h.owner)).unbilled;
 const exp=await h.json('/exports',{title:'Reviewed January work',sourceKeys:sources.map(s=>s.source_key)},h.owner);
 const stored=(await h.json('/billing',undefined,h.owner)).exports.find(e=>e.id===exp.id);
 await h.json(`/exports/${exp.id}/approve`,{revision:stored.revision,reviewNote:'Reconciled all three sources'},h.owner);
 const sub=await h.json('/sub-statuses',{name:'Waiting for tax documents',stage:'waiting',workTypeIds:[type.id]},h.owner);
 detail=await h.json(`/jobs/${open.id}`,undefined,prep);await h.json(`/jobs/${open.id}/status`,{stage:'waiting',subStatusId:sub.id,revision:detail.job.revision},prep);
 const live=await h.json(`/jobs/${open.id}/reminders`,{},prep),liveToken=new URL(live.portalUrl).pathname.split('/').at(-1);
 return {prep,reviewer,client,other,template,type,complete,open,time,expense,exp,file,liveToken};
}
