// Reassignment and dependency-aware scheduling (CAPACITY-002). When a person
// is on leave or over capacity, a manager (a reviewer or the principal) previews
// a coverage plan for the open jobs they prepare or review that fall due from
// the first day through 14 days after the last: each job gets the eligible
// colleague with the work type as a skill, free on its due date and with the
// most capacity left that week after the plan's earlier moves (the person
// covering a job's prerequisite first, so a chain stays together). Overrides
// and new due dates are checked for eligibility, self-review, the partner rule
// and dependency order (a prerequisite never falls due after the job waiting
// for it). Approving applies every feasible line with the preview's
// fingerprint, notifies the people involved, and records work nobody can cover
// as conflicts the approving manager owns.
import { runtimeBindings, type Bindings } from '../auth.server';
import { capacity, hours } from './capacity';
import { prerequisite } from './flow';
import { eligible } from './jobs';
import { notify } from './notifications';
import { jobTasks } from './tasks';
import { atomic, audit, date, digest, email, guard, human, id, insist, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

const DAY = 86_400_000, AFTER = 14, MAX = 50;
const shift = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
const monday = (day: string) => shift(day, -((new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7));
const work = (j: Data) => `${j.client} · ${j.title} · ${j.period_label}`;

/** Dependency order: each job after the plan's jobs it waits for (WORK-003), else by due date. */
function ordered(jobs: Data[], waitsFor: Map<string, string[]>) {
  const done = new Set<string>(), out: Data[] = [], byId = new Map(jobs.map(j => [j.id, j]));
  const visit = (j: Data) => { if (done.has(j.id)) return; done.add(j.id); for (const p of waitsFor.get(j.id) ?? []) if (byId.has(p)) visit(byId.get(p)!); out.push(j); };
  for (const j of jobs) visit(j);
  return out;
}

async function coveragePlan(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const person = email(body.email, 'Person'), reason = body.reason === 'overload' ? 'overload' : 'leave';
  const startsOn = date(body.startsOn, 'From'), endsOn = date(body.endsOn, 'To');
  insist(endsOn >= startsOn && Date.parse(endsOn) - Date.parse(startsOn) <= 92 * DAY, 'To must be on or within 92 days after From');
  insist(body.choices === undefined || Array.isArray(body.choices), 'Choices: list them');
  const choices = new Map<string, Data>(((body.choices ?? []) as Data[]).map(c => [text(c?.jobId, 'Job'), c]));
  const until = shift(endsOn, AFTER);
  const jobs = await rows(db, `SELECT j.*,c.name client,w.name work_type FROM b_jobs j JOIN b_clients c ON c.id=j.client_id LEFT JOIN b_work_types w ON w.id=j.work_type_id
    WHERE ((j.status='open' AND j.preparer_email=?1) OR (j.status<>'signed_off' AND j.reviewer_email=?1)) AND j.due_date BETWEEN ?2 AND ?3 ORDER BY j.due_date,c.name`, person, startsOn, until);
  insist(jobs.length <= MAX, `More than ${MAX} jobs fall in these dates; plan a shorter period`);
  for (const jobId of choices.keys()) insist(jobs.some(j => j.id === jobId), 'A chosen job is not part of this coverage', 409);
  // What each job waits for (and when that is due), from WORK-003's job dependencies.
  const waitsFor = new Map<string, string[]>(), prereqDue = new Map<string, Data[]>();
  for (const j of jobs) {
    const templates = (await rows(db, 'SELECT DISTINCT after_template FROM b_job_steps WHERE job_id=? AND after_template IS NOT NULL AND done_at IS NULL', j.id)).map(r => r.after_template);
    const found: Data[] = [];
    for (const t of templates) { const p = await prerequisite(db, j, t); if (p.job) found.push({ ...p.job, ...await stmt(db, 'SELECT due_date,title,period_label FROM b_jobs WHERE id=?', p.job.id).first<Data>() }); }
    waitsFor.set(j.id, found.map(p => p.id)); prereqDue.set(j.id, found);
  }
  const people = await rows(db, `SELECT email,name,role FROM b_members WHERE active=1 UNION ALL SELECT email,display_name,'owner' FROM oa_operators WHERE role='owner' AND status='active' ORDER BY 1`);
  const weeks = new Map<string, Map<string, Data>>(), planned = new Map<string, number>(), coverer = new Map<string, string>();
  const week = async (day: string) => {
    const key = monday(day);
    if (!weeks.has(key)) weeks.set(key, new Map(((await capacity(db, actor, { week: key })).people as Data[]).map(p => [p.email, p])));
    return { key, people: weeks.get(key)! };
  };
  const lines: Data[] = [], due = new Map<string, string>();
  for (const j of ordered(jobs, waitsFor)) {
    const choice = choices.get(j.id) ?? {}, line: Data = { jobId: j.id, revision: j.revision, work: work(j), workType: j.work_type, from: { preparer: j.preparer_email, reviewer: j.reviewer_email, dueDate: j.due_date } };
    if (choice.exclude === true) { lines.push({ ...line, action: 'excluded', reasons: [] }); continue; }
    const reasons: string[] = [], unresolved: string[] = [];
    const dueDate = choice.dueDate ? date(choice.dueDate, 'New due date') : j.due_date;
    const dueNote = choice.dueDate ? text(choice.dueNote ?? body.dueNote, 'Where the new due date comes from', 300) : j.due_note;
    if (dueDate < j.period_start) reasons.push('The due date is before the period starts');
    due.set(j.id, dueDate);
    for (const p of prereqDue.get(j.id) ?? []) { const pDue = due.get(p.id) ?? p.due_date; if (pDue > dueDate) reasons.push(`It waits for ${p.title} · ${p.period_label}, due ${pDue}, after this job's due date ${dueDate}`); }
    const tasks = await jobTasks(db, { ...j, due_date: dueDate });
    const { key, people: cap } = await week(dueDate);
    const free = (who: string, minutes: number) => {
      const p = cap.get(who); if (!p) return -1;
      if ((p.blocks as Data[]).some(b => b.kind === 'leave' && b.startsOn <= dueDate && b.endsOn >= dueDate)) return -1;
      return Number(p.availableMinutes) - Number(p.demandMinutes) - (planned.get(`${key}|${who}`) ?? 0) - minutes;
    };
    const skilled = (who: string) => !!j.work_type && ((cap.get(who)?.skills ?? []) as string[]).includes(String(j.work_type).toLowerCase());
    const pick = async (role: 'preparer' | 'reviewer', minutes: number, avoid: string[]) => {
      const wanted = optional(role === 'preparer' ? choice.preparerEmail : choice.reviewerEmail, role === 'preparer' ? 'Preparer' : 'Reviewer', 254).toLowerCase();
      const roles = role === 'preparer' ? ['preparer', 'reviewer'] : ['reviewer'];
      if (wanted) {
        if (wanted === person || !await eligible(db, wanted, roles)) reasons.push(`${wanted} is not an active ${role} who can cover`);
        else if (avoid.includes(wanted)) reasons.push(role === 'reviewer' ? `${wanted} cannot review their own work` : wanted === j.partner_email ? `${wanted} is the partner and cannot prepare this job` : `${wanted} would review their own work`);
        else if (free(wanted, minutes) < 0) reasons.push(`${wanted} is on leave on ${dueDate} or lacks ${hours(minutes)} of capacity that week`);
        return wanted;
      }
      const prior = (waitsFor.get(j.id) ?? []).map(p => coverer.get(`${p}|${role}`)).find(Boolean);
      const options = people.filter(p => p.email !== person && !avoid.includes(p.email) && (role === 'preparer' || p.role !== 'preparer') && free(p.email, minutes) >= 0)
        .sort((a, b) => Number(b.email === prior) - Number(a.email === prior) || Number(skilled(b.email)) - Number(skilled(a.email)) || free(b.email, minutes) - free(a.email, minutes) || a.email.localeCompare(b.email));
      if (!options.length) unresolved.push(`No eligible ${role} is free on ${dueDate} with ${hours(minutes)} of capacity in the week of ${key}`);
      return options[0]?.email ?? person;
    };
    const prepMinutes = tasks.filter(t => !t.done_at && t.owner === j.preparer_email && t.estimate_minutes).reduce((n, t) => n + Number(t.estimate_minutes), 0);
    const reviewMinutes = Number(j.review_estimate_minutes ?? 0);
    let preparer = j.preparer_email, reviewer = j.reviewer_email;
    if (j.preparer_email === person && j.status === 'open') preparer = await pick('preparer', prepMinutes, [reviewer, j.partner_email].filter(Boolean));
    else if (choice.preparerEmail) reasons.push(`${person} does not prepare this job`);
    if (j.reviewer_email === person) reviewer = await pick('reviewer', reviewMinutes, [preparer, j.submitted_by].filter(Boolean));
    else if (choice.reviewerEmail) reasons.push(`${person} does not review this job`);
    if (preparer !== person) { planned.set(`${key}|${preparer}`, (planned.get(`${key}|${preparer}`) ?? 0) + (preparer !== j.preparer_email ? prepMinutes : 0)); coverer.set(`${j.id}|preparer`, preparer); }
    if (reviewer !== person) { planned.set(`${key}|${reviewer}`, (planned.get(`${key}|${reviewer}`) ?? 0) + (reviewer !== j.reviewer_email ? reviewMinutes : 0)); coverer.set(`${j.id}|reviewer`, reviewer); }
    const to = { preparer, reviewer, dueDate, dueNote };
    const changed = preparer !== j.preparer_email || reviewer !== j.reviewer_email || dueDate !== j.due_date;
    lines.push({ ...line, to, skillMatch: skilled(preparer === person ? reviewer : preparer), action: reasons.length ? 'conflict' : unresolved.length && !changed ? 'unresolved' : 'change', reasons, unresolved });
  }
  const leaving = reason === 'leave' ? 'on leave' : 'over capacity';
  const notifications = lines.filter(l => l.action === 'change').flatMap(l => [
    ...(l.to.preparer !== l.from.preparer ? [{ to: l.to.preparer, jobId: l.jobId, summary: `You now prepare ${l.work}, due ${l.to.dueDate}, while ${person} is ${leaving}` }] : []),
    ...(l.to.reviewer !== l.from.reviewer ? [{ to: l.to.reviewer, jobId: l.jobId, summary: `You now review ${l.work}, due ${l.to.dueDate}, while ${person} is ${leaving}` }] : []),
    { to: person, jobId: l.jobId, summary: `${l.work} is covered by ${[l.to.preparer, l.to.reviewer].filter(p => p !== person).join(' and ')}${l.to.dueDate !== l.from.dueDate ? `, now due ${l.to.dueDate}` : ''}` },
  ]);
  const conflicts = lines.filter(l => l.unresolved?.length).map(l => ({ jobId: l.jobId, work: l.work, due: l.to.dueDate, reason: l.unresolved.join('; ') }));
  const plan = { person, reason, startsOn, endsOn, lines, notifications, conflicts };
  return { ...plan, fingerprint: await digest(JSON.stringify(plan)) };
}

export const previewCoverage = (db: D1Database, actor: Actor, body: Data) => coveragePlan(db, actor, body);

/** Approve the previewed plan: feasible lines apply together, uncovered work becomes the approver's conflicts, the people involved are told. */
export async function approveCoverage(env: Bindings, actor: Actor, body: Data) {
  const db = runtimeBindings(env).DB, plan = await coveragePlan(db, actor, body);
  insist(body.fingerprint === plan.fingerprint, 'The plan changed since the preview. Preview again before approving.', 409);
  const refused = plan.lines.filter(l => l.action === 'conflict');
  insist(!refused.length, `Change or exclude: ${refused.map(l => `${l.work} (${l.reasons.join('; ')})`).join(', ')}`, 409);
  const planId = id(), at = now(), statements: D1PreparedStatement[] = [];
  for (const l of plan.lines.filter(l => l.action === 'change')) {
    const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=? AND status<>'signed_off')", l.jobId, l.revision);
    statements.push(check, stmt(db, 'UPDATE b_jobs SET preparer_email=?,reviewer_email=?,due_date=?,due_note=?,revision=? WHERE id=?', l.to.preparer, l.to.reviewer, l.to.dueDate, l.to.dueNote, id(), l.jobId), release,
      audit(db, actor, 'job.reassigned', l.jobId, `coverage for ${plan.person}: preparer ${l.to.preparer}, reviewer ${l.to.reviewer}, due ${l.to.dueDate}`));
  }
  statements.push(stmt(db, 'INSERT INTO b_coverage_plans(id,person_email,reason,starts_on,ends_on,lines,approved_by,approved_at) VALUES(?,?,?,?,?,?,?,?)', planId, plan.person, plan.reason, plan.startsOn, plan.endsOn, JSON.stringify(plan.lines), actor.email, at),
    ...plan.conflicts.map(c => stmt(db, 'INSERT INTO b_coverage_conflicts(id,plan_id,job_id,reason,owner_email,created_at) VALUES(?,?,?,?,?,?)', id(), planId, c.jobId, c.reason, actor.email, at)),
    audit(db, actor, 'coverage.approved', planId, `${plan.person} ${plan.reason} ${plan.startsOn}–${plan.endsOn}: ${plan.lines.filter(l => l.action === 'change').length} moved, ${plan.conflicts.length} unresolved`));
  await atomic(db, actor, statements);
  for (const n of plan.notifications) await notify(env, [n.to], { kind: 'coverage', jobId: n.jobId, summary: n.summary }, actor.email);
  return { ...plan, planId, changed: plan.lines.filter(l => l.action === 'change').map(l => l.jobId) };
}

/** Approved plans, newest first, with the conflicts each left and who owns them. */
export async function coveragePlans(db: D1Database, actor: Actor) {
  need(actor, 'owner', 'reviewer');
  const [plans, conflicts] = await Promise.all([rows(db, 'SELECT * FROM b_coverage_plans ORDER BY approved_at DESC LIMIT 50'),
    rows(db, 'SELECT k.*,j.title,j.period_label,j.due_date,c.name client FROM b_coverage_conflicts k JOIN b_jobs j ON j.id=k.job_id JOIN b_clients c ON c.id=j.client_id ORDER BY k.created_at')]);
  return plans.map(p => ({ ...p, lines: JSON.parse(p.lines), conflicts: conflicts.filter(k => k.plan_id === p.id).map(k => ({ ...k, work: work(k) })) }));
}

/** The conflict's owner (or the principal) records how it was resolved. */
export async function resolveConflict(db: D1Database, actor: Actor, conflictId: string, body: Data) {
  human(actor);
  const k = await stmt(db, 'SELECT * FROM b_coverage_conflicts WHERE id=?', conflictId).first<Data>();
  insist(k && (k.owner_email === actor.email || actor.role === 'owner'), 'Not found', 404);
  insist(!k.resolved_at, 'Already resolved', 409);
  const note = text(body.note, 'How it was resolved', 500);
  await atomic(db, actor, [stmt(db, 'UPDATE b_coverage_conflicts SET resolved_by=?,resolved_at=?,resolution=? WHERE id=? AND resolved_at IS NULL', actor.email, now(), note, conflictId),
    audit(db, actor, 'coverage.resolved', k.job_id, note)]);
  return { ok: true };
}
