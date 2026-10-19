// The first release's jobs, end to end through the built Worker's HTTP doors.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { harness } from './harness.mjs';

let h, reviewer, preparer, client, template, job, nextJob, csv, oldArchive, newArchive, erasedFile, keptFile;
const b64 = text => Buffer.from(text).toString('base64');
const portalToken = mail => (mail.text ?? mail.html).match(/\/portal\/(up_[0-9a-f]{64})/)?.[1];

before(async () => {
  h = await harness();
  for (const [email, name, role] of [['reviewer@example.test', 'Riley Reviewer', 'reviewer'], ['preparer@example.test', 'Pat Preparer', 'preparer']]) {
    await h.json('/team', { email, name, role }, h.owner);
    await h.json('/team/invite', { email }, h.owner);
  }
  reviewer = await h.login('reviewer@example.test');
  preparer = await h.login('preparer@example.test');
  client = await h.json('/clients', { name: 'Harbour Lane Cafe Pty Ltd', abn: '10 000 000 001', contactName: 'Mia Chen', contactEmail: 'mia@harbourlane.example' }, h.owner);
  template = await h.json('/templates', { name: 'Quarterly BAS', recurrence: 'quarterly', steps: 'Reconcile bank\nDraft BAS', requests: 'Bank statements\nSales invoices', feeCents: 33000 }, h.owner);
});
after(async () => { await h?.close(); });

test('sessions, roles, origin checks and member deactivation guard every handler', async () => {
  await h.json('/state', undefined, '', 401);
  await h.json('/clients', { name: 'X' }, '', 401);
  await h.json('/clients', { name: 'Denied' }, preparer, 403);
  await h.json('/templates', { name: 'Denied', recurrence: 'monthly', steps: 'a', requests: 'b' }, preparer, 403);
  await h.json('/team', { email: 'x@example.test', name: 'X', role: 'preparer' }, reviewer, 403);
  await h.json('/team/rates', { email: 'preparer@example.test', rateCents: 1 }, reviewer, 403);
  await h.json('/clients', { name: 'Cross-site' }, h.owner, 403, { origin: 'https://outside.example.test' });
  await h.json('/backup', undefined, reviewer, 403);
  await h.json('/import/preview', { csv: 'client_name\nA' }, reviewer, 403);
  await h.json('/team', { email: 'preparer@example.test', name: 'Pat Preparer', role: 'preparer', active: false }, h.owner);
  await h.json('/state', undefined, preparer, 403);
  await h.json('/team', { email: 'preparer@example.test', name: 'Pat Preparer', role: 'preparer' }, h.owner);
  assert.equal((await h.json('/state', undefined, preparer)).actor.role, 'preparer');
});

test('a job starts from a template and is visible only to its people', async () => {
  const start = { clientId: client.id, templateId: template.id, periodStart: '2026-07-01', dueDate: '2026-10-28', dueNote: 'ATO lodgement program', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  await h.json('/jobs', { ...start, reviewerEmail: 'preparer@example.test' }, h.owner, 400);
  await h.json('/jobs', { ...start, dueDate: '2026-02-30' }, h.owner, 400);
  job = await h.json('/jobs', start, reviewer);
  assert.equal(job.period_label, 'Jul–Sep 2026');
  assert.equal(job.fee_cents, 33000);
  await h.json('/jobs', start, h.owner, 409);
  const other = await h.json('/clients', { name: 'Other client' }, h.owner);
  const hidden = await h.json('/jobs', { ...start, clientId: other.id, preparerEmail: 'reviewer@example.test' }, h.owner);
  const visible = (await h.json('/state', undefined, preparer)).jobs.map(j => j.id);
  assert.deepEqual(visible, [job.id]);
  await h.json('/jobs/' + hidden.id, undefined, preparer, 404);
  await h.json(`/jobs/${hidden.id}/time`, { date: '2026-10-01', minutes: 5, description: 'x' }, preparer, 404);
  const detail = await h.json('/jobs/' + job.id, undefined, preparer);
  assert.deepEqual(detail.steps.map(s => s.label), ['Reconcile bank', 'Draft BAS']);
  assert.deepEqual(detail.requests.map(r => r.status), ['requested', 'requested']);
});

test('a reminder mails a single-use-generation upload link; the client uploads; staff accept', async () => {
  const first = await h.json(`/jobs/${job.id}/reminders`, { message: 'Thanks!' }, preparer);
  const sent = h.mails.at(-1);
  assert.deepEqual(sent.to, ['mia@harbourlane.example']);
  const token = portalToken(sent);
  assert.ok(token && first.portalUrl.endsWith(token));
  assert.match(first.delivery, /accepted/);
  const view = await (await h.request('/api/blotter/portal/' + token)).json();
  assert.deepEqual(view.requests.map(r => r.label), ['Bank statements', 'Sales invoices']);
  assert.equal(view.client, 'Harbour Lane Cafe Pty Ltd');
  // A later reminder replaces the link; the first stops working.
  await h.json(`/jobs/${job.id}/reminders`, {}, preparer);
  const token2 = portalToken(h.mails.at(-1));
  assert.equal((await h.request('/api/blotter/portal/' + token)).status, 404);
  const upload = (request, body, extra) => h.request(`/api/blotter/portal/${token2}/requests/${request}`, body, '', extra);
  assert.equal((await upload(view.requests[0].id, { name: 'bank.csv', mime: 'text/csv', contentBase64: b64('date,amount\n2026-07-01,10') }, { origin: 'https://outside.example.test' })).status, 403);
  assert.equal((await upload(view.requests[0].id, { name: 'big.bin', contentBase64: Buffer.alloc(1_048_577).toString('base64') })).status, 400);
  assert.equal((await upload(view.requests[0].id, { name: 'bank.csv', mime: 'text/csv', contentBase64: b64('date,amount\n2026-07-01,10') })).status, 200);
  assert.equal((await upload(view.requests[1].id, { name: 'sales.txt', mime: 'text/plain', contentBase64: b64('INV-1 $110') })).status, 200);
  const detail = await h.json('/jobs/' + job.id, undefined, preparer);
  assert.deepEqual(detail.requests.map(r => r.status), ['received', 'received']);
  [keptFile, erasedFile] = detail.requests.map(r => r.files[0]);
  assert.equal(await (await h.request('/api/blotter/files/' + keptFile.id, undefined, preparer)).text(), 'date,amount\n2026-07-01,10');
  assert.ok(!JSON.stringify(detail.reminders).includes(token2), 'Only the link digest is stored');
  await h.json(`/jobs/${job.id}/submit`, { revision: detail.job.revision }, preparer, 409);
  for (const r of detail.requests) await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, preparer);
  for (const s of detail.steps) await h.json(`/jobs/${job.id}/steps`, { ordinal: s.ordinal, done: true }, preparer);
});

