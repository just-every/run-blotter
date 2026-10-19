// Capacity forecasts and hiring plans (CAPACITY-003). Future demand comes from
// the periods of active, approved recurring rules (WORK-002) that fall due in
// the forecast weeks. Each period's time is traced to its source: the client's
// prior actuals for that work (recorded time on signed-off jobs of the same
// client and template, preferring periods in the same calendar month, which is
// how seasonality enters), else the rule's budget, the work type's budget or
// the template's task estimates. A scenario adds hypothetical hires, changes
// someone's hours, drops lost clients or scales a service, and is compared
// with the baseline; neither forecasting nor saving a scenario changes live work.
import { DEFAULT_WEEKLY, shift, weekOf } from './capacity';
import { dueFor, periods } from './recurrence';
import { periodLabel } from './jobs';
import { pipeline } from './prospects';
import { atomic, audit, date, email, human, id, insist, integer, need, now, rows, stmt, text, type Actor, type Data } from './model';

type Range = { point: number; low: number; high: number };
type Line = Data & Range & { client: string; skill: string; weekStart: string; samples: Data[]; reason: string | null };
type Changes = { hires: Data[]; staffing: Data[]; lostClients: string[]; services: Data[] };

const monday = (day: string) => shift(day, -((new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7));
const zero = (): Range => ({ point: 0, low: 0, high: 0 });
const add = (a: Range, b: Range) => { a.point += b.point; a.low += b.low; a.high += b.high; };

export const ASSUMPTIONS = [
  'Recurring work is the periods of active, approved recurring rules that fall due in each week; paused rules, skipped periods and periods already signed off are left out, and one-off jobs are not forecast.',
  'A period’s time is the mean of its client’s prior actuals for the same template: recorded time on signed-off jobs of earlier periods, using only periods in the same calendar month when there are any (seasonality). Its range runs from 90% of the smallest to 110% of the largest prior actual.',
  'Without prior actuals a period uses the rule’s time budget, else the work type’s budget, else the template’s task estimates, with a range from 50% to 150% of that figure, and its client is named as the reason.',
  'Capacity is each person’s weekly hours less scheduled leave and commitments on that week’s weekdays (CAPACITY-001); a person counts in full under each of their skills. Demand counts under the skill named like its work type.',
  'Confidence: high when every period due that week rests on at least three prior actuals, medium when each rests on at least one, low when any rests on none (each such client is named).',
  'Open prospects appear as unestimated pipeline demand in the baseline and every scenario, with their current stage, requested services, lead source and estimated annual fee for the whole prospect. Won and lost prospects are excluded. Fees are not converted to time; pipeline has no scheduled week or time budget and is excluded from weekly hours and confidence until work is budgeted and scheduled.',
];

/** A scenario's changes, checked against the firm's clients, people and work types. */
async function changesFrom(db: D1Database, raw: unknown): Promise<Changes> {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Data, list = (value: unknown, label: string) => { insist(value === undefined || (Array.isArray(value) && value.length <= 20), `${label}: list up to 20`); return (value ?? []) as Data[]; };
  const skills = (value: unknown, label: string) => { insist(Array.isArray(value ?? []), `${label} skills: list them`); return [...new Set(((value ?? []) as unknown[]).map((s, n) => text(s, `${label} skill ${n + 1}`, 60).toLowerCase()))]; };
  const hires = list(body.hires, 'Hires').map((h, n) => ({ name: text(h.name, `Hire ${n + 1} name`, 120), weeklyMinutes: integer(h.weeklyMinutes, `Hire ${n + 1} weekly minutes`, 0, 6000), skills: skills(h.skills, `Hire ${n + 1}`), startsOn: date(h.startsOn, `Hire ${n + 1} start`) }));
  const staffing = [];
  for (const [n, s] of list(body.staffing, 'Staffing changes').entries()) {
    const person = email(s.email, `Staffing change ${n + 1} person`);
    insist(await stmt(db, `SELECT 1 FROM b_members WHERE email=? AND active=1 UNION ALL SELECT 1 FROM oa_operators WHERE email=? AND role='owner' AND status='active'`, person, person).first(), `${person} is not an active practice member`, 404);
    staffing.push({ email: person, weeklyMinutes: integer(s.weeklyMinutes, `Staffing change ${n + 1} weekly minutes`, 0, 6000), startsOn: date(s.startsOn, `Staffing change ${n + 1} from`) });
  }
  const lostClients = [...new Set(list(body.lostClients, 'Lost clients').map((c, n) => text(c, `Lost client ${n + 1}`, 100)))];
  for (const c of lostClients) insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND merged_into IS NULL', c).first(), 'Client not found', 404);
  const services = [];
  for (const [n, s] of list(body.services, 'Service changes').entries()) {
    const type = await stmt(db, 'SELECT name FROM b_work_types WHERE lower(name)=lower(?)', text(s.workType, `Service change ${n + 1} work type`, 120)).first<Data>();
    insist(type, 'Work type not found', 404);
    services.push({ workType: type.name, percent: integer(s.percent, `Service change ${n + 1} percent of today’s time`, 0, 500) });
  }
  return { hires, staffing, lostClients, services };
}

/** Every forecast line: one rule period due in the window, with its estimate, range and sources. */
async function lines(db: D1Database, from: string, to: string): Promise<Line[]> {
  const [rules, held, history] = await Promise.all([
    rows(db, `SELECT r.*,c.name client,t.recurrence,t.steps,w.name work_type,w.budget_minutes type_budget FROM b_recurrence_rules r JOIN b_clients c ON c.id=r.client_id JOIN b_templates t ON t.id=r.template_id
      LEFT JOIN b_work_types w ON w.id='wt-'||r.template_id WHERE r.status='active' AND c.merged_into IS NULL ORDER BY c.name,w.name`),
    rows(db, `SELECT p.rule_id,p.period_start,p.kind,j.status FROM b_rule_periods p LEFT JOIN b_jobs j ON j.id=p.job_id`),
    rows(db, `SELECT j.id,j.client_id,j.template_id,j.period_start,j.period_label,SUM(t.minutes) minutes FROM b_jobs j JOIN b_time t ON t.job_id=j.id WHERE j.status='signed_off' GROUP BY j.id ORDER BY j.period_start`),
  ]);
  const out: Line[] = [];
  for (const r of rules) {
    const templateEstimate = (JSON.parse(r.steps) as unknown[]).reduce((n: number, s) => n + Number((s as Data)?.estimateMinutes ?? 0), 0);
    for (const start of periods(r, r.recurrence, to)) {
      const due = dueFor(start, r.recurrence, r.due_days);
      if (due < from || due > to) continue;
      const h = held.find(p => p.rule_id === r.id && p.period_start === start);
      if (h?.kind === 'skipped' || h?.status === 'signed_off' || history.some(j => j.client_id === r.client_id && j.template_id === r.template_id && j.period_start === start)) continue;
      const prior = history.filter(j => j.client_id === r.client_id && j.template_id === r.template_id && j.period_start < start), season = prior.filter(j => j.period_start.slice(5, 7) === start.slice(5, 7));
      const samples = (season.length ? season : prior).map(j => ({ jobId: j.id, periodLabel: j.period_label, actualMinutes: Number(j.minutes) }));
      const workType = r.work_type ?? 'Unnamed work', base = { ruleId: r.id, clientId: r.client_id, client: r.client, workType, skill: workType.toLowerCase(), periodStart: start, periodLabel: periodLabel(start, r.recurrence), due, weekStart: monday(due), samples, seasonal: season.length > 0 };
      if (samples.length) {
        const minutes = samples.map(s => s.actualMinutes);
        out.push({ ...base, basis: `mean of ${samples.length} prior actual${samples.length > 1 ? 's' : ''}${season.length ? ' in the same month' : ''}`, point: Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length),
          low: Math.floor(Math.min(...minutes) * 9 / 10), high: Math.ceil(Math.max(...minutes) * 11 / 10), reason: null });
      } else {
        const [basis, minutes] = r.budget_minutes ? ['rule time budget', Number(r.budget_minutes)] : r.type_budget ? ['work type budget', Number(r.type_budget)] : templateEstimate ? ['template task estimates', templateEstimate] : ['no estimate', 0];
        out.push({ ...base, basis, point: minutes, low: Math.round(minutes / 2), high: Math.round(minutes * 3 / 2), reason: `${r.client} has no prior actuals for ${workType}${minutes ? '' : ' and no budget or estimate'}` });
      }
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due) || a.client.localeCompare(b.client));
}

