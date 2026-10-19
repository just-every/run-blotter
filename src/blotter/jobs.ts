// Recurring client jobs: start from a template, roll forward, work the
// checklist, submit for review and sign off.
import { deliverablesFor } from './deliverables';
import { atomic, audit, date, guard, human, id, insist, integer, job, need, now, rows, stmt, text, type Actor, type Data } from './model';

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
  const statements = [
    stmt(db, `INSERT INTO b_jobs(id,client_id,template_id,title,period_start,period_label,due_date,due_note,preparer_email,reviewer_email,status,fee_cents,rolled_from,revision,created_by,created_channel,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,'open',?,?,?,?,?,?)`,
      jobId, values.clientId, template.id, template.name, values.periodStart, periodLabel(values.periodStart, template.recurrence),
      values.dueDate, values.dueNote, values.preparer, values.reviewer, template.fee_cents, values.rolledFrom ?? null, id(), actor.email, actor.channel, now()),
    ...JSON.parse(template.steps).map((label: string, n: number) => stmt(db, 'INSERT INTO b_job_steps(job_id,ordinal,label) VALUES(?,?,?)', jobId, n + 1, label)),
    ...JSON.parse(template.requests).map((label: string, n: number) => stmt(db, "INSERT INTO b_requests(id,job_id,ordinal,label,status,updated_by,updated_at) VALUES(?,?,?,?,'requested',?,?)", id(), jobId, n + 1, label, actor.email, now())),
    audit(db, actor, values.rolledFrom ? 'job.rolled_forward' : 'job.started', jobId, `${template.name} ${values.periodStart}`),
  ];
  return statements;
}

export async function startJob(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const client = await stmt(db, 'SELECT * FROM b_clients WHERE id=?', text(body.clientId, 'Client')).first<Data>();
  insist(client, 'Client not found', 404);
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', text(body.templateId, 'Template')).first<Data>();
  insist(template, 'Template not found', 404);
  const values = {
    id: id(), clientId: client.id, periodStart: date(body.periodStart, 'Period start'), dueDate: date(body.dueDate, 'Due date'),
    dueNote: text(body.dueNote, 'Where the due date comes from', 300),
    preparer: await assignee(db, body.preparerEmail, 'Preparer', ['preparer', 'reviewer']),
    reviewer: await assignee(db, body.reviewerEmail, 'Reviewer', ['reviewer']),
  };
  await atomic(db, actor, createStatements(db, actor, template, values));
  return job(db, actor, values.id);
}

/** The next period's job: same client, template and people; a person records the due date. */
export async function rollForward(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
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
  };
  insist(values.dueDate >= periodStart, 'The due date is before the period starts');
  const exists = await stmt(db, 'SELECT id FROM b_jobs WHERE client_id=? AND template_id=? AND period_start=?', previous.client_id, template.id, periodStart).first();
  insist(!exists, `The ${periodLabel(periodStart, template.recurrence)} job already exists`, 409);
  await atomic(db, actor, createStatements(db, actor, template, values));
  return job(db, actor, values.id);
}

export async function jobDetail(db: D1Database, actor: Actor, jobId: string) {
  const j = await job(db, actor, jobId);
  const [client, steps, requests, files, reminders, time, links, deliverables] = await Promise.all([
    stmt(db, 'SELECT * FROM b_clients WHERE id=?', j.client_id).first<Data>(),
    rows(db, 'SELECT * FROM b_job_steps WHERE job_id=? ORDER BY ordinal', j.id),
    rows(db, 'SELECT * FROM b_requests WHERE job_id=? ORDER BY ordinal', j.id),
    rows(db, 'SELECT id,request_id,name,mime,size,sha256,uploaded_by,channel,uploaded_at,erased_at,erased_by,erase_reason FROM b_files WHERE job_id=? ORDER BY uploaded_at', j.id),
    rows(db, 'SELECT * FROM b_reminders WHERE job_id=? ORDER BY sent_at DESC', j.id),
    rows(db, `SELECT t.*,s.export_id,st.status review_status,st.reason review_reason FROM b_time t LEFT JOIN b_export_sources s ON s.source_key='time:'||t.id LEFT JOIN b_time_status st ON st.entry_id=t.id WHERE t.job_id=? ORDER BY t.date,t.created_at`, j.id),
    rows(db, 'SELECT id,created_by,created_at,expires_at,revoked_at FROM b_portal_links WHERE job_id=? ORDER BY created_at DESC', j.id),
    deliverablesFor(db, j.id),
  ]);
  const next = await stmt(db, 'SELECT id FROM b_jobs WHERE rolled_from=?', j.id).first<Data>();
  return { job: j, client, steps, requests: requests.map(r => ({ ...r, files: files.filter(f => f.request_id === r.id) })), reminders, time, links, deliverables, nextJobId: next?.id ?? null };
}

