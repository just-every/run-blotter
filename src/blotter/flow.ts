// Dependencies and conditional workflow (WORK-003). A template task may wait
// for other tasks of its job, for accepted client documents (its required
// evidence) and for a prerequisite job of the same client: submitted for
// review (the preparer gate) or signed off (the reviewer gate). The
// prerequisite job is the same client's job from the named template whose
// period contains this job's last period day. A task may also apply only when a
// job question has one of the chosen answers; until it is answered the task
// waits, and once answered otherwise the task does not apply and is not needed
// for review. A prerequisite task that does not apply counts as satisfied.
// States are worked out when read. Completion events (a task done or reopened,
// a document accepted, an answer, a job submitted, returned or signed off, an
// exception) advance the gated tasks: one that became ready is stamped and its
// owner alerted; one blocked again loses the stamp. The job's reviewer, its
// manager or the principal may record an exception with a reason: the task
// can then be worked, but nothing it waited for is completed or faked, its own
// attachment is still required, and an unanswered branch question is never
// waived. Templates are saved as new versions and wait only on templates that
// already exist, so only tasks within one template can form a cycle; a cycle
// is refused when the template is saved.
import { runtimeBindings, type Bindings } from '../auth.server';
import { nextPeriod } from './jobs';
import { notify } from './notifications';
import { jobTasks } from './tasks';
import { atomic, audit, Fault, guard, human, id, insist, integer, job, need, now, rows, stmt, text, type Actor, type Data } from './model';

const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const GATES = ['submitted', 'signed_off'] as const;
export type Question = { key: string; label: string; options: string[] };
export type Flow = { after: number[]; afterDocuments: number[]; afterTemplate: string | null; afterGate: string | null; whenQuestion: string | null; whenValues: string[] | null };
export const noFlow: Flow = { after: [], afterDocuments: [], afterTemplate: null, afterGate: null, whenQuestion: null, whenValues: null };

/** A template's job questions: a key, the question and 2 to 10 answers. */
export function templateQuestions(value: unknown): Question[] {
  if (value === undefined || value === null || value === '') return [];
  insist(Array.isArray(value) && value.length <= 10, 'Questions: list at most 10');
  const seen = new Set<string>();
  return (value as Data[]).map((raw, n) => {
    const name = `Question ${n + 1}`;
    insist(raw && typeof raw === 'object', 'Each question is an object');
    const key = text(raw.key, `${name} key`, 40);
    insist(KEY.test(key) && !seen.has(key), `${name} key: a new lower-case name of letters, digits and _`);
    seen.add(key);
    const options = Array.isArray(raw.options) ? (raw.options as unknown[]).map((o, i) => text(o, `${name} answer ${i + 1}`, 80)) : [];
    insist(options.length >= 2 && options.length <= 10 && new Set(options).size === options.length, `${name}: give 2 to 10 different answers`);
    return { key, label: text(raw.label, name, 200), options };
  });
}

function numbers(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map(v => v.trim()).filter(Boolean) : [value];
  return [...new Set(list.map(v => integer(v, label, 1, 30)))].sort((a, b) => a - b);
}

/** One task's flow fields; checkFlow then checks them against the whole template. */
export function taskFlow(raw: Data, name: string): Flow {
  const flow: Flow = { ...noFlow, after: numbers(raw.after, `${name} waits for task`), afterDocuments: numbers(raw.afterDocuments, `${name} waits for document`) };
  if (raw.afterJob) {
    insist(typeof raw.afterJob === 'object', `${name} prerequisite job: name a template and a gate`);
    flow.afterTemplate = text(raw.afterJob.templateId, `${name} prerequisite job template`, 100);
    flow.afterGate = raw.afterJob.gate ?? 'signed_off';
    insist(GATES.includes(flow.afterGate as never), `${name}: wait for the prerequisite job to be submitted or signed off`);
  }
  if (raw.when) {
    insist(typeof raw.when === 'object', `${name} condition: name a question and its answers`);
    flow.whenQuestion = text(raw.when.question, `${name} condition question`, 40);
    const values = Array.isArray(raw.when.equals) ? raw.when.equals : [raw.when.equals];
    flow.whenValues = [...new Set((values as unknown[]).map(v => text(v, `${name} condition answer`, 80)))];
  }
  return flow;
}