/** Weekly demand ranges, capacity and confidence, overall and by skill, under one set of changes. */
function project(all: Line[], people: Data[], blocks: Data[], weekStarts: string[], changes: Changes | null, pipelineLines: Data[]) {
  const lost = new Set(changes?.lostClients ?? []), scale = new Map((changes?.services ?? []).map(s => [s.workType.toLowerCase(), s.percent]));
  const removed = all.filter(l => lost.has(l.clientId)).map(l => ({ client: l.client, workType: l.workType, periodLabel: l.periodLabel, due: l.due, reason: 'lost client' }));
  const kept = all.filter(l => !lost.has(l.clientId)).map(l => {
    const percent = scale.get(l.skill);
    return percent === undefined ? l : { ...l, point: Math.round(l.point * percent / 100), low: Math.round(l.low * percent / 100), high: Math.round(l.high * percent / 100), basis: `${l.basis}, at ${percent}% for the service change` };
  });
  const staff: Data[] = [...people.map(p => ({ ...p, hypothetical: false, startsOn: '' })), ...(changes?.hires ?? []).map(h => ({ email: '', name: h.name, weekly: h.weeklyMinutes, skills: h.skills, hypothetical: true, startsOn: h.startsOn }))];
  const weeks = weekStarts.map(weekStart => {
    const weekEnd = shift(weekStart, 6), due = kept.filter(l => l.weekStart === weekStart), demand = zero();
    due.forEach(l => add(demand, l));
    const available: Data[] = staff.filter(p => !p.hypothetical || p.startsOn <= weekEnd).map(p => {
      const change = (changes?.staffing ?? []).filter(s => s.email === p.email && s.startsOn <= weekEnd).at(-1);
      return { ...p, minutes: weekOf(change ? change.weeklyMinutes : p.weekly, p.hypothetical ? [] : blocks.filter(b => b.email === p.email), weekStart).available };
    });
    const capacityMinutes = available.reduce((n, p) => n + p.minutes, 0);
    const skills = [...new Set([...due.map(l => l.skill), ...available.flatMap(p => p.skills as string[])])].sort().map(skill => {
      const d = zero(), cap = available.filter(p => (p.skills as string[]).includes(skill)).reduce((n, p) => n + p.minutes, 0);
      due.filter(l => l.skill === skill).forEach(l => add(d, l));
      return { skill, demand: d, capacityMinutes: cap, shortMinutes: Math.max(0, d.high - cap) };
    });
    const unbacked = [...new Set(due.filter(l => !l.samples.length).map(l => l.reason as string))];
    const level = !due.length ? 'no recurring work due' : unbacked.length ? 'low' : due.every(l => l.samples.length >= 3) ? 'high' : 'medium';
    return { weekStart, weekEnd, demand, capacityMinutes, shortMinutes: Math.max(0, demand.high - capacityMinutes), confidence: { level, reasons: unbacked }, skills, lines: due.map(l => `${l.ruleId}|${l.periodStart}`) };
  });
  const bySkill = new Map<string, { skill: string; demand: Range; capacityMinutes: number }>();
  for (const w of weeks) for (const s of w.skills) {
    const row = bySkill.get(s.skill) ?? { skill: s.skill, demand: zero(), capacityMinutes: 0 };
    add(row.demand, s.demand); row.capacityMinutes += s.capacityMinutes; bySkill.set(s.skill, row);
  }
  const total = zero(); weeks.forEach(w => add(total, w.demand));
  return { weeks, skills: [...bySkill.values()].map(s => ({ ...s, shortMinutes: Math.max(0, s.demand.high - s.capacityMinutes) })), demand: total, capacityMinutes: weeks.reduce((n, w) => n + w.capacityMinutes, 0), lines: kept, removed, pipeline: pipelineLines };
}

