import { tr, type Key, type Language } from '../i18n/catalog';
// Firm work types and the status model (WORK-007). Every job has one work type
// (its template's own, or one the firm chose) and one of six stages: Planned,
// Ready to start, In progress and Waiting are set by the job's people while it
// is open; In review and Completed follow its status, so only submission and
// sign-off (with their gates) reach them. Firm sub-statuses sit under one stage
// and can be limited to work types. Every change records who, when and the old
// and new stage and sub-status; renaming a sub-status keeps that history, and
// a sub-status jobs still use is deleted only by a previewed move of those jobs.
import { atomic, audit, digest, guard, human, id, insist, integer, need, now, optional, readableJob, readableJobParams, readableJobSql, rows, stmt, text, type Actor, type Data } from './model';
import { listJobs, parseFilters } from './filters';

export const STAGES = ['planned', 'ready', 'in_progress', 'waiting', 'in_review', 'completed'] as const;
export const STAGE_LABELS: Record<string, string> = { planned: 'Planned', ready: 'Ready to start', in_progress: 'In progress', waiting: 'Waiting', in_review: 'In review', completed: 'Completed' };
const OPEN_STAGES = ['planned', 'ready', 'in_progress', 'waiting'];
/** A job row's stage in SQL. */
export const stageSql = (j: string) => `CASE ${j}.status WHEN 'review' THEN 'in_review' WHEN 'signed_off' THEN 'completed' ELSE COALESCE(${j}.open_stage,'in_progress') END`;
/** The built-in step after a reviewer's sign-off on work that needs a partner (WORK-007 job roles); recorded in history under this key. */
export const PARTNER_SIGN_OFF = 'partner_sign_off';
export const subOf = (j: Data) => j.status === 'review' && j.reviewed_at ? PARTNER_SIGN_OFF : j.sub_status_id ?? null;
const subName = (alias: string, key: string) => `COALESCE(${alias}.name,CASE WHEN ${key}='${PARTNER_SIGN_OFF}' THEN 'partner sign-off' END)`;
export const stageOf = (j: Data) => j.status === 'review' ? 'in_review' : j.status === 'signed_off' ? 'completed' : (j.open_stage ?? 'in_progress');

/** A history row for a stage or sub-status change (written in the same batch as the change). */
export function historyRow(db: D1Database, jobId: string, from: { stage: string | null; sub: string | null }, to: { stage: string; sub: string | null }, by: string, at = now()) {
  return stmt(db, 'INSERT INTO b_job_status_history(id,job_id,from_stage,from_sub_status_id,to_stage,to_sub_status_id,by,at) VALUES(?,?,?,?,?,?,?,?)', id(), jobId, from.stage, from.sub, to.stage, to.sub, by, at);
}
/** The history row for a status change made by an UPDATE that may not apply: written only when the job reached `toStatus` at `at`. */
export function historyWhen(db: D1Database, j: Data, to: string, by: string, at: string, column: 'submitted_at' | 'signed_off_at') {
  return stmt(db, `INSERT INTO b_job_status_history(id,job_id,from_stage,from_sub_status_id,to_stage,to_sub_status_id,by,at)
    SELECT ?,?,?,?,?,NULL,?,? WHERE EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND ${column}=?)`, id(), j.id, stageOf(j), j.sub_status_id ?? null, to, by, at, j.id, at);
}

