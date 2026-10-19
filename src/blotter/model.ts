// Shared server rules: validation, roles, guarded atomic writes and audit.
// Adapted from just-every/run-satchel src/satchel/model.ts (MIT).
export type Data = Record<string, any>;
export type Role = 'owner' | 'reviewer' | 'preparer';
export type Actor = {
  id: string; email: string; name: string; role: Role; channel: 'person' | 'agent';
  label?: string; approval?: { id: string; resultId: string };
};

export class Fault extends Error { constructor(message: string, public status = 400) { super(message); } }
export function insist(value: unknown, message: string, status = 400): asserts value { if (!value) throw new Fault(message, status); }

export function text(value: unknown, label: string, max = 1000) {
  insist(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${label} is required (maximum ${max} characters)`);
  return value.trim();
}
export function optional(value: unknown, label: string, max = 1000) {
  if (value === undefined || value === null || value === '') return '';
  insist(typeof value === 'string' && value.trim().length <= max, `${label} must be at most ${max} characters`);
  return value.trim();
}
export function integer(value: unknown, label: string, min = 0, max = 100_000_000) {
  const n = typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
  insist(Number.isSafeInteger(n) && Number(n) >= min && Number(n) <= max, `${label} must be a whole number between ${min} and ${max}`);
  return Number(n);
}
export function date(value: unknown, label = 'Date') {
  const v = text(value, label, 10);
  insist(/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v, `${label}: use a valid YYYY-MM-DD date`);
  return v;
}
export function email(value: unknown, label = 'Email') {
  const v = text(value, label, 254).toLowerCase();
  insist(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), `${label}: enter a valid email address`);
  return v;
}
export function lines(value: unknown, label: string, max = 30) {
  const list = (Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [])
    .map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
  insist(list.length > 0 && list.length <= max, `${label}: list between 1 and ${max} items`);
  for (const item of list) insist(item.length <= 200, `${label}: each item is at most 200 characters`);
  return list as string[];
}

export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function need(actor: Actor, ...roles: Role[]) { insist(roles.includes(actor.role), 'Your role cannot perform this action', 403); }
export function human(actor: Actor) { insist(actor.channel === 'person', 'A person must approve this action', 403); }

export const stmt = (db: D1Database, sql: string, ...values: unknown[]) => db.prepare(sql).bind(...values);
export async function rows(db: D1Database, sql: string, ...values: unknown[]) { return (await stmt(db, sql, ...values).all<Data>()).results; }

/** Jobs a person may see: the principal and reviewers see all; preparers see their own. */
export const visibleJobSql = `(?='owner' OR ?='reviewer' OR b_jobs.preparer_email=?)`;
export const visibleJobParams = (actor: Actor) => [actor.role, actor.role, actor.email];
export async function job(db: D1Database, actor: Actor, jobId: string) {
  const j = await stmt(db, `SELECT * FROM b_jobs WHERE id=? AND ${visibleJobSql}`, jobId, ...visibleJobParams(actor)).first<Data>();
  insist(j, 'Job not found', 404);
  return j;
}

/**
 * Jobs a person may read: the jobs above, plus any job with a task assigned to
 * them by name (WORK-009), the one named widening of ACCESS-001. Such a person
 * reads the job and acts only on their own tasks; access ends when no task on
 * the job is assigned to them.
 */
const readableJobSql = `(${visibleJobSql} OR EXISTS(SELECT 1 FROM b_job_steps t WHERE t.job_id=b_jobs.id AND t.assignee_email=?))`;
export const readableJobParams = (actor: Actor) => [...visibleJobParams(actor), actor.email];
export { readableJobSql };
/** A job the actor may read; `access` is 'full', or 'task' when only a named task grants it. */
export async function readableJob(db: D1Database, actor: Actor, jobId: string) {
  const j = await stmt(db, `SELECT *,CASE WHEN ${visibleJobSql} THEN 'full' ELSE 'task' END access FROM b_jobs WHERE id=? AND ${readableJobSql}`,
    ...visibleJobParams(actor), jobId, ...readableJobParams(actor)).first<Data>();
  insist(j, 'Job not found', 404);
  return j;
}

/** The actor's role is re-checked inside the same D1 batch as the write. */
function authority(actor: Actor) {
  return {
    sql: `EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND ((o.role='owner' AND ?='owner') OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=o.email AND m.active=1 AND m.role=?)))`,
    params: [actor.id, actor.role, actor.role],
  };
}
export function audit(db: D1Database, actor: Actor, action: string, objectId: string, detail = '') {
  const who = actor.channel === 'agent' ? `${actor.email} (agent: ${actor.label ?? 'agent'})` : actor.email;
  return stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), who, action, objectId, detail, now());
}
/** A guard row that only inserts when `sql` holds, so the whole batch fails otherwise. */
export function guard(db: D1Database, sql: string, ...params: unknown[]) {
  const key = 'g:' + id();
  return [stmt(db, `INSERT INTO b_guard(id,ok) VALUES(?,CASE WHEN (${sql}) THEN 1 ELSE 0 END)`, key, ...params), stmt(db, 'DELETE FROM b_guard WHERE id=?', key)] as const;
}
export async function atomic(db: D1Database, actor: Actor, statements: D1PreparedStatement[]) {
  const a = authority(actor), [check, release] = guard(db, a.sql, ...a.params);
  const approval: D1PreparedStatement[] = [], decision: D1PreparedStatement[] = [];
  if (actor.approval) {
    const [pending, done] = guard(db, `EXISTS(SELECT 1 FROM b_proposals WHERE id=? AND for_email=? AND status='pending')`, actor.approval.id, actor.email);
    approval.push(pending, done);
    decision.push(stmt(db, "UPDATE b_proposals SET status='approved',result_id=?,decided_by=?,decided_at=? WHERE id=?", actor.approval.resultId, actor.email, now(), actor.approval.id));
  }
  try { await db.batch([...approval, check, ...statements, ...decision, release]); }
  catch (error) {
    if (/constraint|b_guard|UNIQUE|immutable|invalid job transition|only void/i.test(String(error))) throw new Fault('The record changed or this action is no longer allowed. Refresh and try again.', 409);
    throw error;
  }
}

export async function digest(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function secret(prefix: string) {
  return prefix + [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2, '0')).join('');
}
