// Live principal inspection of native risk facts. No saved aggregate or agent authority.
import { capacity, shift } from './capacity';
import { deadlineFor, obligations } from './deadlines';
import { readiness } from './readiness';
import { flowSteps } from './flow';
import { atomic, audit, date, guard, human, insist, rows, stmt, text, type Actor, type Data } from './model';

export async function rescueContext(db: D1Database, actor: Actor, query: Data) {
  human(actor);
  insist(actor.channel === 'person' && actor.role === 'owner' && actor.sessionId && !actor.automation && !actor.doorAgent,
    'Only a signed-in principal can inspect deadline-risk context', 403);
  const week = date(query.week, 'Week starting');
  insist(new Date(week + 'T00:00:00Z').getUTCDay() === 1, 'Choose a Monday for the selected week');
  const end = shift(week, 6), clientIds = [...new Set(text(query.clients, 'Selected clients', 1100).split(',').map(v => text(v, 'Client', 100)))].sort();
  insist(clientIds.length <= 10, 'Select at most 10 clients');
  const clients: Data[] = [], guards: D1PreparedStatement[] = [];
  for (const clientId of clientIds) {
    const client = await stmt(db, "SELECT id,name,revision FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL", clientId).first<Data>();
    insist(client, 'Select only current active, unerased clients', 404);
    clients.push({ id: client.id, name: client.name, href: `/api/blotter/clients/${client.id}/detail` });
    guards.push(...guard(db, "EXISTS(SELECT 1 FROM b_clients WHERE id=? AND revision=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL)", client.id, client.revision));
  }
  const selected = JSON.stringify(clientIds);
  const jobs = await rows(db, `SELECT j.* FROM b_jobs j LEFT JOIN b_job_deadlines d ON d.job_id=j.id
    WHERE j.client_id IN (SELECT value FROM json_each(?)) AND j.status IN ('open','review')
    AND (j.due_date<=? OR d.internal_due BETWEEN ? AND ? OR d.statutory_due BETWEEN ? AND ?
      OR (d.extension_recorded_at IS NOT NULL OR d.extension_automatic=1) AND d.extension_due BETWEEN ? AND ?)
    ORDER BY j.due_date,j.id LIMIT 51`, selected, end, week, end, week, end, week, end);
  insist(jobs.length <= 50, 'This selection exceeds 50 open jobs; select fewer clients', 409);
  const load = await capacity(db, actor, { week }), lines: Data[] = [];
  const selectedJobs = new Set(jobs.map(j => j.id));
  for (const j of jobs) {
    const href = `/api/blotter/jobs/${j.id}`;
    // An erased source is never reinterpreted as a newly missing document.
    insist(!await stmt(db, `SELECT 1 FROM b_files f JOIN b_requests r ON r.id=f.request_id
      WHERE r.job_id=? AND r.organizer_active=1 AND f.erased_at IS NOT NULL LIMIT 1`, j.id).first(),
    'A selected job has erased document sources; inspect its retained records separately', 409);
    const [rawDeadline, map, tasks] = await Promise.all([deadlineFor(db, j.id), readiness(db, actor, j.id), flowSteps(db, j)]);
    const deadline = rawDeadline as Data | null;
    let obligation: Data | null = null;
    if (deadline) {
      const found: Data | undefined = (await obligations(db, actor, j.client_id)).obligations.find((o: Data) => o.id === deadline.obligation_id);
      insist(found?.rule && found.rule.key === deadline.rule_key && found.rule.version === deadline.rule_version,
        'Deadline source changed or is unavailable; review the obligation first', 409);
      if (deadline.filing_file_id) insist(await stmt(db, 'SELECT 1 FROM b_files WHERE id=? AND job_id=? AND erased_at IS NULL', deadline.filing_file_id, j.id).first(), 'Filing source is unavailable', 409);
      obligation = { id: found.id, ruleKey: deadline.rule_key, ruleVersion: deadline.rule_version,
        sourceUrl: deadline.source_url, sourceTitle: deadline.source_title, state: found.state,
        fiscalYearEnd: found.fiscal_year_end, internalDays: found.internal_days,
        href: `/api/blotter/clients/${j.client_id}/obligations`, ruleHref: '/api/blotter/deadlines' };
    }
    const requestSources = await rows(db, 'SELECT id,ordinal,label FROM b_requests WHERE job_id=? AND organizer_active=1 ORDER BY ordinal', j.id);
    const requests = map.documents.filter(r => r.state !== 'validated').map(r => ({ id: r.id, label: r.label, status: r.status, state: r.state, href }));
    const open = tasks.filter(t => !['done', 'not_applicable'].includes(t.state));
    const people = [...new Set([j.preparer_email, j.reviewer_email, ...open.map(t => t.owner)].filter(Boolean))] as string[];
    const risks: Data[] = [];
    const add = (code: string, reason: string, facts: Data = {}) => risks.push({ code, reason, jobId: j.id, jobHref: href,
      obligationId: obligation?.id ?? null, ruleKey: obligation?.ruleKey ?? null, ruleVersion: obligation?.ruleVersion ?? null, ...facts });
    for (const r of requests) add('document', `${r.label}: ${r.state === 'missing' ? 'missing document' : 'received evidence still needs human acceptance'}`, { requestId: r.id, requestHref: r.href });
    for (const t of open) {
      for (const reason of t.blockers) add('dependency', reason, { taskOrdinal: t.ordinal, prerequisiteJobId: t.prerequisite?.id ?? null,
        prerequisiteJobHref: t.prerequisite ? `/api/blotter/jobs/${t.prerequisite.id}` : null,
        requestIds: requestSources.filter(r => (JSON.parse(t.after_requests) as number[]).includes(r.ordinal)).map(r => r.id) });
      if (!t.estimate_minutes) add('estimate', `${t.label}: insufficient estimates; remaining minutes are unknown`, { taskOrdinal: t.ordinal });
      if (!t.owner) add('unassigned', `${t.label}: no recorded task owner`, { taskOrdinal: t.ordinal });
    }
    if (!j.review_estimate_minutes) add('estimate', 'Review: insufficient estimates; remaining minutes are unknown');
    if (!deadline) add('date_source', 'Sourced obligation unavailable; working date is practitioner-recorded');
    if (j.due_date < week) add('past_due', `Working date ${j.due_date} is before the selected week`);
    for (const address of people) {
      const p = load.people.find(p => p.email === address);
      if (!p) { add('capacity_unknown', 'An assigned person is not currently active; capacity is unavailable', { person: address }); continue; }
      if (!p.hoursSet) add('capacity_default', `${p.name}: weekly hours use the capacity default`, { person: address });
      if (!p.skills.length) add('skills_unknown', `${p.name}: skills are not recorded; suitability is not inferred`, { person: address });
      if (p.overloaded) add('over_capacity', `${p.name}: weekly demand exceeds availability by ${p.overMinutes} minutes`, { person: address });
      for (const block of p.blocks.filter(b => b.kind === 'leave' && b.startsOn <= j.due_date))
        add('leave', `${p.name}: recorded leave ${block.startsOn} to ${block.endsOn} before the working date`, { person: address, blockId: block.id });
    }
    lines.push({ id: j.id, clientId: j.client_id, title: j.title, period: j.period_label, href, people, obligation,
      dates: { working: j.due_date, workingSource: j.due_note, statutory: deadline?.statutory_due ?? null,
        original: deadline?.original_due ?? null, shiftNote: deadline?.shift_note ?? null, internal: deadline?.internal_due ?? null,
        extension: deadline ? { due: deadline.extension_due, applies: deadline.extended, form: deadline.extension_form,
          automatic: !!deadline.extension_automatic, recordedBy: deadline.extension_recorded_by, recordedAt: deadline.extension_recorded_at } : null,
        relief: deadline?.relief_due ?? null, override: deadline?.override_due ?? null }, requests,
      tasks: open.map(t => ({ ordinal: t.ordinal, label: t.label, owner: t.owner, due: t.due_date ?? j.due_date,
        estimateMinutes: t.estimate_minutes, state: t.state, blockers: t.blockers, href,
        dependencies: { tasks: JSON.parse(t.after_steps),
          requests: requestSources.filter(r => (JSON.parse(t.after_requests) as number[]).includes(r.ordinal)).map(r => ({ ...r, href })),
          job: t.prerequisite ? { id: t.prerequisite.id, title: t.prerequisite.title, status: t.prerequisite.status, href: `/api/blotter/jobs/${t.prerequisite.id}` } : null,
          templateId: t.after_template, gate: t.after_gate } })), risks });
    guards.push(...guard(db, 'EXISTS(SELECT 1 FROM b_jobs WHERE id=? AND revision=?)', j.id, j.revision));
  }
  const assigned = new Set(lines.flatMap(j => j.people));
  const people = load.people.filter(p => assigned.has(p.email)).map(p => ({ ...p,
    // Firm-wide numerical demand includes competing work, without copying other clients' records.
    jobs: p.jobs.filter(j => selectedJobs.has(j.jobId)).sort((a, b) => a.due.localeCompare(b.due) || a.jobId.localeCompare(b.jobId) || (a.ordinal ?? 0) - (b.ordinal ?? 0)), blocks: p.blocks.map(b => b.jobId && !selectedJobs.has(b.jobId)
      ? { ...b, jobId: null, label: 'Other recorded commitment' } : b).sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id)),
    href: `/api/blotter/capacity?week=${week}`, demandScope: 'All firm work due in the week; only selected job details shown' })).sort((a, b) => a.email.localeCompare(b.email));
  await atomic(db, actor, [...guards, audit(db, actor, 'rescue.context_inspected', week, JSON.stringify({ clientIds, jobIds: jobs.map(j => j.id) }))]);
  return { weekStart: week, weekEnd: end, clientIds, clients, jobs: lines, people,
    coverage: { ledger: 'Unavailable: authorized LEDGER-001 context is not connected',
      estimates: 'Insufficient estimates are unknown demand, never zero remaining work. Past-due work is not counted in weekly capacity demand.',
      readiness: 'Native request and dependency context only; document sufficiency and client response history require human judgment.',
      plan: 'Inspection only. This is not a source-complete feasible rescue plan. No staffing, request, message, cost, extension, deadline or filing action is authorized.' } };
}
