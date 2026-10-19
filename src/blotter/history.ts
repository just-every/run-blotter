// Client engagement history and accountable ownership (CRM-003). A client's
// history is every audited action on the client, its jobs and their requests,
// files, discussions, notices, expenses and time, and the billing exports that
// include its work, newest first, with
// its author, time and the record it links to. Unresolved items are the open
// requests, tasks, reviews, discussions and notices, each with a responsible
// person, next action and due condition. A preparer sees only the jobs they
// may read; client-wide records are for reviewers and the principal. A
// reviewer or the principal hands any unresolved item to another person.
import { atomic, audit, email, guard, human, id, insist, need, optional, readableJobParams, readableJobSql, rows, stmt, text, type Actor, type Data } from './model';
import { eligible } from './jobs';

/** Each history kind and the audit actions it covers. */
const KINDS: Record<string, string> = {
  documents: "a.action LIKE 'request.%' OR a.action LIKE 'file.%' OR a.action LIKE 'deliverable.%'",
  assignments: "a.action IN ('job.started','job.rolled_forward','job.reassigned','job.task_access','client.merged','client.merge_undone') OR a.action LIKE 'step.%'",
  reviews: "a.action IN ('job.submitted','job.returned','job.signed_off')",
  deadlines: "a.action LIKE 'notice.%' OR a.action LIKE 'rule.%'",
  messages: "a.action LIKE 'thread.%' OR a.action LIKE 'portal.%' OR a.action='reminder.sent'",
  billing: "a.action LIKE 'time.%' OR a.action LIKE 'expense.%' OR a.action LIKE 'timer.%' OR a.action LIKE 'export.%'",
};

export async function clientHistory(db: D1Database, actor: Actor, clientId: string, query: Data = {}) {
  const client = await stmt(db, 'SELECT id,name FROM b_clients WHERE id=?', clientId).first<Data>();
  insist(client, 'Client not found', 404);
  const lead = actor.role !== 'preparer';
  const jobs = await rows(db, `SELECT b_jobs.id,b_jobs.title,b_jobs.period_label,b_jobs.status,b_jobs.due_date,b_jobs.preparer_email,b_jobs.reviewer_email FROM b_jobs
    WHERE b_jobs.client_id=? AND ${readableJobSql} ORDER BY b_jobs.period_start`, clientId, ...readableJobParams(actor));
  insist(lead || jobs.length, 'Client not found', 404);
  const ids = JSON.stringify(jobs.map(j => j.id)), kind = optional(query.kind, 'Kind', 20), q = `%${optional(query.q, 'Search', 100).toLowerCase()}%`;
  insist(!kind || Object.hasOwn(KINDS, kind), `Choose one of ${Object.keys(KINDS).join(', ')}`);
  // Every record of the client's readable jobs; client-wide records only for leads.
  const jobIds = 'SELECT value FROM json_each(?1)';
  const objects = `(a.object_id IN (${jobIds})
    OR a.object_id IN (SELECT id FROM b_requests WHERE job_id IN (${jobIds})) OR a.object_id IN (SELECT id FROM b_files WHERE job_id IN (${jobIds}))
    OR a.object_id IN (SELECT id FROM b_threads WHERE job_id IN (${jobIds}) OR (?3 AND client_id=?2 AND job_id IS NULL))
    OR a.object_id IN (SELECT id FROM b_portal_items WHERE job_id IN (${jobIds}))
    OR a.object_id IN (SELECT id FROM b_notices WHERE job_id IN (${jobIds})) OR a.object_id IN (SELECT id FROM b_expenses WHERE job_id IN (${jobIds}))
    OR a.object_id IN (SELECT id FROM b_time WHERE job_id IN (${jobIds})) OR (?3 AND a.object_id IN (SELECT id FROM b_recurrence_rules WHERE client_id=?2)) OR (?3 AND a.object_id=?2)
    OR (?3 AND a.object_id IN (SELECT s.export_id FROM b_export_sources s WHERE s.source_key IN (SELECT 'fee:'||value FROM json_each(?1))
      OR s.source_key IN (SELECT 'time:'||id FROM b_time WHERE job_id IN (${jobIds})) OR s.source_key IN (SELECT 'exp:'||id FROM b_expenses WHERE job_id IN (${jobIds}))
      OR s.source_key IN (SELECT 'adj:'||d.id FROM b_time_adjustments d JOIN b_time t ON t.id=d.entry_id WHERE t.job_id IN (${jobIds})))))`;
  const history = await rows(db, `SELECT a.id,a.actor,a.action,a.object_id,a.detail,a.at,
      COALESCE((SELECT id FROM b_jobs WHERE id=a.object_id),(SELECT job_id FROM b_requests WHERE id=a.object_id),(SELECT job_id FROM b_files WHERE id=a.object_id),
        (SELECT job_id FROM b_threads WHERE id=a.object_id),(SELECT job_id FROM b_portal_items WHERE id=a.object_id),(SELECT job_id FROM b_notices WHERE id=a.object_id),(SELECT job_id FROM b_expenses WHERE id=a.object_id),(SELECT job_id FROM b_time WHERE id=a.object_id)) job_id
    FROM b_audit a WHERE ${objects} AND (?4='' OR ${kind ? KINDS[kind] : '1'}) AND (lower(a.action) LIKE ?5 OR lower(a.detail) LIKE ?5 OR lower(a.actor) LIKE ?5)
    ORDER BY a.at DESC,a.id LIMIT 500`, ids, clientId, lead ? 1 : 0, kind, q);
  const owner = optional(query.owner, 'Owner', 254).toLowerCase();
  const unresolved = (await openItems(db, ids, lead ? clientId : null)).filter(item => !owner || item.owner === owner);
  return { client, jobs, kinds: Object.keys(KINDS), history, unresolved };
}

