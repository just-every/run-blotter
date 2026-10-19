// Personal plans, boards and calendars (WORK-006). A person's week lists their
// open tasks and jobs (WORK-009) and the ones they placed on its days. Boards
// put the filtered jobs in columns by stage, or by a work type's sub-statuses;
// a card moves only through WORK-007's moves. Calendars place jobs and open
// tasks on their due dates, for the firm or one client; moving a job's due date
// previews the task dates it shifts and the capacity it changes (CAPACITY-001)
// before the WORK-004 reschedule commits it. Each person's last board and
// calendar filters are kept for them.
import { capacity } from './capacity';
import { hasFilters, listJobs, parseFilters, PRIORITIES, type Filters } from './filters';
import { pendingStep } from './flow';
import { previewReassign } from './bulk';
import { atomic, audit, date, email, human, id, insist, integer, now, readableJob, rows, stmt, text, type Actor, type Data } from './model';
import { PARTNER_SIGN_OFF, STAGE_LABELS, STAGES } from './statuses';
import { columns, jobTasks, ownerSql, resolveTask } from './tasks';

const DAY = 86_400_000;
const shift = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
const monday = (day: string) => shift(day, -((new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7));
const SURFACES = ['board', 'calendar'];

/** The filters a request names, else the person's last ones for this surface. */
async function filtersFor(db: D1Database, actor: Actor, surface: string, query: Data) {
  if (hasFilters(query)) return query;
  const saved = await stmt(db, 'SELECT filters FROM b_view_filters WHERE owner_email=? AND surface=?', actor.email, surface).first<Data>();
  return saved ? JSON.parse(saved.filters) as Data : {};
}

/** Keep the person's current board or calendar filters, so a refresh shows the same view. */
export async function saveFilters(db: D1Database, actor: Actor, surface: string, body: Data) {
  human(actor);
  insist(SURFACES.includes(surface), 'Not found', 404);
  const filters: Data = parseFilters(body);
  if (surface === 'board') filters.groupBy = body.groupBy === 'sub_status' ? 'sub_status' : 'stage';
  await atomic(db, actor, [stmt(db, `INSERT INTO b_view_filters(owner_email,surface,filters,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(owner_email,surface) DO UPDATE SET filters=excluded.filters,updated_at=excluded.updated_at`, actor.email, surface, JSON.stringify(filters), now())]);
  return filters;
}

/** A board: one column per stage, or for one work type a column per stage and each sub-status it may use. */
export async function board(db: D1Database, actor: Actor, query: Data) {
  const raw = await filtersFor(db, actor, 'board', query), f = parseFilters(raw);
  const groupBy = raw.groupBy === 'sub_status' ? 'sub_status' : 'stage';
  insist(groupBy === 'stage' || f.workType, 'Choose a work type to group its board by sub-status');
  const jobs = await listJobs(db, actor, f);
  const key = (j: Data) => j.status === 'review' && j.reviewed_at ? PARTNER_SIGN_OFF : j.sub_status_id ?? '';
  const columns: Data[] = [];
  for (const stage of STAGES) {
    const inStage = jobs.filter(j => j.stage === stage);
    if (groupBy === 'stage') { columns.push({ key: stage, stage, subStatusId: null, label: STAGE_LABELS[stage], jobs: inStage }); continue; }
    const subs = await rows(db, "SELECT id,name,work_types FROM b_sub_statuses WHERE stage=? AND deleted_at IS NULL AND (work_types='[]' OR EXISTS(SELECT 1 FROM json_each(work_types) WHERE value=?)) ORDER BY created_at", stage, f.workType);
    columns.push({ key: stage, stage, subStatusId: null, label: STAGE_LABELS[stage], jobs: inStage.filter(j => !key(j)) });
    for (const s of subs) columns.push({ key: `${stage}|${s.id}`, stage, subStatusId: s.id, label: `${STAGE_LABELS[stage]} – ${s.name}`, jobs: inStage.filter(j => key(j) === s.id) });
    if (stage === 'in_review' && inStage.some(j => key(j) === PARTNER_SIGN_OFF)) columns.push({ key: `${stage}|${PARTNER_SIGN_OFF}`, stage, subStatusId: PARTNER_SIGN_OFF, label: 'In review – partner sign-off', jobs: inStage.filter(j => key(j) === PARTNER_SIGN_OFF) });
  }
  return { filters: { ...f, groupBy }, groupBy, columns };
}

/** Open tasks of the listed jobs, each with its owner and due date now. */
async function openTasks(db: D1Database, jobs: Data[]) {
  if (!jobs.length) return [];
  const steps = await rows(db, `SELECT s.${columns.split(',').join(',s.')} FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id
    WHERE ${pendingStep('s')} AND j.id IN (SELECT value FROM json_each(?)) ORDER BY s.job_id,s.ordinal`, JSON.stringify(jobs.map(j => j.id)));
  const byId = new Map(jobs.map(j => [j.id, j]));
  return steps.map((s): Data => { const j = byId.get(s.job_id)!; return { ...resolveTask(j, s), client: j.client_name, job: j.title, period: j.period_label, stage: j.stage, sub_status: j.sub_status }; });
}

/** A firm calendar (or one client's, with the client filter): jobs and open tasks on their due dates, from `from` to `to` inclusive (at most 62 days). */
export async function calendar(db: D1Database, actor: Actor, query: Data) {
  const f: Filters = parseFilters(await filtersFor(db, actor, 'calendar', Object.fromEntries(Object.entries(query).filter(([k]) => k !== 'from' && k !== 'to'))));
  const from = date(query.from, 'From'), to = date(query.to, 'To');
  insist(to >= from && Date.parse(to) - Date.parse(from) <= 61 * DAY, 'Show at most 62 days, To on or after From');
  const lo = f.dueFrom > from ? f.dueFrom : from, hi = f.dueTo && f.dueTo < to ? f.dueTo : to;
  const jobs = await listJobs(db, actor, { ...f, dueFrom: '', dueTo: '' });
  const tasks = (await openTasks(db, jobs.filter(j => j.status !== 'signed_off'))).filter(t => t.due_date && t.due_date >= lo && t.due_date <= hi);
  const due = jobs.filter(j => j.due_date >= lo && j.due_date <= hi), days: Data[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) {
    const entry = { date: d, jobs: due.filter(j => j.due_date === d), tasks: tasks.filter(t => t.due_date === d) };
    if (entry.jobs.length || entry.tasks.length) days.push(entry);
  }
  return { from, to, filters: f, days };
}

/**
 * What moving a job's due date changes, beside the WORK-004 reschedule preview
 * whose fingerprint commits it: the job's own date, each open task whose date
 * follows it, anything that would land before today (UTC), and each person's
 * capacity demand in every week the job's estimated work leaves or enters.
 */
export async function previewDueMove(db: D1Database, actor: Actor, body: Data) {
  const jobId = text(body.jobId, 'Job'), dueDate = date(body.dueDate, 'New due date');
  const plan = await previewReassign(db, actor, { jobIds: [jobId], dueDate, dueNote: body.dueNote });
  const j = await readableJob(db, actor, jobId), today = now().slice(0, 10);
  const [before, after] = await Promise.all([jobTasks(db, j), jobTasks(db, { ...j, due_date: dueDate })]);
  const open = before.map((t, n) => ({ t, moved: after[n] })).filter(({ t }) => !t.done_at);
  const tasks = open.filter(({ t, moved }) => t.due_date !== moved.due_date || (moved.due_date && moved.due_date < today))
    .map(({ t, moved }) => ({ ordinal: t.ordinal, label: t.label, owner: t.owner, from: t.due_date, to: moved.due_date, pastDue: !!moved.due_date && moved.due_date < today }));
  const warnings = [...(dueDate < today ? [`The new due date ${dueDate} is already past`] : []),
    ...tasks.filter(t => t.pastDue).map(t => `“${t.label}” would be due ${t.to}, already past`)];
  // The job's estimated work by person and week, before and after: open tasks with an estimate, and the review estimate on the job's due date.
  const pending = new Set((await rows(db, `SELECT s.ordinal FROM b_job_steps s WHERE s.job_id=? AND ${pendingStep('s')}`, j.id)).map(s => s.ordinal));
  const load = (list: Data[], due: string) => {
    const lines = list.filter(t => pending.has(t.ordinal) && t.estimate_minutes && t.owner).map(t => ({ who: t.owner as string, week: monday(t.due_date ?? due), minutes: Number(t.estimate_minutes) }));
    if (j.review_estimate_minutes) lines.push({ who: j.reviewer_email, week: monday(due), minutes: Number(j.review_estimate_minutes) });
    const totals = new Map<string, number>();
    for (const l of lines) totals.set(`${l.week}|${l.who}`, (totals.get(`${l.week}|${l.who}`) ?? 0) + l.minutes);
    return totals;
  };
  const was = load(before, j.due_date), will = load(after, dueDate), changed = [...new Set([...was.keys(), ...will.keys()])].filter(k => was.get(k) !== will.get(k)).sort();
  const weeks = new Map<string, Data>();
  for (const week of new Set(changed.map(k => k.split('|')[0]))) weeks.set(week, await capacity(db, actor, { week }));
  const people = changed.map(k => {
    const [week, who] = k.split('|'), p = (weeks.get(week)!.people as Data[]).find(x => x.email === who);
    const demandBefore = Number(p?.demandMinutes ?? 0), demandAfter = demandBefore - (was.get(k) ?? 0) + (will.get(k) ?? 0), available = Number(p?.availableMinutes ?? 0);
    return { week, email: who, name: p?.name ?? who, availableMinutes: available, demandBefore, demandAfter, overloadedBefore: demandBefore > available, overloadedAfter: demandAfter > available };
  });
  for (const p of people.filter(p => p.overloadedAfter && !p.overloadedBefore)) warnings.push(`${p.name} would be over capacity in the week of ${p.week}`);
  return { ...plan, consequences: { job: { from: j.due_date, to: dueDate }, tasks, capacity: people, warnings } };
}

/** The job's people set its priority while it is not completed. */
export async function setPriority(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await readableJob(db, actor, jobId);
  insist(j.access === 'full', 'Only the job’s people can change its priority', 403);
  insist(j.status !== 'signed_off', 'This job is signed off', 409);
  insist(PRIORITIES.includes(body.priority), 'Priority: choose low, normal or high');
  await atomic(db, actor, [stmt(db, "UPDATE b_jobs SET priority=? WHERE id=? AND status<>'signed_off'", body.priority, j.id), audit(db, actor, 'job.priority', j.id, `${j.priority} → ${body.priority}`)]);
  return { priority: body.priority };
}

/** Whose plan: the person's own; the principal may open or plan anyone's. */
function planOwner(actor: Actor, value: unknown) {
  const who = value ? email(value, 'Person') : actor.email;
  insist(who === actor.email || actor.role === 'owner', 'Only the principal plans someone else’s week', 403);
  return who;
}

/**
 * A person's week (Monday to Sunday): the jobs and tasks they placed on each
 * day, their open tasks due in or before the week or with no due date, and
 * their open jobs (preparer, reviewer, manager or partner) due in or before it.
 */
export async function personalPlan(db: D1Database, actor: Actor, query: Data) {
  const start = date(query.week, 'Week starting');
  insist(new Date(start + 'T00:00:00Z').getUTCDay() === 1, 'A plan week starts on a Monday');
  const end = shift(start, 6), who = planOwner(actor, query.email), today = now().slice(0, 10);
  // Everything the person can read (the principal reads all), and of it the jobs they hold a role on.
  const readable = await listJobs(db, who === actor.email ? actor : { ...actor, role: 'owner' }, parseFilters({}));
  const mine = readable.filter(j => [j.preparer_email, j.reviewer_email, j.manager_email || j.reviewer_email, j.partner_email].includes(who));
  const open = mine.filter(j => j.status !== 'signed_off'), jobs = open.filter(j => j.due_date <= end);
  const steps = await rows(db, `SELECT j.*,c.name client_name,s.${columns.split(',').join(',s.')} FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id JOIN b_clients c ON c.id=j.client_id
    WHERE ${pendingStep('s')} AND j.status<>'signed_off' AND ${ownerSql}=?`, who);
  const tasks = steps.map((r): Data => ({ ...resolveTask(r, r), job_id: r.job_id, job: r.title, period: r.period_label, client: r.client_name }))
    .filter(t => !t.due_date || t.due_date <= end).sort((a, b) => String(a.due_date ?? '9').localeCompare(String(b.due_date ?? '9')) || a.ordinal - b.ordinal);
  const items = await rows(db, `SELECT p.id,p.day,p.job_id,p.ordinal,(SELECT label FROM b_job_steps WHERE job_id=p.job_id AND ordinal=p.ordinal) task FROM b_plan_items p
    WHERE p.owner_email=? AND p.day BETWEEN ? AND ? ORDER BY p.day,p.created_at`, who, start, end);
  const known = new Map(readable.map(j => [j.id, j]));
  const days = [0, 1, 2, 3, 4, 5, 6].map(n => shift(start, n)).map(d => ({ date: d, items: items.filter(i => i.day === d).map(i => ({ ...i, job: known.get(i.job_id) ?? null })) }));
  return { email: who, weekStart: start, weekEnd: end, today, days, tasks, jobs: jobs.map(j => ({ ...j, planned: items.filter(i => i.job_id === j.id && !i.ordinal).map(i => i.day) })) };
}

/** Place one of the person's open jobs (or one of their open tasks) on a day. */
export async function planItem(db: D1Database, actor: Actor, body: Data) {
  human(actor);
  const who = planOwner(actor, body.email), day = date(body.day, 'Day');
  const j = await stmt(db, 'SELECT * FROM b_jobs WHERE id=?', text(body.jobId, 'Job')).first<Data>();
  insist(j, 'Job not found', 404);
  insist(j.status !== 'signed_off', 'Completed work is not planned', 409);
  const ordinal = body.ordinal === undefined || body.ordinal === null || body.ordinal === '' ? 0 : integer(body.ordinal, 'Task', 1, 100);
  if (ordinal) {
    const s = await stmt(db, `SELECT s.* FROM b_job_steps s WHERE s.job_id=? AND s.ordinal=? AND ${pendingStep('s')}`, j.id, ordinal).first<Data>();
    insist(s && resolveTask(j, s).owner === who, `That is not an open task of ${who}`, 409);
  } else insist([j.preparer_email, j.reviewer_email, j.manager_email || j.reviewer_email, j.partner_email].includes(who), `${who} is not one of this job’s people`, 409);
  insist(!await stmt(db, 'SELECT 1 FROM b_plan_items WHERE owner_email=? AND day=? AND job_id=? AND ordinal=?', who, day, j.id, ordinal).first(), 'Already planned for that day', 409);
  const itemId = id();
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_plan_items(id,owner_email,day,job_id,ordinal,created_by,created_at) VALUES(?,?,?,?,?,?,?)', itemId, who, day, j.id, ordinal, actor.email, now())]);
  return { id: itemId, email: who, day, jobId: j.id, ordinal };
}

export async function unplanItem(db: D1Database, actor: Actor, itemId: string) {
  human(actor);
  const item = await stmt(db, 'SELECT * FROM b_plan_items WHERE id=?', itemId).first<Data>();
  insist(item && (item.owner_email === actor.email || actor.role === 'owner'), 'Not found', 404);
  await atomic(db, actor, [stmt(db, 'DELETE FROM b_plan_items WHERE id=?', itemId)]);
  return { ok: true };
}
