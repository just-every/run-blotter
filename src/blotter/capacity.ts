// Workload capacity and coverage (CAPACITY-001). For one Monday-to-Sunday
// week, each person's available minutes are their weekly hours less leave and
// commitments on that week's weekdays; their demand is the estimates of open
// tasks they own that fall due in the week (WORK-009) plus the review estimates
// of jobs they review that fall due in it. Actual time is reported beside it
// and never subtracted. Open work without an estimate is unscheduled; work due
// before the week and still open is past due; neither is counted. Jobs due in
// the week whose people are over capacity, on leave before the due date, or
// with unscheduled work are deadline conflicts, each with its explanation.
import { date, email, human, id, insist, integer, need, now, readableJob, rows, stmt, text, atomic, audit, optional, type Actor, type Data } from './model';
import { pendingStep } from './flow';
import { resolveTask } from './tasks';
import { eligible } from './jobs';

const DEFAULT_WEEKLY = 2400;
const DAY = 86_400_000;
const shift = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
const weekdays = (start: string) => [0, 1, 2, 3, 4].map(n => shift(start, n));
export const hours = (minutes: number) => `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
const KINDS = ['leave', 'meeting', 'internal'];

/** The owner sets a person's weekly hours and skills. */
export async function setCapacity(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const person = email(body.email, 'Person');
  insist(await eligible(db, person, ['preparer', 'reviewer']), `${person} is not an active practice member`);
  const weekly = integer(body.weeklyMinutes, 'Weekly minutes', 0, 6000);
  insist(Array.isArray(body.skills ?? []), 'Skills: list them');
  const skills = [...new Set(((body.skills ?? []) as unknown[]).map((s, n) => text(s, `Skill ${n + 1}`, 60).toLowerCase()))];
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_capacity(email,weekly_minutes,skills,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET weekly_minutes=excluded.weekly_minutes,skills=excluded.skills,updated_by=excluded.updated_by,updated_at=excluded.updated_at',
      person, weekly, JSON.stringify(skills), actor.email, now()),
    audit(db, actor, 'capacity.set', person, `${hours(weekly)} a week; skills ${skills.join(', ') || 'none'}`)]);
  return { email: person, weeklyMinutes: weekly, skills };
}

/** The owner schedules leave (whole weekdays) or a meeting or internal commitment (minutes on each weekday). */
export async function addBlock(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const person = email(body.email, 'Person');
  insist(await eligible(db, person, ['preparer', 'reviewer']), `${person} is not an active practice member`);
  insist(KINDS.includes(body.kind), 'Choose leave, meeting or internal');
  const startsOn = date(body.startsOn, 'From'), endsOn = body.endsOn ? date(body.endsOn, 'To') : startsOn;
  insist(endsOn >= startsOn && Date.parse(endsOn) - Date.parse(startsOn) <= 366 * DAY, 'To must be on or within a year after From');
  const perDay = body.kind === 'leave' ? null : integer(body.minutesPerDay, 'Minutes each day', 1, 1440);
  const jobId = optional(body.jobId, 'Job', 100) || null;
  if (jobId) await readableJob(db, actor, jobId);
  const label = text(body.label, 'Label', 200), blockId = id();
  await atomic(db, actor, [
    stmt(db, 'INSERT INTO b_capacity_blocks(id,email,kind,starts_on,ends_on,minutes_per_day,label,job_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', blockId, person, body.kind, startsOn, endsOn, perDay, label, jobId, actor.email, now()),
    audit(db, actor, 'capacity.block_added', blockId, `${person} ${body.kind} ${startsOn}–${endsOn}: ${label}`)]);
  return { id: blockId };
}

export async function removeBlock(db: D1Database, actor: Actor, blockId: string) {
  human(actor); need(actor, 'owner');
  const block = await stmt(db, 'SELECT * FROM b_capacity_blocks WHERE id=?', blockId).first<Data>();
  insist(block, 'Not found', 404);
  await atomic(db, actor, [stmt(db, 'DELETE FROM b_capacity_blocks WHERE id=?', blockId), audit(db, actor, 'capacity.block_removed', blockId, `${block.email} ${block.kind} ${block.starts_on}–${block.ends_on}: ${block.label}`)]);
  return { ok: true };
}

/** The job's people (or a reviewer or the principal) adjust a task's remaining estimate or the job's review estimate. */
export async function setEstimate(db: D1Database, actor: Actor, jobId: string, body: Data) {
  human(actor);
  const j = await readableJob(db, actor, jobId);
  insist(j.access === 'full', 'Only the job’s people can change its estimates', 403);
  insist(j.status !== 'signed_off', 'This job is signed off', 409);
  const minutes = body.minutes === null || body.minutes === '' ? null : integer(body.minutes, 'Estimate in minutes', 1, 100_000);
  if (body.review === true) {
    await atomic(db, actor, [stmt(db, "UPDATE b_jobs SET review_estimate_minutes=? WHERE id=? AND status<>'signed_off'", minutes, j.id), audit(db, actor, 'job.estimated', j.id, `review ${minutes === null ? 'not estimated' : hours(minutes)}`)]);
  } else {
    const ordinal = integer(body.ordinal, 'Task', 1, 100);
    const step = await stmt(db, 'SELECT label,done_at FROM b_job_steps WHERE job_id=? AND ordinal=?', j.id, ordinal).first<Data>();
    insist(step, 'Task not found', 404);
    insist(!step.done_at, 'A completed task keeps its estimate', 409);
    await atomic(db, actor, [stmt(db, 'UPDATE b_job_steps SET estimate_minutes=? WHERE job_id=? AND ordinal=? AND done_at IS NULL', minutes, j.id, ordinal),
      audit(db, actor, 'job.estimated', j.id, `“${step.label}” ${minutes === null ? 'not estimated' : hours(minutes)}`)]);
  }
  return { ok: true };
}

/** A person's leave, commitments and available minutes in the Monday-to-Sunday week from `start`: weekly less leave and commitments on its weekdays, never below zero. */
export function weekOf(weekly: number, blocks: Data[], start: string) {
  const days = weekdays(start), daily = Math.round(weekly / 5);
  const mine = blocks.filter(b => b.starts_on <= days[4] && b.ends_on >= days[0]).map(b => {
    const on = days.filter(d => d >= b.starts_on && d <= b.ends_on);
    return { id: b.id, kind: b.kind, label: b.label, startsOn: b.starts_on, endsOn: b.ends_on, jobId: b.job_id, minutes: on.length * (b.minutes_per_day ?? daily) };
  });
  const leave = mine.filter(b => b.kind === 'leave').reduce((n, b) => n + b.minutes, 0), commitments = mine.filter(b => b.kind !== 'leave').reduce((n, b) => n + b.minutes, 0);
  return { mine, leave, commitments, available: Math.max(0, weekly - leave - commitments) };
}
export { DEFAULT_WEEKLY, shift };

const OPEN_STEPS = `SELECT j.id job_id,j.title,j.period_label,j.due_date job_due,j.preparer_email,j.reviewer_email,j.manager_email,j.period_start,j.due_date,j.status,c.name client,t.name service,s.*
  FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id JOIN b_clients c ON c.id=j.client_id JOIN b_work_types t ON t.id=j.work_type_id
  WHERE j.status<>'signed_off' AND ${pendingStep('s')} AND (?1='' OR t.name=?1)`;

/** One week's capacity across the firm (a preparer sees only themselves), filtered by skill and service (the job's work type, WORK-007). */
export async function capacity(db: D1Database, actor: Actor, query: Data) {
  const start = date(query.week, 'Week starting');
  insist(new Date(start + 'T00:00:00Z').getUTCDay() === 1, 'A capacity week starts on a Monday');
  const end = shift(start, 6), days = weekdays(start), skill = optional(query.skill, 'Skill', 60).toLowerCase(), service = optional(query.service, 'Service', 120);
  const lead = actor.role !== 'preparer';
  const [members, settings, blocks, steps, reviews, time] = await Promise.all([
    rows(db, `SELECT email,name,role FROM b_members WHERE active=1 UNION ALL SELECT email,display_name,'owner' FROM oa_operators WHERE role='owner' AND status='active' ORDER BY 2`),
    rows(db, 'SELECT * FROM b_capacity'),
    rows(db, 'SELECT * FROM b_capacity_blocks WHERE starts_on<=? AND ends_on>=? ORDER BY starts_on', days[4], days[0]),
    rows(db, OPEN_STEPS, service),
    rows(db, `SELECT j.id job_id,j.title,j.period_label,j.due_date,j.reviewer_email,j.review_estimate_minutes,c.name client FROM b_jobs j JOIN b_clients c ON c.id=j.client_id JOIN b_work_types t ON t.id=j.work_type_id
      WHERE j.status<>'signed_off' AND j.due_date BETWEEN ?2 AND ?3 AND (?1='' OR t.name=?1) ORDER BY j.due_date`, service, start, end),
    rows(db, 'SELECT person_email,job_id,SUM(minutes) minutes,SUM(CASE WHEN date BETWEEN ? AND ? THEN minutes ELSE 0 END) week FROM b_time GROUP BY person_email,job_id', start, end),
  ]);
  const setting = new Map(settings.map(s => [s.email, s]));
  const tasks = steps.map((s): Data => { const t = resolveTask(s, s); return { ...t, due: t.due_date ?? s.job_due }; });
  const people = members.filter(m => lead || m.email === actor.email).map(m => {
    const s = setting.get(m.email), weekly = s ? Number(s.weekly_minutes) : DEFAULT_WEEKLY, skills: string[] = s ? JSON.parse(s.skills) : [];
    const { mine, leave, commitments, available } = weekOf(weekly, blocks.filter(b => b.email === m.email), start);
    const lines = [
      ...tasks.filter(t => t.owner === m.email && t.estimate_minutes && t.due >= start && t.due <= end)
        .map(t => ({ kind: 'preparation', jobId: t.job_id, work: `${t.client} · ${t.title} · ${t.period_label}`, label: t.label, ordinal: t.ordinal, due: t.due, estimateMinutes: Number(t.estimate_minutes) })),
      ...reviews.filter(r => r.reviewer_email === m.email && r.review_estimate_minutes)
        .map(r => ({ kind: 'review', jobId: r.job_id, work: `${r.client} · ${r.title} · ${r.period_label}`, label: 'Review', ordinal: null, due: r.due_date, estimateMinutes: Number(r.review_estimate_minutes) })),
    ].map(l => ({ ...l, actualMinutes: Number(time.find(t => t.person_email === m.email && t.job_id === l.jobId)?.minutes ?? 0) }));
    const demand = lines.reduce((n, l) => n + l.estimateMinutes, 0);
    const actual = time.filter(t => t.person_email === m.email).reduce((n, t) => n + Number(t.week), 0);
    return { email: m.email, name: m.name, role: m.role, skills, weeklyMinutes: weekly, hoursSet: !!s, leaveMinutes: leave, commitmentMinutes: commitments, availableMinutes: available,
      demandMinutes: demand, overMinutes: Math.max(0, demand - available), overloaded: demand > available, actualMinutes: actual, blocks: mine, jobs: lines };
  }).filter(p => !skill || p.skills.includes(skill));
  const shown = new Set(people.map(p => p.email)), inView = (who: string[]) => lead && !skill ? true : who.some(w => shown.has(w));
  const unscheduled = [
    ...tasks.filter(t => !t.estimate_minutes && t.due >= start && t.due <= end && inView([t.owner]))
      .map(t => ({ kind: 'task', jobId: t.job_id, work: `${t.client} · ${t.title} · ${t.period_label}`, label: t.label, ordinal: t.ordinal, owner: t.owner, due: t.due, reason: 'no estimate' })),
    ...reviews.filter(r => !r.review_estimate_minutes && inView([r.reviewer_email]))
      .map(r => ({ kind: 'review', jobId: r.job_id, work: `${r.client} · ${r.title} · ${r.period_label}`, label: 'Review', ordinal: null, owner: r.reviewer_email, due: r.due_date, reason: 'no review estimate' })),
  ];
  const pastDue = tasks.filter(t => t.due < start && inView([t.owner])).map(t => ({ jobId: t.job_id, work: `${t.client} · ${t.title} · ${t.period_label}`, label: t.label, owner: t.owner, due: t.due }));
  const person = new Map(people.map(p => [p.email, p]));
  const conflicts = reviews.filter(r => inView([r.reviewer_email, ...tasks.filter(t => t.job_id === r.job_id).map(t => t.owner)])).map(r => {
    const owners = [...new Set([...tasks.filter(t => t.job_id === r.job_id).map(t => t.owner), r.reviewer_email])].filter(Boolean);
    const reasons: string[] = [];
    for (const who of owners) {
      const p = person.get(who);
      if (!p) continue;
      if (p.overloaded) reasons.push(`${p.name} is over capacity by ${hours(p.overMinutes)} this week`);
      for (const b of p.blocks.filter(b => b.kind === 'leave' && b.startsOn <= r.due_date)) reasons.push(`${p.name} is on leave ${b.startsOn} to ${b.endsOn}, before the due date ${r.due_date}`);
    }
    for (const u of unscheduled.filter(u => u.jobId === r.job_id)) reasons.push(`“${u.label}” has ${u.reason}`);
    return { jobId: r.job_id, work: `${r.client} · ${r.title} · ${r.period_label}`, due: r.due_date, reasons };
  }).filter(c => c.reasons.length);
  const total = (key: 'availableMinutes' | 'demandMinutes' | 'actualMinutes') => people.reduce((n, p) => n + p[key], 0);
  return { weekStart: start, weekEnd: end, skill, service, totals: { availableMinutes: total('availableMinutes'), demandMinutes: total('demandMinutes'), actualMinutes: total('actualMinutes') }, people, unscheduled, pastDue, conflicts };
}