async function scenarioRow(db: D1Database, scenarioId: string) {
  const row = await stmt(db, 'SELECT * FROM b_capacity_scenarios WHERE id=?', scenarioId).first<Data>();
  insist(row, 'Scenario not found', 404);
  return { id: row.id, name: row.name, from: row.from_week, weeks: Number(row.weeks), changes: JSON.parse(row.changes) as Changes, createdBy: row.created_by, createdAt: row.created_at };
}

/** A manager forecasts the weeks from a Monday, comparing the baseline with a scenario's changes (or a saved scenario). Nothing live changes. */
export async function forecast(db: D1Database, actor: Actor, body: Data) {
  need(actor, 'owner', 'reviewer');
  const saved = body.scenarioId ? await scenarioRow(db, text(body.scenarioId, 'Scenario', 100)) : null;
  const from = saved ? saved.from : date(body.from, 'Forecast from');
  insist(new Date(from + 'T00:00:00Z').getUTCDay() === 1, 'A forecast starts on a Monday');
  const count = saved ? saved.weeks : integer(body.weeks, 'Weeks', 1, 53), to = shift(from, count * 7 - 1);
  const changes = saved ? saved.changes : body.changes ? await changesFrom(db, body.changes) : null;
  const [all, members, settings, blocks, prospects] = await Promise.all([
    lines(db, from, to),
    rows(db, `SELECT email,name,role FROM b_members WHERE active=1 UNION ALL SELECT email,display_name,'owner' FROM oa_operators WHERE role='owner' AND status='active' ORDER BY 2`),
    rows(db, 'SELECT * FROM b_capacity'),
    rows(db, 'SELECT * FROM b_capacity_blocks WHERE starts_on<=? AND ends_on>=?', to, from),
    pipeline(db, actor),
  ]);
  // CRM has no prospect work budget or scheduled start. Keep this demand visible
  // without implying a conversion probability, week or number of hours from fees.
  const pipelineLines = prospects.prospects.filter(p => p.stage_kind === 'open').flatMap(p => (p.services as string[]).map(service => ({
    prospectId: p.id, prospect: p.name, service, stageId: p.stage_id, stage: p.stage, source: p.source, ownerEmail: p.owner_email,
    estimatedAnnualFeeCents: p.created_by === 'website' && !p.fee_cents ? null : Number(p.fee_cents), currency: p.currency, feeBasis: 'estimated annual fee for the whole prospect; not allocated to this service',
    status: 'unestimated', minutes: null, weekStart: null, basis: 'requested service; no prospect work budget or scheduled start; fees are not time estimates',
  })));
  const people = members.map(m => { const s = settings.find(x => x.email === m.email); return { email: m.email, name: m.name, weekly: s ? Number(s.weekly_minutes) : DEFAULT_WEEKLY, skills: s ? JSON.parse(s.skills) as string[] : [] }; });
  const weekStarts = Array.from({ length: count }, (_, n) => shift(from, n * 7));
  return { from, to, weeks: count, assumptions: ASSUMPTIONS, scenario: saved ? { id: saved.id, name: saved.name, createdBy: saved.createdBy, createdAt: saved.createdAt } : null, changes,
    baseline: project(all, people, blocks, weekStarts, null, pipelineLines), compared: changes ? project(all, people, blocks, weekStarts, changes, pipelineLines) : null };
}

