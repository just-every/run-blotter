import { payloadFor } from './proposals';
import { liveAgentRuleSql } from './scheduled-agent-gate';
// AI-003: native schedules/events prepare bounded plans. A schedule never sends
// a message or makes a work/financial judgment. The existing human doors do that.
import { runtimeBindings, type Bindings } from '../auth.server';
import { atomic, audit, date, digest, guard, human, id, insist, integer, job, now, rows, stmt, text, type Actor, type Data } from './model';
import { costReservation } from './costs';
const principal = (a:Actor) => {human(a);insist(a.role==='owner','Only the principal supervises scheduled agents',403);};
export async function agentRules(db:D1Database,a:Actor) {
 principal(a);
 return {rules:await rows(db,'SELECT * FROM b_agent_rules ORDER BY created_at,id'),runs:await rows(db,`SELECT r.*,p.status decision,p.payload,p.decided_by,p.decided_at,p.decision_note FROM b_agent_runs r LEFT JOIN b_proposals p ON p.id=r.proposal_id ORDER BY r.created_at,r.id`),
  exclusions:'Only job metadata and outstanding request labels are granted. No file bytes, private mail, internal discussions, vault, financial data, signed-scope inference or model credentials. Blotter calls no provider. All tools prepare only; people decide effects.'};
}
export async function saveAgentRule(db:D1Database,a:Actor,b:Data) {
 principal(a);
 insist(await stmt(db,"SELECT 1 FROM b_service_prices WHERE service='agent_plan' AND enabled=1").first() && await stmt(db,'SELECT 1 FROM b_service_budget WHERE id=1').first(),'Review and enable the native plan price and approve a service budget before enabling an agent',409);
 const ruleId=id(),keyId=text(b.keyId,'Agent key'),clientId=text(b.clientId,'Client'),trigger=text(b.trigger,'Trigger'),tool=text(b.tool,'Preparation tool');
 insist(['file','tasks_complete','question','schedule'].includes(trigger),'Choose a file, completed-task, question or schedule trigger');
 insist(['reminder','rollforward'].includes(tool),'Only reminder and roll-forward preparation tools are granted');
 const key=await stmt(db,'SELECT id FROM b_agent_keys WHERE id=? AND owner_id=? AND revoked=0',keyId,a.id).first();insist(key,'Choose your live agent key',409);
 insist(await stmt(db,"SELECT id FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL",clientId).first(),'Choose an active client',409);
 let starts:string|null=null,hours:number|null=null;
 if(trigger==='schedule') {insist(typeof b.startsAt==='string'&&/T.*(Z|[+-]\d\d:\d\d)$/.test(b.startsAt)&&Number.isFinite(Date.parse(b.startsAt)),'Schedule time needs an explicit timezone');starts=new Date(b.startsAt).toISOString();hours=integer(b.everyHours,'Hours between evaluations',1,8760);}
 const mode=b.mode==='external'?'external':'native',provider=mode==='external'?text(b.providerName,'Agent provider (name, no credentials)',120):'None',model=mode==='external'?text(b.modelName,'Model or runtime name',120):'None',dataUse=mode==='external'?text(b.dataUse,'Provider data use and training policy',1000):'No external model call',retention=mode==='external'?text(b.providerRetention,'Provider retention and account owner',1000):'No external provider copy';
 const after=Number((await stmt(db,'SELECT COALESCE(MAX(seq),0) n FROM b_automation_events').first<Data>())?.n??0);
 const [check,release]=guard(db,"EXISTS(SELECT 1 FROM b_agent_keys WHERE id=? AND owner_id=? AND revoked=0) AND EXISTS(SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND lifecycle='active' AND merged_into IS NULL)",keyId,a.id,clientId);
 const [priced,pricedDone]=guard(db,"EXISTS(SELECT 1 FROM b_service_prices WHERE service='agent_plan' AND enabled=1) AND EXISTS(SELECT 1 FROM b_service_budget WHERE id=1)");
 await atomic(db,a,[check,priced,stmt(db,'INSERT INTO b_agent_rules(id,name,key_id,client_id,supervisor_id,supervisor_email,trigger,starts_at,every_hours,tool,due_date,due_note,budget,after_seq,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',ruleId,text(b.name,'Agent name',120),keyId,clientId,a.id,a.email,trigger,starts,hours,tool,tool==='rollforward'?date(b.dueDate,'Proposed due date'):null,tool==='rollforward'?text(b.dueNote,'Due-date source',300):null,integer(b.budget,'Lifetime plan budget',1,100000),after,now()),stmt(db,'UPDATE b_agent_rules SET mode=?,provider_name=?,model_name=?,data_use=?,provider_retention=?,model_policy=? WHERE id=?',mode,provider,model,dataUse,retention,mode==='native'?'Native deterministic planner; no model or external provider is called. No training or provider retention. References and plans retained under firm erasure/hold policy.':`Owner-declared external caller: ${provider}; ${model}. Data use: ${dataUse}. Retention/account owner: ${retention}. This declaration is not provider verification. Only granted job metadata and request labels are available; the app makes no provider request.`,ruleId),release,pricedDone,audit(db,a,'agent.rule_approved',ruleId,'Explicit client, data and preparation-tool grant; human effects only')]);
 return {id:ruleId};
}
export async function stopAgentRule(db:D1Database,a:Actor,ruleId:string) {
 principal(a);
 await atomic(db,a,[stmt(db,"UPDATE b_agent_rules SET status='revoked' WHERE id=?",ruleId),audit(db,a,'agent.rule_revoked',ruleId)]);
 return {status:'revoked'};
}
// Shared by the plan-commit guard and the human effect batch. Revocation cannot
// race a stale read and allow a later effect, even for an already prepared plan.
export async function runAgentRules(env:Bindings,at=new Date()) {
 const db=runtimeBindings(env).DB,rules=await rows(db,"SELECT * FROM b_agent_rules WHERE status='active' ORDER BY created_at,id LIMIT 100");
 for(const r of rules) {
  const supervisor=await stmt(db,"SELECT id,email,display_name FROM oa_operators WHERE id=? AND role='owner' AND status='active'",r.supervisor_id).first<Data>();
  const events=r.trigger==='schedule' ? (at.toISOString()>=r.starts_at ? await rows(db,"SELECT 'schedule:'||? source,j.id job_id FROM b_jobs j WHERE client_id=? AND status<>'signed_off' AND NOT EXISTS(SELECT 1 FROM b_agent_runs ar WHERE ar.rule_id=? AND ar.job_id=j.id AND ar.event_key='schedule:'||? AND ar.status NOT IN ('pending','blocked')) ORDER BY j.id LIMIT 100",Math.floor((at.getTime()-Date.parse(r.starts_at))/(r.every_hours*3600000)),r.client_id,r.id,Math.floor((at.getTime()-Date.parse(r.starts_at))/(r.every_hours*3600000))):[]) : await rows(db,"SELECT e.source,e.job_id FROM b_automation_events e JOIN b_jobs j ON j.id=e.job_id WHERE e.seq>? AND e.kind=? AND j.client_id=? AND NOT EXISTS(SELECT 1 FROM b_agent_runs ar WHERE ar.rule_id=? AND ar.event_key=e.source AND ar.job_id=e.job_id AND ar.status NOT IN ('pending','blocked')) ORDER BY e.seq LIMIT 100",r.after_seq,r.trigger,r.client_id,r.id);
  for(const e of events) {
   const runId=id();await stmt(db,"INSERT OR IGNORE INTO b_agent_runs(id,rule_id,event_key,job_id,created_at) VALUES(?,?,?,?,?)",runId,r.id,e.source,e.job_id,now()).run();
   const run=await stmt(db,'SELECT * FROM b_agent_runs WHERE rule_id=? AND event_key=? AND job_id=?',r.id,e.source,e.job_id).first<Data>();
   if(!run||!['pending','blocked'].includes(run.status))continue;
   const actor:Actor={id:r.supervisor_id,email:r.supervisor_email,name:supervisor?.display_name??'',role:'owner',channel:'agent',label:'scheduled rule '+r.id};
   try {
    insist(supervisor && await stmt(db,`SELECT 1 WHERE ${liveAgentRuleSql}`,e.job_id,r.id,e.source,e.source).first(),'Agent grant, source or supervisor authority was revoked',409);
    const rule=await stmt(db,'SELECT * FROM b_agent_rules WHERE id=?',r.id).first<Data>();insist(rule&&rule.used<rule.budget,'Lifetime plan budget exhausted; supervisor review required',409);
    const reservation=await costReservation(db,actor,run.id,'agent_plan');
    if(reservation.blocked) {await stmt(db,"UPDATE b_agent_runs SET status='blocked',outcome='Service budget reached; principal owns the exception',cost_cents=? WHERE id=?",reservation.cents,run.id).run();continue;}
    insist(!reservation.already,'Existing cost reservation held; no duplicate plan',409);
    const j=await stmt(db,'SELECT * FROM b_jobs WHERE id=?',e.job_id).first<Data>();insist(j && j.status==='open','Only open work can receive this plan',409);
    const proposalId=r.mode==='external'?null:id(),payload={jobId:j.id,...(r.tool==='rollforward'?{dueDate:r.due_date,dueNote:r.due_note}:{message:''}),summary:`${r.tool==='reminder'?'Review a document reminder for':'Review rolling forward'} ${j.title} (${j.period_label})`,source:{event:e.source,jobRevision:j.revision},agentRunId:run.id};
    const [check,release]=guard(db,`${liveAgentRuleSql} AND EXISTS(SELECT 1 FROM b_agent_rules WHERE id=? AND used<budget) AND EXISTS(SELECT 1 FROM b_agent_runs WHERE id=? AND status IN ('pending','blocked')) AND EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?)`,e.job_id,r.id,e.source,e.source,r.id,run.id,j.id,j.revision);
    await atomic(db,actor,[check,...reservation.statements,
     ...(proposalId?[stmt(db,'INSERT INTO b_proposals(id,kind,payload,for_email,agent_label,created_at) VALUES(?,?,?,?,?,?)',proposalId,r.tool,JSON.stringify(payload),r.supervisor_email,r.name,now())]:[]),
     stmt(db,"UPDATE b_agent_runs SET status=?,proposal_id=?,outcome=?,cost_cents=? WHERE id=?",proposalId?'prepared':'awaiting_agent',proposalId,proposalId?'Plan awaits human decision; no external effect':'Awaiting the named external agent; no proposal or effect yet',reservation.cents,run.id),
     stmt(db,'UPDATE b_agent_rules SET used=used+1 WHERE id=?',r.id),release,audit(db,actor,'agent.plan_prepared',run.id,JSON.stringify({clientId:r.client_id,event:e.source,proposalId}))]);
   } catch(error) {await stmt(db,"UPDATE b_agent_runs SET status='refused',outcome=? WHERE id=? AND status IN ('pending','blocked')",error instanceof Error?error.message:'Plan refused',run.id).run();}
  }
 }
 return {checked:rules.length};
}


