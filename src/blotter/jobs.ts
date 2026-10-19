// Recurring client jobs: start from a template, roll forward, work the
// checklist, submit for review and sign off.
import { runtimeBindings, type Bindings } from '../auth.server';
import { deliverablesFor } from './deliverables';
import { jobExpenses } from './expenses';
import { advance, dependents, flowSteps, jobAnswers, pendingStep, readyGuard } from './flow';
import { completion, stepInsert } from './tasks';
import { notify, reviewRequested } from './notifications';
import { budget, myTimer } from './timers';
import { staffPortal } from './portal-items';
import { historyRow, historyWhen, PARTNER_SIGN_OFF, stageOf, statusHistory, subOf } from './statuses';
import { clientContacts } from './client-contacts';
import { atomic, audit, date, guard, human, id, insist, integer, job, need, now, readableJob, rows, stmt, text, type Actor, type Data } from './model';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STEP = { monthly: 1, quarterly: 3, annual: 12 } as const;
type Recurrence = keyof typeof STEP;

/** Calendar arithmetic on the period start only; no tax due date is ever computed. */
export function addMonths(start: string, months: number) {
  const [y, m, d] = start.split('-').map(Number);
  const total = y * 12 + (m - 1) + months, year = Math.floor(total / 12), month = total % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
/** The start of the period after the one starting on `start`. */
export const nextPeriod = (start: string, recurrence: Recurrence) => addMonths(start, STEP[recurrence]);
export function periodLabel(start: string, recurrence: Recurrence) {
  const name = (value: string) => { const [y, m] = value.split('-').map(Number); return { month: MONTHS[m - 1], year: y }; };
  const first = name(start), last = name(addMonths(start, STEP[recurrence] - 1));
  if (recurrence === 'monthly') return `${first.month} ${first.year}`;
  return first.year === last.year ? `${first.month}–${last.month} ${last.year}` : `${first.month} ${first.year}–${last.month} ${last.year}`;
}

/** An active member in one of these roles, or the active principal. */
export async function eligible(db: D1Database, address: string, roles: string[]) {
  return !!await stmt(db, `SELECT 1 FROM b_members WHERE email=? AND active=1 AND role IN (SELECT value FROM json_each(?))
    UNION ALL SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active'`, address, JSON.stringify(roles), address).first();
}
async function assignee(db: D1Database, address: unknown, label: string, roles: string[]) {
  const value = text(address, label, 254).toLowerCase();
  insist(await eligible(db, value, roles), `${label} must be an active practice member who can do that work`);
  return value;
}

export function createStatements(db: D1Database, actor: Actor, template: Data, values: Data) {
  const jobId = values.id;
  const [active, activeDone] = guard(db, "EXISTS(SELECT 1 FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL)", values.clientId);
  const statements = [active, activeDone,
    // A job carries the work type chosen for it, else its template's own (WORK-007), and starts Planned.
    stmt(db, `INSERT INTO b_jobs(id,client_id,template_id,title,period_start,period_label,due_date,due_note,preparer_email,reviewer_email,manager_email,status,fee_cents,rolled_from,revision,created_by,created_channel,created_at,work_type_id,open_stage,partner_email,currency)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,'open',?,?,?,?,?,?,?,'planned',?,?)`,
      jobId, values.clientId, template.id, template.name, values.periodStart, periodLabel(values.periodStart, template.recurrence),
      values.dueDate, values.dueNote, values.preparer, values.reviewer, values.manager ?? null, template.fee_cents, values.rolledFrom ?? null, id(), actor.email, actor.channel, now(), values.workTypeId ?? 'wt-' + template.id, values.partner ?? null, template.currency),
    stmt(db, `UPDATE b_jobs SET starter_content=(SELECT CASE WHEN starter_content IS NULL THEN NULL ELSE
      json_set(starter_content,'$.messages',json((SELECT json_group_array(json_object(
        'key',json_extract(r.value,'$.key'),'id',m.id,'version',m.version,'name',m.name,'subject',v.subject,'body',v.body))
        FROM json_each(b_templates.starter_content,'$.messages') r JOIN b_msg_templates m ON m.id=json_extract(r.value,'$.id') AND m.deleted_at IS NULL
        JOIN b_msg_template_versions v ON v.template_id=m.id AND v.version=m.version))) END FROM b_templates WHERE id=?) WHERE id=?`, template.id, jobId),
    historyRow(db, jobId, { stage: null, sub: null }, { stage: 'planned', sub: null }, actor.email),
    ...JSON.parse(template.steps).map((entry: Data, n: number) => stepInsert(db, jobId, entry as never, n)),
    // A task assigned by name lets that person read this job (ACCESS-001); each grant is audited.
    ...[...new Set(JSON.parse(template.steps).map((entry: Data) => entry?.assigneeEmail).filter(Boolean))].map(person =>
      audit(db, actor, 'job.task_access', jobId, `${person} can read this job and act on their own tasks`)),
    ...JSON.parse(template.requests).map((label: string, n: number) => stmt(db, "INSERT INTO b_requests(id,job_id,ordinal,label,status,updated_by,updated_at) VALUES(?,?,?,?,'requested',?,?)", id(), jobId, n + 1, label, actor.email, now())),
    // The template's questions (WORK-003), unanswered; branches wait for them.
    ...JSON.parse(template.questions ?? '[]').map((q: Data, n: number) => stmt(db, 'INSERT INTO b_job_answers(job_id,key,ordinal,label,options) VALUES(?,?,?,?,?)', jobId, q.key, n + 1, q.label, JSON.stringify(q.options))),
    audit(db, actor, values.rolledFrom ? 'job.rolled_forward' : 'job.started', jobId, `${template.name} ${values.periodStart}`),
  ];
  return statements;
}

export async function startJob(env: Bindings, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const db = runtimeBindings(env).DB;
  const client = await stmt(db, "SELECT * FROM b_clients WHERE id=? AND merged_into IS NULL AND lifecycle='active'", text(body.clientId, 'Client')).first<Data>();
  insist(client, 'Client not found', 404);
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', text(body.templateId, 'Template')).first<Data>();
  insist(template, 'Template not found', 404);
  const values = {
    id: id(), clientId: client.id, periodStart: date(body.periodStart, 'Period start'), dueDate: date(body.dueDate, 'Due date'),
    dueNote: text(body.dueNote, 'Where the due date comes from', 300),
    preparer: await assignee(db, body.preparerEmail, 'Preparer', ['preparer', 'reviewer']),
    reviewer: await assignee(db, body.reviewerEmail, 'Reviewer', ['reviewer']),
    // The manager job role (WORK-009) is the reviewer unless someone is named.
    manager: body.managerEmail ? await assignee(db, body.managerEmail, 'Manager', ['reviewer']) : null,
  };
  // The work type (WORK-007): the one chosen, else the template's own; its default budget applies unless one is given.
  const type = await stmt(db, 'SELECT * FROM b_work_types WHERE id=?', body.workTypeId ? text(body.workTypeId, 'Work type') : 'wt-' + template.id).first<Data>();
  insist(type, 'Work type not found', 404);
  // The roles the work type needs beyond preparer and reviewer: a manager and a partner (never the preparer) must be named.
  const roles: string[] = JSON.parse(type.roles);
  insist(!roles.includes('manager') || values.manager, `${type.name} work needs a manager`);
  const partner = body.partnerEmail ? await assignee(db, body.partnerEmail, 'Partner', ['reviewer']) : null;
  insist(!roles.includes('partner') || partner, `${type.name} work needs a partner for sign-off`);
  insist(partner !== values.preparer, 'The partner cannot be the preparer', 400);
  Object.assign(values, { workTypeId: type.id, partner: roles.includes('partner') ? partner : null });
  // An optional time budget, approved by the reviewer or principal who starts the job (TIME-001).
  const budgetMinutes = body.budgetMinutes === undefined || body.budgetMinutes === '' ? type.budget_minutes : integer(body.budgetMinutes, 'Time budget in minutes', 1, 100_000);
  await atomic(db, actor, [...createStatements(db, actor, template, values), ...(budgetMinutes ? [stmt(db, 'UPDATE b_jobs SET budget_minutes=? WHERE id=?', budgetMinutes, values.id)] : [])]);
  await advance(env, [values.id], actor.email);
  return job(db, actor, values.id);
}

/** The next period's job: same client, template and people; a person records the due date. */
export async function rollForward(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const db = runtimeBindings(env).DB;
  const previous = await job(db, actor, jobId);
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', previous.template_id).first<Data>();
  insist(template, 'Template not found', 404);
  const periodStart = addMonths(previous.period_start, STEP[template.recurrence as Recurrence]);
  if (body.periodStart !== undefined) insist(date(body.periodStart, 'Period start') === periodStart, `The next period starts ${periodStart}`, 409);
  const values = {
    id: actor.approval?.resultId ?? id(), clientId: previous.client_id, periodStart, rolledFrom: previous.id,
    dueDate: date(body.dueDate, 'Due date'), dueNote: text(body.dueNote, 'Where the due date comes from', 300),
    preparer: await assignee(db, previous.preparer_email, 'Preparer', ['preparer', 'reviewer']),
    reviewer: await assignee(db, previous.reviewer_email, 'Reviewer', ['reviewer']),
    manager: previous.manager_email ? await assignee(db, previous.manager_email, 'Manager', ['reviewer']) : null,
  workTypeId: previous.work_type_id,
    partner: previous.partner_email ? await assignee(db, previous.partner_email, 'Partner', ['reviewer']) : null,
  };
  insist(values.dueDate >= periodStart, 'The due date is before the period starts');
  const exists = await stmt(db, 'SELECT id FROM b_jobs WHERE client_id=? AND template_id=? AND period_start=?', previous.client_id, template.id, periodStart).first();
  insist(!exists, `The ${periodLabel(periodStart, template.recurrence)} job already exists`, 409);
  await atomic(db, actor, createStatements(db, actor, template, values));
  await advance(env, [values.id], actor.email);
  return job(db, actor, values.id);
}

export async function jobDetail(db: D1Database, actor: Actor, jobId: string) {
  const j = await readableJob(db, actor, jobId);
  const [client, steps, requests, files, reminders, time, links, deliverables, money, answers] = await Promise.all([
    stmt(db, 'SELECT * FROM b_clients WHERE id=?', j.client_id).first<Data>(),
    flowSteps(db, j),
    rows(db, 'SELECT * FROM b_requests WHERE job_id=? ORDER BY ordinal', j.id),
    rows(db, `SELECT f.id,f.request_id,f.name,f.mime,CASE WHEN f.storage='packet' THEN p.original_size ELSE f.size END size,f.sha256,f.uploaded_by,f.channel,f.uploaded_at,f.erased_at,f.erased_by,f.erase_reason FROM b_files f LEFT JOIN b_document_packets p ON p.file_id=f.id WHERE f.job_id=? ORDER BY f.uploaded_at`, j.id),
    rows(db, 'SELECT * FROM b_reminders WHERE job_id=? ORDER BY sent_at DESC', j.id),
    rows(db, `SELECT t.*,s.export_id,st.status review_status,st.reason review_reason,(SELECT label FROM b_job_steps WHERE job_id=t.job_id AND ordinal=t.step_ordinal) task FROM b_time t LEFT JOIN b_export_sources s ON s.source_key='time:'||t.id LEFT JOIN b_time_status st ON st.entry_id=t.id WHERE t.job_id=? ORDER BY t.date,t.created_at`, j.id),
    rows(db, 'SELECT id,created_by,created_at,expires_at,revoked_at FROM b_portal_links WHERE job_id=? ORDER BY created_at DESC', j.id),
    deliverablesFor(db, j.id),
    jobExpenses(db, j),
    jobAnswers(db, j.id),
  ]);
  if (client?.ssn_last4) client.ssn_last4 = '•••••' + client.ssn_last4;
  const next = await stmt(db, 'SELECT id FROM b_jobs WHERE rolled_from=?', j.id).first<Data>();
  // Full readers see the client link's progress, messages and to-dos (PORTAL-003); a named-task reader does not.
  const portal = j.access === 'full' ? await staffPortal(db, j) : null;
  return { contacts: await clientContacts(db,actor,j.client_id), job: j, starter: j.starter_content ? JSON.parse(j.starter_content) : null, portal, statusHistory: await statusHistory(db, actor, j.id), client, budget: await budget(db, j), timer: await myTimer(db, actor) ?? null, steps, requests: requests.map(r => ({ ...r, files: files.filter(f => f.request_id === r.id) })), reminders, time, links, deliverables, ...money, answers, nextJobId: next?.id ?? null };
}

const openJob = (j: Data, revision: unknown) => {
  insist(j.status === 'open', 'This job is not open for work', 409);
  insist(revision === undefined || revision === j.revision, 'The job changed. Refresh and try again.', 409);
};

export async function setStep(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB;
  const j = await readableJob(db, actor, jobId); openJob(j, body.revision);
  const ordinal = integer(body.ordinal, 'Step', 1, 100), done = body.done === true;
  const step = await stmt(db, 'SELECT * FROM b_job_steps WHERE job_id=? AND ordinal=?', j.id, ordinal).first<Data>();
  insist(step, 'Checklist step not found', 404);
  insist(j.access === 'full' || step.assignee_email === actor.email, 'You can act only on your own tasks on this job', 403);
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open')", j.id);
  // A task that is blocked or outside its answered branch cannot be completed (WORK-003).
  const ready = done && !step.done_at ? await readyGuard(db, j, ordinal) : [];
  await atomic(db, actor, [check, ...ready,
    await completion(db, j, step, done, actor.email, now(), body),
    stmt(db, 'UPDATE b_jobs SET revision=? WHERE id=?', id(), j.id), release,
    audit(db, actor, done ? 'step.done' : 'step.reopened', j.id, String(ordinal))]);
  await advance(env, [j.id], actor.email);
  return jobDetail(db, actor, j.id);
}

export async function submitJob(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB;
  const j = await job(db, actor, jobId); openJob(j, body.revision);
  const pending = await stmt(db, `SELECT (SELECT COUNT(*) FROM b_job_steps s WHERE s.job_id=? AND ${pendingStep('s')}) steps,
    (SELECT COUNT(*) FROM b_requests WHERE job_id=? AND status<>'accepted') requests`, j.id, j.id).first<Data>();
  insist(pending!.steps === 0, 'Finish every checklist step before submitting for review', 409);
  insist(pending!.requests === 0, 'Accept every requested client document before submitting for review', 409);
  const at = now();
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?) AND NOT EXISTS(SELECT 1 FROM b_job_steps s WHERE s.job_id=? AND ${pendingStep('s')})
    AND NOT EXISTS(SELECT 1 FROM b_requests WHERE job_id=? AND status<>'accepted')`, j.id, j.revision, j.id, j.id);
  await atomic(db, actor, [check,
    stmt(db, "UPDATE b_jobs SET status='review',sub_status_id=NULL,submitted_by=?,submitted_at=?,revision=? WHERE id=?", actor.email, at, id(), j.id), release,
    historyWhen(db, j, 'in_review', actor.email, at, 'submitted_at'), audit(db, actor, 'job.submitted', j.id)]);
  await reviewRequested(env, j.id, actor.name || actor.email);
  await advance(env, await dependents(db, j), actor.email);
  return jobDetail(db, actor, j.id);
}

/** The assigned reviewer (or the principal) signs off or returns the job, with a recorded note. */
export async function reviewJob(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const db = runtimeBindings(env).DB;
  const j = await job(db, actor, jobId);
  insist(j.status === 'review', 'This job is not waiting for review', 409);
  insist(body.revision === j.revision, 'The job changed. Refresh and try again.', 409);
  // After the reviewer's sign-off a partner-sign-off job waits for its partner (WORK-007); only they or the principal act on it.
  const partnerStep = !!j.reviewed_at;
  insist(actor.role === 'owner' || actor.email === (partnerStep ? j.partner_email : j.reviewer_email),
    partnerStep ? 'Only the named partner or the principal can sign off or return this job' : 'Only the assigned reviewer or the principal can review this job', 403);
  const note = text(body.note, 'Review note', 2000), from = { stage: stageOf(j), sub: subOf(j) };
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND status='review')", j.id, j.revision);
  if (body.decision === 'return') {
    await atomic(db, actor, [check, stmt(db, "UPDATE b_jobs SET status='open',open_stage='in_progress',sub_status_id=NULL,reviewed_by=NULL,reviewed_at=NULL,revision=? WHERE id=?", id(), j.id), release,
      historyRow(db, j.id, from, { stage: 'in_progress', sub: null }, actor.email), audit(db, actor, 'job.returned', j.id, note)]);
    await notify(env, [j.preparer_email], { kind: 'review_returned', jobId: j.id, summary: `${actor.name || actor.email} returned ${j.title} ${j.period_label} to you: ${note}` }, actor.email);
    await advance(env, await dependents(db, j), actor.email);
    return jobDetail(db, actor, j.id);
  }
  insist(body.decision === 'signoff', 'Choose sign off or return');
  const selfReview = actor.email === j.preparer_email || actor.email === j.submitted_by;
  // A solo principal may review their own work, but must say so; it is recorded.
  insist(!selfReview || (actor.role === 'owner' && body.selfReview === true), 'A different person must review this job', 403);
  const recorded = selfReview ? `${note} [self-review acknowledged]` : note;
  if (j.partner_email && !partnerStep) {
    await atomic(db, actor, [check, stmt(db, 'UPDATE b_jobs SET sub_status_id=NULL,reviewed_by=?,reviewed_at=?,revision=? WHERE id=?', actor.email, now(), id(), j.id), release,
      historyRow(db, j.id, from, { stage: 'in_review', sub: PARTNER_SIGN_OFF }, actor.email), audit(db, actor, 'job.reviewed', j.id, `${recorded} (partner sign-off by ${j.partner_email})`)]);
    await notify(env, [j.partner_email], { kind: 'partner_sign_off', jobId: j.id, summary: `${actor.name || actor.email} reviewed ${j.title} ${j.period_label}; it waits for your partner sign-off` }, actor.email);
    return jobDetail(db, actor, j.id);
  }
  await atomic(db, actor, [check,
    stmt(db, "UPDATE b_jobs SET status='signed_off',sub_status_id=NULL,signed_off_by=?,signed_off_at=?,sign_off_note=?,revision=? WHERE id=?", actor.email, now(), recorded, id(), j.id),
    historyRow(db, j.id, from, { stage: 'completed', sub: null }, actor.email),
    stmt(db, 'UPDATE b_portal_links SET revoked_at=? WHERE job_id=? AND revoked_at IS NULL', now(), j.id), release,
    audit(db, actor, 'job.signed_off', j.id, recorded)]);
  await advance(env, await dependents(db, j), actor.email);
  return jobDetail(db, actor, j.id);
}