const openJob = (j: Data, revision: unknown) => {
  insist(j.status === 'open', 'This job is not open for work', 409);
  insist(revision === undefined || revision === j.revision, 'The job changed. Refresh and try again.', 409);
};

export async function setStep(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await job(db, actor, jobId); openJob(j, body.revision);
  const ordinal = integer(body.ordinal, 'Step', 1, 100), done = body.done === true;
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open')", j.id);
  await atomic(db, actor, [check,
    stmt(db, 'UPDATE b_job_steps SET done_by=?,done_at=? WHERE job_id=? AND ordinal=?', done ? actor.email : null, done ? now() : null, j.id, ordinal),
    stmt(db, 'UPDATE b_jobs SET revision=? WHERE id=?', id(), j.id), release,
    audit(db, actor, done ? 'step.done' : 'step.reopened', j.id, String(ordinal))]);
  return jobDetail(db, actor, j.id);
}

export async function submitJob(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await job(db, actor, jobId); openJob(j, body.revision);
  const pending = await stmt(db, `SELECT (SELECT COUNT(*) FROM b_job_steps WHERE job_id=? AND done_at IS NULL) steps,
    (SELECT COUNT(*) FROM b_requests WHERE job_id=? AND status<>'accepted') requests`, j.id, j.id).first<Data>();
  insist(pending!.steps === 0, 'Finish every checklist step before submitting for review', 409);
  insist(pending!.requests === 0, 'Accept every requested client document before submitting for review', 409);
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?) AND NOT EXISTS(SELECT 1 FROM b_job_steps WHERE job_id=? AND done_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM b_requests WHERE job_id=? AND status<>'accepted')`, j.id, j.revision, j.id, j.id);
  await atomic(db, actor, [check,
    stmt(db, "UPDATE b_jobs SET status='review',submitted_by=?,submitted_at=?,revision=? WHERE id=?", actor.email, now(), id(), j.id), release,
    audit(db, actor, 'job.submitted', j.id)]);
  return jobDetail(db, actor, j.id);
}

/** The assigned reviewer (or the principal) signs off or returns the job, with a recorded note. */
export async function reviewJob(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const j = await job(db, actor, jobId);
  insist(j.status === 'review', 'This job is not waiting for review', 409);
  insist(body.revision === j.revision, 'The job changed. Refresh and try again.', 409);
  insist(actor.role === 'owner' || actor.email === j.reviewer_email, 'Only the assigned reviewer or the principal can review this job', 403);
  const note = text(body.note, 'Review note', 2000);
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND status='review')", j.id, j.revision);
  if (body.decision === 'return') {
    await atomic(db, actor, [check, stmt(db, "UPDATE b_jobs SET status='open',revision=? WHERE id=?", id(), j.id), release, audit(db, actor, 'job.returned', j.id, note)]);
    return jobDetail(db, actor, j.id);
  }
  insist(body.decision === 'signoff', 'Choose sign off or return');
  const selfReview = actor.email === j.preparer_email || actor.email === j.submitted_by;
  // A solo principal may review their own work, but must say so; it is recorded.
  insist(!selfReview || (actor.role === 'owner' && body.selfReview === true), 'A different person must review this job', 403);
  const recorded = selfReview ? `${note} [self-review acknowledged]` : note;
  await atomic(db, actor, [check,
    stmt(db, "UPDATE b_jobs SET status='signed_off',signed_off_by=?,signed_off_at=?,sign_off_note=?,revision=? WHERE id=?", actor.email, now(), recorded, id(), j.id),
    stmt(db, 'UPDATE b_portal_links SET revoked_at=? WHERE job_id=? AND revoked_at IS NULL', now(), j.id), release,
    audit(db, actor, 'job.signed_off', j.id, recorded)]);
  return jobDetail(db, actor, j.id);
}
