// Task assignees, relative dates and instructions (WORK-009). A template's
// checklist step can name its owner (a job role or a person), start and due
// dates in whole days from the work's start (its period start) or due date, a
// time estimate, instructions with an SOP link, a required attachment and a
// client-facing flag. Open tasks resolve their owner and dates when read, so
// they follow the job's people and due date; completing one keeps who, when,
// the owner and the dates it had then.
import { decodeFile, fileResponse } from './documents';
import { checkFlow, flowSteps, noFlow, pendingStep, taskFlow, templateQuestions, type Flow, type Question } from './flow';
import { eligible } from './jobs';
import { date, digest, email, insist, integer, lines, optional, readableJob, rows, stmt, text, type Actor, type Data } from './model';

const ROLES = ['preparer', 'reviewer', 'manager'] as const;
const ANCHORS = ['start', 'due'] as const;
type Task = {
  label: string; assigneeRole: string | null; assigneeEmail: string | null; startAnchor: string | null; startOffset: number | null;
  dueAnchor: string | null; dueOffset: number | null; estimateMinutes: number | null; instructions: string; sopUrl: string;
  requiresAttachment: boolean; clientFacing: boolean;
} & Flow;

const plain = (label: string): Task => ({ label, assigneeRole: null, assigneeEmail: null, startAnchor: null, startOffset: null, dueAnchor: null, dueOffset: null, estimateMinutes: null, instructions: '', sopUrl: '', requiresAttachment: false, clientFacing: false, ...noFlow });

function relative(anchor: unknown, offset: unknown, label: string) {
  if ((anchor === undefined || anchor === null || anchor === '') && (offset === undefined || offset === null || offset === '')) return [null, null] as const;
  insist(ANCHORS.includes(anchor as never), `${label}: count days from the work's start or due date`);
  return [anchor as string, integer(offset, `${label} days`, -366, 366)] as const;
}
function sop(value: unknown) {
  const url = optional(value, 'SOP link', 500);
  if (url) { let parsed: URL | null = null; try { parsed = new URL(url); } catch { /* refused below */ } insist(parsed && ['https:', 'http:'].includes(parsed.protocol), 'SOP link: use a full https:// address'); }
  return url;
}

/** A template's tasks: plain labels (one per line) or task objects. A named owner is any active practice member or the principal. */
export async function templateTasks(db: D1Database, body: Data) {
  if (!Array.isArray(body.tasks)) return null;
  insist(body.tasks.length > 0 && body.tasks.length <= 30, 'Tasks: list between 1 and 30 tasks');
  const tasks: Task[] = [];
  for (const [n, raw] of (body.tasks as Data[]).entries()) {
    insist(raw && typeof raw === 'object', 'Each task is an object');
    const name = `Task ${n + 1}`, label = text(raw.label, `${name} label`, 200);
    let role: string | null = null, person: string | null = null;
    if (typeof raw.assignee === 'string' && raw.assignee) {
      if (ROLES.includes(raw.assignee as never)) role = raw.assignee;
      else {
        person = email(raw.assignee, `${name} assignee`);
        insist(await eligible(db, person, ['preparer', 'reviewer']), `${name}: ${person} is not an active practice member`);
      }
    }
    const [startAnchor, startOffset] = relative(raw.startFrom, raw.startDays, `${name} start`);
    const [dueAnchor, dueOffset] = relative(raw.dueFrom, raw.dueDays, `${name} due`);
    const estimate = raw.estimateMinutes === undefined || raw.estimateMinutes === null || raw.estimateMinutes === '' ? null : integer(raw.estimateMinutes, `${name} estimate in minutes`, 1, 100_000);
    tasks.push({ label, assigneeRole: role, assigneeEmail: person, startAnchor, startOffset, dueAnchor, dueOffset, estimateMinutes: estimate,
      instructions: optional(raw.instructions, `${name} instructions`, 2000), sopUrl: sop(raw.sopUrl), requiresAttachment: raw.requiresAttachment === true, clientFacing: raw.clientFacing === true,
      ...taskFlow(raw, name) });
  }
  return tasks;
}

/** A template's checklist (plain steps or tasks), questions and requests, with dependencies checked (WORK-003). */
export async function templateWork(db: D1Database, body: Data): Promise<{ steps: (string | Task)[]; questions: Question[]; requests: string[] }> {
  const tasks = await templateTasks(db, body), questions = templateQuestions(body.questions), requests = lines(body.requests, 'Client document requests');
  if (tasks) await checkFlow(db, tasks, questions, requests.length);
  else insist(!questions.length, 'Questions need tasks that branch on them');
  return { steps: tasks ?? lines(body.steps, 'Checklist steps'), questions, requests };
}

