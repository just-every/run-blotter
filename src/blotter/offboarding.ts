import { invalidateMailConsent } from './mail-consent';
import {pendingSignatures,transferSignatures} from './signatures';
// Staff offboarding (ACCESS-006). The principal previews everything a member
// owns, names a work successor and a review successor, and commits one batch
// that moves it all and deactivates the member. A member already deactivated
// in a hurry is offboarded the same way afterwards. Commit plans again and must
// match the preview. Past messages, decisions and recorded time keep their
// authors; only open work changes hands. Deactivation revokes the member's
// sessions and agent keys. Unsent bulk-message batches move to the review
// successor (MSG-002); a moved marketing batch needs the principal's fresh approval.
import { atomic, audit, digest, email, guard, human, id, insist, need, now, rows, stmt, type Actor, type Data } from './model';
import { eligible } from './jobs';
import { weekStart } from './timesheets';

const OPEN_JOB = "b_jobs.status<>'signed_off'";

/** Everything a member owns that would be orphaned by their departure. */
async function owned(db: D1Database, leaver: string) {
  const [jobs, tasks, rules, notices, threads, portal, proposals, templates, timer, time, keys, sessions, clients, automations, batches,signatures] = await Promise.all([
    rows(db, `SELECT b_jobs.id,b_jobs.title,b_jobs.period_label,b_jobs.status,b_jobs.revision,b_jobs.submitted_by,b_jobs.preparer_email,b_jobs.reviewer_email,b_jobs.manager_email,b_jobs.partner_email,c.name client
      FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id WHERE ${OPEN_JOB} AND ?1 IN (b_jobs.preparer_email,b_jobs.reviewer_email,b_jobs.manager_email,b_jobs.partner_email) ORDER BY b_jobs.due_date`, leaver),
    rows(db, `SELECT s.job_id,s.ordinal,s.label,b_jobs.title job FROM b_job_steps s JOIN b_jobs ON b_jobs.id=s.job_id WHERE ${OPEN_JOB} AND s.done_at IS NULL AND s.assignee_email=? ORDER BY b_jobs.due_date,s.ordinal`, leaver),
    rows(db, `SELECT r.id,r.revision,r.preparer_email,r.reviewer_email,r.manager_email,c.name client,t.name template FROM b_recurrence_rules r JOIN b_clients c ON c.id=r.client_id JOIN b_templates t ON t.id=r.template_id
      WHERE ?1 IN (r.preparer_email,r.reviewer_email,r.manager_email) ORDER BY c.name`, leaver),
    rows(db, "SELECT n.id,n.agency,n.notice_type,n.response_due FROM b_notices n WHERE n.status='open' AND n.assignee_email=? ORDER BY n.response_due", leaver),
    rows(db, "SELECT id,title,follow_up_due FROM b_threads WHERE status='open' AND owner_email=? ORDER BY created_at", leaver),
    rows(db, "SELECT p.id,p.kind,p.body,j.title job FROM b_portal_items p JOIN b_jobs j ON j.id=p.job_id WHERE p.status='open' AND p.owner_email=? ORDER BY p.created_at", leaver),
    rows(db, "SELECT id,kind,agent_label,created_at FROM b_proposals WHERE status='pending' AND for_email=? ORDER BY created_at", leaver),
    rows(db, "SELECT id,name,steps FROM b_templates WHERE EXISTS(SELECT 1 FROM json_each(b_templates.steps) e WHERE CASE WHEN e.type='object' THEN json_extract(e.value,'$.assigneeEmail') END=?) ORDER BY name", leaver),
    stmt(db, 'SELECT t.*,j.title FROM b_timers t JOIN b_jobs j ON j.id=t.job_id WHERE t.person_email=?', leaver).first<Data>(),
    rows(db, `SELECT t.id,t.date,t.minutes,t.description,s.status,s.reason FROM b_time t LEFT JOIN b_time_status s ON s.entry_id=t.id
      WHERE t.person_email=? AND (s.status IS NULL OR s.status<>'approved') ORDER BY t.date`, leaver),
    rows(db, 'SELECT k.id,k.label FROM b_agent_keys k JOIN oa_operators o ON o.id=k.owner_id WHERE o.email=? AND k.revoked=0', leaver),
    stmt(db, 'SELECT COUNT(*) n FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE o.email=? AND s.revoked_at IS NULL', leaver).first<Data>(),
    rows(db, `SELECT id,name,partner_email,team,revision FROM b_clients WHERE merged_into IS NULL AND (partner_email=? OR EXISTS(SELECT 1 FROM json_each(team) WHERE value=?)) ORDER BY name`, leaver,leaver),
    rows(db,"SELECT id,name,version,status,definition FROM b_automation_rules WHERE status<>'revoked' AND (approved_by=? OR json_extract(definition,'$.action.email')=?) ORDER BY name,version",leaver,leaver),
    rows(db, "SELECT id,class,status,reason,topic,send_at,approved_by FROM b_bulk_batches WHERE owner_email=? AND status<>'sent' ORDER BY created_at,id", leaver),
    pendingSignatures(db,leaver),
  ]);
  return { signatures,clients, jobs, tasks, rules, notices, threads, portal, proposals, automations, batches, templates: templates.map(t => ({ id: t.id, name: t.name, steps: JSON.parse(t.steps) })), timer: timer ?? null, time, keys, sessions: Number(sessions!.n) };
}