/** A keyed caller receives the same metadata already granted by agent/context, for its queued runs only. */
export async function pendingAgentPlans(db:D1Database,a:Actor) {
 insist(a.channel==='agent'&&a.agentKeyId,'An agent key is required',403);
 const candidates=await rows(db,`SELECT ar.*,r.name,r.tool,r.due_date,r.due_note,r.provider_name,r.model_name,r.data_use,r.provider_retention,r.supervisor_email
 FROM b_agent_runs ar JOIN b_agent_rules r ON r.id=ar.rule_id WHERE r.key_id=? AND r.mode='external' AND r.status='active' AND ar.status='awaiting_agent' ORDER BY ar.created_at,ar.id LIMIT 100`,a.agentKeyId);
 const plans:Data[]=[];
 for(const r of candidates) {
  if(!await stmt(db,`SELECT 1 WHERE ${liveAgentRuleSql}`,r.job_id,r.rule_id,r.event_key,r.event_key).first())continue;
  const j=await job(db,a,r.job_id);
  const [live,done]=guard(db,`${liveAgentRuleSql} AND EXISTS(SELECT 1 FROM b_agent_rules WHERE id=? AND key_id=?)`,j.id,r.rule_id,r.event_key,r.event_key,r.rule_id,a.agentKeyId);
  await atomic(db,a,[live,audit(db,a,'agent.read','agent-plan',JSON.stringify([j.client_id])),done]);
  plans.push({id:r.id,jobId:j.id,clientId:j.client_id,title:j.title,period:j.period_label,dueDate:j.due_date,source:r.event_key,tool:r.tool,
   outstanding:await rows(db,"SELECT label FROM b_requests WHERE job_id=? AND status='requested'",j.id),proposedDueDate:r.due_date,proposedDueNote:r.due_note,
   supervisor:r.supervisor_email,estimatedCents:r.cost_cents,provider:{name:r.provider_name,model:r.model_name,dataUse:r.data_use,retention:r.provider_retention,verification:'owner-declared; not verified by Blotter'}});
 }
 return {plans,exclusions:'Job metadata and outstanding request labels only. No document bytes, portal/internal discussions, vault, financial context, arbitrary tools or effects.'};
}