/** Open items of these jobs (and, for leads, client-wide discussions), each with its owner, next action and due condition. */
async function openItems(db: D1Database, ids: string, clientId: string | null) {
  const open = `SELECT value FROM json_each(?1)`;
  const [requests, tasks, reviews, threads, notices, portal] = await Promise.all([
    rows(db, `SELECT r.id,r.label,r.status,j.id job_id,j.title,j.period_label,j.preparer_email,j.due_date FROM b_requests r JOIN b_jobs j ON j.id=r.job_id
      WHERE j.id IN (${open}) AND j.status='open' AND r.status IN ('requested','received') ORDER BY j.due_date,r.ordinal`, ids),
    rows(db, `SELECT s.ordinal,s.label,s.assignee_email,s.assignee_role,j.id job_id,j.title,j.period_label,j.preparer_email,j.reviewer_email,j.manager_email,j.due_date FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id
      WHERE j.id IN (${open}) AND j.status='open' AND s.done_at IS NULL ORDER BY j.due_date,s.ordinal`, ids),
    rows(db, `SELECT j.id job_id,j.title,j.period_label,j.reviewer_email,j.partner_email,j.reviewed_at,j.due_date FROM b_jobs j WHERE j.id IN (${open}) AND j.status='review' ORDER BY j.due_date`, ids),
    rows(db, `SELECT t.id,t.title,t.owner_email,t.follow_up_due,t.job_id FROM b_threads t WHERE t.status='open' AND (t.job_id IN (${open}) OR (?2 IS NOT NULL AND t.client_id=?2 AND t.job_id IS NULL)) ORDER BY t.created_at`, ids, clientId),
    rows(db, `SELECT n.id,n.agency,n.notice_type,n.assignee_email,n.response_due,n.job_id FROM b_notices n WHERE n.status='open' AND n.job_id IN (${open}) ORDER BY n.response_due`, ids),
    rows(db, `SELECT p.id,p.kind,p.body,p.owner_email,p.due_date item_due,j.id job_id,j.title,j.period_label,j.due_date FROM b_portal_items p JOIN b_jobs j ON j.id=p.job_id
      WHERE j.id IN (${open}) AND j.status<>'signed_off' AND p.status='open' ORDER BY p.created_at`, ids),
  ]);
  const work = (j: Data) => `${j.title} · ${j.period_label}`;
  return [
    ...requests.map(r => ({ kind: 'request', id: r.id, jobId: r.job_id, work: work(r), owner: r.preparer_email, nextAction: r.status === 'requested' ? `Collect “${r.label}” from the client` : `Accept or return “${r.label}”`, due: `job due ${r.due_date}` })),
    ...tasks.map(t => {
      const role = t.assignee_role === 'reviewer' ? t.reviewer_email : t.assignee_role === 'manager' ? t.manager_email || t.reviewer_email : t.preparer_email;
      return { kind: 'task', id: `${t.job_id}:${t.ordinal}`, jobId: t.job_id, work: work(t), owner: t.assignee_email || role, nextAction: `Complete “${t.label}”`, due: `job due ${t.due_date}` };
    }),
    ...reviews.map(r => r.reviewed_at
      ? { kind: 'partner_sign_off', id: r.job_id, jobId: r.job_id, work: work(r), owner: r.partner_email, nextAction: 'Partner sign-off, or return', due: `job due ${r.due_date}` }
      : { kind: 'review', id: r.job_id, jobId: r.job_id, work: work(r), owner: r.reviewer_email, nextAction: 'Review and sign off, or return', due: `job due ${r.due_date}` }),
    ...threads.map(t => ({ kind: 'discussion', id: t.id, jobId: t.job_id, work: t.title, owner: t.owner_email, nextAction: `Resolve “${t.title}”`, due: t.follow_up_due ? `follow up by ${t.follow_up_due}` : 'no follow-up date' })),
    ...portal.map(p => {
      const about = p.body.length > 60 ? p.body.slice(0, 59) + '…' : p.body;
      return p.kind === 'question'
        ? { kind: 'client_question', id: p.id, jobId: p.job_id, work: work(p), owner: p.owner_email, nextAction: `Answer the client: “${about}”`, due: `job due ${p.due_date}` }
        : { kind: 'client_todo', id: p.id, jobId: p.job_id, work: work(p), owner: p.owner_email, nextAction: `Client to complete “${about}”`, due: p.item_due ? `client due ${p.item_due}` : `job due ${p.due_date}` };
    }),
    ...notices.map(n => ({ kind: 'notice', id: n.id, jobId: n.job_id, work: `${n.agency} ${n.notice_type}`, owner: n.assignee_email, nextAction: 'Respond to the notice', due: `respond by ${n.response_due}` })),
  ];
}