test('the assigned reviewer signs off; the preparer cannot; sign-off closes the upload link', async () => {
  let detail = await h.json('/jobs/' + job.id, undefined, preparer);
  detail = await h.json(`/jobs/${job.id}/submit`, { revision: detail.job.revision }, preparer);
  assert.equal(detail.job.status, 'review');
  await h.json(`/jobs/${job.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Self' }, preparer, 403);
  await h.json(`/jobs/${job.id}/review`, { revision: detail.job.revision, decision: 'signoff' }, reviewer, 400);
  detail = await h.json(`/jobs/${job.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Reconciled to bank; GST coding checked' }, reviewer);
  assert.equal(detail.job.status, 'signed_off');
  assert.equal(detail.job.signed_off_by, 'reviewer@example.test');
  assert.equal((await h.request('/api/blotter/portal/' + portalToken(h.mails.findLast(portalToken)))).status, 404);
  await h.json(`/jobs/${job.id}/steps`, { ordinal: 1, done: false }, h.owner, 409);
});

test('roll forward creates the next period once, with a recorded due date', async () => {
  await h.json(`/jobs/${job.id}/roll-forward`, { dueDate: '2027-02-28', dueNote: 'ATO lodgement program' }, preparer, 403);
  await h.json(`/jobs/${job.id}/roll-forward`, { dueNote: 'missing date' }, h.owner, 400);
  nextJob = await h.json(`/jobs/${job.id}/roll-forward`, { dueDate: '2027-02-28', dueNote: 'ATO lodgement program' }, h.owner);
  assert.equal(nextJob.period_start, '2026-10-01');
  assert.equal(nextJob.period_label, 'Oct–Dec 2026');
  assert.equal(nextJob.due_date, '2027-02-28');
  assert.equal(nextJob.preparer_email, 'preparer@example.test');
  assert.equal(nextJob.rolled_from, job.id);
  await h.json(`/jobs/${job.id}/roll-forward`, { dueDate: '2027-02-28', dueNote: 'again' }, h.owner, 409);
  const detail = await h.json('/jobs/' + nextJob.id, undefined, preparer);
  assert.deepEqual(detail.requests.map(r => r.status), ['requested', 'requested']);
});

test('time snapshots rates; exports reserve each item once and approved CSVs never change', async () => {
  await h.json(`/jobs/${job.id}/time`, { date: '2026-10-02', minutes: 50, description: 'Reconcile' }, preparer, 409);
  await h.json('/team/rates', { email: 'preparer@example.test', rateCents: 9500, effectiveFrom: '2026-10-01' }, h.owner);
  const t1 = await h.json(`/jobs/${job.id}/time`, { date: '2026-10-02', minutes: 50, description: 'Reconcile bank' }, preparer);
  assert.equal(t1.amountCents, 7917); // 50 × 9500 ÷ 60 = 7916.67, rounded half up
  await h.json('/team/rates', { email: 'preparer@example.test', rateCents: 12000, effectiveFrom: '2026-10-03' }, h.owner);
  const t2 = await h.json(`/jobs/${nextJob.id}/time`, { date: '2026-10-03', minutes: 30, description: '=HYPERLINK("x")' }, preparer);
  assert.equal(t2.amountCents, 6000);
  // Only approved time is ready to bill (TIME-002).
  assert.ok(!(await h.json('/billing', undefined, reviewer)).unbilled.some(l => l.source_id === t1.id));
  await h.json('/timesheets/submit', { weekStart: '2026-09-28' }, preparer);
  for (const t of [t1, t2]) await h.json(`/time/${t.id}/review`, { decision: 'approve' }, reviewer);
  const billing = await h.json('/billing', undefined, reviewer);
  assert.equal(billing.unbilled.find(l => l.source_id === t1.id).rate_cents, 9500);
  const fee = billing.unbilled.find(l => l.kind === 'fee');
  assert.equal(fee.amount_cents, 33000);
  await h.json('/billing', undefined, preparer, 403);
  await h.json('/exports', { title: 'Oct', sourceKeys: [fee.source_key] }, preparer, 403);
  let draft = await h.json('/exports', { title: 'October billing', sourceKeys: [fee.source_key, 'time:' + t1.id, 'time:' + t2.id] }, reviewer);
  assert.equal(draft.totalCents, 33000 + 7917 + 6000);
  await h.json('/exports', { title: 'Twice', sourceKeys: ['time:' + t1.id] }, reviewer, 409);
  await h.json(`/exports/${draft.id}/csv`, undefined, h.owner, 409);
  const listed = (await h.json('/billing', undefined, h.owner)).exports.find(e => e.id === draft.id);
  await h.json(`/exports/${draft.id}/approve`, { revision: listed.revision, reviewNote: 'Checked' }, reviewer, 403);
  await h.json(`/exports/${draft.id}/approve`, { revision: listed.revision, reviewNote: 'Checked against job records' }, h.owner);
  const csvA = await (await h.request(`/api/blotter/exports/${draft.id}/csv`, undefined, h.owner)).text();
  assert.match(csvA, /,46917,AUD\r\n$/);
  assert.ok(csvA.includes(`"'=HYPERLINK(""x"")"`), 'Spreadsheet formulas are neutralised');
  csv = csvA;
  assert.equal(await (await h.request(`/api/blotter/exports/${draft.id}/csv`, undefined, reviewer)).text(), csvA);
  await h.json(`/exports/${draft.id}/void`, { reason: 'Too late' }, h.owner, 409);
  await h.json(`/time/${t1.id}/delete`, {}, h.owner, 409);
  // A voided draft releases its items for a later export.
  const t3 = await h.json(`/jobs/${nextJob.id}/time`, { date: '2026-10-04', minutes: 6, description: 'Call' }, preparer);
  await h.json('/timesheets/submit', { weekStart: '2026-09-28' }, preparer);
  await h.json(`/time/${t3.id}/review`, { decision: 'approve' }, reviewer);
  draft = await h.json('/exports', { title: 'Draft', sourceKeys: ['time:' + t3.id] }, reviewer);
  await h.json(`/exports/${draft.id}/void`, { reason: 'Wrong month' }, reviewer);
  assert.ok((await h.json('/billing', undefined, reviewer)).unbilled.some(l => l.source_id === t3.id));
});

test('TIME-003 rate cards resolve client and service, client, service, staff member, then role, each from its date', async () => {
  const card = (body, cookie = h.owner, expected = 200) => h.json('/team/rates', body, cookie, expected);
  await card({ scope: 'role', role: 'preparer', rateCents: 1, effectiveFrom: '2026-10-01' }, preparer, 403);
  await card({ scope: 'client', clientId: 'missing', rateCents: 1, effectiveFrom: '2026-10-01' }, h.owner, 404);
  await card({ scope: 'staff', email: 'preparer@example.test', rateCents: 1, effectiveFrom: '2026-02-30' }, h.owner, 400);
  const individual = await h.json('/templates', { name: '1040 Individual return', recurrence: 'annual', steps: 'Prepare return', requests: 'W-2 forms' }, h.owner);
  const kestrel = await h.json('/clients', { name: 'Kestrel Dental LLC' }, h.owner);
  const start = (clientId, templateId) => h.json('/jobs', { clientId, templateId, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'IRS Form 1040 instructions', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  const [harbour1040, kestrelBas, kestrel1040] = [await start(client.id, individual.id), await start(kestrel.id, template.id), await start(kestrel.id, individual.id)];
  await card({ scope: 'service', templateId: individual.id, rateCents: 20000, effectiveFrom: '2026-10-01' });
  await card({ scope: 'client', clientId: kestrel.id, rateCents: 15000, effectiveFrom: '2026-10-01' });
  await card({ scope: 'client_service', clientId: kestrel.id, templateId: individual.id, rateCents: 25000, effectiveFrom: '2026-10-10' });
  await card({ scope: 'role', role: 'reviewer', rateCents: 11000, effectiveFrom: '2026-10-01' });
  const log = (j, date, who = preparer) => h.json(`/jobs/${j.id}/time`, { date, minutes: 60, description: 'Work' }, who);
  const resolved = async (j, date, who) => { const t = await log(j, date, who); assert.equal(t.amountCents, t.rateCents); return [t.rateCents, t.rateSource]; };
  assert.deepEqual(await resolved(nextJob, '2026-10-05'), [12000, 'staff']);
  assert.deepEqual(await resolved(harbour1040, '2026-10-05'), [20000, 'service']);
  assert.deepEqual(await resolved(kestrelBas, '2026-10-05'), [15000, 'client']);
  assert.deepEqual(await resolved(kestrel1040, '2026-10-05'), [15000, 'client'], 'The client override beats the service rate');
  assert.deepEqual(await resolved(kestrel1040, '2026-10-10'), [25000, 'client_service'], 'Client and service applies from its date');
  assert.deepEqual(await resolved(nextJob, '2026-10-05', reviewer), [11000, 'role'], 'A person without a staff rate falls back to the role rate');
  await h.json(`/jobs/${harbour1040.id}/time`, { date: '2026-09-30', minutes: 60, description: 'Before any rate' }, preparer, 409);
  // A staff rate change effective next month applies from its date and never rewrites recorded time.
  const before = (await h.json('/jobs/' + nextJob.id, undefined, preparer)).time;
  await card({ scope: 'staff', email: 'preparer@example.test', rateCents: 13000, effectiveFrom: '2026-11-01' });
  assert.deepEqual(await resolved(nextJob, '2026-10-31'), [12000, 'staff']);
  assert.deepEqual(await resolved(nextJob, '2026-11-02'), [13000, 'staff']);
  const after = (await h.json('/jobs/' + nextJob.id, undefined, preparer)).time;
  for (const t of before) assert.deepEqual(after.find(a => a.id === t.id), t);
  const kestrelTime = (await h.json('/jobs/' + kestrel1040.id, undefined, h.owner)).time.map(t => [t.date, t.rate_cents, t.rate_source]);
  assert.deepEqual(kestrelTime, [['2026-10-05', 15000, 'client'], ['2026-10-10', 25000, 'client_service']]);
  assert.deepEqual((await h.json('/jobs/' + harbour1040.id, undefined, preparer)).time.map(t => [t.rate_cents, t.rate_source]), [[20000, 'service']]);
  assert.equal((await h.json('/team', undefined, h.owner)).rates.filter(r => r.scope === 'staff' && r.person_email === 'preparer@example.test').length, 3);
  assert.ok((await h.json('/team', undefined, preparer)).rates.every(r => r.scope === 'staff' && r.person_email === 'preparer@example.test'), 'Preparers see only their own staff rates');
});

test('TIME-002 timesheets: submit a week, return and correct, approve, close the period, then only adjustments change it', async () => {
  const log = (date, minutes, description, who = preparer, expected = 200) => h.json(`/jobs/${nextJob.id}/time`, { date, minutes, description }, who, expected);
  const e1 = await log('2026-12-07', 60, 'Reconcile December bank'), e2 = await log('2026-12-08', 30, 'Client call');
  await h.json('/timesheets/submit', { weekStart: '2026-12-08' }, preparer, 400);
  assert.equal((await h.json('/timesheets/submit', { weekStart: '2026-12-07' }, preparer)).submitted, 2);
  await h.json('/timesheets/submit', { weekStart: '2026-12-07' }, preparer, 409);
  await h.json(`/time/${e1.id}/review`, { decision: 'approve' }, preparer, 403);
  await h.json(`/time/${e1.id}/delete`, {}, preparer, 409);
  await h.json(`/time/${e2.id}/review`, { decision: 'return' }, reviewer, 400);
  await h.json(`/time/${e2.id}/review`, { decision: 'return', reason: 'The call was 20 minutes' }, reviewer);
  await h.json(`/time/${e1.id}/review`, { decision: 'approve' }, reviewer);
  const mine = (await h.json('/timesheets', undefined, preparer)).entries;
  assert.deepEqual([e1.id, e2.id].map(id => mine.find(e => e.id === id).status), ['approved', 'returned']);
  assert.equal(mine.find(e => e.id === e2.id).reason, 'The call was 20 minutes');
  let ready = (await h.json('/billing', undefined, reviewer)).unbilled.map(l => l.source_id);
  assert.ok(ready.includes(e1.id) && !ready.includes(e2.id), 'Returned time is not billable');
  const close = { startDate: '2026-12-01', endDate: '2026-12-31', note: 'December closed' };
  assert.match((await h.json('/periods/close', close, h.owner, 409)).error, /1 time entry in this period is not approved/);
  await h.json(`/time/${e2.id}/correct`, { minutes: 20, description: 'Client call' }, reviewer, 403);
  const fixed = await h.json(`/time/${e2.id}/correct`, { minutes: 20, description: 'Client call' }, preparer);
  assert.deepEqual([fixed.status, fixed.minutes, fixed.replaces], ['submitted', 20, e2.id]);
  await h.json(`/time/${e2.id}/history`, undefined, preparer, 404);
  await h.json(`/time/${fixed.id}/review`, { decision: 'approve' }, reviewer);
  await h.json('/periods/close', close, reviewer, 403);
  await h.json('/periods/close', close, h.owner);
  await h.json('/periods/close', { ...close, startDate: '2026-12-31', endDate: '2027-01-05' }, h.owner, 409);
  // Closed time is locked: no new entries, deletions or corrections in the period.
  await log('2026-12-15', 10, 'Late entry', preparer, 409);
  await h.json(`/time/${e1.id}/delete`, {}, h.owner, 409);
  await h.json(`/time/${e1.id}/correct`, { minutes: 50, description: 'x' }, preparer, 409);
  // Reservations still bill each item once.
  ready = (await h.json('/billing', undefined, reviewer)).unbilled.map(l => l.source_key);
  await h.json('/exports', { title: 'December', sourceKeys: ['time:' + e1.id, 'time:' + fixed.id] }, reviewer);
  await h.json('/exports', { title: 'December again', sourceKeys: ['time:' + e1.id] }, reviewer, 409);
  // An authorized adjustment corrects locked time and keeps the original.
  await h.json(`/time/${e1.id}/adjust`, { minutes: 15, reason: 'Missed review call' }, reviewer, 403);
  await h.json(`/time/${e1.id}/adjust`, { minutes: -100, reason: 'Too much' }, h.owner, 400);
  const adjustment = await h.json(`/time/${e1.id}/adjust`, { minutes: 15, reason: 'Missed review call' }, h.owner);
  assert.equal(adjustment.amountCents, 3250); // 15 × 13000 ÷ 60
  const history = await h.json(`/time/${e1.id}/history`, undefined, preparer);
  assert.deepEqual([history.entry.minutes, history.entry.amount_cents, history.locked, history.review.status, history.review.decided_by], [60, 13000, true, 'approved', 'reviewer@example.test']);
  assert.deepEqual(history.adjustments.map(a => [a.minutes, a.amount_cents, a.reason, a.created_by]), [[15, 3250, 'Missed review call', 'owner@example.test']]);
  assert.deepEqual(history.audit.map(a => a.action), ['time.added', 'time.approved', 'time.adjusted']);
  const line = (await h.json('/billing', undefined, reviewer)).unbilled.find(l => l.source_key === 'adj:' + adjustment.id);
  assert.deepEqual([line.kind, line.amount_cents], ['adjustment', 3250]);
  await h.json('/exports', { title: 'Adjustment', sourceKeys: [line.source_key] }, reviewer);
  await h.json('/exports', { title: 'Adjustment again', sourceKeys: [line.source_key] }, reviewer, 409);
});

test('WORK-004 bulk scheduling previews a client segment, keeps existing work and refuses inactive or self-review assignments', async () => {
  const add = name => h.json('/clients', { name }, h.owner);
  const [north, south, east, west, odd] = [await add('Northwind Books LLC'), await add('Southside Bakery'), await add('Eastgate Dental PC'), await add('Westfield Farms'), await add('Oddity Labs')];
  const payroll = await h.json('/templates', { name: 'Payroll quarterly', recurrence: 'quarterly', steps: 'Reconcile Form 941', requests: 'Payroll register' }, h.owner);
  await h.json('/jobs', { clientId: north.id, templateId: payroll.id, periodStart: '2026-07-01', dueDate: '2026-10-31', dueNote: 'Form 941 instructions', preparerEmail: 'reviewer@example.test', reviewerEmail: 'owner@example.test' }, h.owner);
  const batch = { templateId: payroll.id, periodStart: '2026-10-01', dueDate: '2027-01-31', dueNote: 'Form 941 instructions', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test',
    clients: [{ clientId: north.id }, { clientId: south.id, preparerEmail: 'owner@example.test' }, { clientId: east.id, reviewerEmail: 'owner@example.test' }, { clientId: west.id, exclude: true },
      { clientId: odd.id, reviewerEmail: 'preparer@example.test' }] };
  await h.json('/bulk/schedule/preview', batch, preparer, 403);
  const count = async () => (await h.json('/state', undefined, h.owner)).jobs.filter(j => j.template_id === payroll.id).length;
  let plan = await h.json('/bulk/schedule/preview', batch, h.owner);
  assert.equal(await count(), 1, 'A preview changes nothing');
  const line = id => plan.lines.find(l => l.clientId === id);
  assert.deepEqual([line(north.id).action, line(north.id).preparer, line(north.id).preparerFrom, line(north.id).reviewer], ['create', 'reviewer@example.test', 'last period', 'owner@example.test']);
  assert.deepEqual([line(south.id).preparer, line(south.id).preparerFrom, line(south.id).reviewer], ['owner@example.test', 'override', 'reviewer@example.test']);
  assert.deepEqual([line(east.id).preparer, line(east.id).reviewer, line(east.id).reviewerFrom], ['preparer@example.test', 'owner@example.test', 'override']);
  assert.equal(line(west.id).action, 'excluded');
  assert.equal(line(odd.id).action, 'conflict');
  assert.match(line(odd.id).reasons.join(' '), /not an active reviewer.*cannot review their own work/);
  await h.json('/bulk/schedule', { ...batch, fingerprint: plan.fingerprint }, h.owner, 409);
  assert.equal(await count(), 1, 'A plan with a conflict commits nothing');
  const fixed = { ...batch, clients: batch.clients.map(c => c.clientId === odd.id ? { clientId: odd.id, exclude: true } : c) };
  plan = await h.json('/bulk/schedule/preview', fixed, h.owner);
  await h.json('/bulk/schedule', { ...fixed, fingerprint: 'stale' }, h.owner, 409);
  const committed = await h.json('/bulk/schedule', { ...fixed, fingerprint: plan.fingerprint }, h.owner);
  assert.equal(committed.created.length, 3);
  assert.equal(await count(), 4);
  // The same batch again creates nothing: its old preview is stale, and a fresh one keeps every existing job.
  await h.json('/bulk/schedule', { ...fixed, fingerprint: plan.fingerprint }, h.owner, 409);
  const again = await h.json('/bulk/schedule/preview', fixed, h.owner);
  assert.deepEqual(again.lines.map(l => l.action), ['exists', 'exists', 'exists', 'excluded', 'excluded']);
  assert.deepEqual((await h.json('/bulk/schedule', { ...fixed, fingerprint: again.fingerprint }, h.owner)).created, []);
  assert.equal(await count(), 4);
  // Bulk reassignment and rescheduling refuse inactive people, self-review and signed-off work.
  await h.json('/team', { email: 'gone@example.test', name: 'Gone Person', role: 'preparer', active: false }, h.owner);
  const made = Object.fromEntries(committed.created.map(c => [c.clientId, c.jobId]));
  const inactive = await h.json('/bulk/reassign/preview', { jobIds: [made[south.id], made[east.id]], preparerEmail: 'gone@example.test' }, h.owner);
  assert.ok(inactive.lines.every(l => l.action === 'conflict' && /not an active preparer/.test(l.reasons[0])));
  await h.json('/bulk/reassign', { jobIds: [made[south.id], made[east.id]], preparerEmail: 'gone@example.test', fingerprint: inactive.fingerprint }, h.owner, 409);
  const move = { jobIds: [made[north.id], made[south.id], made[east.id], job.id], reviewerEmail: 'reviewer@example.test', dueDate: '2027-02-15', dueNote: 'Extension filed' };
  const mixed = await h.json('/bulk/reassign/preview', move, h.owner);
  assert.deepEqual(mixed.lines.map(l => l.action), ['conflict', 'change', 'change', 'conflict']);
  assert.match(mixed.lines[0].reasons[0], /cannot review their own work/);
  assert.match(mixed.lines[3].reasons[0], /Signed-off work/);
  await h.json('/bulk/reassign', { ...move, fingerprint: mixed.fingerprint }, h.owner, 409);
  const ok = { ...move, jobIds: [made[south.id], made[east.id]] };
  const okPlan = await h.json('/bulk/reassign/preview', ok, h.owner);
  assert.deepEqual((await h.json('/bulk/reassign', { ...ok, fingerprint: okPlan.fingerprint }, h.owner)).changed, [made[south.id], made[east.id]]);
  const eastJob = (await h.json('/jobs/' + made[east.id], undefined, h.owner)).job;
  assert.deepEqual([eastJob.preparer_email, eastJob.reviewer_email, eastJob.due_date, eastJob.due_note], ['preparer@example.test', 'reviewer@example.test', '2027-02-15', 'Extension filed']);
  assert.equal((await h.json('/jobs/' + made[north.id], undefined, h.owner)).job.reviewer_email, 'owner@example.test', 'A refused job is unchanged');
});

test('DOC-003 client approval of deliverables: changes on version 1, approval bound to version 2, newer versions reset approval', async () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  const northwind = await h.json('/clients', { name: 'Northwind Studio LLC', contactName: 'Jordan Lee', contactEmail: 'jordan@northwind.example' }, h.owner);
  const tpl = await h.json('/templates', { name: 'Annual financial statements', recurrence: 'annual', steps: 'Prepare statements', requests: 'Trial balance' }, h.owner);
  const work = await h.json('/jobs', { clientId: northwind.id, templateId: tpl.id, periodStart: '2026-01-01', dueDate: '2027-03-15', dueNote: 'Engagement letter', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  const send = body => h.json(`/jobs/${work.id}/deliverables`, { mime: 'application/pdf', submitOnApproval: true, ...body }, preparer);
  const portal = token => ({
    list: async () => (await h.request(`/api/blotter/portal/${token}/deliverables`)).json(),
    decide: (versionId, body, extra) => h.request(`/api/blotter/portal/${token}/deliverables/${versionId}/decide`, body, '', extra),
  });

  // Version 1 goes to the client, who asks for a change with a comment.
  const v1 = await send({ title: 'Financial statements FY2026', name: 'statements-v1.pdf', contentBase64: b64('FS v1'), note: 'Draft for your review' });
  assert.deepEqual(h.mails.at(-1).to, ['jordan@northwind.example']);
  assert.match(h.mails.at(-1).text, /Financial statements FY2026 \(version 1\)/);
  assert.equal(v1.sha256, sha('FS v1'));
  let client = portal(portalToken(h.mails.at(-1)));
  const [listed] = await client.list();
  assert.deepEqual([listed.title, listed.status, listed.versions[0].sha256], ['Financial statements FY2026', 'sent', v1.sha256]);
  assert.equal(await (await h.request(`/api/blotter/portal/${portalToken(h.mails.at(-1))}/deliverables/${v1.id}/file`)).text(), 'FS v1');
  assert.equal((await client.decide(v1.id, { decision: 'changes', name: 'Jordan Lee', sha256: v1.sha256, comment: 'x' }, { origin: 'https://outside.example.test' })).status, 403);
  assert.equal((await client.decide(v1.id, { decision: 'changes', name: 'Jordan Lee', sha256: v1.sha256 })).status, 400, 'A change request needs a comment');
  assert.equal((await client.decide(v1.id, { decision: 'approve', name: 'Jordan Lee', sha256: sha('something else') })).status, 409, 'The decision names the reviewed hash');
  const changes = await client.decide(v1.id, { decision: 'changes', name: 'Jordan Lee', sha256: v1.sha256, comment: 'Please split owner draws from wages.' });
  assert.equal((await changes.json()).status, 'changes_requested');
  assert.equal((await client.decide(v1.id, { decision: 'approve', name: 'Jordan Lee', sha256: v1.sha256 })).status, 409, 'A version is answered once');

  // A second deliverable shows a newer version resetting an approval; it moves nothing.
  const r1 = await send({ title: 'Management report', name: 'report-v1.pdf', contentBase64: b64('MR v1'), submitOnApproval: false });
  client = portal(portalToken(h.mails.at(-1)));
  assert.equal((await (await client.decide(r1.id, { decision: 'approve', name: 'Jordan Lee', sha256: r1.sha256 })).json()).jobStatus, 'open');
  await send({ deliverableId: r1.deliverableId, name: 'report-v2.pdf', contentBase64: b64('MR v2') });
  let report = (await h.json('/jobs/' + work.id, undefined, preparer)).deliverables.find(d => d.id === r1.deliverableId);
  assert.deepEqual([report.status, report.versions[1].status, report.versions[1].approver_name], ['sent', 'approved', 'Jordan Lee']);

  // The job's checklist and documents are complete, so approval can submit it for review.
  const detail = await h.json('/jobs/' + work.id, undefined, preparer);
  await h.json(`/requests/${detail.requests[0].id}/files`, { name: 'tb.csv', mime: 'text/csv', contentBase64: b64('account,balance') }, preparer);
  await h.json(`/requests/${detail.requests[0].id}/decide`, { decision: 'accept' }, preparer);
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 1, done: true }, preparer);

  // Version 2 replaces the link; approving version 1 now is refused; version 2 is approved.
  const oldToken = portalToken(h.mails.at(-1));
  const v2 = await send({ deliverableId: v1.deliverableId, name: 'statements-v2.pdf', contentBase64: b64('FS v2'), note: 'Owner draws now shown separately' });
  assert.equal(v2.version, 2);
  assert.equal((await h.request(`/api/blotter/portal/${oldToken}/deliverables`)).status, 404);
  client = portal(portalToken(h.mails.at(-1)));
  assert.equal((await client.decide(v1.id, { decision: 'approve', name: 'Jordan Lee', sha256: v1.sha256 })).status, 409, 'Version 1 cannot be approved after version 2');
  const approved = await (await client.decide(v2.id, { decision: 'approve', name: 'Jordan Lee', sha256: v2.sha256 })).json();
  assert.deepEqual(approved, { status: 'approved', jobStatus: 'review', movedJob: true });

  const after = await h.json('/jobs/' + work.id, undefined, reviewer);
  const statements = after.deliverables.find(d => d.id === v1.deliverableId);
  const [second, first] = statements.versions;
  assert.equal(statements.status, 'approved');
  assert.deepEqual([second.approver_name, second.approver_email, second.decided_sha256, second.sha256], ['Jordan Lee', 'jordan@northwind.example', sha('FS v2'), sha('FS v2')]);
  assert.ok(second.decided_at);
  assert.deepEqual([first.status, first.comment], ['changes_requested', 'Please split owner draws from wages.']);
  assert.deepEqual([after.job.status, after.job.submitted_by], ['review', 'preparer@example.test']);
  assert.equal(await (await h.request(`/api/blotter/deliverables/versions/${v2.id}/file`, undefined, reviewer)).text(), 'FS v2');
  await h.json(`/jobs/${work.id}/deliverables`, { deliverableId: v1.deliverableId, name: 'v3.pdf', contentBase64: b64('FS v3') }, preparer, 409);
  // The approval took the job through the normal review gate: the preparer still cannot sign it off.
  await h.json(`/jobs/${work.id}/review`, { revision: after.job.revision, decision: 'signoff', note: 'Self' }, preparer, 403);
});

test('COLLAB-001 review alerts and internal threads: mention, correction, unread state, resolution, no leak to the client or unassigned staff', async () => {
  await h.json('/team', { email: 'other@example.test', name: 'Omar Other', role: 'preparer' }, h.owner);
  await h.json('/team/invite', { email: 'other@example.test' }, h.owner);
  const other = await h.login('other@example.test');
  const cove = await h.json('/clients', { name: 'Cove Dental PLLC', contactName: 'Sam Cove', contactEmail: 'sam@cove.example' }, h.owner);
  const tpl = await h.json('/templates', { name: 'Monthly close', recurrence: 'monthly', steps: 'Reconcile accounts', requests: 'Bank statement' }, h.owner);
  const work = await h.json('/jobs', { clientId: cove.id, templateId: tpl.id, periodStart: '2026-06-01', dueDate: '2026-07-20', dueNote: 'Client close calendar', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  await h.json(`/jobs/${work.id}/reminders`, {}, preparer);
  const token = portalToken(h.mails.at(-1));
  let detail = await h.json('/jobs/' + work.id, undefined, preparer);
  const request = detail.requests[0];
  await h.json(`/requests/${request.id}/files`, { name: 'may.csv', mime: 'text/csv', contentBase64: b64('May only') }, preparer);
  await h.json(`/requests/${request.id}/decide`, { decision: 'accept' }, preparer);
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 1, done: true }, preparer);
  detail = await h.json(`/jobs/${work.id}/submit`, { revision: (await h.json('/jobs/' + work.id, undefined, preparer)).job.revision }, preparer);

  // Submission alerts the assigned reviewer, in the app and by email.
  assert.match(h.mails.findLast(m => m.to.includes('reviewer@example.test')).text, /Pat Preparer submitted Cove Dental PLLC Monthly close Jun 2026 for your review/);
  assert.equal((await h.json('/notifications', undefined, reviewer))[0].kind, 'review_requested');

  // The reviewer asks the preparer for a correction on the document and mentions the principal.
  const start = { anchor: 'request:' + request.id, title: 'June bank statement missing', body: 'The statement covers May only. @owner@example.test FYI.', correction: true, followUpDue: '2026-07-10' };
  await h.json(`/jobs/${work.id}/threads`, { ...start, mentions: ['other@example.test'] }, reviewer, 400);
  await h.json(`/jobs/${work.id}/threads`, { ...start, correction: false, title: 'x', mentions: [] }, other, 404);
  await h.json(`/jobs/${work.id}/threads`, { ...start, correction: true, title: 'x' }, preparer, 403);
  const opened = await h.json(`/jobs/${work.id}/threads`, { ...start, mentions: ['owner@example.test'] }, reviewer);
  const threadId = opened.thread.id;
  assert.deepEqual([opened.thread.kind, opened.thread.owner_email, opened.thread.follow_up_due], ['correction', 'preparer@example.test', '2026-07-10']);
  assert.match(h.mails.findLast(m => m.to.includes('preparer@example.test')).text, /asked you for a correction on Cove Dental PLLC Monthly close Jun 2026 by 2026-07-10/);
  assert.equal((await h.json('/notifications', undefined, h.owner)).find(n => n.thread_id === threadId).kind, 'mention');
  detail = await h.json(`/jobs/${work.id}/review`, { revision: detail.job.revision, decision: 'return', note: 'See the correction thread' }, reviewer);
  assert.equal(detail.job.status, 'open');
  assert.equal((await h.json('/notifications', undefined, preparer))[0].kind, 'review_returned');

  // Unread until the preparer opens it; a reply makes it unread for the reviewer.
  const unread = async who => (await h.json(`/jobs/${work.id}/threads`, undefined, who)).find(t => t.id === threadId).unread;
  assert.equal(await unread(preparer), true);
  assert.equal(await unread(reviewer), false);
  await h.json('/threads/' + threadId, undefined, preparer);
  assert.equal(await unread(preparer), false);
  await h.json(`/threads/${threadId}/messages`, { body: 'Uploaded the June statement as well.' }, preparer);
  assert.equal(await unread(reviewer), true);
  assert.match(h.mails.findLast(m => m.to.includes('reviewer@example.test')).text, /replied on Cove Dental PLLC/);

  // Only the owner of the correction (or the principal) resolves it; the decision and thread are retained.
  await h.json(`/threads/${threadId}/resolve`, { resolution: 'Done' }, reviewer, 403);
  const resolved = await h.json(`/threads/${threadId}/resolve`, { resolution: 'June statement added and reconciled' }, preparer);
  assert.deepEqual([resolved.thread.status, resolved.thread.resolved_by, resolved.thread.resolution], ['resolved', 'preparer@example.test', 'June statement added and reconciled']);
  await h.json(`/threads/${threadId}/messages`, { body: 'late' }, reviewer, 409);
  const kept = await h.json('/threads/' + threadId, undefined, reviewer);
  assert.deepEqual(kept.messages.map(m => [m.author_email, m.mentions]), [['reviewer@example.test', ['owner@example.test']], ['preparer@example.test', []]]);

  // A client-wide thread follows the same rules. Unassigned staff and the client read nothing.
  const clientWide = await h.json(`/jobs/${work.id}/threads`, { anchor: 'client', title: 'Fee review', body: 'Internal: raise the monthly fee next year.' }, h.owner);
  await h.json('/threads/' + threadId, undefined, other, 404);
  await h.json('/threads/' + clientWide.thread.id, undefined, other, 404);
  await h.json(`/jobs/${work.id}/threads`, undefined, other, 404);
  assert.equal((await h.json(`/jobs/${work.id}/threads`, undefined, preparer)).length, 2);
  const seenByClient = JSON.stringify([await (await h.request('/api/blotter/portal/' + token)).json(), await (await h.request(`/api/blotter/portal/${token}/deliverables`)).json()]);
  assert.ok(!/June statement|monthly fee|correction/i.test(seenByClient), 'Internal discussion never reaches the client link');
  assert.ok(!h.mails.some(m => m.to.includes('sam@cove.example') && /June statement|monthly fee/.test(m.text)));
});

test('agent keys only prepare; a person approves or declines and the decision is recorded', async () => {
  const key = await h.json('/keys', { label: 'Practice assistant' }, h.owner), auth = { authorization: 'Bearer ' + key.key };
  await h.json('/keys', { label: 'Nope' }, preparer, 403);
  const context = await h.json('/agent/context', undefined, '', 200, auth);
  assert.ok(context.jobs.some(j => j.id === nextJob.id));
  await h.json('/state', undefined, '', 401, auth);
  const roll = await h.json('/agent/prepare-rollforward', { jobId: nextJob.id, dueDate: '2027-04-28', dueNote: 'ATO lodgement program' }, '', 200, auth);
  assert.equal(roll.status, 'pending');
  await h.json(`/proposals/${roll.id}/decide`, { decision: 'approve' }, '', 401, auth);
  const approved = await h.json(`/proposals/${roll.id}/decide`, { decision: 'approve' }, h.owner);
  assert.equal(approved.result.period_start, '2027-01-01');
  await h.json(`/proposals/${roll.id}/decide`, { decision: 'approve' }, h.owner, 409);
  const recorded = (await h.json('/state', undefined, h.owner)).proposals.find(p => p.id === roll.id);
  assert.equal(recorded.decided_by, 'owner@example.test');
  assert.equal(recorded.result_id, approved.result.id);
  const remind = await h.json('/agent/prepare-reminder', { jobId: nextJob.id }, '', 200, auth);
  const before = h.mails.length;
  const reminded = await h.json(`/proposals/${remind.id}/decide`, { decision: 'approve' }, h.owner);
  assert.equal(h.mails.length, before + 1);
  assert.equal((await h.json('/jobs/' + nextJob.id, undefined, h.owner)).reminders[0].proposal_id, remind.id);
  assert.ok(reminded.result.portalUrl);
  const unbilled = context.unbilled.filter(l => l.job_id === nextJob.id).map(l => l.source_key);
  const prep = await h.json('/agent/prepare-export', { title: 'Agent prepared', sourceKeys: unbilled.length ? unbilled : ['time:none'] }, '', 200, auth);
  const declined = await h.json(`/proposals/${prep.id}/decide`, { decision: 'decline', reason: 'Bill next month' }, h.owner);
  assert.equal(declined.status, 'declined');
  await h.json(`/keys/${key.id}/revoke`, {}, h.owner);
  await h.json('/agent/context', undefined, '', 401, auth);
});

test('client list move-in: dry run, exact commit, journal, replay and undo that keeps clients with jobs', async () => {
  const file = await readFile(new URL('../../fixtures/client-list.csv', import.meta.url), 'utf8');
  const before = (await h.json('/state', undefined, h.owner)).clients.length;
  const preview = await h.json('/import/preview', { csv: file }, h.owner);
  assert.equal(preview.clients.length, 3);
  assert.match(preview.summary.warnings.join(' '), /practice_notes/);
  assert.equal((await h.json('/state', undefined, h.owner)).clients.length, before, 'A dry run changes nothing');
  await h.json('/import/preview', { csv: 'client_name,abn\nBad,123' }, h.owner).then(p => assert.equal(p.summary.errors.length, 1));
  await h.json('/import/commit', { csv: file, fingerprint: 'changed' }, h.owner, 409);
  let imported = await h.json('/import/commit', { csv: file, fingerprint: preview.fingerprint }, h.owner);
  while (imported.job.state !== 'completed') imported = await h.json('/import/resume', { id: imported.job.id }, h.owner);
  assert.equal((await h.json('/import/commit', { csv: file, fingerprint: preview.fingerprint }, h.owner)).job.id, imported.job.id);
  const clients = (await h.json('/state', undefined, h.owner)).clients;
  assert.equal(clients.length, before + 3);
  const used = clients.find(c => c.name === 'Ridgeline Plumbing');
  await h.json('/jobs', { clientId: used.id, templateId: template.id, periodStart: '2026-07-01', dueDate: '2026-10-28', dueNote: 'ATO', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  let undone = await h.json('/import/undo', { id: imported.job.id }, h.owner);
  while (undone.job.state === 'undoing') undone = await h.json('/import/undo', { id: imported.job.id }, h.owner);
  const journal = await h.json('/import/status', { id: imported.job.id }, h.owner);
  assert.equal(journal.job.state, 'undone');
  assert.ok(journal.originals.length > 0, 'The original file is kept in the journal');
  const after = (await h.json('/state', undefined, h.owner)).clients;
  assert.equal(after.length, before + 1);
  assert.ok(after.some(c => c.id === used.id), 'A client with a job survives undo');
});

test('erasing a file removes its bytes everywhere and fences older archives', async () => {
  oldArchive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
  assert.ok(oldArchive.includes('runeditrun-portability'));
  await h.json(`/files/${erasedFile.id}/erase`, { confirm: erasedFile.name, reason: 'Client asked' }, reviewer, 403);
  await h.json(`/files/${erasedFile.id}/erase`, { confirm: 'wrong', reason: 'Client asked' }, h.owner, 400);
  await h.json(`/files/${erasedFile.id}/erase`, { confirm: erasedFile.name, reason: 'Client withdrew consent' }, h.owner);
  await h.json('/files/' + erasedFile.id, undefined, h.owner, 404);
  newArchive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
  assert.ok(!newArchive.includes(b64('INV-1 $110')), 'Erased bytes are absent from new archives');
});

test('restore needs an empty installation, an intact archive and the latest erasure journal', async () => {
  await h.json('/restore', { archive: newArchive, confirm: 'RESTORE' }, h.owner, 409);
  const target = await harness();
  try {
    const damaged = await target.request('/api/blotter/restore', { archive: newArchive.replace('Harbour Lane', 'Harbour Lame'), confirm: 'RESTORE' }, target.owner);
    assert.equal(damaged.status, 400);
    const stale = await target.request('/api/blotter/restore', { archive: oldArchive, journal: newArchive, confirm: 'RESTORE' }, target.owner);
    assert.equal(stale.status, 409);
    assert.match((await stale.json()).error, /erasure/);
    assert.equal((await target.json('/restore', { archive: newArchive, confirm: 'RESTORE' }, target.owner)).phase, 'complete');
    const rowsOf = archive => archive.trim().split('\n').map(line => JSON.parse(line)).filter(r => r.kind === 'part').flatMap(p => p.items).filter(i => i.kind === 'row').map(i => JSON.stringify({ table: i.table, row: i.row })).sort();
    const roundtrip = await (await target.request('/api/blotter/backup', undefined, target.owner)).text();
    assert.deepEqual(rowsOf(roundtrip), rowsOf(newArchive), 'Every archived row survives export, restore and export');
    const exportId = csv.split('\r\n')[1].split(',')[0];
    assert.equal(await (await target.request(`/api/blotter/exports/${exportId}/csv`, undefined, target.owner)).text(), csv);
    assert.equal(await (await target.request('/api/blotter/files/' + keptFile.id, undefined, target.owner)).text(), 'date,amount\n2026-07-01,10');
    await target.json('/files/' + erasedFile.id, undefined, target.owner, 404);
  } finally { await target.close(); }
});
