import { listOrganizers } from './organizers';
// Source events are committed with domain writes. Each event/version has one durable claim.
import { runtimeBindings, type Bindings } from '../auth.server';
import { atomic, audit, guard, id, insist, now, rows, stmt, type Actor, type Data } from './model';
import { eligible, rollForward, submitJob } from './jobs';
import { moveJob } from './statuses';
import { sendReminder } from './documents';
import { pendingStep } from './flow';

async function effect(env:Bindings,actor:Actor,j:Data,action:Data) {
  const db=runtimeBindings(env).DB;
  if(action.kind==='reminder') {
    insist(await stmt(db,'SELECT 1 FROM b_msg_templates WHERE id=? AND version=? AND deleted_at IS NULL',action.templateId,action.templateVersion).first(),'Message template changed since approval',409);
    const result=await sendReminder(env,actor,j.id,action);
    const accepted=/^accepted by /.test(result.delivery), uncertain=/^failed:/.test(result.delivery);
    await stmt(db,"UPDATE b_automation_attempts SET status=?,outcome=?,next_action=? WHERE id=? AND status IN ('dispatching','held')",accepted?'succeeded':uncertain?'held':'failed',result.delivery,uncertain?'Confirm the provider outcome and record human reconciliation; do not resend':'',actor.automation!.attemptId).run();return;
  }
  if(action.kind==='status') {
    if(action.stage==='in_review') {insist(!action.subStatusId,'Submit review before choosing a review sub-status',409);await submitJob(env,actor,j.id,{revision:j.revision});}
    else await moveJob(db,actor,j.id,{...action,revision:j.revision});return;
  }
  if(action.kind==='rollforward') {await rollForward(env,actor,j.id,action);return;}
  insist(j.status==='open','Only open work can be changed',409);
  const [check,release]=guard(db,"EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND status='open')",j.id,j.revision);
  const statements=[check];
  if(action.kind==='assign') {
    insist(await eligible(db,action.email,action.role==='preparer'?['preparer','reviewer']:['reviewer']),'Assignee authority changed',409);
    const role=action.role as 'preparer'|'reviewer'|'manager'|'partner';
    insist(['preparer','reviewer','manager','partner'].includes(role),'Invalid role');
    const people={preparer:j.preparer_email,reviewer:j.reviewer_email,partner:j.partner_email,[role]:action.email};
    insist(people.preparer!==people.reviewer && (!people.partner||people.partner!==people.preparer),'Independent review must be preserved',409);
    const [active,done]=guard(db,"EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active') OR EXISTS(SELECT 1 FROM b_members WHERE email=? AND active=1 AND role IN (SELECT value FROM json_each(?)))",action.email,action.email,JSON.stringify(role==='preparer'?['preparer','reviewer']:['reviewer']));
    statements.push(active,stmt(db,`UPDATE b_jobs SET ${role}_email=?,revision=? WHERE id=?`,action.email,id(),j.id),done);
  } else {
    insist(action.kind==='request','Unknown action');
    statements.push(stmt(db,"INSERT INTO b_requests(id,job_id,ordinal,label,status,updated_by,updated_at) SELECT ?,?,COALESCE(MAX(ordinal),0)+1,?,'requested',?,? FROM b_requests WHERE job_id=?",id(),j.id,action.label,actor.email,now(),j.id));
  }
  statements.push(release,audit(db,actor,'automation.effect',j.id,action.kind));await atomic(db,actor,statements);
}