/** A manager saves a scenario (its window and changes) to reopen and compare later; live jobs, rules and capacity are untouched. */
export async function saveScenario(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const name = text(body.name, 'Scenario name', 120), from = date(body.from, 'Forecast from'), weeks = integer(body.weeks, 'Weeks', 1, 53), changes = await changesFrom(db, body.changes);
  insist(new Date(from + 'T00:00:00Z').getUTCDay() === 1, 'A forecast starts on a Monday');
  const scenarioId = id(), summary = [changes.hires.length && `${changes.hires.length} hire(s)`, changes.staffing.length && `${changes.staffing.length} hours change(s)`, changes.lostClients.length && `${changes.lostClients.length} lost client(s)`, changes.services.length && `${changes.services.length} service change(s)`].filter(Boolean).join(', ') || 'no changes';
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_capacity_scenarios(id,name,from_week,weeks,changes,created_by,created_at) VALUES(?,?,?,?,?,?,?)', scenarioId, name, from, weeks, JSON.stringify(changes), actor.email, now()),
    audit(db, actor, 'capacity.scenario_saved', scenarioId, `${name}: ${weeks} weeks from ${from}; ${summary}`)]);
  return { id: scenarioId, name };
}

export async function scenarios(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  return (await rows(db, 'SELECT * FROM b_capacity_scenarios ORDER BY created_at DESC')).map(r => ({ id: r.id, name: r.name, from: r.from_week, weeks: Number(r.weeks), changes: JSON.parse(r.changes), createdBy: r.created_by, createdAt: r.created_at }));
}