/** Whole-template checks: every reference exists, no task waits on itself and no dependency cycle. */
export async function checkFlow(db: D1Database, tasks: (Flow & { label: string })[], questions: Question[], requestCount: number) {
  for (const [i, t] of tasks.entries()) {
    const name = `Task ${i + 1}`;
    for (const n of t.after) insist(n <= tasks.length && n !== i + 1, `${name} can wait only for another task of this template`);
    for (const n of t.afterDocuments) insist(n <= requestCount, `${name} waits for document ${n}, which this template does not request`);
    if (t.afterTemplate) insist(await stmt(db, 'SELECT 1 FROM b_templates WHERE id=?', t.afterTemplate).first(), `${name}: prerequisite job template not found`, 404);
    if (t.whenQuestion) {
      const q = questions.find(x => x.key === t.whenQuestion);
      insist(q, `${name}: this template has no question "${t.whenQuestion}"`);
      for (const v of t.whenValues!) insist(q.options.includes(v), `${name}: "${v}" is not an answer to "${q.label}"`);
    }
  }
  const mark: number[] = tasks.map(() => 0);
  const visit = (i: number, path: number[]) => {
    if (mark[i] === 2) return;
    insist(mark[i] !== 1, `Dependency cycle: ${[...path.slice(path.indexOf(i)), i].map(n => `task ${n + 1}`).join(' → ')}`);
    mark[i] = 1;
    for (const n of tasks[i].after) visit(n - 1, [...path, i]);
    mark[i] = 2;
  };
  tasks.forEach((_, i) => visit(i, []));
}

/** An open step still owed: not done, and not outside its answered branch. `s` is the b_job_steps alias. */
export const pendingStep = (s: string) => `${s}.done_at IS NULL AND NOT EXISTS(SELECT 1 FROM b_job_answers a WHERE a.job_id=${s}.job_id AND a.key=${s}.when_question
  AND a.value IS NOT NULL AND a.value NOT IN (SELECT value FROM json_each(${s}.when_values)))`;

const dayBefore = (day: string) => new Date(Date.parse(day + 'T00:00:00Z') - 86_400_000).toISOString().slice(0, 10);
/** The same client's job from the template whose period contains this job's last period day, if one exists. */
export async function prerequisite(db: D1Database, j: Data, templateId: string) {
  const [own, template] = await Promise.all([stmt(db, 'SELECT recurrence FROM b_templates WHERE id=?', j.template_id).first<Data>(),
    stmt(db, 'SELECT id,name,recurrence FROM b_templates WHERE id=?', templateId).first<Data>()]);
  const last = dayBefore(nextPeriod(j.period_start, own!.recurrence));
  const found = await stmt(db, 'SELECT id,title,period_label,period_start,status FROM b_jobs WHERE client_id=? AND template_id=? AND period_start<=? ORDER BY period_start DESC LIMIT 1',
    j.client_id, templateId, last).first<Data>();
  return { name: template!.name as string, last, job: found && nextPeriod(found.period_start, template!.recurrence) > last ? found : null };
}
const gateMet = (status: string, gate: string) => gate === 'submitted' ? ['review', 'signed_off'].includes(status) : status === 'signed_off';

