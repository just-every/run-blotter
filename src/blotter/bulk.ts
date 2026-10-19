// Bulk scheduling (WORK-004): plan one period's jobs for a selected client
// segment, or reassign and reschedule selected jobs. A preview lists every
// impacted job and conflict; commit plans again and must match the preview.
// Existing jobs are kept, signed-off work never changes, and nobody is
// assigned to review their own work.
import { atomic, audit, date, digest, guard, human, id, insist, need, optional, stmt, text, type Actor, type Data } from './model';
import { runtimeBindings, type Bindings } from '../auth.server';
import { advance } from './flow';
import { createStatements, eligible, periodLabel } from './jobs';

const MAX = 50;
const PREPARERS = ['preparer', 'reviewer'], REVIEWERS = ['reviewer'];
const address = (value: unknown, label: string) => optional(value, label, 254).toLowerCase();

async function conflicts(db: D1Database, preparer: string, reviewer: string, submittedBy?: string | null) {
  const reasons: string[] = [];
  if (!preparer) reasons.push('No preparer resolved');
  else if (!await eligible(db, preparer, PREPARERS)) reasons.push(`${preparer} is not an active preparer`);
  if (!reviewer) reasons.push('No reviewer resolved');
  else if (!await eligible(db, reviewer, REVIEWERS)) reasons.push(`${reviewer} is not an active reviewer`);
  if (reviewer && (reviewer === preparer || reviewer === submittedBy)) reasons.push(`${reviewer} cannot review their own work`);
  return reasons;
}
const fingerprint = (plan: unknown) => digest(JSON.stringify(plan));

/** People for one client: an override, else last period's people while still eligible, else the batch default. */
async function resolve(db: D1Database, override: string, last: string | undefined, fallback: string, roles: string[]) {
  if (override) return { email: override, from: 'override' };
  if (last && await eligible(db, last, roles)) return { email: last, from: 'last period' };
  return { email: fallback, from: 'batch' };
}

async function schedulePlan(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', text(body.templateId, 'Template')).first<Data>();
  insist(template, 'Template not found', 404);
  const periodStart = date(body.periodStart, 'Period start'), dueDate = date(body.dueDate, 'Due date');
  insist(dueDate >= periodStart, 'The due date is before the period starts');
  const dueNote = text(body.dueNote, 'Where the due date comes from', 300);
  const preparer = address(body.preparerEmail, 'Preparer'), reviewer = address(body.reviewerEmail, 'Reviewer');
  insist(Array.isArray(body.clients) && body.clients.length > 0 && body.clients.length <= MAX, `Choose between 1 and ${MAX} clients`);
  const seen = new Set<string>(), lines: Data[] = [];
  for (const choice of body.clients as Data[]) {
    const clientId = text(choice?.clientId, 'Client');
    insist(!seen.has(clientId), 'Each client can appear once'); seen.add(clientId);
    const client = await stmt(db, 'SELECT id,name FROM b_clients WHERE id=?', clientId).first<Data>();
    insist(client, 'Client not found', 404);
    const line: Data = { clientId, client: client.name };
    if (choice.exclude === true) { lines.push({ ...line, action: 'excluded', reasons: [] }); continue; }
    const existing = await stmt(db, 'SELECT id FROM b_jobs WHERE client_id=? AND template_id=? AND period_start=?', clientId, template.id, periodStart).first<Data>();
    if (existing) { lines.push({ ...line, action: 'exists', jobId: existing.id, reasons: [] }); continue; }
    const last = await stmt(db, 'SELECT preparer_email,reviewer_email FROM b_jobs WHERE client_id=? AND template_id=? AND period_start<? ORDER BY period_start DESC LIMIT 1', clientId, template.id, periodStart).first<Data>();
    const p = await resolve(db, address(choice.preparerEmail, 'Preparer'), last?.preparer_email, preparer, PREPARERS);
    const r = await resolve(db, address(choice.reviewerEmail, 'Reviewer'), last?.reviewer_email, reviewer, REVIEWERS);
    const reasons = await conflicts(db, p.email, r.email);
    lines.push({ ...line, preparer: p.email, preparerFrom: p.from, reviewer: r.email, reviewerFrom: r.from, action: reasons.length ? 'conflict' : 'create', reasons });
  }
  const plan = { templateId: template.id, template: template.name, periodStart, periodLabel: periodLabel(periodStart, template.recurrence), dueDate, dueNote, lines };
  return { template, plan: { ...plan, fingerprint: await fingerprint(plan) } };
}

export async function previewSchedule(db: D1Database, actor: Actor, body: Data) {
  return (await schedulePlan(db, actor, body)).plan;
}

