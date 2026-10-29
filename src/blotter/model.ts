import { liveIntegrationSql } from './integration-policy';
import { liveAgentRuleSql } from './scheduled-agent-gate';
import { clientScopeSql, clientScopeParams } from './access-sql';
// Shared server rules: validation, roles, guarded atomic writes and audit.
// Adapted from just-every/run-satchel src/satchel/model.ts (MIT).
export type Data = Record<string, any>;
export type Role = 'owner' | 'reviewer' | 'preparer';
export type Actor = {
  doorAgent?: { id: string; name: string; approvers?: readonly {id:string;name:string}[] };
  doorAuthority?: { envelope: string|null; localDocument:string|null; revision:number; businessRevision?:number };
  id: string; email: string; name: string; role: Role; channel: 'person' | 'agent' | 'integration'; integration?: { keyId: string; action: string }; agentKeyId?: string; sessionId?: string; sessionStartedAt?: number; readOnly?: boolean; accessScoped?: boolean; accessRevision?: string; manageAccess?: boolean; financial?: boolean;
  automation?: { ruleId: string; attemptId: string; jobId: string; revision: string; external: boolean }; label?: string; approval?: { id: string; resultId: string };
};

export class Fault extends Error { constructor(message: string, public status = 400, public detail: Data = {}) { super(message); } }
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

export const preparationOwnerSql = (alias='') => `(${alias}door_sponsor_id=? OR (${alias}door_sponsor_id IS NULL AND ${alias}for_email=?))`;
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function need(actor: Actor, ...roles: Role[]) { insist(roles.includes(actor.role), 'Your role cannot perform this action', 403); }
/** The principal, or a member the principal granted financial authority (ACCESS-002). */
export const canBill = (actor: Actor) => actor.role === 'owner' || !!actor.financial;
export const canReadBilling = (actor: Actor) => actor.role !== 'preparer' || !!actor.financial;
export function human(actor: Actor) { insist(actor.channel === 'person' || !!actor.automation, 'A person must approve this action', 403); }

export const stmt = (db: D1Database, sql: string, ...values: unknown[]) => db.prepare(sql).bind(...values);
export async function rows(db: D1Database, sql: string, ...values: unknown[]) { return (await stmt(db, sql, ...values).all<Data>()).results; }