const color = (value: unknown) => { const c = (optional(value, 'Color', 7) || '#64748b').toLowerCase(); insist(/^#[0-9a-f]{6}$/.test(c), 'Color: use #rrggbb'); return c; };

/** The firm's work types and sub-statuses, with how many jobs use each. */
export async function statusModel(db: D1Database) {
  const [types, subs] = await Promise.all([
    rows(db, `SELECT w.*,t.name template,(SELECT COUNT(*) FROM b_jobs j WHERE j.work_type_id=w.id) jobs FROM b_work_types w LEFT JOIN b_templates t ON t.id=w.template_id ORDER BY w.name`),
    rows(db, `SELECT s.*,(SELECT COUNT(*) FROM b_jobs j WHERE j.sub_status_id=s.id) jobs FROM b_sub_statuses s WHERE s.deleted_at IS NULL ORDER BY s.created_at`),
  ]);
  return { stages: STAGES.map(key => ({ key, label: STAGE_LABELS[key] })), workTypes: types.map(t => ({ ...t, roles: JSON.parse(t.roles) })), subStatuses: subs.map(s => ({ ...s, work_types: JSON.parse(s.work_types) })) };
}

/** The principal defines a work type: default template, default budget and color. */
export async function saveWorkType(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const name = text(body.name, 'Work type', 120), templateId = optional(body.templateId, 'Default template', 100) || null;
  if (templateId) insist(await stmt(db, 'SELECT 1 FROM b_templates WHERE id=?', templateId).first(), 'Template not found', 404);
  insist(!await stmt(db, 'SELECT 1 FROM b_work_types WHERE lower(name)=lower(?)', name).first(), `${name} already exists`, 409);
  const budget = body.budgetMinutes === undefined || body.budgetMinutes === '' ? null : integer(body.budgetMinutes, 'Default budget in minutes', 1, 100_000);
  insist(body.roles === undefined || (Array.isArray(body.roles) && body.roles.every((r: unknown) => r === 'manager' || r === 'partner')), 'Roles: choose from manager and partner (preparer and reviewer are always needed)');
  const roles = [...new Set((body.roles ?? []) as string[])], typeId = id();
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_work_types(id,name,template_id,budget_minutes,color,roles,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)', typeId, name, templateId, budget, color(body.color), JSON.stringify(roles), actor.email, now()),
    audit(db, actor, 'work_type.saved', typeId, name)]);
  return { id: typeId, name, roles };
}

async function permittedTypes(db: D1Database, value: unknown) {
  insist(value === undefined || Array.isArray(value), 'Work types: list them');
  const ids = [...new Set((value ?? []) as string[])];
  for (const t of ids) insist(await stmt(db, 'SELECT 1 FROM b_work_types WHERE id=?', String(t)).first(), 'Work type not found', 404);
  return ids;
}
const allows = (sub: Data, workTypeId: string) => { const types = typeof sub.work_types === 'string' ? JSON.parse(sub.work_types) : sub.work_types; return !types.length || types.includes(workTypeId); };

/** The principal adds a sub-status under one stage, optionally limited to work types. */
export async function addSubStatus(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  insist(STAGES.includes(body.stage), 'Choose a stage');
  const name = text(body.name, 'Sub-status', 80), types = await permittedTypes(db, body.workTypeIds), subId = id(), clientLabel = optional(body.clientLabel, 'Client label', 80) || null;
  insist(!await stmt(db, 'SELECT 1 FROM b_sub_statuses WHERE stage=? AND lower(name)=lower(?) AND deleted_at IS NULL', body.stage, name).first(), `${STAGE_LABELS[body.stage]} – ${name} already exists`, 409);
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_sub_statuses(id,stage,name,work_types,client_label,created_by,created_at) VALUES(?,?,?,?,?,?,?)', subId, body.stage, name, JSON.stringify(types), clientLabel, actor.email, now()),
    audit(db, actor, 'sub_status.added', subId, `${STAGE_LABELS[body.stage]} – ${name}`)]);
  return { id: subId, stage: body.stage, name, work_types: types, client_label: clientLabel };
}

/** Rename a sub-status or change its work types; history keeps pointing at it. A job may not lose its permission. */
export async function editSubStatus(db: D1Database, actor: Actor, subId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const sub = await stmt(db, 'SELECT * FROM b_sub_statuses WHERE id=? AND deleted_at IS NULL', subId).first<Data>();
  insist(sub, 'Sub-status not found', 404);
  const clientLabel = body.clientLabel === undefined ? sub.client_label : optional(body.clientLabel, 'Client label', 80) || null;
  const name = body.name === undefined ? sub.name : text(body.name, 'Sub-status', 80), types = body.workTypeIds === undefined ? JSON.parse(sub.work_types) : await permittedTypes(db, body.workTypeIds);
  const stranded = (await rows(db, 'SELECT work_type_id FROM b_jobs WHERE sub_status_id=?', subId)).filter(j => !allows({ work_types: types }, j.work_type_id)).length;
  insist(!stranded, `${stranded} jobs of other work types use this sub-status; move them first`, 409);
  await atomic(db, actor, [stmt(db, 'UPDATE b_sub_statuses SET name=?,work_types=?,client_label=? WHERE id=?', name, JSON.stringify(types), clientLabel, subId),
    audit(db, actor, 'sub_status.edited', subId, `${STAGE_LABELS[sub.stage]} – ${sub.name} is now ${name}`)]);
  return { id: subId, name, work_types: types, client_label: clientLabel };
}

