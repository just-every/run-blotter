import { liveAgentRuleSql } from './scheduled-agent-gate';
// AI-003: native schedules/events prepare bounded plans. A schedule never sends
// a message or makes a work/financial judgment. The existing human doors do that.
import { runtimeBindings, type Bindings } from '../auth.server';
import { atomic, audit, date, guard, human, id, insist, integer, now, rows, stmt, text, type Actor, type Data } from './model';
import { costReservation } from './costs';
const principal = (a:Actor) => {human(a);insist(a.role==='owner','Only the principal supervises scheduled agents',403);};
export async function agentRules(db:D1Database,a:Actor) {
 principal(a);
 return {rules:await rows(db,'SELECT * FROM b_agent_rules ORDER BY created_at,id'),runs:await rows(db,`SELECT r.*,p.status decision,p.payload,p.decided_by,p.decided_at,p.decision_note FROM b_agent_runs r LEFT JOIN b_proposals p ON p.id=r.proposal_id ORDER BY r.created_at,r.id`),
  exclusions:'Only job metadata and outstanding request labels are granted. No file bytes, private mail, internal discussions, vault, financial data, signed-scope inference or external model access. All tools prepare only; people decide effects.'};
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
 const after=Number((await stmt(db,'SELECT COALESCE(MAX(seq),0) n FROM b_automation_events').first<Data>())?.n??0);
 const [check,release]=guard(db,"EXISTS(SELECT 1 FROM b_agent_keys WHERE id=? AND owner_id=? AND revoked=0) AND EXISTS(SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND lifecycle='active' AND merged_into IS NULL)",keyId,a.id,clientId);
 const [priced,pricedDone]=guard(db,"EXISTS(SELECT 1 FROM b_service_prices WHERE service='agent_plan' AND enabled=1) AND EXISTS(SELECT 1 FROM b_service_budget WHERE id=1)");
 await atomic(db,a,[check,priced,stmt(db,'INSERT INTO b_agent_rules(id,name,key_id,client_id,supervisor_id,supervisor_email,trigger,starts_at,every_hours,tool,due_date,due_note,budget,after_seq,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',ruleId,text(b.name,'Agent name',120),keyId,clientId,a.id,a.email,trigger,starts,hours,tool,tool==='rollforward'?date(b.dueDate,'Proposed due date'):null,tool==='rollforward'?text(b.dueNote,'Due-date source',300):null,integer(b.budget,'Lifetime plan budget',1,100000),after,now()),release,pricedDone,audit(db,a,'agent.rule_approved',ruleId,'Explicit client, data and preparation-tool grant; human effects only')]);
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
    const proposalId=id(),payload={jobId:j.id,...(r.tool==='rollforward'?{dueDate:r.due_date,dueNote:r.due_note}:{message:''}),summary:`${r.tool==='reminder'?'Review a document reminder for':'Review rolling forward'} ${j.title} (${j.period_label})`,source:{event:e.source,jobRevision:j.revision},agentRunId:run.id};
    const [check,release]=guard(db,`${liveAgentRuleSql} AND EXISTS(SELECT 1 FROM b_agent_rules WHERE id=? AND used<budget) AND EXISTS(SELECT 1 FROM b_agent_runs WHERE id=? AND status IN ('pending','blocked')) AND EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?)`,e.job_id,r.id,e.source,e.source,r.id,run.id,j.id,j.revision);
    await atomic(db,actor,[check,...reservation.statements,
     stmt(db,'INSERT INTO b_proposals(id,kind,payload,for_email,agent_label,created_at) VALUES(?,?,?,?,?,?)',proposalId,r.tool,JSON.stringify(payload),r.supervisor_email,r.name,now()),
     stmt(db,"UPDATE b_agent_runs SET status='prepared',proposal_id=?,outcome='Plan awaits human decision; no external effect',cost_cents=? WHERE id=?",proposalId,reservation.cents,run.id),
     stmt(db,'UPDATE b_agent_rules SET used=used+1 WHERE id=?',r.id),release,audit(db,actor,'agent.plan_prepared',run.id,JSON.stringify({clientId:r.client_id,event:e.source,proposalId}))]);
   } catch(error) {await stmt(db,"UPDATE b_agent_runs SET status='refused',outcome=? WHERE id=? AND status IN ('pending','blocked')",error instanceof Error?error.message:'Plan refused',run.id).run();}
  }
 }
 return {checked:rules.length};
}