async function plan(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const leaver = email(body.email, 'Departing member');
  const member = await stmt(db, 'SELECT * FROM b_members WHERE email=?', leaver).first<Data>();
  insist(member, 'Choose a practice member', 404);
  const work = email(body.workSuccessor, 'Successor for their work'), review = body.reviewSuccessor ? email(body.reviewSuccessor, 'Successor for their reviews') : work;
  insist(work !== leaver && review !== leaver, 'A successor cannot be the departing member');
  const problems: string[] = [];
  if (!await eligible(db, work, ['preparer', 'reviewer'])) problems.push(`${work} is not an active member who can prepare work`);
  const o = await owned(db, leaver), swap = (person: string | null, to: string) => person === leaver ? to : person;
  const jobs = o.jobs.map((j): Data => {
    const to = { preparer: swap(j.preparer_email, work), reviewer: swap(j.reviewer_email, review), manager: swap(j.manager_email, review), partner: swap(j.partner_email, review) };
    const reasons = to.reviewer === to.preparer || (j.status === 'review' && to.reviewer === j.submitted_by) ? [`${to.reviewer} cannot review their own work`] : [];
    if (to.partner && to.partner === to.preparer) reasons.push(`${to.partner} cannot give partner sign-off on their own work`);
    return { ...j, to, reasons };
  });
  const rules = o.rules.map((r): Data => {
    const to = { preparer: swap(r.preparer_email, work), reviewer: swap(r.reviewer_email, review), manager: swap(r.manager_email, review) };
    return { ...r, to, reasons: to.reviewer === to.preparer ? [`${to.reviewer} cannot review their own work`] : [] };
  });
  // The review successor matters only when there are reviews, manager roles or proposals to hand over.
  // Only the principal and reviewers send bulk-message batches, so unsent batches go to the review successor.
  const reviews = [...o.jobs, ...o.rules].some(x => x.reviewer_email === leaver || x.manager_email === leaver || x.partner_email === leaver) || o.proposals.length > 0 || o.batches.length > 0 || o.clients.some(c => c.partner_email === leaver);
  if (reviews && !await eligible(db, review, ['reviewer'])) problems.push(`${review} is not an active reviewer or the principal`);
  for (const line of [...jobs, ...rules]) for (const reason of line.reasons) problems.push(`${line.client} ${line.title ?? line.template}: ${reason}`);
  const result = { email: leaver, name: member.name, active: !!member.active, workSuccessor: work, reviewSuccessor: review, ...o, jobs, rules, problems };
  return { ...result, fingerprint: await digest(JSON.stringify(result)) };
}