/** Each task's state (done, ready, blocked, not_applicable) with the reasons it waits. */
export async function taskStates(db: D1Database, j: Data, steps: Data[]) {
  const [answers, requests] = await Promise.all([rows(db, 'SELECT * FROM b_job_answers WHERE job_id=? ORDER BY ordinal', j.id),
    rows(db, 'SELECT ordinal,label,status FROM b_requests WHERE job_id=?', j.id)]);
  const applies = (s: Data) => {
    if (!s.when_question) return true;
    const a = answers.find(x => x.key === s.when_question);
    return a?.value == null ? null : (JSON.parse(s.when_values) as string[]).includes(a.value);
  };
  const prerequisites = new Map<string, Awaited<ReturnType<typeof prerequisite>>>();
  for (const t of new Set(steps.map(s => s.after_template).filter(Boolean))) prerequisites.set(t, await prerequisite(db, j, t));
  return steps.map((s): Data => {
    const gated = JSON.parse(s.after_steps).length > 0 || JSON.parse(s.after_requests).length > 0 || !!s.after_template || !!s.when_question;
    const pre = s.after_template ? prerequisites.get(s.after_template)! : null;
    const base = { ...s, gated, prerequisite: pre?.job ?? null, exception_waived: s.exception_waived ? JSON.parse(s.exception_waived) : [] };
    const branch = applies(s);
    if (s.done_at) return { ...base, state: 'done', blockers: [], waivable: [] };
    if (branch === false) return { ...base, state: 'not_applicable', blockers: [], waivable: [] };
    const waivable: string[] = [];
    for (const n of JSON.parse(s.after_steps) as number[]) {
      const p = steps.find(x => x.ordinal === n);
      if (p && !p.done_at && applies(p) !== false) waivable.push(`Waiting for task ${n}: ${p.label}`);
    }
    for (const n of JSON.parse(s.after_requests) as number[]) {
      const r = requests.find(x => x.ordinal === n);
      if (r && r.status !== 'accepted') waivable.push(`Waiting for the client's ${r.label} to be accepted`);
    }
    if (pre && !pre.job) waivable.push(`Waiting for a ${pre.name} job covering ${pre.last}; none exists yet`);
    else if (pre && !gateMet(pre.job!.status, s.after_gate)) waivable.push(`Waiting for ${pre.job!.title} ${pre.job!.period_label} to be ${s.after_gate === 'submitted' ? 'submitted for review' : 'signed off'}`);
    const question = answers.find(x => x.key === s.when_question);
    const blockers = [...(branch === null ? [`Waiting for the answer to "${question?.label ?? s.when_question}"`] : []), ...(s.exception_at ? [] : waivable)];
    return { ...base, state: blockers.length ? 'blocked' : 'ready', blockers, waivable: s.exception_at ? [] : waivable };
  });
}
export async function flowSteps(db: D1Database, j: Data) { return taskStates(db, j, await jobTasks(db, j)); }
export const jobAnswers = (db: D1Database, jobId: string) => rows(db, 'SELECT key,label,options,value,answered_by,answered_at FROM b_job_answers WHERE job_id=? ORDER BY ordinal', jobId);

/** Refuses completing a task that does not apply or is blocked; returns a guard that re-checks the same inside the write. */
export async function readyGuard(db: D1Database, j: Data, ordinal: number) {
  const s = (await flowSteps(db, j)).find(x => x.ordinal === ordinal)!;
  insist(s.state !== 'not_applicable', `"${s.label}" does not apply to this job's answers`, 409);
  if (s.state === 'blocked') throw new Fault(`"${s.label}" is blocked: ${s.blockers.join('; ')}`, 409, { blockers: s.blockers });
  const checks: string[] = [], params: unknown[] = [];
  if (s.when_question) { checks.push('EXISTS(SELECT 1 FROM b_job_answers a WHERE a.job_id=? AND a.key=? AND a.value IN (SELECT value FROM json_each(?)))'); params.push(j.id, s.when_question, s.when_values); }
  if (!s.exception_at) {
    checks.push(`NOT EXISTS(SELECT 1 FROM b_job_steps p WHERE p.job_id=? AND p.ordinal IN (SELECT value FROM json_each(?)) AND ${pendingStep('p')})`,
      "NOT EXISTS(SELECT 1 FROM b_requests r WHERE r.job_id=? AND r.ordinal IN (SELECT value FROM json_each(?)) AND r.status<>'accepted')");
    params.push(j.id, s.after_steps, j.id, s.after_requests);
    if (s.prerequisite) { checks.push('EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status IN (SELECT value FROM json_each(?)))'); params.push(s.prerequisite.id, JSON.stringify(s.after_gate === 'submitted' ? ['review', 'signed_off'] : ['signed_off'])); }
  }
  return guard(db, checks.length ? checks.join(' AND ') : '1', ...params);
}

/** Open jobs of the same client with an open task waiting on this job's template. */
export async function dependents(db: D1Database, j: Data) {
  return (await rows(db, `SELECT DISTINCT d.id FROM b_jobs d JOIN b_job_steps s ON s.job_id=d.id
    WHERE d.client_id=? AND d.status='open' AND s.after_template=? AND s.done_at IS NULL`, j.client_id, j.template_id)).map(r => r.id as string);
}