/** One immutable preparation per claimed event. Replays never consume more budget or create another proposal. */
export async function fillAgentPlan(db:D1Database,a:Actor,runId:string,b:Data) {
 insist(a.channel==='agent'&&a.agentKeyId,'An agent key is required',403);
 const r=await stmt(db,`SELECT ar.*,r.name,r.tool,r.due_date,r.due_note FROM b_agent_runs ar JOIN b_agent_rules r ON r.id=ar.rule_id
 WHERE ar.id=? AND r.key_id=? AND r.mode='external' AND r.status='active'`,runId,a.agentKeyId).first<Data>();
 insist(r,'Agent plan not found',404);
 insist(await stmt(db,`SELECT 1 WHERE ${liveAgentRuleSql}`,r.job_id,r.rule_id,r.event_key,r.event_key).first(),'Agent, source or supervisor authority changed',409);
 insist(!b.jobId||b.jobId===r.job_id,'A plan cannot change client or job',403);insist(!b.tool||b.tool===r.tool,'This tool was not granted',403);
 const payload=await payloadFor(db,a,r.tool,{jobId:r.job_id,message:b.message,dueDate:b.dueDate??r.due_date,dueNote:b.dueNote??r.due_note});
 const hash=await digest(JSON.stringify({tool:r.tool,jobId:r.job_id,message:'message' in payload?payload.message:null,dueDate:'dueDate' in payload?payload.dueDate:null,dueNote:'dueNote' in payload?payload.dueNote:null}));
 if(r.preparation_hash) {insist(r.preparation_hash===hash,'The first preparation is immutable; ask the supervisor to decline it before preparing different work',409);return {id:r.proposal_id,replayed:true};}
 insist(r.status==='awaiting_agent','This event is not waiting for a preparation',409);
 const j=await job(db,a,r.job_id),proposalId=id(),body={...payload,agentRunId:r.id,source:{event:r.event_key,jobRevision:j.revision}};
 const [live,done]=guard(db,`${liveAgentRuleSql} AND EXISTS(SELECT 1 FROM b_agent_runs WHERE id=? AND status='awaiting_agent' AND preparation_hash IS NULL) AND EXISTS(SELECT 1 FROM b_agent_rules WHERE id=? AND key_id=?)`,j.id,r.rule_id,r.event_key,r.event_key,r.id,r.rule_id,a.agentKeyId);
 const attributed={...a,label:'scheduled rule '+r.rule_id};
 await atomic(db,attributed,[live,
  stmt(db,'INSERT INTO b_proposals(id,kind,payload,for_email,agent_label,created_at) VALUES(?,?,?,?,?,?)',proposalId,r.tool,JSON.stringify(body),a.email,r.name,now()),
  stmt(db,"UPDATE b_agent_runs SET status='prepared',proposal_id=?,preparation_hash=?,outcome='External agent preparation awaits human decision; no effect' WHERE id=?",proposalId,hash,r.id),
  done,audit(db,attributed,'agent.plan_filled',r.id,JSON.stringify({clientId:j.client_id,keyId:a.agentKeyId,proposalId}))]);
 return {id:proposalId,replayed:false};
}
