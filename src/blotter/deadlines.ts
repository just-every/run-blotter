// Sourced US deadlines (DUE-004) and the wider catalog with firm-defined rules
// (DUE-003). The principal approves catalog rules, defines firm rules and
// approves imported source revisions after previewing the jobs they move; a
// client obligation names one approved rule, and a job started from it carries
// the calculated statutory, original, extended, relief and internal dates
// apart from any override. Filing is never inferred: only a recorded agency
// acknowledgment with its file marks a return filed.
import { addDays, businessDayOnOrBefore, nextBusinessDay, statutoryDate, type DueSpec } from './deadline-calendar';
import { CATALOG, type Entity, type Frequency, type Rule } from './deadline-catalog';
import { readableClient } from './client-contacts';
import { atomic, audit, date, digest, Fault, human, id, insist, integer, need, now, optional, readableJob, rows, stmt, text, type Actor, type Data } from './model';

const FREQUENCIES: Frequency[] = ['monthly', 'quarterly', 'annual'];
const MONTHS: Record<Frequency, number> = { monthly: 1, quarterly: 3, annual: 12 };
const STATE = /^[A-Z]{2}$/;
type Relief = { id: string; title: string; jurisdiction: string; states: string[]; ruleKeys: string[]; from: string; to: string; postponedTo: string; sourceUrl: string };

