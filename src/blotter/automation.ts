// AUTOMATE-001: immutable definitions, concrete preview and recorded principal authority.
import { atomic, audit, digest, guard, human, id, insist, integer, need, now, rows, stmt, text, type Actor, type Data } from './model';
import { eligible } from './jobs';
import { previewReminder } from './documents';
import { STAGES } from './statuses';

export async function automationState(db: D1Database, actor: Actor) {
  human(actor); need(actor, 'owner');
  const [rules, attempts] = await Promise.all([rows(db,'SELECT * FROM b_automation_rules ORDER BY created_at DESC'),rows(db,'SELECT * FROM b_automation_attempts ORDER BY created_at DESC,id DESC LIMIT 200')]);
  return { rules: rules.map(r => ({...r,definition:JSON.parse(r.definition)})), attempts };
}
export async function previewAutomation(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor,'owner');
  const name = text(body.name,'Rule name',120), budget = integer(body.budget,'Lifetime attempt budget',1,10000);
  insist(Array.isArray(body.clientIds) && body.clientIds.length>0 && body.clientIds.length<=100,'Choose 1–100 clients');
  const clientIds = [...new Set(body.clientIds.map(String))].sort();
  for (const c of clientIds) insist(await stmt(db,"SELECT 1 FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL",c).first(),'Choose active clients',409);
  const input = body.trigger ?? {}, act = body.action ?? {};
  insist(['status','tasks_complete','file','request_complete','organizer_complete','signature_complete','proposal','due'].includes(input.kind),'Choose a native trigger');
  const trigger:Data = {kind:input.kind};
  if(input.kind==='status') {
    insist(STAGES.includes(input.stage),'Choose the trigger stage'); trigger.stage=input.stage;
    if(input.subStatusId) { insist(await stmt(db,'SELECT 1 FROM b_sub_statuses WHERE id=? AND stage=? AND deleted_at IS NULL',String(input.subStatusId),input.stage).first(),'Trigger sub-status is unavailable',409); trigger.subStatusId=String(input.subStatusId); }
  }
  if(input.kind==='due') { insist(typeof input.at==='string' && /Z$|[+-]\d\d:\d\d$/.test(input.at) && Number.isFinite(Date.parse(input.at)),'Due time needs an ISO instant with offset');trigger.at=new Date(input.at).toISOString(); }
  insist(['status','reminder','assign','request','rollforward'].includes(act.kind),'Choose an available native action');
  const action:Data={kind:act.kind};
  if(act.kind==='status') { insist(STAGES.includes(act.stage),'Choose target stage'); action.stage=act.stage;
    if(act.subStatusId) {insist(await stmt(db,'SELECT 1 FROM b_sub_statuses WHERE id=? AND stage=? AND deleted_at IS NULL',String(act.subStatusId),act.stage).first(),'Target sub-status is unavailable',409);action.subStatusId=String(act.subStatusId);} }
  if(act.kind==='assign') {insist(['preparer','reviewer','manager','partner'].includes(act.role),'Choose job role'); action.role=act.role;action.email=text(act.email,'Assignee',254).toLowerCase();insist(await eligible(db,action.email,act.role==='preparer'?['preparer','reviewer']:['reviewer']),'Assignee is not active',409);}
  if(act.kind==='request') action.label=text(act.label,'Document request',200);
  if(act.kind==='reminder') { action.templateId=text(act.templateId,'Message template',100); const t=await stmt(db,"SELECT t.id,t.version,v.message_class FROM b_msg_templates t JOIN b_msg_template_versions v ON v.template_id=t.id AND v.version=t.version WHERE t.id=? AND t.deleted_at IS NULL AND (t.scope='firm' OR t.owner_email=?)",action.templateId,actor.email).first<Data>();insist(t,'Message template unavailable',409);insist(t.message_class!=='marketing','Automation sends engagement messages only; a marketing template goes only in a principal-approved marketing batch',409);action.templateVersion=t.version; }
  if(act.kind==='rollforward') {action.dueDate=text(act.dueDate,'Recorded next due date',10);action.dueNote=text(act.dueNote,'Due-date source',300);}
  const definition={clientIds,trigger,action}, jobs=await rows(db,"SELECT j.id,j.title,c.name client,j.revision FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.client_id IN (SELECT value FROM json_each(?)) AND j.status<>'signed_off' ORDER BY j.id",JSON.stringify(clientIds));
  const previews=[];
  if(action.kind==='reminder') for(const j of jobs) {try {previews.push({jobId:j.id,...await previewReminder(db,actor,j.id,action)});} catch(e) { previews.push({jobId:j.id,error:e instanceof Error?e.message:'Cannot send'}); }}
  return {name,budget,definition,jobs,previews,description:`At most ${budget} lifetime attempts, including failures; future work for these explicitly selected clients is included`,fingerprint:await digest(JSON.stringify({name,budget,definition,jobs,previews}))};
}
export async function saveAutomation(db:D1Database,actor:Actor,body:Data) {
  const p=await previewAutomation(db,actor,body);insist(body.fingerprint===p.fingerprint,'Preview the current rule and scope first',409);
  const ruleId=id();let family=ruleId,version=1;
  if(body.ruleId) { const prior=await stmt(db,'SELECT * FROM b_automation_rules WHERE id=?',String(body.ruleId)).first<Data>();insist(prior,'Prior version not found',404);family=prior.family;version=Number((await stmt(db,'SELECT MAX(version) n FROM b_automation_rules WHERE family=?',family).first<Data>())!.n)+1; }
  await atomic(db,actor,[stmt(db,'INSERT INTO b_automation_rules(id,family,version,name,definition,budget,created_at) VALUES(?,?,?,?,?,?,?)',ruleId,family,version,p.name,JSON.stringify(p.definition),p.budget,now()),audit(db,actor,'automation.drafted',ruleId,`version ${version}; ${p.description}`)]);
  return {id:ruleId,version,status:'draft'};
}
export async function automationStatus(db:D1Database,actor:Actor,ruleId:string,status:string) {
  human(actor);need(actor,'owner');insist(['active','paused','revoked'].includes(status),'Choose rule status');
  const r=await stmt(db,'SELECT * FROM b_automation_rules WHERE id=?',ruleId).first<Data>();insist(r,'Rule not found',404);insist(r.status!=='revoked','Revoked approval requires a new version',409);
  const [check,release]=guard(db,'EXISTS(SELECT 1 FROM b_automation_rules WHERE id=? AND status=?)',ruleId,r.status);
  const changes=[check];
  if(status==='active') {
    const def=JSON.parse(r.definition);const current=await previewAutomation(db,actor,{...def,name:r.name,budget:r.budget});insist(JSON.stringify(current.definition)===r.definition,'Definition dependencies changed; preview and save a new version',409);
    changes.push(stmt(db,"UPDATE b_automation_rules SET status='revoked' WHERE family=? AND id<>? AND status='active'",r.family,r.id),stmt(db,"UPDATE b_automation_rules SET status='active',approved_by=?,principal_id=?,approved_at=?,after_seq=(SELECT COALESCE(MAX(seq),0) FROM b_automation_events) WHERE id=?",actor.email,actor.id,now(),ruleId));
  } else changes.push(stmt(db,'UPDATE b_automation_rules SET status=? WHERE id=?',status,ruleId));
  changes.push(release,audit(db,actor,'automation.'+status,ruleId,`version ${r.version}`));await atomic(db,actor,changes);return {id:ruleId,status};
}
export async function reconcileAutomation(db:D1Database,actor:Actor,attemptId:string,body:Data) {
  human(actor);need(actor,'owner');insist(['accepted','not_accepted'].includes(body.outcome),'Record confirmed accepted or not accepted');const reason=text(body.reason,'Provider evidence / reason',1000);
  const [check,release]=guard(db,"EXISTS(SELECT 1 FROM b_automation_attempts WHERE id=? AND status='held')",attemptId);
  await atomic(db,actor,[check,stmt(db,'UPDATE b_automation_attempts SET status=?,outcome=?,next_action=? WHERE id=?',body.outcome==='accepted'?'succeeded':'failed',`Human reconciliation: ${body.outcome}; ${reason}`,'No replay. Review a new event/rule if another action is needed.',attemptId),release,audit(db,actor,'automation.reconciled',attemptId,`${body.outcome}: ${reason}`)]);return {id:attemptId,outcome:body.outcome};
}