/**
 * Hand one unresolved item to another person. A request's owner is its job's
 * preparer and a review's is its reviewer, so those reassign the job (nobody
 * reviews their own work); a task is assigned to them by name (which lets them
 * read the job, WORK-009); a discussion or notice changes its owner.
 */
export async function changeOwner(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const to = email(body.owner, 'New owner'), itemId = text(body.id, 'Item', 200);
  const item = (await clientHistory(db, actor, clientId)).unresolved.find(i => i.kind === body.kind && i.id === itemId);
  insist(item, 'Unresolved item not found', 404);
  insist(item.owner !== to, `${to} already owns it`, 409);
  const j = item.jobId ? await stmt(db, 'SELECT * FROM b_jobs WHERE id=?', item.jobId).first<Data>() : null;
  const can = (roles: string[]) => eligible(db, to, roles);
  let change: D1PreparedStatement[];
  if (item.kind === 'request' || item.kind === 'review') {
    const preparer = item.kind === 'request' ? to : j!.preparer_email, reviewer = item.kind === 'review' ? to : j!.reviewer_email;
    insist(await can(item.kind === 'review' ? ['reviewer'] : ['preparer', 'reviewer']), `${to} must be an active member who can do that work`);
    insist(reviewer !== preparer && reviewer !== (item.kind === 'review' ? j!.submitted_by : null), `${reviewer} cannot review their own work`, 409);
    insist(!j!.partner_email || j!.partner_email !== preparer, `${preparer} is the partner and cannot prepare this job`, 409);
    const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?)', j!.id, j!.revision);
    change = [check, stmt(db, 'UPDATE b_jobs SET preparer_email=?,reviewer_email=?,revision=? WHERE id=?', preparer, reviewer, id(), j!.id), release,
      audit(db, actor, 'job.reassigned', j!.id, `preparer ${preparer}, reviewer ${reviewer}`)];
  } else if (item.kind === 'partner_sign_off') {
    insist(await can(['reviewer']), `${to} must be an active reviewer or the principal`);
    insist(to !== j!.preparer_email && to !== j!.submitted_by, `${to} cannot give partner sign-off on their own work`, 409);
    const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?)', j!.id, j!.revision);
    change = [check, stmt(db, 'UPDATE b_jobs SET partner_email=?,revision=? WHERE id=?', to, id(), j!.id), release, audit(db, actor, 'job.reassigned', j!.id, `partner ${to}`)];
  } else if (item.kind === 'task') {
    insist(await can(['preparer', 'reviewer']), `${to} must be an active practice member`);
    const ordinal = Number(itemId.split(':')[1]);
    change = [stmt(db, 'UPDATE b_job_steps SET assignee_email=? WHERE job_id=? AND ordinal=? AND done_at IS NULL', to, j!.id, ordinal),
      audit(db, actor, 'job.task_access', j!.id, `${to} can read this job and act on their own tasks`)];
  } else if (item.kind === 'discussion') {
    insist(await can(['reviewer']) || (j && j.preparer_email === to), `${to} cannot read this discussion`);
    change = [stmt(db, "UPDATE b_threads SET owner_email=? WHERE id=? AND status='open'", to, itemId)];
  } else if (item.kind === 'client_question' || item.kind === 'client_todo') {
    insist(await can(['reviewer']) || j!.preparer_email === to, `${to} cannot read this job`);
    change = [stmt(db, "UPDATE b_portal_items SET owner_email=? WHERE id=? AND status='open'", to, itemId)];
  } else {
    insist(await can(['preparer', 'reviewer']), 'The assigned practitioner must be an active practice member');
    change = [stmt(db, "UPDATE b_notices SET assignee_email=? WHERE id=? AND status='open'", to, itemId)];
  }
  await atomic(db, actor, [...change, audit(db, actor, 'item.owner_changed', ['discussion', 'notice', 'client_question', 'client_todo'].includes(item.kind) ? itemId : j!.id, `${item.kind} ${item.nextAction}: ${item.owner} to ${to}`)]);
  return { ...item, owner: to };
}