const parse = (row: Data): Rule => ({ ...JSON.parse(row.definition), version: row.version, effective: row.effective, source: { url: row.source_url, title: row.source_title } });
async function approvedRules(db: D1Database) { return new Map((await rows(db, 'SELECT * FROM b_deadline_rules')).map(r => [r.key as string, { rule: parse(r), row: r }])); }
async function reliefs(db: D1Database): Promise<Relief[]> {
  return (await rows(db, 'SELECT * FROM b_deadline_relief')).map(r => ({ id: r.id, title: r.title, jurisdiction: r.jurisdiction, states: JSON.parse(r.states), ruleKeys: JSON.parse(r.rule_keys), from: r.from_date, to: r.to_date, postponedTo: r.postponed_to, sourceUrl: r.source_url }));
}
const federal = (rule: Rule) => rule.jurisdiction === 'US';
const pad = (n: number) => String(n).padStart(2, '0');
function periodEnd(start: string, frequency: Frequency) {
  const [y, m] = start.split('-').map(Number), t = new Date(Date.UTC(y, m - 1 + MONTHS[frequency], 0));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
/** The first day of the tax year containing `start` for a year ending in `fyEnd`. */
function yearStart(start: string, fyEnd: number) {
  const [y, m] = start.split('-').map(Number), first = fyEnd % 12 + 1;
  return `${m >= first ? y : y - 1}-${pad(first)}-01`;
}

/** Every date for one period of one obligation; `extended` says whether an extension applies. */
export function calculate(rule: Rule, obligation: Data, periodStart: string, all: Relief[], extended: boolean) {
  insist(periodStart.endsWith('-01'), 'A deadline period starts on the first day of a month');
  const end = periodEnd(periodStart, rule.frequency), fyEnd = rule.calendarYear ? 12 : obligation.fiscal_year_end, ys = yearStart(periodStart, fyEnd);
  const month = Number(periodStart.slice(5, 7));
  if (rule.frequency === 'annual') insist(Number(end.slice(5, 7)) === fyEnd, `${rule.form} covers a tax year ending in month ${fyEnd}; start the period on ${ys}`);
  if (rule.frequency === 'quarterly') insist((month - Number(ys.slice(5, 7)) + 12) % 3 === 0, `${rule.form} periods are the quarters of the tax year starting ${ys}`);
  const fiscal = rule.fiscal?.find(f => f.endMonth === fyEnd && ys < f.startsBefore);
  const due: DueSpec = fiscal?.due ?? rule.due, extension = rule.extension ? fiscal?.extension ?? rule.extension.due : null;
  const statutory = statutoryDate(due, periodStart, end, ys), original = nextBusinessDay(statutory, federal(rule));
  const extensionDue = extension ? nextBusinessDay(statutoryDate(extension, periodStart, end, ys), federal(rule)).date : null;
  const external = (extended || rule.extension?.automatic) && extensionDue ? extensionDue : original.date;
  const relief = all.find(r => r.jurisdiction === rule.jurisdiction && r.states.includes(obligation.state) && (!r.ruleKeys.length || r.ruleKeys.includes(rule.key)) && external >= r.from && external <= r.to);
  const target = relief?.postponedTo ?? external;
  return {
    periodEnd: end, statutory, original: original.date, shiftNote: original.note, extensionForm: rule.extension?.form ?? null, extensionDue,
    extensionAutomatic: !!rule.extension?.automatic, reliefId: relief?.id ?? null, reliefDue: relief?.postponedTo ?? null, reliefTitle: relief?.title ?? null,
    internal: businessDayOnOrBefore(addDays(target, -obligation.internal_days), federal(rule)), external: target,
    source: rule.source, version: rule.version, kind: rule.jurisdiction === 'Firm' ? 'firm' : 'agency',
  };
}
type Calc = ReturnType<typeof calculate>;
const note = (rule: Rule, c: Calc) => c.kind === 'firm' ? `Firm-defined deadline: ${rule.title}` : `${rule.source.title} (${rule.form}, rule ${rule.key} v${rule.version})`.slice(0, 300);

export async function deadlineState(db: D1Database, actor: Actor) {
  human(actor);
  const approved = await approvedRules(db);
  return {
    catalog: CATALOG.map(c => ({ ...(approved.get(c.key)?.rule ?? c), approved: approved.has(c.key), approvedBy: approved.get(c.key)?.row.approved_by ?? null, approvedAt: approved.get(c.key)?.row.approved_at ?? null })),
    firmRules: [...approved.values()].filter(a => a.row.kind === 'firm').map(a => ({ ...a.rule, approvedBy: a.row.approved_by, approvedAt: a.row.approved_at })),
    revisions: await rows(db, 'SELECT id,version,effective,source_url,source_title,affected_jobs,approved_by,approved_at FROM b_deadline_revisions ORDER BY approved_at'),
    relief: await reliefs(db),
  };
}

/** Until an admin role exists the principal approves catalog rules for the firm. */
export async function approveRule(db: D1Database, actor: Actor, key: string) {
  human(actor); need(actor, 'owner');
  const rule = CATALOG.find(c => c.key === key);
  insist(rule, 'No catalog rule has that key', 404);
  insist(!(await approvedRules(db)).has(key), 'This rule is already approved', 409);
  const { source, version, effective, ...definition } = rule;
  await atomic(db, actor, [stmt(db, "INSERT INTO b_deadline_rules(key,kind,definition,version,effective,source_url,source_title,approved_by,approved_at) VALUES(?,'agency',?,?,?,?,?,?,?)",
    key, JSON.stringify(definition), version, effective, source.url, source.title, actor.email, now()), audit(db, actor, 'deadline.rule_approved', key, `${rule.form} ${rule.jurisdiction} v${version} from ${source.url}`)]);
  return deadlineState(db, actor);
}

function firmSpec(body: Data): DueSpec {
  switch (body.type) {
    case 'fixed': return { type: 'fixed', month: integer(body.month, 'Month', 1, 12), day: integer(body.day, 'Day', 1, 31) };
    case 'days-after-period-end': return { type: 'days-after-period-end', days: integer(body.days, 'Days after the period ends', 0, 366) };
    case 'nth-weekday': return { type: 'nth-weekday', n: integer(body.n, 'Which weekday of the month (1-5, or -1 for the last)', -1, 5), weekday: integer(body.weekday, 'Weekday (0 Sunday to 6 Saturday)', 0, 6), months: integer(body.months ?? 1, 'Months after the period ends', 0, 12) };
    default: throw new Fault('Choose a fixed date, days after period end or the nth weekday of a month');
  }
}
/** A firm's own obligation: a fixed date, N days after period end or the nth weekday of a month; labeled firm-defined, never an agency deadline. */
export async function defineFirmRule(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  insist(['fixed', 'days-after-period-end', 'nth-weekday'].includes(body.type), 'Choose a fixed date, days after period end or the nth weekday of a month');
  insist(FREQUENCIES.includes(body.frequency), 'Choose monthly, quarterly or annual');
  const due = firmSpec(body);
  insist(due.type !== 'nth-weekday' || due.n !== 0, 'Choose which weekday of the month');
  const key = 'firm-' + id().slice(0, 8), title = text(body.name, 'Rule name', 120), label = optional(body.source, 'Source or label', 300) || 'Firm-defined';
  const definition = { key, form: title, title, jurisdiction: 'Firm', entities: ['individual', 'business', 'trust'] as Entity[], frequency: body.frequency as Frequency, due };
  await atomic(db, actor, [stmt(db, "INSERT INTO b_deadline_rules(key,kind,definition,version,effective,source_url,source_title,approved_by,approved_at) VALUES(?,'firm',?,'firm',?,'',?,?,?)",
    key, JSON.stringify(definition), now().slice(0, 10), label, actor.email, now()), audit(db, actor, 'deadline.firm_rule_defined', key, `${title}: ${JSON.stringify(due)} (${label})`)]);
  return { key, ...(await deadlineState(db, actor)) };
}

export async function obligations(db: D1Database, actor: Actor, clientId: string) {
  human(actor);
  await readableClient(db, actor, clientId);
  const approved = await approvedRules(db);
  return { obligations: (await rows(db, 'SELECT * FROM b_client_obligations WHERE client_id=? ORDER BY created_at', clientId)).map(o => ({ ...o, rule: approved.get(o.rule_key)?.rule })) };
}
/** Configure an approved rule for a client, with their state, fiscal year end and internal lead days. */
export async function addObligation(db: D1Database, actor: Actor, clientId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const client = await stmt(db, "SELECT * FROM b_clients WHERE id=? AND merged_into IS NULL AND lifecycle='active'", clientId).first<Data>();
  insist(client, 'Client not found', 404);
  const found = (await approvedRules(db)).get(text(body.ruleKey, 'Deadline rule'));
  insist(found, 'The firm has not approved that deadline rule', 409);
  const rule = found.rule, state = text(body.state, 'State', 2).toUpperCase();
  insist(STATE.test(state), 'State: use the two-letter postal code');
  insist(['US', 'Firm'].includes(rule.jurisdiction) || rule.jurisdiction === state, `${rule.form} is a ${rule.jurisdiction} obligation`);
  insist(rule.entities.includes(client.entity_type), `${rule.form} does not apply to ${client.entity_type} clients`);
  const fiscal = rule.calendarYear ? 12 : integer(body.fiscalYearEnd ?? 12, 'Fiscal year end month', 1, 12);
  const row = { id: id(), internal: integer(body.internalDays ?? 0, 'Internal lead days', 0, 90) };
  await atomic(db, actor, [stmt(db, 'INSERT INTO b_client_obligations(id,client_id,rule_key,state,fiscal_year_end,internal_days,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',
    row.id, clientId, rule.key, state, fiscal, row.internal, actor.email, now()), audit(db, actor, 'deadline.obligation_added', clientId, `${rule.form} (${rule.key}) for ${state}, year ending month ${fiscal}`)]);
  return { id: row.id, ...(await obligations(db, actor, clientId)) };
}

async function obligationRule(db: D1Database, obligationId: string) {
  const obligation = await stmt(db, 'SELECT * FROM b_client_obligations WHERE id=?', obligationId).first<Data>();
  insist(obligation, 'Obligation not found', 404);
  const found = (await approvedRules(db)).get(obligation.rule_key);
  insist(found, 'The firm has not approved that deadline rule', 409);
  return { obligation, rule: found.rule };
}
export async function previewDates(db: D1Database, actor: Actor, body: Data) {
  human(actor);
  const { obligation, rule } = await obligationRule(db, text(body.obligationId, 'Obligation'));
  await readableClient(db, actor, obligation.client_id);
  return calculate(rule, obligation, date(body.periodStart, 'Period start'), await reliefs(db), false);
}

/** The due date and job-deadline row for a job started from an obligation (used by startJob and rollForward). */
export async function jobDeadline(db: D1Database, clientId: string, obligationId: string, periodStart: string, frequency: string) {
  const { obligation, rule } = await obligationRule(db, obligationId);
  insist(obligation.client_id === clientId, 'That obligation belongs to another client', 409);
  insist(rule.frequency === frequency, `${rule.form} is ${rule.frequency}; choose a ${rule.frequency} template`);
  const c = calculate(rule, obligation, periodStart, await reliefs(db), false);
  return {
    dueDate: c.external, dueNote: note(rule, c),
    statement: (jobId: string) => stmt(db, `INSERT INTO b_job_deadlines(job_id,obligation_id,rule_key,rule_version,source_url,source_title,period_end,statutory_due,original_due,shift_note,extension_form,extension_due,extension_automatic,relief_id,relief_due,internal_due)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, jobId, obligation.id, rule.key, rule.version, rule.source.url, rule.source.title, c.periodEnd, c.statutory, c.original, c.shiftNote,
      c.extensionForm, c.extensionDue, c.extensionAutomatic ? 1 : 0, c.reliefId, c.reliefDue, c.internal),
  };
}

/** Each period's calculated working due date for a recurrence rule that names an obligation (WORK-010). */
export async function obligationDue(db: D1Database, obligationId: string) {
  const { obligation, rule } = await obligationRule(db, obligationId), all = await reliefs(db);
  return (periodStart: string) => calculate(rule, obligation, periodStart, all, false).external;
}

export async function deadlineFor(db: D1Database, jobId: string) {
  const d = await stmt(db, `SELECT d.*,f.name filing_file_name,r.title relief_title,(SELECT kind FROM b_deadline_rules WHERE key=d.rule_key) kind FROM b_job_deadlines d
    LEFT JOIN b_files f ON f.id=d.filing_file_id LEFT JOIN b_deadline_relief r ON r.id=d.relief_id WHERE d.job_id=?`, jobId).first<Data>();
  if (!d) return null;
  return { ...d, extended: !!d.extension_recorded_at || !!d.extension_automatic, filing: d.filing_recorded_at ? 'acknowledged by the agency (practitioner-recorded)' : 'no filing evidence recorded' };
}
async function deadlineJob(db: D1Database, actor: Actor, jobId: string) {
  const j = await readableJob(db, actor, jobId);
  insist(j.access === 'full', 'Job not found', 404);
  const d = await stmt(db, 'SELECT * FROM b_job_deadlines WHERE job_id=?', jobId).first<Data>();
  insist(d, 'This job has no calculated deadline', 404);
  return { j, d };
}
async function recalc(db: D1Database, d: Data, extended: boolean, extra: { rules?: Map<string, Rule>; relief?: Relief[] } = {}) {
  const { obligation, rule: current } = await obligationRule(db, d.obligation_id);
  const rule = extra.rules?.get(d.rule_key) ?? current;
  const start = await stmt(db, 'SELECT period_start FROM b_jobs WHERE id=?', d.job_id).first<string>('period_start');
  return { rule, c: calculate(rule, obligation, start!, extra.relief ?? await reliefs(db), extended) };
}
function update(db: D1Database, jobId: string, rule: Rule, c: Calc, workingDue: string | null) {
  return [stmt(db, `UPDATE b_job_deadlines SET rule_version=?,source_url=?,source_title=?,statutory_due=?,original_due=?,shift_note=?,extension_due=?,relief_id=?,relief_due=?,internal_due=? WHERE job_id=?`,
    rule.version, rule.source.url, rule.source.title, c.statutory, c.original, c.shiftNote, c.extensionDue, c.reliefId, c.reliefDue, c.internal, jobId),
  ...(workingDue ? [stmt(db, 'UPDATE b_jobs SET due_date=?,due_note=?,revision=? WHERE id=?', workingDue, note(rule, c), id(), jobId)] : [])];
}

/** Record that the extension was requested; the job's people do this, and the job then stays open until filing evidence is recorded. */
export async function recordExtension(db: D1Database, actor: Actor, jobId: string) {
  human(actor);
  const { j, d } = await deadlineJob(db, actor, jobId);
  insist(j.status !== 'signed_off', 'This job is signed off', 409);
  insist(d.extension_form && !d.extension_automatic, 'This obligation has no extension to request', 409);
  insist(!d.extension_recorded_at, 'The extension is already recorded', 409);
  const { rule, c } = await recalc(db, d, true), moved = !!d.override_due || j.due_date !== (d.relief_due ?? d.original_due);
  await atomic(db, actor, [stmt(db, 'UPDATE b_job_deadlines SET extension_recorded_by=?,extension_recorded_at=? WHERE job_id=? AND extension_recorded_at IS NULL', actor.email, now(), jobId),
    ...update(db, jobId, rule, c, moved ? null : c.external), audit(db, actor, 'deadline.extension_recorded', jobId, `Form ${d.extension_form}: due ${c.extensionDue}${c.reliefDue ? `, postponed to ${c.reliefDue}` : ''}`)]);
  return deadlineFor(db, jobId);
}
/** A principal or reviewer moves the working due date with a reason; calculated dates stay as they are. */
export async function overrideDeadline(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const { j } = await deadlineJob(db, actor, jobId);
  insist(j.status !== 'signed_off', 'This job is signed off', 409);
  const due = date(body.date, 'Override date'), reason = text(body.reason, 'Reason for the override', 300);
  await atomic(db, actor, [stmt(db, 'UPDATE b_job_deadlines SET override_due=?,override_reason=?,override_by=?,override_at=? WHERE job_id=?', due, reason, actor.email, now(), jobId),
    stmt(db, 'UPDATE b_jobs SET due_date=?,due_note=?,revision=? WHERE id=?', due, `Override: ${reason}`.slice(0, 300), id(), jobId), audit(db, actor, 'deadline.overridden', jobId, `${due}: ${reason}`)]);
  return deadlineFor(db, jobId);
}
/** The agency's acknowledgment, with its file on this job, is the only filing evidence. */
export async function recordFiling(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const { d } = await deadlineJob(db, actor, jobId);
  insist(!d.filing_recorded_at, 'Filing evidence is already recorded', 409);
  const file = await stmt(db, 'SELECT id,name FROM b_files WHERE id=? AND job_id=? AND erased_at IS NULL', text(body.fileId, 'Acknowledgment file'), jobId).first<Data>();
  insist(file, 'Attach the acknowledgment file to this job first', 404);
  const submission = text(body.submissionId, 'Submission ID', 60), accepted = date(body.acceptedOn, 'Accepted on');
  await atomic(db, actor, [stmt(db, 'UPDATE b_job_deadlines SET filing_submission_id=?,filing_file_id=?,filing_accepted_on=?,filing_recorded_by=?,filing_recorded_at=? WHERE job_id=? AND filing_recorded_at IS NULL',
    submission, file.id, accepted, actor.email, now(), jobId), audit(db, actor, 'deadline.filing_recorded', jobId, `${submission} accepted ${accepted} (${file.name})`)]);
  return deadlineFor(db, jobId);
}

function revisionRule(value: Data, base: Rule | undefined, version: string, effective: string): Rule {
  insist(base, `Revision rule ${value?.key} is not in the catalog`);
  const source = { url: text(value.source?.url, 'Rule source URL', 300), title: text(value.source?.title, 'Rule source title', 200) };
  insist(/^https:\/\//.test(source.url), 'Rule source URL must be https');
  const merged = { ...base, ...value, key: base.key, jurisdiction: base.jurisdiction, version, effective, source } as Rule;
  insist(merged.due && FREQUENCIES.includes(merged.frequency), `Revision rule ${base.key} needs a due rule and frequency`);
  return merged;
}
/** Parse an imported IRS or state calendar revision: its version, effective date, source and changed rules or relief. */
async function readRevision(db: D1Database, body: Data) {
  const doc = body.revision;
  insist(doc && typeof doc === 'object', 'Supply the source revision');
  const version = text(doc.version, 'Revision version', 40), effective = date(doc.effective, 'Effective date');
  const source = { url: text(doc.source?.url, 'Revision source URL', 300), title: text(doc.source?.title, 'Revision source title', 200) };
  insist(/^https:\/\//.test(source.url), 'Revision source URL must be https');
  insist(!(await stmt(db, 'SELECT 1 FROM b_deadline_revisions WHERE version=?', version).first()), 'This revision is already imported', 409);
  const approved = await approvedRules(db);
  const changed = new Map(((doc.rules ?? []) as Data[]).map(v => { const key = text(v?.key, 'Rule key', 60); return [key, revisionRule(v, approved.get(key)?.rule ?? CATALOG.find(c => c.key === key), version, effective)]; }));
  const relief: Relief[] = ((doc.relief ?? []) as Data[]).map(r => ({
    id: id(), title: text(r.title, 'Relief title', 200), jurisdiction: text(r.jurisdiction, 'Relief jurisdiction', 4).toUpperCase(),
    states: (Array.isArray(r.states) ? r.states : []).map((s: unknown) => { const v = text(s, 'Relief state', 2).toUpperCase(); insist(STATE.test(v), 'Relief state: two-letter postal code'); return v; }),
    ruleKeys: (Array.isArray(r.rules) ? r.rules : []).map((k: unknown) => text(k, 'Relief rule', 60)), from: date(r.from, 'Relief from'), to: date(r.to, 'Relief to'),
    postponedTo: date(r.postponedTo, 'Postponed to'), sourceUrl: text(r.source?.url ?? source.url, 'Relief source URL', 300),
  }));
  for (const r of relief) insist(r.states.length && r.from <= r.to && r.postponedTo > r.from, `Relief "${r.title}" needs states and a window ending before its postponed date`);
  insist(changed.size || relief.length, 'The revision changes no rule and grants no relief');
  return { doc, version, effective, source, changed, relief, approved };
}
async function revisionPlan(db: D1Database, body: Data) {
  const rev = await readRevision(db, body), all = [...await reliefs(db), ...rev.relief];
  const open = await rows(db, `SELECT d.*,j.due_date,j.status,j.title,j.period_label,c.name client_name FROM b_job_deadlines d JOIN b_jobs j ON j.id=d.job_id JOIN b_clients c ON c.id=j.client_id
    WHERE j.status<>'signed_off' ORDER BY j.due_date,j.id`);
  const lines = [];
  for (const d of open) {
    const { rule, c } = await recalc(db, d, !!d.extension_recorded_at, { rules: rev.changed, relief: all });
    const before = d.relief_due ?? (d.extension_recorded_at || d.extension_automatic ? d.extension_due : d.original_due);
    if (rule.version === d.rule_version && c.external === before && c.internal === d.internal_due && c.original === d.original_due) continue;
    // A job whose working date was moved by hand keeps it; only its calculated dates change.
    const moved = !!d.override_due || d.due_date !== before;
    lines.push({ jobId: d.job_id, client: d.client_name, job: `${d.title} ${d.period_label}`, rule: d.rule_key, fromVersion: d.rule_version, toVersion: rule.version,
      original: [d.original_due, c.original], external: [before, c.external], internal: [d.internal_due, c.internal], relief: c.reliefTitle, workingDue: moved ? d.due_date : c.external, keepsWorkingDate: moved });
  }
  const summary = { version: rev.version, effective: rev.effective, source: rev.source, rules: [...rev.changed.values()].map(r => ({ key: r.key, form: r.form, approvedBefore: rev.approved.has(r.key) })), relief: rev.relief.map(({ id: _, ...r }) => r), lines };
  return { rev, summary, fingerprint: await digest(JSON.stringify(summary)) };
}
export async function previewRevision(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const { summary, fingerprint } = await revisionPlan(db, body);
  return { ...summary, fingerprint };
}
/** Approving the previewed revision approves its rules, records its relief and recalculates the open jobs it moves. */
export async function approveRevision(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const { rev, summary, fingerprint } = await revisionPlan(db, body);
  insist(body.fingerprint === fingerprint, 'The revision or its affected jobs changed since the preview. Preview again before approving.', 409);
  const revisionId = id(), at = now(), all = [...await reliefs(db), ...rev.relief];
  const statements = [
    stmt(db, 'INSERT INTO b_deadline_revisions(id,version,effective,source_url,source_title,document,affected_jobs,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?,?)',
      revisionId, rev.version, rev.effective, rev.source.url, rev.source.title, JSON.stringify(rev.doc), summary.lines.length, actor.email, at),
    ...[...rev.changed.values()].map(({ source, version, effective, ...definition }) => stmt(db, `INSERT INTO b_deadline_rules(key,kind,definition,version,effective,source_url,source_title,revision_id,approved_by,approved_at) VALUES(?,'agency',?,?,?,?,?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET definition=excluded.definition,version=excluded.version,effective=excluded.effective,source_url=excluded.source_url,source_title=excluded.source_title,revision_id=excluded.revision_id,approved_by=excluded.approved_by,approved_at=excluded.approved_at`,
      definition.key, JSON.stringify(definition), version, effective, source.url, source.title, revisionId, actor.email, at)),
    ...rev.relief.map(r => stmt(db, 'INSERT INTO b_deadline_relief(id,revision_id,title,jurisdiction,states,rule_keys,from_date,to_date,postponed_to,source_url) VALUES(?,?,?,?,?,?,?,?,?,?)',
      r.id, revisionId, r.title, r.jurisdiction, JSON.stringify(r.states), JSON.stringify(r.ruleKeys), r.from, r.to, r.postponedTo, r.sourceUrl)),
    audit(db, actor, 'deadline.revision_approved', revisionId, `${rev.version} effective ${rev.effective} from ${rev.source.url}: ${summary.lines.length} jobs recalculated`),
  ];
  for (const line of summary.lines) {
    const d = await stmt(db, 'SELECT * FROM b_job_deadlines WHERE job_id=?', line.jobId).first<Data>();
    const { rule, c } = await recalc(db, d!, !!d!.extension_recorded_at, { rules: rev.changed, relief: all });
    statements.push(...update(db, line.jobId, rule, c, line.keepsWorkingDate ? null : c.external), audit(db, actor, 'deadline.recalculated', line.jobId, `${rev.version}: ${line.external[0]} → ${c.external}`));
  }
  await atomic(db, actor, statements);
  return { revisionId, recalculated: summary.lines.length, ...(await deadlineState(db, actor)) };
}