/** Choose a stage (and sub-status) for a job; sub-statuses must belong to the stage and allow the job's work type. */
async function target(db: D1Database, j: Data, stage: unknown, subId: unknown) {
  insist(STAGES.includes(stage as never), 'Choose a stage');
  const sub = subId ? await stmt(db, 'SELECT * FROM b_sub_statuses WHERE id=? AND deleted_at IS NULL', String(subId)).first<Data>() : null;
  if (subId) {
    insist(sub && sub.stage === stage, 'That sub-status is not under this stage', 400);
    insist(allows(sub, j.work_type_id), `${STAGE_LABELS[sub.stage]} – ${sub.name} is not offered for this work type`, 409);
  }
  return { stage: stage as string, sub: sub?.id ?? null };
}

/** The job's people move it between open stages and sub-statuses; In review and Completed go through submission and sign-off. */
export async function moveJob(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await readableJob(db, actor, jobId);
  insist(j.access === 'full', 'Only the job’s people can change its status', 403);
  insist(body.revision === undefined || body.revision === j.revision, 'The job changed. Refresh and try again.', 409);
  const from = { stage: stageOf(j), sub: subOf(j) };
  insist(from.sub !== PARTNER_SIGN_OFF, 'This job waits for its partner’s sign-off', 409);
  if (body.stage === 'in_review' || body.stage === 'completed') {
    insist(from.stage === body.stage, body.stage === 'in_review' ? 'Submit the job for review: every step done and document accepted' : 'Only the reviewer’s sign-off completes a job', 409);
  } else insist(j.status === 'open', 'A job in review or completed moves only by review', 409);
  const to = await target(db, j, body.stage, body.subStatusId);
  insist(to.stage !== from.stage || to.sub !== from.sub, 'The job is already there', 409);
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?)', j.id, j.revision);
  await atomic(db, actor, [check,
    stmt(db, 'UPDATE b_jobs SET open_stage=CASE WHEN status=\'open\' THEN ? ELSE open_stage END,sub_status_id=?,revision=? WHERE id=?', OPEN_STAGES.includes(to.stage) ? to.stage : j.open_stage, to.sub, id(), j.id),
    release, historyRow(db, j.id, from, to, actor.email), audit(db, actor, 'job.status', j.id, `${await label(db, from)} → ${await label(db, to)}`)]);
  return { stage: to.stage, subStatusId: to.sub };
}

async function label(db: D1Database, s: { stage: string | null; sub: string | null }) {
  if (!s.stage) return 'new';
  const sub = s.sub ? await stmt(db, 'SELECT name FROM b_sub_statuses WHERE id=?', s.sub).first<Data>() : null;
  return STAGE_LABELS[s.stage] + (sub ? ` – ${sub.name}` : '');
}