export const previewOffboarding = plan;

export async function commitOffboarding(db: D1Database, actor: Actor, body: Data) {
  const p = await plan(db, actor, body);
  insist(body.fingerprint === p.fingerprint, 'Their work changed since the preview. Preview again before committing.', 409);
  insist(!p.problems.length, `Resolve first: ${p.problems.join('; ')}`, 409);
  const at = now(), leaver = p.email, rewrite = (steps: Data[]) => JSON.stringify(steps.map(s => s?.assigneeEmail === leaver ? { ...s, assigneeEmail: p.workSuccessor } : s));
  const statements: D1PreparedStatement[] = [];
  for (const j of p.jobs) {
    // Each job must still be at its previewed revision, so nothing changed underneath the preview.
    const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND status<>'signed_off')", j.id, j.revision);
    statements.push(check, stmt(db, 'UPDATE b_jobs SET preparer_email=?,reviewer_email=?,manager_email=?,partner_email=?,revision=? WHERE id=?', j.to.preparer, j.to.reviewer, j.to.manager, j.to.partner, id(), j.id), release,
      audit(db, actor, 'job.reassigned', j.id, `offboarding ${leaver}: preparer ${j.to.preparer}, reviewer ${j.to.reviewer}${j.to.manager ? `, manager ${j.to.manager}` : ''}${j.to.partner ? `, partner ${j.to.partner}` : ''}`));
  }
  for (const c of p.clients) {
    const [check,release] = guard(db,'EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND merged_into IS NULL)',c.id,c.revision);
    const team = [...new Set(JSON.parse(c.team).map((person: string) => person === leaver ? p.workSuccessor : person))];
    statements.push(check,stmt(db,'UPDATE b_clients SET partner_email=?,team=?,revision=? WHERE id=?',c.partner_email === leaver ? p.reviewSuccessor : c.partner_email,JSON.stringify(team),id(),c.id),
      audit(db,actor,'client.team_transferred',c.id,`offboarding ${leaver}: team to ${p.workSuccessor}, partner to ${p.reviewSuccessor}`),release);
  }
  for (const r of p.automations) {
    const [check,done]=guard(db,'EXISTS(SELECT 1 FROM b_automation_rules WHERE id=? AND version=? AND status=? AND definition=?)',r.id,r.version,r.status,r.definition);
    statements.push(check,done,audit(db,actor,'automation.offboarding_checked',r.id,`Offboarding ${leaver}; standing version remains immutable, inactive assignee is refused; new successor version requires fresh approval`));
  }
  for (const b of p.batches) {
    // A moved marketing batch loses its approval and waits, previewed, for the principal to approve the same preview again.
    const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_bulk_batches WHERE id=? AND owner_email=? AND status=?)', b.id, leaver, b.status);
    statements.push(check, b.class === 'marketing'
      ? stmt(db, "UPDATE b_bulk_batches SET owner_email=?,approved_by=NULL,approved_at=NULL,status=CASE WHEN status IN ('scheduled','sending') THEN 'previewed' ELSE status END WHERE id=?", p.reviewSuccessor, b.id)
      : stmt(db, 'UPDATE b_bulk_batches SET owner_email=? WHERE id=?', p.reviewSuccessor, b.id), release,
      audit(db, actor, 'bulk.transferred', b.id, `offboarding ${leaver}: ${b.class} batch to ${p.reviewSuccessor}${b.class === 'marketing' ? "; needs the principal's fresh approval" : ''}`));
  }
  for (const r of p.rules) {
    const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_recurrence_rules WHERE id=? AND revision=?)', r.id, r.revision);
    statements.push(check, stmt(db, 'UPDATE b_recurrence_rules SET preparer_email=?,reviewer_email=?,manager_email=?,revision=? WHERE id=?', r.to.preparer, r.to.reviewer, r.to.manager, id(), r.id), release);
  }
  statements.push(
    stmt(db, `UPDATE b_job_steps SET assignee_email=? WHERE assignee_email=? AND done_at IS NULL AND job_id IN (SELECT id FROM b_jobs WHERE ${OPEN_JOB})`, p.workSuccessor, leaver),
    stmt(db, "UPDATE b_notices SET assignee_email=? WHERE assignee_email=? AND status='open'", p.workSuccessor, leaver),
    stmt(db, "UPDATE b_threads SET owner_email=? WHERE owner_email=? AND status='open'", p.workSuccessor, leaver),
    stmt(db, "UPDATE b_portal_items SET owner_email=? WHERE owner_email=? AND status='open'", p.workSuccessor, leaver),
    stmt(db, "UPDATE b_proposals SET for_email=?,door_sponsor_id=CASE WHEN door_sponsor_id IS NULL THEN NULL ELSE (SELECT id FROM oa_operators WHERE email=? AND status='active') END WHERE for_email=? AND status='pending'", p.reviewSuccessor, p.reviewSuccessor, leaver),
    ...p.templates.map(t => stmt(db, 'UPDATE b_templates SET steps=? WHERE id=?', rewrite(t.steps), t.id)),
    // A running timer records nothing; unsubmitted time goes to reviewers as submitted on the member's behalf.
    stmt(db, 'DELETE FROM b_timers WHERE person_email=?', leaver),
    ...p.time.filter(t => !t.status).map(t => stmt(db, "INSERT INTO b_time_status(entry_id,person_email,week_start,status,submitted_at) VALUES(?,?,?,'submitted',?)", t.id, leaver, weekStart(t.date), at)),
    stmt(db, 'DELETE FROM b_activity_consent WHERE person_email=?', leaver),
    ...transferSignatures(db,actor,p.signatures,leaver,p.workSuccessor),
    ...deactivation(db, leaver),
    audit(db, actor, 'member.offboarded', leaver, `work to ${p.workSuccessor}, reviews to ${p.reviewSuccessor}: ${p.signatures.length} pending signature requests, ${p.jobs.length} jobs, ${p.tasks.length} tasks, ${p.rules.length} recurring rules, ${p.notices.length} notices, ${p.threads.length} discussions, ${p.portal.length} client questions and to-dos, ${p.proposals.length} proposals, ${p.batches.length} message batches, ${p.templates.length} templates${p.timer ? `, timer on ${p.timer.title} since ${p.timer.started_at} discarded` : ''}, ${p.time.filter(t => !t.status).length} time entries submitted, ${p.keys.length} agent keys and ${p.sessions} sessions revoked`),
  );
  await atomic(db, actor, statements);
  return { email: leaver, active: false, moved: { signatures:p.signatures.length, clients:p.clients.length, jobs: p.jobs.length, tasks: p.tasks.length, rules: p.rules.length, notices: p.notices.length, threads: p.threads.length, portal: p.portal.length, proposals: p.proposals.length, batches: p.batches.length, templates: p.templates.length } };
}

/** Deactivating a member revokes every session and agent key they hold; reactivation needs a new sign-in and new keys. */
export function deactivation(db: D1Database, address: string) {
  return [
    invalidateMailConsent(db, address),
    stmt(db,'UPDATE b_enterprise_identities SET active=0,blocked=1 WHERE email=?',address),
    stmt(db,'DELETE FROM b_enterprise_group_members WHERE identity_id IN(SELECT id FROM b_enterprise_identities WHERE email=?)',address),
    stmt(db, 'UPDATE b_members SET active=0 WHERE email=?', address),
    stmt(db, 'UPDATE oa_sessions SET revoked_at=? WHERE revoked_at IS NULL AND operator_id IN (SELECT id FROM oa_operators WHERE email=?)', Date.now(), address),
    stmt(db, 'UPDATE b_agent_keys SET revoked=1 WHERE revoked=0 AND owner_id IN (SELECT id FROM oa_operators WHERE email=?)', address),
  ];
}
