// Automatic recurring work (WORK-002). A principal or reviewer approves a rule
// for one client and template. Its periods start on the first period's day in
// the chosen months (the template's own cadence, or fewer months for a custom
// schedule; a fiscal year is an annual first period in its first month), from
// the first period through the optional last period, inclusive. A period's job
// is created once the run's UTC date reaches the period start less the lead
// time in months. Its due date is the period's last day plus the rule's
// calendar days. Every period not yet held (generated, claimed or skipped) is
// created in order, so a run after downtime catches up, a restart repeats
// nothing, and a paused rule resumes the same way. A job that already exists
// for the client, template and period is claimed instead of duplicated. A job
// keeps its own due date and sign-off once created: changing the rule never
// alters an existing job.
import { runtimeBindings, type Bindings } from '../auth.server';
import { advance } from './flow';
import { addMonths, createStatements, eligible, nextPeriod, periodLabel } from './jobs';
import { atomic, audit, date, guard, human, id, insist, integer, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

const STEP = { monthly: 1, quarterly: 3, annual: 12 } as const;
type Recurrence = keyof typeof STEP;
const MAX_PER_RUN = 60;
const day = (value: Date) => value.toISOString().slice(0, 10);
const shiftDays = (d: string, n: number) => day(new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000));
const monthOf = (d: string) => Number(d.slice(5, 7));

/** The rule's period starts from its first period through `until` (inclusive) or its last period. */
export function periods(rule: Data, recurrence: Recurrence, until: string) {
  const months = JSON.parse(rule.months) as number[], list: string[] = [];
  for (let start = rule.first_period, n = 0; start <= until && (!rule.end_period || start <= rule.end_period) && n < 600; start = addMonths(rule.first_period, ++n * STEP[recurrence]))
    if (months.includes(monthOf(start))) list.push(start);
  return list;
}
const createOn = (start: string, lead: number) => addMonths(start, -lead);
export const dueFor = (start: string, recurrence: Recurrence, days: number) => shiftDays(shiftDays(nextPeriod(start, recurrence), -1), days);

/** A rule's schedule: periods from last period on (and any earlier one not yet held), with what holds each or when it will be created. */
function schedule(rule: Data, recurrence: Recurrence, held: Data[], today: string, count = 12) {
  const recent = addMonths(today, -STEP[recurrence]), until = addMonths(addMonths(today, rule.lead_months), STEP[recurrence] * count);
  return periods(rule, recurrence, until).filter(p => p >= recent || !held.some(h => h.period_start === p)).slice(0, count).map(p => {
    const h = held.find(x => x.period_start === p);
    return { periodStart: p, label: periodLabel(p, recurrence), createOn: createOn(p, rule.lead_months), dueDate: dueFor(p, recurrence, rule.due_days),
      state: h ? h.kind : createOn(p, rule.lead_months) <= today ? 'due' : 'scheduled', jobId: h?.job_id ?? null, note: h?.note ?? '' };
  });
}

async function ruleBody(db: D1Database, body: Data) {
  const client = await stmt(db, "SELECT id FROM b_clients WHERE id=? AND merged_into IS NULL AND lifecycle='active'", text(body.clientId, 'Client')).first<Data>();
  insist(client, 'Client not found', 404);
  const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', text(body.templateId, 'Template')).first<Data>();
  insist(template, 'Template not found', 404);
  const recurrence = template.recurrence as Recurrence, first = date(body.firstPeriod, 'First period starts');
  const natural = Array.from({ length: 12 / STEP[recurrence] }, (_, n) => ((monthOf(first) - 1 + n * STEP[recurrence]) % 12) + 1).sort((a, b) => a - b);
  const months = body.months === undefined || body.months === null || body.months === '' ? natural
    : [...new Set((Array.isArray(body.months) ? body.months : String(body.months).split(',')).map(m => integer(typeof m === 'string' ? m.trim() : m, 'Month', 1, 12)))].sort((a, b) => a - b);
  insist(months.length > 0 && months.every(m => natural.includes(m)), `Months: choose from this template's ${recurrence} cadence starting ${first} (${natural.join(', ')})`);
  insist(months.includes(monthOf(first)), 'The first period must start in one of the chosen months');
  const end = body.endPeriod ? date(body.endPeriod, 'Last period starts') : null;
  insist(!end || end >= first, 'The last period starts before the first');
  const person = async (value: unknown, label: string, roles: string[]) => {
    const address = text(value, label, 254).toLowerCase();
    insist(await eligible(db, address, roles), `${label} must be an active practice member who can do that work`);
    return address;
  };
  return {
    client_id: client.id, template_id: template.id, months: JSON.stringify(months), first_period: first, end_period: end,
    lead_months: integer(body.leadMonths ?? 0, 'Lead time in months', 0, 24), due_days: integer(body.dueDays, 'Due days after the period ends', 0, 366),
    due_note: text(body.dueNote, 'Where the due-date rule comes from', 300),
    preparer_email: await person(body.preparerEmail, 'Preparer', ['preparer', 'reviewer']), reviewer_email: await person(body.reviewerEmail, 'Reviewer', ['reviewer']),
    manager_email: body.managerEmail ? await person(body.managerEmail, 'Manager', ['reviewer']) : null,
    budget_minutes: body.budgetMinutes === undefined || body.budgetMinutes === null || body.budgetMinutes === '' ? null : integer(body.budgetMinutes, 'Time budget in minutes', 1, 100_000),
    recurrence,
  };
}

