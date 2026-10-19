// Work filters shared by the queue, boards and calendars (WORK-006, WORK-007):
// work type, stage, sub-status, client, assignee (the job's preparer,
// reviewer, manager or partner), due dates (an inclusive range, or overdue:
// due before today in UTC and not completed), blocked and priority. A job is
// blocked when it is open and every one of its remaining tasks waits on a
// WORK-003 dependency or answer, so nobody can work on it.
import { flowSteps } from './flow';
import { date, insist, now, optional, readableJobParams, readableJobSql, rows, type Actor, type Data } from './model';
import { STAGES, stageSql } from './statuses';

export const PRIORITIES = ['low', 'normal', 'high'] as const;
export const FILTER_KEYS = ['workType', 'stage', 'subStatus', 'client', 'assignee', 'dueFrom', 'dueTo', 'overdue', 'blocked', 'priority'] as const;
export type Filters = Record<(typeof FILTER_KEYS)[number], string>;

const flag = (v: unknown) => v === true || v === 'true' || v === '1' ? '1' : '';

/** Checked filters; every key is present, empty when unused. */
export function parseFilters(q: Data): Filters {
  const f: Filters = {
    workType: optional(q.workType, 'Work type', 100), stage: optional(q.stage, 'Stage', 20), subStatus: optional(q.subStatus, 'Sub-status', 100),
    client: optional(q.client, 'Client', 100), assignee: optional(q.assignee, 'Assignee', 254).toLowerCase(),
    dueFrom: q.dueFrom ? date(q.dueFrom, 'Due from') : '', dueTo: q.dueTo ? date(q.dueTo, 'Due to') : '',
    overdue: flag(q.overdue), blocked: optional(q.blocked, 'Blocked', 3), priority: optional(q.priority, 'Priority', 10),
  };
  insist(!f.stage || STAGES.includes(f.stage as never), 'Choose a stage');
  insist(!f.blocked || f.blocked === 'yes' || f.blocked === 'no', 'Blocked: choose yes or no');
  insist(!f.priority || PRIORITIES.includes(f.priority as never), 'Priority: choose low, normal or high');
  insist(!f.dueFrom || !f.dueTo || f.dueFrom <= f.dueTo, 'Due from must be on or before due to');
  return f;
}
export const hasFilters = (q: Data) => FILTER_KEYS.some(k => k in q) || 'groupBy' in q;

/** Whether an open job can be worked: blocked when it has remaining tasks and none of them is ready. */
async function blockedState(db: D1Database, j: Data) {
  const open = (await flowSteps(db, j)).filter(s => s.state === 'ready' || s.state === 'blocked');
  const blocked = open.length > 0 && open.every(s => s.state === 'blocked');
  return { blocked, blockers: blocked ? [...new Set(open.flatMap(s => s.blockers as string[]))] : [] };
}

/** The jobs this person may read that match the filters, by due date, each with its stage, sub-status, overdue and blocked state. */
export async function listJobs(db: D1Database, actor: Actor, f: Filters) {
  const today = now().slice(0, 10), where: string[] = [], params: unknown[] = [];
  const add = (sql: string, ...values: unknown[]) => { where.push(sql); params.push(...values); };
  if (f.workType) add('b_jobs.work_type_id=?', f.workType);
  if (f.stage) add(`${stageSql('b_jobs')}=?`, f.stage);
  if (f.subStatus) add('b_jobs.sub_status_id=?', f.subStatus);
  if (f.client) add('b_jobs.client_id=?', f.client);
  if (f.assignee) add('? IN (b_jobs.preparer_email,b_jobs.reviewer_email,COALESCE(b_jobs.manager_email,b_jobs.reviewer_email),b_jobs.partner_email)', f.assignee);
  if (f.dueFrom) add('b_jobs.due_date>=?', f.dueFrom);
  if (f.dueTo) add('b_jobs.due_date<=?', f.dueTo);
  if (f.overdue) add("b_jobs.due_date<? AND b_jobs.status<>'signed_off'", today);
  if (f.priority) add('b_jobs.priority=?', f.priority);
  const jobs = await rows(db, `SELECT b_jobs.id,b_jobs.client_id,b_jobs.template_id,b_jobs.title,b_jobs.period_label,b_jobs.period_start,b_jobs.due_date,b_jobs.status,b_jobs.preparer_email,b_jobs.reviewer_email,b_jobs.manager_email,
      b_jobs.partner_email,b_jobs.reviewed_at,b_jobs.priority,b_jobs.revision,${stageSql('b_jobs')} stage,b_jobs.sub_status_id,
      CASE WHEN b_jobs.status='review' AND b_jobs.reviewed_at IS NOT NULL THEN 'partner sign-off' ELSE s.name END sub_status,b_jobs.work_type_id,w.name work_type,w.color,c.name client_name,
      EXISTS(SELECT 1 FROM b_job_steps g WHERE g.job_id=b_jobs.id AND g.done_at IS NULL AND (g.after_steps<>'[]' OR g.after_requests<>'[]' OR g.after_template IS NOT NULL OR g.when_question IS NOT NULL)) gated
    FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id LEFT JOIN b_work_types w ON w.id=b_jobs.work_type_id LEFT JOIN b_sub_statuses s ON s.id=b_jobs.sub_status_id
    WHERE ${readableJobSql}${where.map(w => ` AND ${w}`).join('')}
    ORDER BY b_jobs.due_date,c.name`, ...readableJobParams(actor), ...params);
  const listed: Data[] = [];
  for (const { gated, ...j } of jobs) {
    // Only a task with a dependency or condition can wait, so only those jobs are worked out.
    const state = j.status === 'open' && gated ? await blockedState(db, j) : { blocked: false, blockers: [] };
    if (f.blocked === 'yes' && !state.blocked || f.blocked === 'no' && state.blocked) continue;
    listed.push({ ...j, ...state, overdue: j.status !== 'signed_off' && j.due_date < today });
  }
  return listed;
}