/** Moving the jobs off a sub-status before deleting it: the plan and its fingerprint. */
async function deletionPlan(db: D1Database, actor: Actor, subId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const sub = await stmt(db, 'SELECT * FROM b_sub_statuses WHERE id=? AND deleted_at IS NULL', subId).first<Data>();
  insist(sub, 'Sub-status not found', 404);
  const jobs = await rows(db, 'SELECT id,title,period_label,status,open_stage,sub_status_id,work_type_id,revision FROM b_jobs WHERE sub_status_id=? ORDER BY due_date,id', subId);
  let to: { stage: string; sub: string | null } | null = null;
  const problems: string[] = [];
  if (jobs.length) {
    insist(body.toSubStatusId !== subId, 'Move the jobs to another status');
    to = await target(db, { work_type_id: null }, body.toStage ?? sub.stage, null);
    const into = body.toSubStatusId ? await stmt(db, 'SELECT * FROM b_sub_statuses WHERE id=? AND deleted_at IS NULL', String(body.toSubStatusId)).first<Data>() : null;
    if (body.toSubStatusId) { insist(into && into.stage === to.stage, 'That sub-status is not under this stage'); to.sub = into.id; }
    insist([sub.stage].includes(to.stage) || (OPEN_STAGES.includes(sub.stage) && OPEN_STAGES.includes(to.stage)), 'Jobs move only to an open stage, or within In review or Completed', 409);
    for (const j of jobs) if (into && !allows(into, j.work_type_id)) problems.push(`${j.title} ${j.period_label}: ${into.name} is not offered for its work type`);
  }
  const plan = { sub: { id: sub.id, stage: sub.stage, name: sub.name }, to, jobs: jobs.map(j => ({ id: j.id, title: j.title, period: j.period_label, revision: j.revision })), problems };
  return { ...plan, fingerprint: await digest(JSON.stringify(plan)), rows: jobs };
}

export async function previewSubStatusDeletion(db: D1Database, actor: Actor, subId: string, body: Data) {
  const { rows: _, ...plan } = await deletionPlan(db, actor, subId, body);
  return plan;
}

/** Delete a sub-status: refused while jobs use it, unless the previewed move goes with it in one batch. History keeps its name. */
export async function deleteSubStatus(db: D1Database, actor: Actor, subId: string, body: Data) {
  const p = await deletionPlan(db, actor, subId, body);
  insist(p.jobs.length === 0 || body.fingerprint === p.fingerprint, p.jobs.length ? `${p.jobs.length} jobs use this sub-status. Preview moving them, then delete.` : 'Preview first', 409);
  insist(!p.problems.length, `Resolve first: ${p.problems.join('; ')}`, 409);
  const at = now(), statements: D1PreparedStatement[] = [];
  for (const j of p.rows) {
    const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND sub_status_id=?)', j.id, j.revision, subId);
    statements.push(check, stmt(db, "UPDATE b_jobs SET open_stage=CASE WHEN status='open' THEN ? ELSE open_stage END,sub_status_id=?,revision=? WHERE id=?", p.to!.stage, p.to!.sub, id(), j.id), release,
      historyRow(db, j.id, { stage: stageOf(j), sub: subId }, p.to!, actor.email, at));
  }
  statements.push(stmt(db, 'UPDATE b_sub_statuses SET deleted_by=?,deleted_at=? WHERE id=?', actor.email, at, subId),
    audit(db, actor, 'sub_status.deleted', subId, `${STAGE_LABELS[p.sub.stage]} – ${p.sub.name}; ${p.jobs.length} jobs moved`));
  await atomic(db, actor, statements);
  return { deleted: subId, moved: p.jobs.length };
}

/** A job's status history, oldest first, with sub-status names as they are now (renames keep history). */
export async function statusHistory(db: D1Database, actor: Actor, jobId: string) {
  const j = await readableJob(db, actor, jobId);
  return rows(db, `SELECT h.*,${subName('f', 'h.from_sub_status_id')} from_sub_status,${subName('t', 'h.to_sub_status_id')} to_sub_status FROM b_job_status_history h LEFT JOIN b_sub_statuses f ON f.id=h.from_sub_status_id
    LEFT JOIN b_sub_statuses t ON t.id=h.to_sub_status_id WHERE h.job_id=? ORDER BY h.at,h.id`, j.id);
}

/** The queue over the jobs this person may read, filtered (WORK-006/007) or by one of their saved views. */
export async function queue(db: D1Database, actor: Actor, query: Data) {
  const view = query.view ? await stmt(db, 'SELECT filters FROM b_saved_views WHERE id=? AND owner_email=?', String(query.view), actor.email).first<Data>() : null;
  if (query.view) insist(view, 'Saved view not found', 404);
  return listJobs(db, actor, parseFilters(view ? JSON.parse(view.filters) : query));
}