export async function commitSchedule(env: Bindings, actor: Actor, body: Data) {
  const db = runtimeBindings(env).DB;
  const { template, plan } = await schedulePlan(db, actor, body);
  insist(body.fingerprint === plan.fingerprint, 'The plan changed since the preview. Preview again before committing.', 409);
  const blocked = plan.lines.filter(l => l.action === 'conflict');
  insist(!blocked.length, `Resolve or exclude: ${blocked.map(l => `${l.client} (${l.reasons.join('; ')})`).join(', ')}`, 409);
  const created = plan.lines.filter(l => l.action === 'create').map((l): Data => ({ ...l, jobId: id() }));
  if (created.length) await atomic(db, actor, [
    ...created.flatMap(l => createStatements(db, actor, template, { id: l.jobId, clientId: l.clientId, periodStart: plan.periodStart, dueDate: plan.dueDate, dueNote: plan.dueNote, preparer: l.preparer, reviewer: l.reviewer })),
    audit(db, actor, 'jobs.bulk_scheduled', template.id, `${plan.periodLabel}: ${created.length} created, ${plan.lines.length - created.length} kept or excluded`),
  ]);
  await advance(env, created.map(l => l.jobId), actor.email);
  return { ...plan, created: created.map(l => ({ clientId: l.clientId, jobId: l.jobId })) };
}

async function reassignPlan(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  insist(Array.isArray(body.jobIds) && body.jobIds.length > 0 && body.jobIds.length <= MAX, `Choose between 1 and ${MAX} jobs`);
  insist(new Set(body.jobIds).size === body.jobIds.length, 'Each job can appear once');
  const preparer = address(body.preparerEmail, 'Preparer'), reviewer = address(body.reviewerEmail, 'Reviewer');
  const dueDate = body.dueDate ? date(body.dueDate, 'Due date') : '', dueNote = dueDate ? text(body.dueNote, 'Where the new due date comes from', 300) : '';
  insist(preparer || reviewer || dueDate, 'Choose a new preparer, reviewer or due date');
  const lines: Data[] = [];
  for (const jobId of body.jobIds as unknown[]) {
    const j = await stmt(db, 'SELECT b_jobs.*,c.name client FROM b_jobs JOIN b_clients c ON c.id=b_jobs.client_id WHERE b_jobs.id=?', text(jobId, 'Job')).first<Data>();
    insist(j, 'Job not found', 404);
    const to = { preparer: preparer || j.preparer_email, reviewer: reviewer || j.reviewer_email, dueDate: dueDate || j.due_date, dueNote: dueDate ? dueNote : j.due_note };
    const line: Data = { jobId: j.id, revision: j.revision, client: j.client, job: `${j.title} · ${j.period_label}`, status: j.status,
      from: { preparer: j.preparer_email, reviewer: j.reviewer_email, dueDate: j.due_date }, to };
    const reasons = j.status === 'signed_off' ? ['Signed-off work is not changed'] : await conflicts(db, to.preparer, to.reviewer, j.status === 'review' ? j.submitted_by : null);
    if (to.dueDate < j.period_start) reasons.push('The due date is before the period starts');
    const same = to.preparer === j.preparer_email && to.reviewer === j.reviewer_email && to.dueDate === j.due_date;
    lines.push({ ...line, action: reasons.length ? 'conflict' : same ? 'unchanged' : 'change', reasons });
  }
  const plan = { preparer, reviewer, dueDate, dueNote, lines };
  return { ...plan, fingerprint: await fingerprint(plan) };
}

export async function previewReassign(db: D1Database, actor: Actor, body: Data) {
  return reassignPlan(db, actor, body);
}

export async function commitReassign(db: D1Database, actor: Actor, body: Data) {
  const plan = await reassignPlan(db, actor, body);
  insist(body.fingerprint === plan.fingerprint, 'The plan changed since the preview. Preview again before committing.', 409);
  const blocked = plan.lines.filter(l => l.action === 'conflict');
  insist(!blocked.length, `Resolve or deselect: ${blocked.map(l => `${l.client} ${l.job} (${l.reasons.join('; ')})`).join(', ')}`, 409);
  const changes = plan.lines.filter(l => l.action === 'change');
  if (changes.length) await atomic(db, actor, changes.flatMap(l => {
    // Each job must still be at its previewed revision, so nothing changed underneath the preview.
    const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND status<>'signed_off')", l.jobId, l.revision);
    return [check,
      stmt(db, 'UPDATE b_jobs SET preparer_email=?,reviewer_email=?,due_date=?,due_note=?,revision=? WHERE id=?', l.to.preparer, l.to.reviewer, l.to.dueDate, l.to.dueNote, id(), l.jobId),
      release, audit(db, actor, 'job.reassigned', l.jobId, `preparer ${l.to.preparer}, reviewer ${l.to.reviewer}, due ${l.to.dueDate}`)];
  }));
  return { ...plan, changed: changes.map(l => l.jobId) };
}