/** Previews a rule's schedule without saving it. */
export async function previewRule(db: D1Database, actor: Actor, body: Data) {
  need(actor, 'owner', 'reviewer');
  const rule = await ruleBody(db, body);
  return { schedule: schedule(rule, rule.recurrence, [], day(new Date())) };
}

/** A person approves a rule; the scheduler then creates its periods. */
export async function createRule(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const { recurrence: _, ...rule } = await ruleBody(db, body), ruleId = id();
  insist(!await stmt(db, 'SELECT 1 FROM b_recurrence_rules WHERE client_id=? AND template_id=?', rule.client_id, rule.template_id).first(), 'This client already has a rule for this template', 409);
  await atomic(db, actor, [
    stmt(db, `INSERT INTO b_recurrence_rules(id,client_id,template_id,months,first_period,end_period,lead_months,due_days,due_note,preparer_email,reviewer_email,manager_email,budget_minutes,status,revision,approved_by,approved_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?,?)`, ruleId, rule.client_id, rule.template_id, rule.months, rule.first_period, rule.end_period, rule.lead_months, rule.due_days, rule.due_note,
      rule.preparer_email, rule.reviewer_email, rule.manager_email, rule.budget_minutes, id(), actor.email, now()),
    audit(db, actor, 'rule.approved', ruleId, `${rule.first_period}${rule.end_period ? ' to ' + rule.end_period : ''}, ${rule.lead_months} months ahead`)]);
  return { id: ruleId };
}

export async function rules(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  const list = await rows(db, `SELECT r.*,c.name client,t.name template,t.recurrence FROM b_recurrence_rules r JOIN b_clients c ON c.id=r.client_id JOIN b_templates t ON t.id=r.template_id ORDER BY c.name,t.name`);
  const held = await rows(db, 'SELECT * FROM b_rule_periods ORDER BY period_start'), today = day(new Date());
  return {
    rules: list.map(r => ({ ...r, months: JSON.parse(r.months), schedule: schedule(r, r.recurrence, held.filter(h => h.rule_id === r.id), today) })),
    held, runs: await rows(db, 'SELECT * FROM b_scheduler_runs ORDER BY finished_at DESC LIMIT 10'),
  };
}

async function ruleFor(db: D1Database, ruleId: string) {
  const rule = await stmt(db, 'SELECT r.*,t.recurrence FROM b_recurrence_rules r JOIN b_templates t ON t.id=r.template_id WHERE r.id=?', ruleId).first<Data>();
  insist(rule, 'Rule not found', 404);
  return rule;
}
const aligned = (rule: Data, start: string) => periods(rule, rule.recurrence, start).at(-1) === start;

export async function setRuleStatus(db: D1Database, actor: Actor, ruleId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const rule = await ruleFor(db, ruleId);
  insist(['active', 'paused'].includes(body.status), 'Choose active or paused');
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_recurrence_rules WHERE id=? AND revision=?)', rule.id, rule.revision);
  await atomic(db, actor, [check, stmt(db, 'UPDATE b_recurrence_rules SET status=?,revision=? WHERE id=?', body.status, id(), rule.id), release,
    audit(db, actor, body.status === 'paused' ? 'rule.paused' : 'rule.resumed', rule.id, optional(body.reason, 'Reason', 500))]);
  return { status: body.status };
}

/** Skips a period not yet held, with a reason; it is then never generated. */
export async function skipPeriod(db: D1Database, actor: Actor, ruleId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const rule = await ruleFor(db, ruleId), start = date(body.periodStart, 'Period start'), reason = text(body.reason, 'Why this period is skipped', 500);
  insist(aligned(rule, start), `${start} is not one of this rule's periods`);
  insist(!await stmt(db, 'SELECT 1 FROM b_rule_periods WHERE rule_id=? AND period_start=?', rule.id, start).first(), 'This period is already held by the rule', 409);
  await atomic(db, actor, [stmt(db, "INSERT INTO b_rule_periods(rule_id,period_start,kind,note,by_email,at) VALUES(?,?,'skipped',?,?,?)", rule.id, start, reason, actor.email, now()),
    audit(db, actor, 'rule.skipped', rule.id, `${start}: ${reason}`)]);
  return { skipped: start };
}

