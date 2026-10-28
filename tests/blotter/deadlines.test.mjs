// DUE-001 / DUE-004 / DUE-005 sourced US obligations and extensions, DUE-003 wider catalog and firm-defined deadlines,
// through the staff doors, agent key, archives and erasure journal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

const b64 = s => Buffer.from(s).toString('base64');
const people = { preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' };
async function setup(h) {
  for (const [email, role] of [['reviewer@example.test', 'reviewer'], ['prep@example.test', 'preparer'], ['outside@example.test', 'preparer']]) {
    await h.json('/team', { email, name: email, role }, h.owner); await h.json('/team/invite', { email }, h.owner);
  }
  return { reviewer: await h.login('reviewer@example.test'), prep: await h.login('prep@example.test'), outside: await h.login('outside@example.test') };
}
const template = (h, name, recurrence) => h.json('/templates', { name, recurrence, steps: 'Prepare return', requests: 'Source records' }, h.owner);
const obligation = async (h, clientId, ruleKey, state, fiscalYearEnd = 12, internalDays = 0, who = h.owner) => (await h.json(`/clients/${clientId}/obligations`, { ruleKey, state, fiscalYearEnd, internalDays }, who)).id;
const start = (h, clientId, t, obligationId, periodStart) => h.json('/jobs', { clientId, templateId: t.id, obligationId, periodStart, ...people }, h.owner);
const deadline = async (h, jobId, who) => (await h.json('/jobs/' + jobId, undefined, who ?? h.owner)).deadline;

test('DUE-001 / DUE-004 / DUE-005 sourced obligations: five approved rule types for clients in two states and fiscal years, weekend/holiday shifts, a previewed source revision with disaster relief, extension and override kept apart, no filing without an acknowledgment, authority, audit, archive and erasure fencing', async () => {
  const h = await harness(), others = [];
  try {
    const { reviewer, prep, outside } = await setup(h);
    // Only the principal approves catalog rules; agents and staff cannot.
    const catalog = await h.json('/deadlines', undefined, h.owner);
    assert.ok(catalog.catalog.every(r => r.source.url.startsWith('https://') && r.version && r.effective && !r.approved));
    await h.json('/deadlines/rules/us-1040/approve', {}, reviewer, 403);
    const key = await h.json('/keys', { label: 'Assistant' }, h.owner), bearer = { authorization: 'Bearer ' + key.key };
    await h.json('/deadlines/rules/us-1040/approve', {}, '', 401, bearer);
    for (const rule of ['us-1040', 'us-1120s', 'us-1065', 'us-941', 'ca-sales', 'tx-sales']) await h.json(`/deadlines/rules/${rule}/approve`, {}, h.owner);
    await h.json('/deadlines/rules/us-1040/approve', {}, h.owner, 409);

    const ana = await h.json('/clients', { name: 'Ana Ruiz', entityType: 'individual' }, h.owner);
    const bay = await h.json('/clients', { name: 'Bay Partners LP', entityType: 'business' }, h.owner);
    const star = await h.json('/clients', { name: 'Lone Star Widgets Inc', entityType: 'business' }, h.owner);
    // Applicability: entity type, the rule's own state, approval.
    await h.json(`/clients/${ana.id}/obligations`, { ruleKey: 'us-1120s', state: 'CA' }, h.owner, 400);
    await h.json(`/clients/${bay.id}/obligations`, { ruleKey: 'tx-sales', state: 'CA' }, h.owner, 400);
    await h.json(`/clients/${bay.id}/obligations`, { ruleKey: 'us-1120', state: 'CA' }, h.owner, 409);
    await h.json(`/clients/${ana.id}/obligations`, { ruleKey: 'us-1040', state: 'CA' }, prep, 403);
    const o1040 = await obligation(h, ana.id, 'us-1040', 'CA', 12, 14, reviewer);
    const o1065 = await obligation(h, bay.id, 'us-1065', 'CA'), oCa = await obligation(h, bay.id, 'ca-sales', 'CA');
    const o1120s = await obligation(h, star.id, 'us-1120s', 'TX', 6), o941 = await obligation(h, star.id, 'us-941', 'TX'), oTx = await obligation(h, star.id, 'tx-sales', 'TX');
    const annual = await template(h, 'Annual return', 'annual'), quarterly = await template(h, 'Quarterly filing', 'quarterly'), monthly = await template(h, 'Monthly sales tax', 'monthly');

    const j1040 = await start(h, ana.id, annual, o1040, '2025-01-01'), j1065 = await start(h, bay.id, annual, o1065, '2025-01-01');
    const j1120s = await start(h, star.id, annual, o1120s, '2025-07-01'), j941 = await start(h, star.id, quarterly, o941, '2026-07-01');
    const jCa = await start(h, bay.id, quarterly, oCa, '2026-07-01'), jTx = await start(h, star.id, monthly, oTx, '2026-10-01');
    // The fiscal year must match: a June year end starts in July.
    assert.match((await h.json('/jobs', { clientId: star.id, templateId: annual.id, obligationId: o1120s, periodStart: '2025-01-01', ...people }, h.owner, 400)).error, /ending in month 6/);
    await h.json('/jobs', { clientId: star.id, templateId: monthly.id, obligationId: o1120s, periodStart: '2025-07-01', ...people }, h.owner, 400);
    const due = Object.fromEntries(await Promise.all(Object.entries({ j1040, j1065, j1120s, j941, jCa, jTx }).map(async ([k, j]) => [k, await deadline(h, j.id)])));
    assert.deepEqual(Object.fromEntries(Object.entries(due).map(([k, d]) => [k, d.original_due])),
      { j1040: '2026-04-15', j1065: '2026-03-16', j1120s: '2026-09-15', j941: '2026-11-02', jCa: '2026-11-02', jTx: '2026-11-20' });
    assert.equal(due.j1065.statutory_due, '2026-03-15'); assert.match(due.j1065.shift_note, /2026-03-15 is a Sunday/);
    assert.match(due.j941.shift_note, /2026-10-31 is a Saturday/);
    assert.equal(due.j1040.internal_due, '2026-04-01', 'Internal target 14 days earlier');
    assert.equal(j1040.due_date, '2026-04-15'); assert.match(j1040.due_note, /Publication 509.*us-1040 v2026\.1/);
    assert.equal(due.jCa.source_url.startsWith('https://www.cdtfa.ca.gov/'), true); assert.equal(due.jTx.source_url, 'https://comptroller.texas.gov/taxes/sales/');
    // A weekend and holiday case: 15 April 2028 is a Saturday and the observed DC Emancipation Day is Monday 17 April.
    const shifted = await h.json('/deadlines/calculate', { obligationId: o1040, periodStart: '2027-01-01' }, prep);
    assert.deepEqual([shifted.statutory, shifted.original, shifted.extensionDue], ['2028-04-15', '2028-04-18', '2028-10-16']);
    assert.match(shifted.shiftNote, /Saturday.*Sunday.*DC Emancipation Day/);

    // Unassigned staff cannot see or act on a job's deadline; overrides need a reviewer or the principal and a reason.
    await h.json('/jobs/' + j1065.id, undefined, outside, 404);
    await h.json(`/clients/${bay.id}/obligations`, undefined, outside, 404);
    await h.json('/deadlines/calculate', { obligationId: o1065, periodStart: '2026-01-01' }, outside, 404);
    await h.json(`/jobs/${j1065.id}/deadline/extension`, {}, outside, 404);
    await h.json(`/jobs/${j1065.id}/deadline/override`, { date: '2026-03-06', reason: 'Early' }, prep, 403);
    await h.json(`/jobs/${j1065.id}/deadline/override`, { date: '2026-03-06' }, reviewer, 400);
    const overridden = await h.json(`/jobs/${j1065.id}/deadline/override`, { date: '2026-03-06', reason: 'Partner wants it filed before the K-1 meeting' }, reviewer);
    assert.deepEqual([overridden.override_due, overridden.original_due], ['2026-03-06', '2026-03-16']);

    // Import a source revision: a CA disaster postponement and a re-published 941 rule. Preview lists the affected jobs first.
    const revision = { version: '2026.2', effective: '2026-02-01', source: { url: 'https://www.irs.gov/newsroom/tax-relief-in-disaster-situations', title: 'IRS: Tax relief in disaster situations' },
      relief: [{ title: 'IRS CA-2026-01 winter storm relief', jurisdiction: 'US', states: ['CA'], from: '2026-01-20', to: '2026-10-14', postponedTo: '2026-10-15', rules: [] }],
      rules: [{ key: 'us-941', source: { url: 'https://www.irs.gov/instructions/i941', title: 'IRS: Instructions for Form 941 (Rev. March 2026)' } }] };
    await h.json('/deadlines/revisions/preview', { revision }, reviewer, 403);
    await h.json('/deadlines/revisions/preview', { revision: { ...revision, source: { url: 'http://example.test', title: 'x' } } }, h.owner, 400);
    const preview = await h.json('/deadlines/revisions/preview', { revision }, h.owner);
    const lines = Object.fromEntries(preview.lines.map(l => [l.jobId, l]));
    assert.deepEqual(Object.keys(lines).sort(), [j1040.id, j1065.id, j941.id].sort(), 'Only CA federal jobs and the re-published rule are affected');
    assert.deepEqual(lines[j1040.id].external, ['2026-04-15', '2026-10-15']);
    assert.equal(lines[j1065.id].keepsWorkingDate, true);
    assert.deepEqual([lines[j941.id].external, lines[j941.id].toVersion], [['2026-11-02', '2026-11-02'], '2026.2']);
    assert.equal((await deadline(h, j1040.id)).original_due, '2026-04-15', 'Nothing changes before approval');
    await h.json('/deadlines/revisions', { revision, fingerprint: 'stale' }, h.owner, 409);
    const approved = await h.json('/deadlines/revisions', { revision, fingerprint: preview.fingerprint }, h.owner);
    assert.equal(approved.recalculated, 3);
    await h.json('/deadlines/revisions/preview', { revision }, h.owner, 409);
    const after1040 = await deadline(h, j1040.id), after1065 = await h.json('/jobs/' + j1065.id, undefined, h.owner);
    assert.deepEqual([after1040.original_due, after1040.relief_due, after1040.internal_due, after1040.relief_title], ['2026-04-15', '2026-10-15', '2026-10-01', 'IRS CA-2026-01 winter storm relief']);
    assert.equal((await h.json('/jobs/' + j1040.id, undefined, h.owner)).job.due_date, '2026-10-15');
    assert.deepEqual([after1065.job.due_date, after1065.deadline.relief_due, after1065.deadline.original_due], ['2026-03-06', '2026-10-15', '2026-03-16'], 'The override keeps the working date; calculated dates stay distinct');
    assert.equal((await deadline(h, j941.id)).rule_version, '2026.2');
    assert.equal((await deadline(h, j1120s.id)).original_due, '2026-09-15', 'A TX client is outside the CA relief');

    // Extension work stays open until the agency acknowledgment is recorded; a finished checklist never claims a filing.
    const ext = await h.json(`/jobs/${j1120s.id}/deadline/extension`, {}, prep);
    assert.deepEqual([ext.original_due, ext.extension_due, ext.extension_form, ext.extension_recorded_by], ['2026-09-15', '2027-03-15', '7004', 'prep@example.test']);
    assert.equal((await h.json('/jobs/' + j1120s.id, undefined, prep)).job.due_date, '2027-03-15');
    await h.json(`/jobs/${j1120s.id}/deadline/extension`, {}, prep, 409);
    let detail = await h.json('/jobs/' + j1120s.id, undefined, prep);
    const request = detail.requests[0];
    await h.json(`/requests/${request.id}/files`, { name: 'tb.csv', mime: 'text/csv', contentBase64: b64('account,balance') }, prep);
    const ack = await h.json(`/requests/${request.id}/files`, { name: 'irs-ack-1120s.txt', mime: 'text/plain', contentBase64: b64('Submission 12345620270101abc accepted') }, prep);
    await h.json(`/requests/${request.id}/decide`, { decision: 'accept' }, prep);
    for (const s of detail.steps) await h.json(`/jobs/${j1120s.id}/steps`, { ordinal: s.ordinal, done: true }, prep);
    detail = await h.json(`/jobs/${j1120s.id}/submit`, { revision: (await h.json('/jobs/' + j1120s.id, undefined, prep)).job.revision }, prep);
    assert.match((await h.json(`/jobs/${j1120s.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Reviewed' }, reviewer, 409)).error, /filing acknowledgment/);
    assert.equal(detail.deadline.filing, 'no filing evidence recorded');
    await h.json(`/jobs/${j1120s.id}/deadline/filing`, { fileId: 'not-on-this-job', submissionId: 'x', acceptedOn: '2027-03-01' }, prep, 404);
    const filed = await h.json(`/jobs/${j1120s.id}/deadline/filing`, { fileId: ack.id, submissionId: '12345620270101abc', acceptedOn: '2027-03-02' }, prep);
    assert.match(filed.filing, /acknowledged by the agency \(practitioner-recorded\)/);
    detail = await h.json(`/jobs/${j1120s.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Reviewed' }, reviewer);
    assert.equal(detail.job.status, 'signed_off');
    detail = await h.json('/jobs/' + jTx.id, undefined, prep);
    await h.json(`/requests/${detail.requests[0].id}/files`, { name: 'oct.csv', mime: 'text/csv', contentBase64: b64('sales,1') }, prep);
    await h.json(`/requests/${detail.requests[0].id}/decide`, { decision: 'accept' }, prep);
    for (const s of detail.steps) await h.json(`/jobs/${jTx.id}/steps`, { ordinal: s.ordinal, done: true }, prep);
    detail = await h.json(`/jobs/${jTx.id}/submit`, { revision: (await h.json('/jobs/' + jTx.id, undefined, prep)).job.revision }, prep);
    detail = await h.json(`/jobs/${jTx.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Checked' }, reviewer);
    assert.deepEqual([detail.job.status, detail.deadline.filing], ['signed_off', 'no filing evidence recorded'], 'Sign-off does not claim a filing');

    // Roll forward carries the obligation to the next period's calculated date.
    const next = await h.json(`/jobs/${j1040.id}/roll-forward`, {}, h.owner);
    assert.deepEqual([next.due_date, (await deadline(h, next.id)).original_due], ['2027-04-15', '2027-04-15']);

    // Attribution: each decision names its person in the client's history.
    const history = (await h.json(`/clients/${ana.id}/history`, undefined, h.owner)).history.map(e => `${e.action} ${e.actor}`);
    for (const line of ['deadline.obligation_added reviewer@example.test', 'deadline.recalculated owner@example.test']) assert.ok(history.includes(line), line);
    assert.ok((await h.json(`/clients/${bay.id}/history`, undefined, h.owner)).history.some(e => e.action === 'deadline.overridden' && e.actor === 'reviewer@example.test'));

    // Revocation: a deactivated reviewer's session can no longer override.
    await h.json('/team', { email: 'reviewer@example.test', name: 'reviewer@example.test', role: 'reviewer', active: false }, h.owner);
    await h.json(`/jobs/${jCa.id}/deadline/override`, { date: '2026-10-20', reason: 'Late' }, reviewer, 401);

    // Archives carry rules, revisions, relief and job dates; erasing the acknowledgment fences older archives.
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const target = await harness(); others.push(target);
    await target.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, target.owner);
    const restored = await target.json('/deadlines', undefined, target.owner);
    assert.deepEqual([restored.revisions.map(r => r.version), restored.relief.map(r => r.postponedTo), restored.catalog.filter(r => r.approved).length], [['2026.2'], ['2026-10-15'], 6]);
    assert.deepEqual(await deadline(target, j1040.id), after1040);
    await h.json(`/files/${ack.id}/erase`, { confirm: 'irs-ack-1120s.txt', reason: 'Client asked' }, h.owner);
    const erased = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.ok(!erased.includes(b64('Submission 12345620270101abc accepted')));
    assert.equal((await deadline(h, j1120s.id)).filing_submission_id, '12345620270101abc', 'The acknowledgment record keeps its attribution');
    const stale = await harness(); others.push(stale);
    assert.match((await stale.json('/restore', { archive, journal: erased, confirm: 'RESTORE' }, stale.owner, 409)).error, /erasure/);
  } finally { await h.close(); for (const o of others) await o.close(); }
});

test('DUE-003 wider catalog and firm rules: 1040-ES installments with a weekend shift, January 31 W-2 and 1099-NEC, FBAR with its automatic October extension, a firm rule 15 days after month end labeled firm-defined, and a previewed source revision', async () => {
  const h = await harness();
  try {
    const { prep } = await setup(h);
    for (const rule of ['us-1040es', 'us-w2', 'us-1099nec', 'us-fbar', 'us-1120', 'us-1041', 'us-990', 'us-940', 'us-1099misc', 'us-1120w', 'ca-de9', 'tx-c3', 'tx-franchise', 'de-annual-report']) await h.json(`/deadlines/rules/${rule}/approve`, {}, h.owner);
    await h.json('/deadlines/firm-rules', { name: 'Monthly close package', frequency: 'monthly', type: 'days-after-period-end', days: 15 }, prep, 403);
    await h.json('/deadlines/firm-rules', { name: 'Bad', frequency: 'monthly', type: 'every-full-moon' }, h.owner, 400);
    const firm = await h.json('/deadlines/firm-rules', { name: 'Monthly close package', frequency: 'monthly', type: 'days-after-period-end', days: 15, source: 'Engagement letter, section 3' }, h.owner);
    const board = await h.json('/deadlines/firm-rules', { name: 'Board pack', frequency: 'quarterly', type: 'nth-weekday', n: 2, weekday: 2, months: 1 }, h.owner);
    const books = await h.json('/deadlines/firm-rules', { name: 'Year-end books to the firm', frequency: 'annual', type: 'fixed', month: 2, day: 10 }, h.owner);
    const listed = await h.json('/deadlines', undefined, h.owner);
    assert.equal(listed.catalog.filter(r => r.approved).length, 14);
    assert.deepEqual(listed.firmRules.map(r => r.jurisdiction), ['Firm', 'Firm', 'Firm']);

    const lee = await h.json('/clients', { name: 'Lee Park', entityType: 'individual' }, h.owner);
    const acme = await h.json('/clients', { name: 'Acme Corp', entityType: 'business' }, h.owner);
    const add = (clientId, ruleKey, state, fiscalYearEnd = 12) => h.json(`/clients/${clientId}/obligations`, { ruleKey, state, fiscalYearEnd }, h.owner).then(r => r.id);
    const calc = (obligationId, periodStart) => h.json('/deadlines/calculate', { obligationId, periodStart }, h.owner);
    const es = await add(lee.id, 'us-1040es', 'NY'), fbar = await add(lee.id, 'us-fbar', 'NY');
    const w2 = await add(acme.id, 'us-w2', 'DE', 6), nec = await add(acme.id, 'us-1099nec', 'DE'), close = await add(acme.id, firm.key, 'DE');
    const boardO = await add(acme.id, board.key, 'DE'), booksO = await add(acme.id, books.key, 'DE');

    // 1040-ES: four installments; 15 June 2025 is a Sunday, 15 January 2028 a Saturday before Martin Luther King Jr. Day.
    const installments = await Promise.all(['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01'].map(p => calc(es, p)));
    assert.deepEqual(installments.map(i => i.original), ['2025-04-15', '2025-06-16', '2025-09-15', '2026-01-15']);
    assert.match(installments[1].shiftNote, /2025-06-15 is a Sunday/);
    const january = await calc(es, '2027-10-01');
    assert.deepEqual([january.statutory, january.original], ['2028-01-15', '2028-01-18']);
    assert.match(january.shiftNote, /Saturday.*Sunday.*Martin Luther King Jr\. Day/);
    // W-2 and 1099-NEC are calendar-year forms due January 31 (a Saturday in 2026), whatever the client's fiscal year.
    for (const o of [w2, nec]) { const d = await calc(o, '2025-01-01'); assert.deepEqual([d.statutory, d.original], ['2026-01-31', '2026-02-02']); }
    // FBAR: April 15 with the automatic extension to October 15, labeled automatic.
    const f = await calc(fbar, '2025-01-01');
    assert.deepEqual([f.original, f.extensionDue, f.extensionAutomatic, f.extensionForm, f.external], ['2026-04-15', '2026-10-15', true, 'none required', '2026-10-15']);
    assert.match(f.source.url, /^https:\/\/www\.fincen\.gov\//);
    // The firm rule: 15 days after month end (a Sunday moves to Monday), firm-defined, never an agency deadline.
    const c = await calc(close, '2026-10-01');
    assert.deepEqual([c.statutory, c.original, c.kind, c.source.title, c.source.url], ['2026-11-15', '2026-11-16', 'firm', 'Engagement letter, section 3', '']);
    assert.deepEqual([(await calc(boardO, '2026-07-01')).original, (await calc(booksO, '2025-01-01')).original], ['2026-10-13', '2026-02-10'], 'Second Tuesday after the quarter; the first 10 February after the year');
    const monthly = await h.json('/templates', { name: 'Monthly close', recurrence: 'monthly', steps: 'Close books', requests: 'Bank statements' }, h.owner);
    const closeJob = await h.json('/jobs', { clientId: acme.id, templateId: monthly.id, obligationId: close, periodStart: '2026-10-01', ...people }, h.owner);
    assert.deepEqual([closeJob.due_date, closeJob.due_note], ['2026-11-16', 'Firm-defined deadline: Monthly close package']);
    const annual = await h.json('/templates', { name: 'FBAR', recurrence: 'annual', steps: 'File FBAR', requests: 'Account statements' }, h.owner);
    const fbarJob = await h.json('/jobs', { clientId: lee.id, templateId: annual.id, obligationId: fbar, periodStart: '2025-01-01', ...people }, h.owner);
    assert.equal(fbarJob.due_date, '2026-10-15', 'The automatic extension sets the working date');
    await h.json(`/jobs/${fbarJob.id}/deadline/extension`, {}, prep, 409);
    const quarterly = await h.json('/templates', { name: 'Estimates', recurrence: 'quarterly', steps: 'Compute estimate', requests: 'Year-to-date income' }, h.owner);
    const esJob = await h.json('/jobs', { clientId: lee.id, templateId: quarterly.id, obligationId: es, periodStart: '2026-01-01', ...people }, h.owner);
    assert.equal(esJob.due_date, '2026-04-15');

    // A source revision moves the 1040-ES dates; the preview lists the affected job before approval and the firm rule is untouched.
    const revision = { version: '2026.3', effective: '2026-03-01', source: { url: 'https://www.irs.gov/forms-pubs/about-form-1040-es', title: 'IRS: Form 1040-ES (2026)' },
      rules: [{ key: 'us-1040es', due: { type: 'installments', offsets: [3, 5, 8, 12], day: 16 }, source: { url: 'https://www.irs.gov/forms-pubs/about-form-1040-es', title: 'IRS: Form 1040-ES (2026), revised' } }] };
    const preview = await h.json('/deadlines/revisions/preview', { revision }, h.owner);
    assert.deepEqual(preview.lines.map(l => [l.jobId, ...l.external]), [[esJob.id, '2026-04-15', '2026-04-17']], '16 April 2026 is DC Emancipation Day');
    assert.equal((await h.json('/jobs/' + esJob.id, undefined, h.owner)).job.due_date, '2026-04-15');
    await h.json('/deadlines/revisions', { revision, fingerprint: preview.fingerprint }, h.owner);
    const after = await h.json('/jobs/' + esJob.id, undefined, h.owner);
    assert.deepEqual([after.job.due_date, after.deadline.statutory_due, after.deadline.rule_version, after.deadline.source_title], ['2026-04-17', '2026-04-16', '2026.3', 'IRS: Form 1040-ES (2026), revised']);
    assert.match(after.deadline.shift_note, /2026-04-16 is DC Emancipation Day/);
    const firmJob = await h.json('/jobs/' + closeJob.id, undefined, h.owner);
    assert.deepEqual([firmJob.job.due_date, firmJob.deadline.kind, firmJob.deadline.rule_version], ['2026-11-16', 'firm', 'firm']);
    assert.ok((await h.json(`/clients/${lee.id}/history`, undefined, h.owner)).history.some(e => e.action === 'deadline.recalculated' && e.actor === 'owner@example.test'));

    // A WORK-002 / WORK-010 recurrence rule takes each period's due date from the obligation, in its preview and the jobs the scheduler creates.
    const rule = { clientId: acme.id, templateId: monthly.id, obligationId: close, firstPeriod: '2026-11-01', leadMonths: 0, ...people };
    await h.json('/rules/preview', { ...rule, obligationId: es }, h.owner, 409);
    assert.deepEqual((await h.json('/rules/preview', rule, h.owner)).schedule.slice(0, 2).map(p => [p.periodStart, p.dueDate]), [['2026-11-01', '2026-12-15'], ['2026-12-01', '2027-01-15']]);
    await h.json('/rules', rule, h.owner);
    await h.scheduled('2027-01-03T17:00:00Z');
    const generated = (await h.json('/state', undefined, h.owner)).jobs.filter(j => j.client_name === 'Acme Corp' && j.period_start >= '2026-11-01').map(j => [j.period_start, j.due_date]).sort();
    assert.deepEqual(generated, [['2026-11-01', '2026-12-15'], ['2026-12-01', '2027-01-15'], ['2027-01-01', '2027-02-16']], '15 February 2027 is Washington\'s Birthday');
  } finally { await h.close(); }
});