/**
 * Time in each status: from each history entry to the next (or now), over the
 * jobs this person may read, with how many jobs are in it now. Minutes are
 * whole minutes, rounded down.
 */
export async function statusReport(db: D1Database, actor: Actor, query: Data) {
  const type = optional(query.workType, 'Work type', 100), at = now();
  const history = await rows(db, `SELECT h.job_id,h.to_stage,h.to_sub_status_id,h.at,${subName('s', 'h.to_sub_status_id')} sub FROM b_job_status_history h JOIN b_jobs ON b_jobs.id=h.job_id LEFT JOIN b_sub_statuses s ON s.id=h.to_sub_status_id
    WHERE ${readableJobSql} AND (?='' OR b_jobs.work_type_id=?) ORDER BY h.job_id,h.at,h.id`, ...readableJobParams(actor), type, type);
  const report = new Map<string, Data>();
  history.forEach((h, n) => {
    const next = history[n + 1]?.job_id === h.job_id ? history[n + 1] : null, key = `${h.to_stage}|${h.to_sub_status_id ?? ''}`;
    const r = report.get(key) ?? { stage: h.to_stage, label: STAGE_LABELS[h.to_stage], subStatusId: h.to_sub_status_id, subStatus: h.sub, entries: 0, now: 0, minutes: 0 };
    r.entries += 1; if (!next) r.now += 1;
    r.minutes += Math.floor((Date.parse(next?.at ?? at) - Date.parse(h.at)) / 60_000);
    report.set(key, r);
  });
  return [...report.values()].map((r): Data => ({ ...r, averageMinutes: Math.floor(r.minutes / r.entries) }))
    .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || String(a.subStatus ?? '').localeCompare(String(b.subStatus ?? '')));
}

/** The person's own saved queue views (any of the WORK-006 filters). */
export const savedViews = (db: D1Database, actor: Actor) => rows(db, 'SELECT id,name,filters,created_at FROM b_saved_views WHERE owner_email=? ORDER BY name', actor.email);

/** Save the queue's current filters under a name, for this person only. */
export async function saveView(db: D1Database, actor: Actor, body: Data) {
  human(actor);
  const name = text(body.name, 'View name', 80), filters = parseFilters(body);
  if (filters.workType) insist(await stmt(db, 'SELECT 1 FROM b_work_types WHERE id=?', filters.workType).first(), 'Work type not found', 404);
  if (filters.subStatus) insist(await stmt(db, 'SELECT 1 FROM b_sub_statuses WHERE id=? AND deleted_at IS NULL', filters.subStatus).first(), 'Sub-status not found', 404);
  insist(!await stmt(db, 'SELECT 1 FROM b_saved_views WHERE owner_email=? AND name=?', actor.email, name).first(), `You already have a view named ${name}`, 409);
  const viewId = id();
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_saved_views(id,owner_email,name,filters,created_at) VALUES(?,?,?,?,?)', viewId, actor.email, name, JSON.stringify(filters), now())]);
  return { id: viewId, name, filters };
}

export async function deleteView(db: D1Database, actor: Actor, viewId: string) {
  human(actor);
  insist(await stmt(db, 'SELECT 1 FROM b_saved_views WHERE id=? AND owner_email=?', viewId, actor.email).first(), 'Saved view not found', 404);
  await atomic(db, actor, [stmt(db, 'DELETE FROM b_saved_views WHERE id=? AND owner_email=?', viewId, actor.email)]);
  return { ok: true };
}

/** The status the client sees: the sub-status's client label when staff gave one, else the stage's name. */
export async function clientStatus(db: D1Database, j: Data, language: Language = 'en') {
  const sub = j.sub_status_id ? await stmt(db, 'SELECT client_label FROM b_sub_statuses WHERE id=?', j.sub_status_id).first<Data>() : null;
  // A firm-written client label is shown as written; the built-in stage names follow the contact's language.
  return sub?.client_label ?? tr(language, `stage.${stageOf(j)}` as Key);
}