/** Attaches an existing job (made by hand, in bulk or by a migration) as the rule's period. */
export async function claimJob(db: D1Database, actor: Actor, ruleId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const rule = await ruleFor(db, ruleId);
  const j = await stmt(db, 'SELECT * FROM b_jobs WHERE id=?', text(body.jobId, 'Job')).first<Data>();
  insist(j && j.client_id === rule.client_id && j.template_id === rule.template_id, "Claim a job of this rule's client and template", 404);
  insist(aligned(rule, j.period_start), `${j.period_label} is not one of this rule's periods`);
  insist(!await stmt(db, 'SELECT 1 FROM b_rule_periods WHERE (rule_id=? AND period_start=?) OR job_id=?', rule.id, j.period_start, j.id).first(), 'This period is already held by the rule', 409);
  await atomic(db, actor, [stmt(db, "INSERT INTO b_rule_periods(rule_id,period_start,kind,job_id,by_email,at) VALUES(?,?,'claimed',?,?,?)", rule.id, j.period_start, j.id, actor.email, now()),
    audit(db, actor, 'rule.claimed', rule.id, `${j.period_label}: ${j.id}`)]);
  return { claimed: j.id };
}

/**
 * One scheduler run as of `at` (UTC date): for each active rule, every period
 * through its creation horizon that is not yet held is claimed (a job already
 * exists) or created, in order. Rules whose people can no longer do the work
 * are held and listed in the run, never assigned to someone else.
 */
export async function runRules(env: Bindings, at: Date, trigger: 'cron' | 'manual') {
  const db = runtimeBindings(env).DB, today = day(at);
  const list = await rows(db, "SELECT r.*,t.recurrence FROM b_recurrence_rules r JOIN b_templates t ON t.id=r.template_id JOIN b_clients c ON c.id=r.client_id WHERE r.status='active' AND c.lifecycle='active' AND c.merged_into IS NULL");
  let created = 0, claimed = 0;
  const held: string[] = [], made: string[] = [];
  for (const rule of list) {
    const template = await stmt(db, 'SELECT * FROM b_templates WHERE id=?', rule.template_id).first<Data>();
    const taken = new Set((await rows(db, 'SELECT period_start FROM b_rule_periods WHERE rule_id=?', rule.id)).map(r => r.period_start));
    const due = periods(rule, rule.recurrence, addMonths(today, rule.lead_months)).filter(p => !taken.has(p)).slice(0, MAX_PER_RUN);
    if (!due.length) continue;
    const people = await Promise.all([eligible(db, rule.preparer_email, ['preparer', 'reviewer']), eligible(db, rule.reviewer_email, ['reviewer']), !rule.manager_email || eligible(db, rule.manager_email, ['reviewer'])]);
    for (const start of due) {
      const existing = await stmt(db, 'SELECT id FROM b_jobs WHERE client_id=? AND template_id=? AND period_start=?', rule.client_id, rule.template_id, start).first<Data>();
      const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_recurrence_rules WHERE id=? AND revision=? AND status='active') AND NOT EXISTS(SELECT 1 FROM b_rule_periods WHERE rule_id=? AND period_start=?)", rule.id, rule.revision, rule.id, start);
      const who = 'Blotter scheduler';
      const log = (action: string, detail: string) => stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), `${who} (rule approved by ${rule.approved_by})`, action, rule.id, detail, now());
      try {
        if (existing) {
          if (await stmt(db, 'SELECT 1 FROM b_rule_periods WHERE job_id=?', existing.id).first()) continue;
          await db.batch([check, stmt(db, "INSERT INTO b_rule_periods(rule_id,period_start,kind,job_id,by_email,at) VALUES(?,?,'claimed',?,?,?)", rule.id, start, existing.id, who, now()), release, log('rule.claimed', `${start}: ${existing.id}`)]);
          claimed++;
          continue;
        }
        if (!people.every(Boolean)) { held.push(`${rule.id} ${start}: an assigned person can no longer do this work`); break; }
        const jobId = id(), actor: Actor = { id: '', email: rule.approved_by, name: '', role: 'owner', channel: 'person' };
        const values = { id: jobId, clientId: rule.client_id, periodStart: start, dueDate: dueFor(start, rule.recurrence, rule.due_days), dueNote: rule.due_note,
          preparer: rule.preparer_email, reviewer: rule.reviewer_email, manager: rule.manager_email };
        await db.batch([check, ...createStatements(db, actor, template!, values),
          stmt(db, 'UPDATE b_jobs SET budget_minutes=? WHERE id=?', rule.budget_minutes, jobId),
          stmt(db, "INSERT INTO b_rule_periods(rule_id,period_start,kind,job_id,by_email,at) VALUES(?,?,'generated',?,?,?)", rule.id, start, jobId, who, now()), release,
          log('rule.generated', `${start}: ${jobId}`)]);
        created++; made.push(jobId);
      } catch (error) {
        // Another run took this period first (guard or unique key); nothing was written.
        if (!/b_guard|UNIQUE|constraint/i.test(String(error))) throw error;
      }
    }
  }
  await stmt(db, 'INSERT INTO b_scheduler_runs(id,trigger,as_of,created,claimed,held,finished_at) VALUES(?,?,?,?,?,?,?)', id(), trigger, today, created, claimed, JSON.stringify(held), now()).run();
  await advance(env, made);
  return { asOf: today, created, claimed, held };
}

/** Run now: a principal or reviewer runs the scheduler at once. */
export async function runNow(env: Bindings, actor: Actor) {
  human(actor); need(actor, 'owner', 'reviewer');
  return runRules(env, new Date(), 'manual');
}
