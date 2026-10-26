// Native, explicitly approved document sequences. A durable step claim is never replayed.
import { runtimeBindings, type Bindings } from '../auth.server';
import { previewReminder, sendReminder } from './documents';
import { recipientFor } from './client-recipients';
import { followupItems } from './followup-items';
import { usable, engagementOnly } from './messages';
import { atomic, audit, email, guard, human, id, insist, integer, job, need, now, rows, stmt, text, type Actor, type Data } from './model';

async function sender(db:D1Database,address:string):Promise<Actor> {
  const p=await stmt(db,`SELECT o.id,o.email,o.display_name,CASE WHEN o.role='owner' THEN 'owner' ELSE m.role END role
    FROM oa_operators o LEFT JOIN b_members m ON m.email=o.email AND m.active=1
    WHERE o.email=? AND ((o.role='owner' AND o.status='active') OR (o.status IN ('active','invited') AND m.role IN ('preparer','reviewer'))) AND (o.role='owner' OR NOT EXISTS(SELECT 1 FROM b_access_members a WHERE a.email=o.email AND a.read_only=1))`,address).first<Data>();
  insist(p,'Sequence owner is not active',409);
  return {id:p.id,email:p.email,name:p.display_name,role:p.role,channel:'person'};
}
export async function followups(db:D1Database,actor:Actor) {
  human(actor);need(actor,'owner');
  return {sequences:(await rows(db,'SELECT * FROM b_followups ORDER BY created_at,id')).map(f=>({...f,definition:JSON.parse(f.definition)})),attempts:await rows(db,'SELECT * FROM b_followup_attempts ORDER BY created_at,id')};
}
export async function approveFollowup(db:D1Database,actor:Actor,body:Data) {
  human(actor);need(actor,'owner');insist(body.confirm==='APPROVE','Explicitly approve this bounded sequence');
  const j=await job(db,actor,text(body.jobId,'Work item')),ownerEmail=email(body.ownerEmail,'Sequence owner'),owner=await sender(db,ownerEmail);
  await job(db,owner,j.id);insist(j.status==='open','Only open work can be chased',409);
  const name=text(body.name,'Sequence name',120),contactId=text(body.contactId,'Recipient',100);
  insist(Array.isArray(body.steps)&&body.steps.length>0&&body.steps.length<=20,'Choose 1–20 template steps');
  const steps:string[]=[];
  for(const step of body.steps) {const t=await usable(db,owner,text(step,'Step template',100));engagementOnly(t);steps.push(t.id);}
  const cadenceHours=integer(body.cadenceHours,'Cadence in elapsed hours',1,8760),maximumSends=integer(body.maximumSends,'Maximum sends',1,steps.length);
  const startHour=integer(body.startHour,'Business start hour',0,23),endHour=integer(body.endHour,'Business end hour',1,24);
  insist(startHour<endHour,'Business hours must end after they start');
  const timezone=text(body.timezone,'Business time zone',100);
  try {new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format();}catch{insist(false,'Choose an IANA time zone');}
  insist(Array.isArray(body.weekdays)&&body.weekdays.length>0&&body.weekdays.every((d:unknown)=>Number.isInteger(d)&&Number(d)>=0&&Number(d)<=6),'Choose weekdays numbered Sunday 0 through Saturday 6');
  const weekdays=[...new Set<number>(body.weekdays)].sort(),escalateAfter=integer(body.escalateAfter,'Escalate after attempts',1,maximumSends);
  insist(j.manager_email,'Assign a job manager before approving escalation',409);await job(db,await sender(db,j.manager_email),j.id);
  const startAt=text(body.startAt,'First send instant',40);insist(/(?:Z|[+-]\d\d:\d\d)$/.test(startAt)&&Number.isFinite(Date.parse(startAt)),'First send needs an ISO instant with offset');
  // The existing recipient door validates explicit request and email consent before approval.
  await previewReminder(db,owner,j.id,{templateId:steps[0],contactId},true);
  const channel=body.channel??'email';insist(channel==='email'||channel==='portal','Choose email or portal');
  const definition={channel,steps,cadenceHours,maximumSends,startHour,endHour,timezone,weekdays,escalateAfter};
  const sequenceId=id(),at=now();
  await atomic(db,actor,[stmt(db,`INSERT INTO b_followups(id,job_id,contact_id,name,owner_email,definition,status,principal_id,approved_by,approved_at,next_at,revision,response_seq,created_at)
    VALUES(?,?,?,?,?,?,'active',?,?,?,?,?,(SELECT COALESCE(MAX(rowid),0) FROM b_portal_items WHERE job_id=? AND author='client'),?)`,sequenceId,j.id,contactId,name,ownerEmail,JSON.stringify(definition),actor.id,actor.email,at,new Date(startAt).toISOString(),id(),j.id,at),audit(db,actor,'followup.approved',sequenceId,`${maximumSends} attempts; ${cadenceHours} elapsed hours apart; engagement only; owner ${ownerEmail}`)]);
  return {id:sequenceId,status:'active'};
}
export async function followupStatus(db:D1Database,actor:Actor,sequenceId:string,status:string,body:Data) {
  human(actor);need(actor,'owner');
  const f=await stmt(db,'SELECT * FROM b_followups WHERE id=?',sequenceId).first<Data>();insist(f,'Sequence not found',404);
  insist(body.revision===f.revision,'Refresh the sequence before changing it',409);
  insist(['active','paused'].includes(f.status),'A stopped, completed or held sequence cannot replay; review a new sequence',409);
  if(status==='active') {
    insist(body.confirm==='APPROVE','Explicitly approve resuming the remaining steps');
    insist(!await stmt(db,"SELECT 1 FROM b_followup_attempts WHERE sequence_id=? AND status IN ('held','running','dispatching')",f.id).first(),'Reconcile every uncertain earlier step before resuming',409);
  }
  const [check,done]=guard(db,'EXISTS(SELECT 1 FROM b_followups WHERE id=? AND revision=? AND status=?)',f.id,f.revision,f.status);
  await atomic(db,actor,[check,stmt(db,'UPDATE b_followups SET status=?,revision=?,principal_id=?,approved_by=? WHERE id=?',status,id(),actor.id,actor.email,f.id),done,audit(db,actor,'followup.'+status,f.id,'Recorded principal decision; sent steps never replay')]);
  return {id:f.id,status};
}
function businessHours(d:Data,at:Date) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:d.timezone,weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(at);
  const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.find(p=>p.type==='weekday')!.value),hour=Number(parts.find(p=>p.type==='hour')!.value);
  return d.weekdays.includes(day)&&hour>=d.startHour&&hour<d.endHour;
}
function alert(db:D1Database,f:Data,kind:string,summary:string) {
  // Resolve ownership in the write: an offboarding batch may have moved a dispatched step.
  return stmt(db,`INSERT OR IGNORE INTO b_notifications(id,to_email,kind,job_id,summary,delivery,created_at)
    SELECT ?,CASE WHEN ?='followup_escalated' THEN j.manager_email ELSE live.owner_email END,?,live.job_id,?,'in-app only',?
    FROM b_followups live JOIN b_jobs j ON j.id=live.job_id WHERE live.id=?`,`${f.id}:${kind}:${f.used}`,kind,kind,summary,now(),f.id);
}
export async function runFollowups(env:Bindings,at=new Date()) {
  const db=runtimeBindings(env).DB;
  const abandoned=await rows(db,"SELECT a.*,f.owner_email,f.job_id,f.used FROM b_followup_attempts a JOIN b_followups f ON f.id=a.sequence_id WHERE a.status IN ('running','dispatching') AND a.created_at<?",new Date(at.getTime()-600000).toISOString());
  for(const a of abandoned)await db.batch([stmt(db,"UPDATE b_followup_attempts SET status='held',delivery='Interrupted; human reconciliation required; never replay' WHERE id=? AND status IN ('running','dispatching')",a.id),stmt(db,"UPDATE b_followups SET status='held',reason='Interrupted step; confirm provider outcome before a new sequence' WHERE id=? AND status='active'",a.sequence_id),alert(db,{...a,id:a.sequence_id},'followup_failed','Reminder outcome is uncertain; review retained history. No automatic retry.')]);
  const sequences=await rows(db,"SELECT * FROM b_followups WHERE status='active' AND next_at<=? ORDER BY next_at,id LIMIT 100",at.toISOString());
  for(const f of sequences) {
    const d=JSON.parse(f.definition);if(!businessHours(d,at))continue;
    let attemptId:string|undefined;
    try {
      insist(await stmt(db,"SELECT 1 FROM oa_operators WHERE id=? AND email=? AND role='owner' AND status='active'",f.principal_id,f.approved_by).first(),'Approving principal no longer has authority',409);
      const owner=await sender(db,f.owner_email),j=await job(db,owner,f.job_id);
      const client=await stmt(db,"SELECT 1 FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL",j.client_id).first();insist(client,'Client scope or lifecycle changed',409);
      const response=await stmt(db,"SELECT 1 FROM b_portal_items WHERE job_id=? AND author='client' AND rowid>?",j.id,f.response_seq).first();
      const contact=await recipientFor(db,j.client_id,'request',f.contact_id);
      const remaining=(await followupItems(db,j.id,contact)).length;
      if(response||j.status!=='open'||!remaining) {
        await db.batch([stmt(db,"UPDATE b_followups SET status='stopped',reason=?,revision=? WHERE id=? AND status='active'",response?'Client responded':'No outstanding client items',id(),f.id),audit(db,owner,'followup.stopped',f.id,'Outstanding items and client response rechecked')]);continue;
      }
      insist(f.used<d.maximumSends,'Maximum sends reached',409);
      // Render current wording before taking the durable claim. Missing values hold the entire sequence.
      const preview=await previewReminder(db,owner,j.id,{templateId:d.steps[f.used],contactId:f.contact_id},true);
      if(d.channel==='portal')insist(preview.body.length<=2000,'Portal step exceeds 2000 characters; shorten the template',409);
      insist(!preview.missing.length,`Unresolved placeholders: ${preview.missing.map((p:Data)=>p.label).join(', ')}`,409);
      attemptId=id();
      const [check,done]=guard(db,"EXISTS(SELECT 1 FROM b_followups WHERE id=? AND revision=? AND used=? AND status='active')",f.id,f.revision,f.used);
      await db.batch([check,stmt(db,"INSERT INTO b_followup_attempts(id,sequence_id,step,status,sender,created_at) VALUES(?,?,?,'running',?,?)",attemptId,f.id,f.used+1,owner.email,at.toISOString()),stmt(db,'UPDATE b_followups SET used=used+1,next_at=? WHERE id=?',new Date(at.getTime()+d.cadenceHours*3600000).toISOString(),f.id),done]);
      owner.followup={sequenceId:f.id,attemptId,revision:f.revision};owner.channel='agent';
      const result=await sendReminder(env,owner,j.id,{templateId:d.steps[f.used],contactId:f.contact_id,channel:d.channel});
      const accepted=/^accepted by |^posted to portal /.test(result.delivery),status=accepted?(d.channel==='portal'?'posted':'accepted'):/^uncertain by |^failed:/.test(result.delivery)?'held':'failed';
      const changes=[stmt(db,'UPDATE b_followup_attempts SET status=?,delivery=? WHERE id=?',status,result.delivery,attemptId),stmt(db,'UPDATE b_followups SET status=?,reason=? WHERE id=? AND status=\'active\'',accepted?(f.used+1>=d.maximumSends?'completed':'active'):'held',accepted?'':'Provider outcome requires review; never replay',f.id)];
      if(!accepted)changes.push(alert(db,f,'followup_failed',`Reminder not confirmed: ${result.delivery}`));
      if(f.used+1>=d.escalateAfter&&!f.escalated)changes.push(alert(db,f,'followup_escalated','Client items remain outstanding after the configured reminder attempts'),stmt(db,'UPDATE b_followups SET escalated=1 WHERE id=?',f.id));
      await db.batch(changes);
    }catch(error) {
      // A concurrent runner losing the same claim must not hold the winner's step.
      if(attemptId&&!await stmt(db,'SELECT 1 FROM b_followup_attempts WHERE id=?',attemptId).first())continue;
      const reason=error instanceof Error?error.message:'Reminder failed';
      await db.batch([stmt(db,"UPDATE b_followups SET status='held',reason=? WHERE id=? AND status='active'",reason,f.id),...(attemptId?[stmt(db,"UPDATE b_followup_attempts SET status='held',delivery=? WHERE id=?",reason,attemptId)]:[]),alert(db,f,'followup_failed',`Reminder held: ${reason}`)]);
    }
  }
  return {checked:sequences.length};
}

export async function reconcileFollowup(db:D1Database,actor:Actor,attemptId:string,body:Data) {
  human(actor);need(actor,'owner');insist(['accepted','not_accepted'].includes(body.outcome),'Record a confirmed provider outcome');
  const reason=text(body.reason,'Provider evidence and reason',1000);
  const [check,done]=guard(db,"EXISTS(SELECT 1 FROM b_followup_attempts WHERE id=? AND status='held')",attemptId);
  await atomic(db,actor,[check,stmt(db,'UPDATE b_followup_attempts SET status=?,delivery=? WHERE id=?',body.outcome==='accepted'?'accepted':'failed',`Human reconciliation: ${body.outcome}; ${reason}; no replay`,attemptId),done,audit(db,actor,'followup.reconciled',attemptId,`${body.outcome}: ${reason}`)]);
  return {id:attemptId,outcome:body.outcome};
}