/** One template entry as a job step insert. */
export function stepInsert(db: D1Database, jobId: string, entry: string | Task, n: number) {
  const t = typeof entry === 'string' ? plain(entry) : entry;
  const f = { ...noFlow, ...t };
  return stmt(db, `INSERT INTO b_job_steps(job_id,ordinal,label,assignee_role,assignee_email,start_anchor,start_offset,due_anchor,due_offset,estimate_minutes,instructions,sop_url,requires_attachment,client_facing,
      after_steps,after_requests,after_template,after_gate,when_question,when_values)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, jobId, n + 1, t.label, t.assigneeRole, t.assigneeEmail, t.startAnchor, t.startOffset, t.dueAnchor, t.dueOffset, t.estimateMinutes,
    t.instructions, t.sopUrl, t.requiresAttachment ? 1 : 0, t.clientFacing ? 1 : 0,
    JSON.stringify(f.after), JSON.stringify(f.afterDocuments), f.afterTemplate, f.afterGate, f.whenQuestion, f.whenValues ? JSON.stringify(f.whenValues) : null);
}

const DAY = 86_400_000;
const shift = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
const on = (j: Data, anchor: string | null, offset: number | null) => anchor ? shift(anchor === 'start' ? j.period_start : j.due_date, Number(offset)) : null;
/** The person in a job role now: the manager is the reviewer unless one is named. */
export function roleHolder(j: Data, role: string | null) {
  return role === 'preparer' ? j.preparer_email : role === 'reviewer' ? j.reviewer_email : role === 'manager' ? (j.manager_email || j.reviewer_email) : null;
}
/** Owner and dates: resolved now for an open task, as recorded for a completed one. */
export function resolveTask(j: Data, s: Data): Data {
  const done = !!s.done_at;
  return {
    ...s, owner: done ? s.done_owner : (s.assignee_email ?? roleHolder(j, s.assignee_role)),
    start_date: done ? s.done_start_date : on(j, s.start_anchor, s.start_offset), due_date: done ? s.done_due_date : on(j, s.due_anchor, s.due_offset),
  };
}

const columns = 'job_id,ordinal,label,done_by,done_at,assignee_role,assignee_email,start_anchor,start_offset,due_anchor,due_offset,estimate_minutes,instructions,sop_url,requires_attachment,client_facing,done_start_date,done_due_date,done_owner,attachment_name,attachment_size,attachment_sha256,'
  + 'after_steps,after_requests,after_template,after_gate,when_question,when_values,ready_at,exception_by,exception_at,exception_reason,exception_waived';
export async function jobTasks(db: D1Database, j: Data) {
  return (await rows(db, `SELECT ${columns} FROM b_job_steps WHERE job_id=? ORDER BY ordinal`, j.id)).map(s => resolveTask(j, s));
}

/** Statements that complete or reopen a step, with its attachment when one is required. */
export async function completion(db: D1Database, j: Data, step: Data, done: boolean, by: string, at: string, body: Data) {
  if (!done) return stmt(db, 'UPDATE b_job_steps SET done_by=NULL,done_at=NULL,done_owner=NULL,done_start_date=NULL,done_due_date=NULL WHERE job_id=? AND ordinal=?', j.id, step.ordinal);
  const t = resolveTask(j, step), file = body.attachment ? decodeFile(body.attachment) : null;
  insist(!step.requires_attachment || file, `Attach the required file to complete "${step.label}"`);
  return stmt(db, `UPDATE b_job_steps SET done_by=?,done_at=?,done_owner=?,done_start_date=?,done_due_date=?,
      attachment_name=COALESCE(?,attachment_name),attachment_mime=COALESCE(?,attachment_mime),attachment_size=COALESCE(?,attachment_size),attachment_sha256=COALESCE(?,attachment_sha256),attachment_base64=COALESCE(?,attachment_base64)
    WHERE job_id=? AND ordinal=?`, by, at, t.owner, t.start_date, t.due_date,
    file?.name ?? null, file?.mime ?? null, file?.bytes.length ?? null, file ? await digest(file.bytes) : null, file?.encoded ?? null, j.id, step.ordinal);
}

export async function downloadAttachment(db: D1Database, actor: Actor, jobId: string, ordinal: string) {
  const j = await readableJob(db, actor, jobId);
  const s = await stmt(db, 'SELECT attachment_name name,attachment_mime mime,attachment_base64 content_base64 FROM b_job_steps WHERE job_id=? AND ordinal=?', j.id, integer(ordinal, 'Step', 1, 100)).first<Data>();
  insist(s?.content_base64, 'This task has no attachment', 404);
  return fileResponse(s);
}

const ownerSql = `COALESCE(s.assignee_email,CASE s.assignee_role WHEN 'preparer' THEN j.preparer_email WHEN 'reviewer' THEN j.reviewer_email WHEN 'manager' THEN COALESCE(j.manager_email,j.reviewer_email) END)`;
/**
 * The person's weekly plan (Monday to Sunday): their open tasks due in or
 * before the week, or with no due date, and their open jobs (as preparer,
 * reviewer or manager) due in or before it.
 */
export async function weeklyPlan(db: D1Database, actor: Actor, query: Data) {
  const start = date(query.week, 'Week starting');
  insist(new Date(start + 'T00:00:00Z').getUTCDay() === 1, 'A plan week starts on a Monday');
  const end = shift(start, 6);
  const open = await rows(db, `SELECT j.*,c.name client_name,s.${columns.split(',').join(',s.')} FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id JOIN b_clients c ON c.id=j.client_id
    WHERE ${pendingStep('s')} AND j.status<>'signed_off' AND ${ownerSql}=?`, actor.email);
  const tasks = open.map((r): Data => ({ ...resolveTask(r, r), job_id: r.job_id, job: r.title, period: r.period_label, client: r.client_name }))
    .filter(t => !t.due_date || t.due_date <= end).sort((a, b) => String(a.due_date ?? '9').localeCompare(String(b.due_date ?? '9')) || a.ordinal - b.ordinal);
  const jobs = await rows(db, `SELECT j.id,j.title,j.period_label,j.due_date,j.status,c.name client_name FROM b_jobs j JOIN b_clients c ON c.id=j.client_id
    WHERE j.status<>'signed_off' AND j.due_date<=? AND ? IN (j.preparer_email,j.reviewer_email,COALESCE(j.manager_email,j.reviewer_email)) ORDER BY j.due_date`, end, actor.email);
  return { weekStart: start, weekEnd: end, tasks, jobs };
}

/** The client sees only the labels, dates and progress of client-facing tasks (PORTAL-003). */
export async function clientTasks(db: D1Database, j: Data) {
  return (await flowSteps(db, j)).filter(t => t.client_facing && t.state !== 'not_applicable').map(t => ({ label: t.label, dueDate: t.due_date, done: !!t.done_at }));
}