/** Stamps gated tasks that became ready and alerts their owner; clears the stamp on tasks blocked again. */
export async function advance(env: Bindings, jobIds: string[], by = '') {
  const db = runtimeBindings(env).DB;
  for (const jobId of new Set(jobIds)) {
    const j = await stmt(db, 'SELECT j.*,c.name client FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE j.id=?', jobId).first<Data>();
    if (!j || j.status !== 'open') continue;
    for (const s of await flowSteps(db, j)) {
      if (!s.gated || s.done_at) continue;
      if (s.state === 'ready' && !s.ready_at) {
        const stamped = await stmt(db, 'UPDATE b_job_steps SET ready_at=? WHERE job_id=? AND ordinal=? AND ready_at IS NULL AND done_at IS NULL', now(), j.id, s.ordinal).run();
        if (!stamped.meta.changes) continue;
        await stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'Blotter (automatic)', 'task.ready', j.id, `${s.ordinal}: ${s.label}`, now()).run();
        await notify(env, [s.owner || j.preparer_email], { kind: 'task_ready', jobId: j.id, summary: `${s.label} is ready to work on ${j.client} ${j.title} ${j.period_label}` }, by);
      } else if (s.state !== 'ready' && s.ready_at) await stmt(db, 'UPDATE b_job_steps SET ready_at=NULL WHERE job_id=? AND ordinal=?', j.id, s.ordinal).run();
    }
  }
}

/** A job person records the answer to one of the job's questions; branches follow it. */
export async function recordAnswer(env: Bindings, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const db = runtimeBindings(env).DB, j = await job(db, actor, jobId);
  insist(j.status === 'open', 'This job is not open for work', 409);
  const q = await stmt(db, 'SELECT * FROM b_job_answers WHERE job_id=? AND key=?', j.id, text(body.key, 'Question', 40)).first<Data>();
  insist(q, 'Question not found', 404);
  const options = JSON.parse(q.options) as string[], value = text(body.value, 'Answer', 80);
  insist(options.includes(value), `Answer "${q.label}" with one of: ${options.join(', ')}`);
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open')", j.id);
  await atomic(db, actor, [check, stmt(db, 'UPDATE b_job_answers SET value=?,answered_by=?,answered_at=? WHERE job_id=? AND key=?', value, actor.email, now(), j.id, q.key),
    stmt(db, 'UPDATE b_jobs SET revision=? WHERE id=?', id(), j.id), release, audit(db, actor, 'job.answered', j.id, `${q.label}: ${value}`)]);
  await advance(env, [j.id], actor.email);
}

/** The job's reviewer, its manager or the principal lets a blocked task be worked, with a recorded reason. */
export async function grantException(env: Bindings, actor: Actor, jobId: string, ordinal: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const db = runtimeBindings(env).DB, j = await job(db, actor, jobId);
  insist(j.status === 'open', 'This job is not open for work', 409);
  insist(actor.role === 'owner' || [j.reviewer_email, j.manager_email].includes(actor.email), "Only the job's reviewer, its manager or the principal can record an exception", 403);
  const reason = text(body.reason, 'Reason for the exception', 1000);
  const s = (await flowSteps(db, j)).find(x => x.ordinal === integer(ordinal, 'Step', 1, 100));
  insist(s, 'Checklist step not found', 404);
  insist(s.state === 'blocked' && s.waivable.length > 0, s.state === 'blocked' ? 'Record the answer instead: an exception never chooses a branch' : `"${s.label}" is not blocked`, 409);
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_job_steps WHERE job_id=? AND ordinal=? AND done_at IS NULL AND exception_at IS NULL) AND EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND status='open')", j.id, s.ordinal, j.id);
  await atomic(db, actor, [check,
    stmt(db, 'UPDATE b_job_steps SET exception_by=?,exception_at=?,exception_reason=?,exception_waived=? WHERE job_id=? AND ordinal=?', actor.email, now(), reason, JSON.stringify(s.waivable), j.id, s.ordinal),
    release, audit(db, actor, 'step.exception', j.id, `${s.ordinal}: ${reason} (waived: ${s.waivable.join('; ')})`)]);
  await advance(env, [j.id], actor.email);
}