/** Jobs a person may see: the principal and reviewers see all; preparers see their own. */
export const visibleJobSql = `((?='owner' OR ?='reviewer' OR b_jobs.preparer_email=?) AND ${clientScopeSql('b_jobs.client_id')})`;
export const visibleJobParams = (actor: Actor) => [actor.role, actor.role, actor.email, ...clientScopeParams(actor)];
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
const readableJobSql = `(${visibleJobSql} OR (EXISTS(SELECT 1 FROM b_job_steps t WHERE t.job_id=b_jobs.id AND t.assignee_email=?) AND ${clientScopeSql('b_jobs.client_id')}))`;
export const readableJobParams = (actor: Actor) => [...visibleJobParams(actor), actor.email, ...clientScopeParams(actor)];
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
    sql: `(? IS NULL OR COALESCE((SELECT revision FROM b_access_policy WHERE id=1),'')=?) AND EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND ((o.role='owner' AND ?='owner') OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=o.email AND m.active=1 AND m.role=?)))`,
    params: [actor.accessRevision ?? null, actor.accessRevision ?? null, actor.id, actor.role, actor.role],
  };
}
export function audit(db: D1Database, actor: Actor, action: string, objectId: string, detail = '') {
  if(actor.doorAgent?.approvers?.length)detail+='; company approvers: '+actor.doorAgent.approvers.map(p=>`${p.name} (${p.id})`).join(', ');
  const who = actor.doorAgent ? `${actor.doorAgent.name} for ${actor.name} <${actor.email}>` : actor.integration ? `${actor.email} (integration: ${actor.integration.keyId})` : actor.automation ? `${actor.email} (automation: ${actor.automation.ruleId})` : actor.channel === 'agent' ? `${actor.email} (agent: ${actor.label ?? 'agent'})` : actor.email;
  return stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), who, action, objectId, detail, now());
}
/** A guard row that only inserts when `sql` holds, so the whole batch fails otherwise. */
export function guard(db: D1Database, sql: string, ...params: unknown[]) {
  const key = 'g:' + id();
  return [stmt(db, `INSERT INTO b_guard(id,ok) VALUES(?,CASE WHEN (${sql}) THEN 1 ELSE 0 END)`, key, ...params), stmt(db, 'DELETE FROM b_guard WHERE id=?', key)] as const;
}
export async function atomic(db: D1Database, actor: Actor, statements: D1PreparedStatement[]) {
  const a = authority(actor), [check, release] = guard(db, a.sql, ...a.params);
  const door: D1PreparedStatement[] = [];
  if(actor.doorAuthority){const snap=actor.doorAuthority;door.push(...guard(db,`EXISTS(SELECT 1 FROM agent_door_state WHERE id=1 AND local_paused=0 AND envelope IS ? AND local_document IS ? AND local_revision=? AND (envelope IS NOT NULL OR local_document IS NOT NULL) AND (envelope IS NULL OR (json_extract(envelope,'$.exp')>unixepoch() AND json_extract(envelope,'$.paused')=0))) AND EXISTS(SELECT 1 FROM agent_door_agents WHERE id=? AND revoked=0)`,snap.envelope,snap.localDocument,snap.revision,actor.doorAgent!.id));if(snap.businessRevision!==undefined)door.push(...guard(db,`EXISTS(SELECT 1 FROM bs_settings WHERE singleton=1 AND stopped=0 AND rev=? AND ((owner_id IS NOT NULL AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')) OR EXISTS(SELECT 1 FROM bs_team WHERE operator_id=? AND state='active')))`,snap.businessRevision,actor.id,actor.id));}
  if(actor.doorAgent&&actor.agentKeyId)door.push(...guard(db,'EXISTS(SELECT 1 FROM b_agent_keys WHERE id=? AND owner_id=? AND revoked=0)',actor.agentKeyId,actor.id));
  const integration: D1PreparedStatement[] = [];
  if (actor.integration) {
    const [live, done] = guard(db, `${liveIntegrationSql} AND EXISTS(SELECT 1 FROM b_integration_keys k,json_each(k.actions) a WHERE k.id=? AND a.value=?)`, actor.integration.keyId, actor.integration.keyId, actor.integration.action);
    integration.push(live, done);
  }
  const approval: D1PreparedStatement[] = [], decision: D1PreparedStatement[] = [];
  if (actor.approval) {
    const [pending, done] = guard(db, `EXISTS(SELECT 1 FROM b_proposals WHERE id=? AND ${preparationOwnerSql()} AND status='pending')`, actor.approval.id, actor.id, actor.email);
    approval.push(pending, done);
    const [live,liveDone]=guard(db,`NOT EXISTS(SELECT 1 FROM b_agent_runs WHERE proposal_id=?) OR EXISTS(SELECT 1 FROM b_agent_runs ar WHERE ar.proposal_id=? AND ${liveAgentRuleSql.replace('j.id=?','j.id=ar.job_id').replace('r.id=?','r.id=ar.rule_id').replace('? NOT LIKE',"ar.event_key NOT LIKE").replace('substr(?,6)', 'substr(ar.event_key,6)')})`,actor.approval.id,actor.approval.id);
    approval.push(live,liveDone);
    decision.push(stmt(db, "UPDATE b_proposals SET status='approved',result_id=?,decided_by=?,decided_at=? WHERE id=?", actor.approval.resultId, actor.email, now(), actor.approval.id));
  }
  const execution: D1PreparedStatement[] = [], completed: D1PreparedStatement[] = [];
  if (actor.automation) {
    const x = actor.automation;
    const [allowed, finish] = guard(db, `EXISTS(SELECT 1 FROM b_automation_attempts a JOIN b_automation_rules r ON r.id=a.rule_id JOIN b_jobs j ON j.id=a.job_id JOIN b_clients c ON c.id=j.client_id
      WHERE a.id=? AND a.rule_id=? AND a.job_id=? AND a.status='running' AND j.revision=? AND r.status='active' AND r.used<=r.budget AND r.principal_id=?
      AND c.lifecycle='active' AND c.merged_into IS NULL AND j.client_id IN (SELECT value FROM json_each(r.definition,'$.clientIds'))
      AND (substr(a.event_key,1,5)<>'file:' OR EXISTS(SELECT 1 FROM b_files f WHERE f.id=substr(a.event_key,6) AND f.erased_at IS NULL))
      AND (substr(a.event_key,1,10)<>'signature:' OR EXISTS(SELECT 1 FROM b_signatures s WHERE ('signature:'||s.id||':'||s.attempt)=a.event_key AND s.status='completed' AND s.erased_at IS NULL))
      AND (substr(a.event_key,1,10)<>'organizer:' OR EXISTS(SELECT 1 FROM b_organizer_submissions s WHERE s.id=substr(a.event_key,11) AND s.erased_at IS NULL))
      AND (json_extract(r.definition,'$.action.kind')<>'rollforward' OR NOT EXISTS(
        SELECT 1 FROM json_each(json_array(j.preparer_email,j.reviewer_email,j.manager_email,j.partner_email)) p WHERE p.value IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM oa_operators o WHERE o.email=p.value AND o.role='owner' AND o.status='active')
        AND NOT EXISTS(SELECT 1 FROM b_members m WHERE m.email=p.value AND m.active=1 AND (m.role='reviewer' OR (p.key=0 AND m.role='preparer')))))
      AND (json_extract(r.definition,'$.action.kind')<>'reminder' OR EXISTS(SELECT 1 FROM b_msg_templates m WHERE m.id=json_extract(r.definition,'$.action.templateId') AND m.version=json_extract(r.definition,'$.action.templateVersion') AND m.deleted_at IS NULL)))` , x.attemptId, x.ruleId, x.jobId, x.revision, actor.id);
    execution.push(allowed, finish);
    completed.push(stmt(db, "UPDATE b_automation_attempts SET status=?,outcome=?,next_action=? WHERE id=? AND status='running'", x.external ? 'dispatching' : 'succeeded', x.external ? 'Provider outcome not yet recorded' : 'Native effect committed', x.external ? 'Reconcile if interrupted; never resend blindly' : '', x.attemptId));
  }
  try { const results = await db.batch([...door, ...approval, check, ...execution, ...integration, ...statements, ...decision, ...completed, release]); return results.slice(door.length + approval.length + 1 + execution.length + integration.length, door.length + approval.length + 1 + execution.length + integration.length + statements.length); }
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