export async function runAutomation(env:Bindings,at=new Date()) {
  const db=runtimeBindings(env).DB;
  // A previously dispatched outcome may have been accepted before process loss. It is never replayed.
  await stmt(db,"UPDATE b_automation_attempts SET status='held',next_action='Record provider/native outcome with evidence; no automatic retry' WHERE status IN ('dispatching','running')").run();
  const rules=await rows(db,"SELECT * FROM b_automation_rules WHERE status='active' ORDER BY created_at,id LIMIT 100");
  for(const r of rules) {
    const d=JSON.parse(r.definition),t=d.trigger;
    const principal=await stmt(db,"SELECT id,email,display_name FROM oa_operators WHERE id=? AND email=? AND role='owner' AND status='active'",r.principal_id,r.approved_by).first<Data>();
    const events=t.kind==='due' ? (at.toISOString()>=t.at ? await rows(db,"SELECT 'due:'||id||':'||? source,id job_id,? at FROM b_jobs WHERE client_id IN (SELECT value FROM json_each(?)) AND status<>'signed_off'",t.at,t.at,JSON.stringify(d.clientIds)):[]) : await rows(db,`SELECT e.* FROM b_automation_events e JOIN b_jobs j ON j.id=e.job_id
      WHERE e.seq>? AND NOT EXISTS(SELECT 1 FROM b_automation_attempts a WHERE a.rule_id=? AND a.event_key=e.source) AND e.kind=? AND j.client_id IN (SELECT value FROM json_each(?)) AND (?='' OR e.stage=?) AND (?='' OR e.sub_status_id=?) ORDER BY e.seq LIMIT 200`,r.after_seq,r.id,t.kind,JSON.stringify(d.clientIds),t.stage??'',t.stage??'',t.subStatusId??'',t.subStatusId??'');
    for(const e of events) {
      const attemptId=id();
      const inserted=await stmt(db,"INSERT OR IGNORE INTO b_automation_attempts(id,rule_id,version,event_key,job_id,status,created_at) VALUES(?,?,?,?,?,'pending',?)",attemptId,r.id,r.version,e.source,e.job_id,now()).run();
      if(!inserted.meta.changes)continue;
      try {
        insist(principal,'Approving principal no longer has live authority',409);
        const j=await stmt(db,"SELECT j.* FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=? AND c.lifecycle='active' AND c.merged_into IS NULL AND j.client_id IN (SELECT value FROM json_each(?))",e.job_id,JSON.stringify(d.clientIds)).first<Data>();
        insist(j,'Client scope or lifecycle changed',409);
        if(t.kind==='file') insist(await stmt(db,'SELECT 1 FROM b_files WHERE id=? AND erased_at IS NULL',e.source.slice(5)).first(),'Source file was erased',409);
        if(t.kind==='organizer_complete') {
          const submission=await stmt(db,'SELECT s.* FROM b_organizer_submissions s WHERE s.id=? AND s.erased_at IS NULL AND s.version=(SELECT MAX(version) FROM b_organizer_submissions WHERE organizer_id=s.organizer_id)',e.source.slice(10)).first<Data>();
          insist(submission,'Organizer source was erased or superseded',409);
          const sourceActor:Actor={id:principal.id,email:principal.email,name:principal.display_name,role:'owner',channel:'agent',automation:{ruleId:r.id,attemptId,jobId:j.id,revision:j.revision,external:false}};
          const current=(await listOrganizers(db,sourceActor,j.id)).organizers.find(o=>(o as Data).id===submission.organizer_id);
          insist(current && current.completeness.unresolved.length===0,'Organizer still has unanswered required questions',409);
        }
        if(t.kind==='tasks_complete') insist(!await stmt(db,`SELECT 1 FROM b_job_steps s WHERE s.job_id=? AND ${pendingStep('s')}`,j.id).first(),'Tasks are no longer complete',409);
        const actor:Actor={id:principal.id,email:principal.email,name:principal.display_name,role:'owner',channel:'agent',automation:{ruleId:r.id,attemptId,jobId:j.id,revision:j.revision,external:d.action.kind==='reminder'}};
        const [check,release]=guard(db,`EXISTS(SELECT 1 FROM b_automation_rules r JOIN oa_operators o ON o.id=r.principal_id WHERE r.id=? AND r.status='active' AND r.used<r.budget AND o.status='active' AND o.role='owner' AND o.email=r.approved_by) AND EXISTS(SELECT 1 FROM b_automation_attempts WHERE id=? AND status='pending')`,r.id,attemptId);
        // A budget unit reserves one attempt, including failures: downtime cannot expand spending.
        await db.batch([check,stmt(db,"UPDATE b_automation_attempts SET status='running' WHERE id=?",attemptId),stmt(db,'UPDATE b_automation_rules SET used=used+1 WHERE id=?',r.id),release]);
        await effect(env,actor,j,d.action);
      } catch(error) {
        const current=await stmt(db,'SELECT status FROM b_automation_attempts WHERE id=?',attemptId).first<Data>();
        const held=current?.status==='dispatching';
        await stmt(db,"UPDATE b_automation_attempts SET status=?,outcome=?,next_action=? WHERE id=? AND status NOT IN ('succeeded','held')",held?'held':current?.status==='pending'?'refused':'failed',error instanceof Error?error.message:'Action failed',held?'Record confirmed provider outcome; never resend':'Review authority, scope, gates and budget. No automatic replay.',attemptId).run();
      }
    }
  }
  return {checked:rules.length};
}
