// The first release's jobs, end to end through the built Worker's HTTP doors.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, createHmac, generateKeyPairSync, randomBytes, sign as signWith } from 'node:crypto';
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

test('TIME-004 expenses: a receipted filing fee with markup is approved and billed, a non-billable cost counts in profitability, unapproved expenses cannot be billed', async () => {
  const add = (body, who = preparer, expected = 200) => h.json(`/jobs/${nextJob.id}/expenses`, body, who, expected);
  const receipt = { name: 'state-receipt.pdf', mime: 'application/pdf', contentBase64: b64('%PDF state filing fee receipt') };
  const fee = await add({ kind: 'filing_fee', date: '2026-11-03', description: 'State annual report fee', costCents: 4500, billable: true, markupPercent: 10, receipt });
  assert.deepEqual([fee.costCents, fee.chargeCents, fee.status], [4500, 4950, 'pending']);
  const courier = await add({ kind: 'postage', date: '2026-11-03', description: 'Courier to client', costCents: 1200, billable: false });
  await add({ kind: 'postage', date: '2026-11-03', description: 'Marked-up but not billable', costCents: 100, billable: false, markupPercent: 5 }, preparer, 400);
  await add({ kind: 'postage', date: '2026-12-10', description: 'In the closed December period', costCents: 100 }, preparer, 409);
  // Mileage costs tenths of a mile at the firm rate in force on its date.
  const drive = { kind: 'mileage', date: '2026-11-04', description: 'Drive to client office', miles: '12.4', billable: true, paidBy: 'staff' };
  await add(drive, preparer, 409);
  await h.json('/mileage-rates', { effectiveFrom: '2026-11-01', centsPerMile: 70 }, reviewer, 403);
  await h.json('/mileage-rates', { effectiveFrom: '2026-11-01', centsPerMile: 70 }, h.owner);
  const mileage = await add(drive);
  assert.deepEqual([mileage.mileTenths, mileage.costCents, mileage.chargeCents], [124, 868, 868]); // 12.4 mi × 70 cents
  // An unapproved expense cannot be billed.
  assert.ok(!(await h.json('/billing', undefined, reviewer)).unbilled.some(l => l.source_id === fee.id));
  assert.match((await h.json('/exports', { title: 'Too soon', sourceKeys: ['exp:' + fee.id] }, reviewer, 409)).error, /approved billable expenses/);
  await h.json(`/expenses/${fee.id}/decide`, { decision: 'approve' }, preparer, 403);
  for (const e of [fee, courier, mileage]) await h.json(`/expenses/${e.id}/decide`, { decision: 'approve' }, reviewer);
  await h.json(`/expenses/${fee.id}/decide`, { decision: 'reject', reason: 'Late' }, reviewer, 409);
  const billing = await h.json('/billing', undefined, reviewer);
  const line = billing.unbilled.find(l => l.source_key === 'exp:' + fee.id);
  assert.deepEqual([line.kind, line.amount_cents, line.cost_cents, line.markup_percent], ['expense', 4950, 4500, 10]);
  assert.ok(!billing.unbilled.some(l => l.source_id === courier.id), 'A non-billable expense stays off the bill');
  await h.json('/exports', { title: 'Courier', sourceKeys: ['exp:' + courier.id] }, reviewer, 409);
  assert.equal(billing.wip.byKind.expense, 4950 + 868);
  assert.equal(billing.wip.totalCents, billing.unbilled.reduce((sum, l) => sum + l.amount_cents, 0));
  // The staff member is owed the mileage at cost, apart from the client charge.
  assert.deepEqual(billing.reimbursements.map(r => [r.id, r.person_email, r.cost_cents, r.reimbursed_at]), [[mileage.id, 'preparer@example.test', 868, null]]);
  await h.json(`/expenses/${fee.id}/reimbursed`, {}, h.owner, 409);
  await h.json(`/expenses/${mileage.id}/reimbursed`, {}, reviewer, 403);
  await h.json(`/expenses/${mileage.id}/reimbursed`, {}, h.owner);
  assert.equal((await h.json('/billing', undefined, h.owner)).reimbursements[0].reimbursed_by, 'owner@example.test');
  // Invoice the filing fee: one line at cost plus markup, once.
  const draft = await h.json('/exports', { title: 'November expenses', sourceKeys: ['exp:' + fee.id] }, reviewer);
  assert.deepEqual([draft.totalCents, draft.lines[0].description], [4950, 'Filing fee: State annual report fee (cost 4500 cents + 10% markup)']);
  await h.json('/exports', { title: 'Again', sourceKeys: ['exp:' + fee.id] }, reviewer, 409);
  const listed = (await h.json('/billing', undefined, h.owner)).exports.find(e => e.id === draft.id);
  await h.json(`/exports/${draft.id}/approve`, { revision: listed.revision, reviewNote: 'Receipt checked' }, h.owner);
  const lines = (await (await h.request(`/api/blotter/exports/${draft.id}/csv`, undefined, h.owner)).text()).split('\r\n');
  assert.match(lines[1], /,expense,2026-11-03,preparer@example\.test,Filing fee: State annual report fee \(cost 4500 cents \+ 10% markup\),,,4950,AUD$/);
  const download = await h.request(`/api/blotter/expenses/${fee.id}/receipt`, undefined, preparer);
  assert.equal(await download.text(), '%PDF state filing fee receipt');
  // The job shows each expense and counts every approved cost in its margin.
  const detail = await h.json('/jobs/' + nextJob.id, undefined, preparer);
  assert.equal(detail.expenses.find(e => e.id === fee.id).export_id, draft.id);
  const p = detail.profitability;
  assert.deepEqual([p.billableExpenseCents, p.expenseCostCents, p.nonBillableExpenseCents], [4950 + 868, 4500 + 1200 + 868, 1200]);
  assert.equal(p.marginCents, p.billableValueCents - p.expenseCostCents);
});

test('WORK-009 tasks: role and named owners, dates relative to the due date that follow it, re-routing on a new preparer, SOP links, required attachments and the weekly plan', async () => {
  await h.json('/team', { email: 'quinn@example.test', name: 'Quinn Preparer', role: 'preparer' }, h.owner);
  await h.json('/team/invite', { email: 'quinn@example.test' }, h.owner);
  const quinn = await h.login('quinn@example.test');
  const sop = 'https://sops.example.test/1040/organizer';
  const tasks = [
    { label: 'Review organizer', assignee: 'preparer', dueFrom: 'due', dueDays: -10, startFrom: 'start', startDays: 0, estimateMinutes: 45, instructions: 'Check every schedule against last year', sopUrl: sop },
    { label: 'Manager check', assignee: 'manager', dueFrom: 'due', dueDays: -5 },
    { label: 'Partner sign-off memo', assignee: 'reviewer@example.test', dueFrom: 'due', dueDays: -2 },
    { label: 'Upload signed 8879', assignee: 'preparer', dueFrom: 'due', dueDays: -1, requiresAttachment: true, clientFacing: true },
    { label: 'Scan prior-year return', assignee: 'quinn@example.test', dueFrom: 'start', dueDays: 14 },
  ];
  const base = { name: '1040 return', recurrence: 'annual', steps: 'unused', requests: 'W-2 forms' };
  await h.json('/templates', { ...base, tasks: [{ label: 'x', assignee: 'nobody@example.test' }] }, h.owner, 400);
  await h.json('/templates', { ...base, tasks: [{ label: 'x', sopUrl: 'javascript:alert(1)' }] }, h.owner, 400);
  const t1040 = await h.json('/templates', { ...base, tasks }, h.owner);
  const household = await h.json('/clients', { name: 'Rivera household', contactName: 'Ana Rivera', contactEmail: 'ana@rivera.example' }, h.owner);
  const work = await h.json('/jobs', { clientId: household.id, templateId: t1040.id, periodStart: '2027-01-01', dueDate: '2027-03-15', dueNote: 'Federal filing deadline',
    preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test', managerEmail: 'owner@example.test' }, h.owner);
  const view = async (who = h.owner) => (await h.json('/jobs/' + work.id, undefined, who)).steps;
  let steps = await view();
  assert.deepEqual(steps.map(s => [s.label, s.owner, s.due_date]), [
    ['Review organizer', 'preparer@example.test', '2027-03-05'], ['Manager check', 'owner@example.test', '2027-03-10'],
    ['Partner sign-off memo', 'reviewer@example.test', '2027-03-13'], ['Upload signed 8879', 'preparer@example.test', '2027-03-14'],
    ['Scan prior-year return', 'quinn@example.test', '2027-01-15']]);
  // A task assigned by name lets that preparer read the job and act only on their own task; the grant is audited.
  assert.equal((await h.json('/jobs/' + work.id, undefined, quinn)).job.access, 'task');
  assert.ok((await h.json('/state', undefined, quinn)).jobs.some(j => j.id === work.id));
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 1, done: true }, quinn, 403);
  await h.json(`/jobs/${work.id}/time`, { date: '2027-01-04', minutes: 5, description: 'x' }, quinn, 404);
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 5, done: true }, quinn);
  assert.ok((await h.json('/team', undefined, h.owner)).audit.some(a => a.action === 'job.task_access' && a.object_id === work.id && a.detail.startsWith('quinn@example.test')));
  assert.deepEqual([steps[0].start_date, steps[0].estimate_minutes, steps[0].instructions, steps[0].sop_url], ['2027-01-01', 45, 'Check every schedule against last year', sop]);
  // The client sees only client-facing tasks, without internal instructions.
  await h.json(`/jobs/${work.id}/reminders`, {}, h.owner);
  const portal = await h.json('/portal/' + portalToken(h.mails.at(-1)), undefined);
  assert.deepEqual(portal.tasks, [{ label: 'Upload signed 8879', dueDate: '2027-03-14', done: false }]);
  // The preparer completes the first task; a required attachment is enforced.
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 1, done: true }, preparer);
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 4, done: true }, preparer, 400);
  const done = (await view(preparer))[0];
  // Moving the work's due date moves open task dates; the completed task keeps its dates.
  const reschedule = { jobIds: [work.id], dueDate: '2027-03-31', dueNote: 'Moved to the extension plan' };
  await h.json('/bulk/reassign', { ...reschedule, fingerprint: (await h.json('/bulk/reassign/preview', reschedule, h.owner)).fingerprint }, h.owner);
  steps = await view();
  assert.deepEqual(steps.map(s => s.due_date), ['2027-03-05', '2027-03-26', '2027-03-29', '2027-03-30', '2027-01-15']);
  // A new preparer takes the open Preparer task; the completed one keeps its completer and time.
  const handover = { jobIds: [work.id], preparerEmail: 'quinn@example.test' };
  await h.json('/bulk/reassign', { ...handover, fingerprint: (await h.json('/bulk/reassign/preview', handover, h.owner)).fingerprint }, h.owner);
  steps = await view(quinn);
  assert.deepEqual(steps.map(s => s.owner), ['preparer@example.test', 'owner@example.test', 'reviewer@example.test', 'quinn@example.test', 'quinn@example.test']);
  assert.deepEqual([steps[0].done_by, steps[0].done_at], ['preparer@example.test', done.done_at]);
  const plan = await h.json('/plan?week=2027-03-29', undefined, quinn);
  assert.deepEqual(plan.tasks.map(t => [t.label, t.due_date, t.job_id]), [['Upload signed 8879', '2027-03-30', work.id]]);
  assert.ok(plan.jobs.some(j => j.id === work.id));
  assert.ok(!(await h.json('/plan?week=2027-03-29', undefined, preparer)).tasks.some(t => t.job_id === work.id));
  await h.json('/plan?week=2027-03-30', undefined, quinn, 400);
  assert.deepEqual((await h.json('/plan?week=2027-03-29', undefined, h.owner)).tasks.map(t => t.label), ['Manager check']);
  assert.equal((await h.json('/plan?week=2027-03-29', undefined, h.owner)).tasks[0].sop_url, '');
  assert.equal((await h.json('/plan?week=2027-02-22', undefined, h.owner)).tasks.length, 0);
  // Completing with the attachment records it, and it can be downloaded.
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 4, done: true, attachment: { name: '8879.pdf', mime: 'application/pdf', contentBase64: b64('%PDF signed 8879') } }, quinn);
  const last = (await view(quinn))[3];
  assert.deepEqual([last.done_by, last.owner, last.attachment_name], ['quinn@example.test', 'quinn@example.test', '8879.pdf']);
  assert.equal(await (await h.request(`/api/blotter/jobs/${work.id}/steps/4/attachment`, undefined, quinn)).text(), '%PDF signed 8879');
  assert.ok(!(await h.json('/plan?week=2027-03-29', undefined, quinn)).tasks.length);
  assert.ok((await h.json('/portal/' + portalToken(h.mails.at(-1)), undefined)).tasks[0].done);
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

// Last: a required client field applies to every client created after it.
test('CRM-002 groups, typed fields and tags: filter a segment, schedule its annual work, preview a bulk field change; the same rules hold for the API and CSV import', async () => {
  await h.json('/clients/fields', { key: 'service_tier', label: 'Service tier', type: 'choice', choices: 'Essentials, Plus, Premier', required: true }, preparer, 403);
  await h.json('/clients/fields', { key: 'fiscal_year_end', label: 'Fiscal year end', type: 'date' }, h.owner);
  await h.json('/clients/fields', { key: 'service_tier', label: 'Service tier', type: 'choice', choices: 'Essentials, Plus, Premier', required: true }, reviewer);
  await h.json('/clients', { name: 'No tier' }, h.owner, 400);
  await h.json('/clients', { name: 'Bad tier', fields: { service_tier: 'Gold' } }, h.owner, 400);
  await h.json('/clients', { name: 'Bad date', fields: { service_tier: 'Plus', fiscal_year_end: '2026-13-01' } }, h.owner, 400);
  await h.json('/clients', { name: 'Unknown field', fields: { service_tier: 'Plus', shoe_size: '9' } }, h.owner, 400);
  const make = (name, fields, tags) => h.json('/clients', { name, fields, tags }, h.owner);
  const parent = await make('Atlas Holdings Inc', { service_tier: 'Premier', fiscal_year_end: '2026-06-30' }, 'priority');
  const sub = await make('Atlas Logistics LLC', { service_tier: 'Plus', fiscal_year_end: '2026-06-30' }, '');
  const home = await make('Rivera Household', { service_tier: 'Essentials' }, 'individual, Priority');
  await make('Unrelated Bakery', { service_tier: 'Plus', fiscal_year_end: '2026-06-30' }, 'priority');
  assert.deepEqual([home.fields, home.tags], [{ service_tier: 'Essentials' }, ['individual', 'priority']]);

  // Group a parent, its subsidiary and the owner's household, then filter by group, tag and field.
  const members = [{ clientId: parent.id, relationship: 'parent' }, { clientId: sub.id, relationship: 'subsidiary' }, { clientId: home.id, relationship: 'household' }];
  await h.json('/groups', { name: 'Atlas family', members }, preparer, 403);
  await h.json('/groups', { name: 'Atlas family', members: [{ clientId: parent.id, relationship: 'cousin' }] }, h.owner, 400);
  const atlas = (await h.json('/groups', { name: 'Atlas family', members }, h.owner)).find(g => g.name === 'Atlas family');
  assert.deepEqual(atlas.members.map(m => [m.client, m.relationship]), [['Atlas Holdings Inc', 'parent'], ['Atlas Logistics LLC', 'subsidiary'], ['Rivera Household', 'household']]);
  const names = async query => (await h.json('/clients/segment?' + new URLSearchParams(query), undefined, reviewer)).map(c => c.name);
  assert.deepEqual(await names({ groupId: atlas.id }), ['Atlas Holdings Inc', 'Atlas Logistics LLC', 'Rivera Household']);
  assert.deepEqual(await names({ groupId: atlas.id, tag: 'priority' }), ['Atlas Holdings Inc', 'Rivera Household']);
  assert.deepEqual(await names({ field: 'fiscal_year_end', value: '2026-06-30' }), ['Atlas Holdings Inc', 'Atlas Logistics LLC', 'Unrelated Bakery']);
  await h.json('/clients/segment?groupId=' + atlas.id, undefined, preparer, 403);

  // Schedule the group's annual work from the segment.
  const segment = await h.json('/clients/segment?groupId=' + atlas.id, undefined, reviewer);
  const annual = await h.json('/templates', { name: 'Annual return', recurrence: 'annual', steps: 'Prepare return', requests: 'Organizer' }, h.owner);
  const schedule = { templateId: annual.id, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'IRS filing calendar', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test', clients: segment.map(c => ({ clientId: c.id })) };
  const plan = await h.json('/bulk/schedule/preview', schedule, reviewer);
  assert.deepEqual(plan.lines.map(l => l.action), ['create', 'create', 'create']);
  assert.equal((await h.json('/bulk/schedule', { ...schedule, fingerprint: plan.fingerprint }, reviewer)).created.length, 3);

  // Preview a bulk field change: one invalid value is rejected; only the previewed change lands.
  const change = { key: 'service_tier', lines: [{ clientId: parent.id, value: 'Premier' }, { clientId: sub.id, value: 'Premier' }, { clientId: home.id, value: 'Platinum' }] };
  await h.json('/clients/bulk-fields/preview', change, preparer, 403);
  const preview = await h.json('/clients/bulk-fields/preview', change, reviewer);
  assert.deepEqual(preview.lines.map(l => [l.client, l.from, l.to, l.action]), [['Atlas Holdings Inc', 'Premier', 'Premier', 'unchanged'], ['Atlas Logistics LLC', 'Plus', 'Premier', 'change'], ['Rivera Household', 'Essentials', 'Platinum', 'rejected']]);
  assert.match(preview.lines[2].reason, /Service tier must be one of/);
  await h.json('/clients/bulk-fields', { ...change, fingerprint: 'stale' }, reviewer, 409);
  assert.deepEqual((await h.json('/clients/bulk-fields', { ...change, fingerprint: preview.fingerprint }, reviewer)).changed, [sub.id]);
  const tiers = Object.fromEntries((await h.json('/state', undefined, h.owner)).clients.map(c => [c.name, JSON.parse(c.fields).service_tier]));
  assert.deepEqual(['Atlas Holdings Inc', 'Atlas Logistics LLC', 'Rivera Household', 'Unrelated Bakery'].map(n => tiers[n]), ['Premier', 'Premier', 'Essentials', 'Plus']);
  await h.json(`/clients/${home.id}/profile`, { fields: { service_tier: '' } }, h.owner, 400);
  await h.json(`/clients/${home.id}/profile`, { tags: 'household' }, preparer, 403);

  // The CSV import applies the same required-field and type rules.
  const missing = await h.json('/import/preview', { csv: 'client_name,field:service_tier,tags\nNorth Pier LLC,Plus,priority;new\nNo Tier Co,,' }, h.owner);
  assert.equal(missing.summary.errors.length, 1);
  assert.match(missing.summary.errors[0], /No Tier|Service tier is required/);
  await h.json('/import/preview', { csv: 'client_name,field:shoe_size\nX,9' }, h.owner, 400);
  const csv = 'client_name,field:service_tier,field:fiscal_year_end,tags\nNorth Pier LLC,Plus,2026-09-30,priority;new';
  const reviewed = await h.json('/import/preview', { csv }, h.owner);
  let imported = await h.json('/import/commit', { csv, fingerprint: reviewed.fingerprint }, h.owner);
  while (imported.job.state !== 'completed') imported = await h.json('/import/resume', { id: imported.job.id }, h.owner);
  const pier = await h.json('/clients/segment?tag=new', undefined, h.owner);
  assert.deepEqual(pier.map(c => [c.name, JSON.parse(c.fields), JSON.parse(c.tags)]), [['North Pier LLC', { service_tier: 'Plus', fiscal_year_end: '2026-09-30' }, ['new', 'priority']]]);
});

// RFC 6238 codes as an authenticator app computes them; `offset` moves whole 30-second steps.
const totp = (secret, offset = 0) => {
  let bits = 0, value = 0; const key = [];
  for (const c of secret) { value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c); bits += 5; if (bits >= 8) { key.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const mac = createHmac('sha1', Buffer.from(key)).update(counter).digest(), o = mac[19] & 15;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
};
// A software passkey: a P-256 key, "none" attestation in CBOR, and assertions it signs with a rising counter.
const cbor = v => {
  const head = (major, n) => n < 24 ? [major << 5 | n] : n < 256 ? [major << 5 | 24, n] : [major << 5 | 25, n >> 8, n & 255];
  if (typeof v === 'number') return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === 'string') return [...head(3, Buffer.byteLength(v)), ...Buffer.from(v)];
  if (v instanceof Uint8Array) return [...head(2, v.length), ...v];
  return [...head(5, v.size), ...[...v].flatMap(([k, x]) => [...cbor(k), ...cbor(x)])];
};
const passkey = origin => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' }), jwk = publicKey.export({ format: 'jwk' }), id = randomBytes(16);
  const rp = createHash('sha256').update(new URL(origin).hostname).digest();
  let count = 0;
  const data = (flags, extra = []) => { const n = Buffer.alloc(4); n.writeUInt32BE(count); return Buffer.from([...rp, flags, ...n, ...extra]); };
  const client = (type, challenge) => Buffer.from(JSON.stringify({ type, challenge, origin }));
  return {
    register: options => ({ id: id.toString('base64url'), clientDataJSON: client('webauthn.create', options.challenge).toString('base64url'),
      attestationObject: Buffer.from(cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', data(0x41, [...Buffer.alloc(16), 0, id.length, ...id,
        ...cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]))])]]))).toString('base64url') }),
    assert: options => {
      count += 1;
      const auth = data(0x01), c = client('webauthn.get', options.challenge);
      return { id: id.toString('base64url'), clientDataJSON: c.toString('base64url'), authenticatorData: auth.toString('base64url'),
        signature: signWith('sha256', Buffer.concat([auth, createHash('sha256').update(c).digest()]), privateKey).toString('base64url') };
    },
  };
};
const wrongCode = secret => String((Number(totp(secret)) + 500000) % 1e6).padStart(6, '0');

// Runs last: once the policy is on, every later request needs a verified second factor.
test('ACCESS-004 enforced MFA: enroll before any client, TOTP and recovery-code step-up, owner reset revokes sessions, agent keys follow, enrollment report', async () => {
  const key = await h.json('/keys', { label: 'Reviewer assistant' }, reviewer), auth = { authorization: 'Bearer ' + key.key };
  await h.json('/team/mfa-policy', { required: true }, reviewer, 403);
  await h.json('/team/mfa-policy', { required: true }, h.owner);
  // Sessions from before the policy see no client data until they enroll; agent keys cannot go around it.
  for (const who of [h.owner, preparer, reviewer]) assert.equal((await h.json('/state', undefined, who, 403)).mfa, 'enroll');
  assert.equal((await h.json('/jobs/' + job.id, undefined, preparer, 403)).mfa, 'enroll');
  await h.json('/agent/context', undefined, '', 403, auth);
  const start = await h.json('/mfa/totp/start', {}, preparer);
  assert.match(start.uri, /^otpauth:\/\/totp\/Blotter%3Apreparer%40example\.test\?secret=[A-Z2-7]{32}&/);
  await h.json('/mfa/totp/confirm', { id: start.id, code: wrongCode(start.secret) }, preparer, 400);
  const enrolled = await h.json('/mfa/totp/confirm', { id: start.id, code: totp(start.secret) }, preparer);
  assert.equal(enrolled.recoveryCodes.length, 10);
  assert.deepEqual((await h.json('/state', undefined, preparer)).jobs.map(j => j.id).includes(job.id), true);
  // A sign-in with the right first factor and no second factor is refused until it passes TOTP; a used code never works twice.
  const second = await h.login('preparer@example.test');
  assert.equal((await h.json('/state', undefined, second, 403)).mfa, 'verify');
  await h.json('/mfa/totp/start', {}, second, 403);
  await h.json('/mfa/verify', { code: totp(start.secret) }, second, 400);
  assert.equal((await h.json('/mfa/verify', { code: totp(start.secret, 1) }, second)).method, 'totp');
  await h.json('/state', undefined, second);
  // A recovery code verifies one session, once.
  const third = await h.login('preparer@example.test'), fourth = await h.login('preparer@example.test');
  await h.json('/mfa/verify', { recoveryCode: enrolled.recoveryCodes[0].toUpperCase() }, third);
  await h.json('/mfa/verify', { recoveryCode: enrolled.recoveryCodes[0] }, fourth, 400);
  assert.equal((await h.json('/mfa', undefined, fourth)).recoveryCodesLeft, 9);
  // A passkey is added from a verified session only, and a new sign-in steps up with it; a replayed assertion fails.
  const device = passkey(h.origin);
  await h.json('/mfa/passkey/start', {}, fourth, 403);
  await h.json('/mfa/passkey/confirm', device.register(await h.json('/mfa/passkey/start', {}, second)), second);
  const answer = device.assert(await h.json('/mfa/passkey/challenge', {}, fourth));
  assert.equal((await h.json('/mfa/verify', { passkey: answer }, fourth)).method, 'passkey');
  await h.json('/state', undefined, fourth);
  await h.json('/mfa/passkey/challenge', {}, third);
  await h.json('/mfa/verify', { passkey: answer }, third, 400);
  // The principal enrolls, then resets the preparer's lost factor: every preparer session ends and the audit names who reset it.
  const own = await h.json('/mfa/totp/start', {}, h.owner);
  await h.json('/mfa/totp/confirm', { id: own.id, code: totp(own.secret) }, h.owner);
  await h.json('/team/mfa-reset', { email: 'owner@example.test', reason: 'Self' }, h.owner, 400);
  await h.json('/team/mfa-reset', { email: 'preparer@example.test', reason: 'Lost phone' }, h.owner);
  for (const who of [preparer, second, third, fourth]) await h.json('/state', undefined, who, 401);
  const reset = (await h.json('/team', undefined, h.owner)).audit.find(a => a.action === 'mfa.reset');
  assert.deepEqual([reset.actor, reset.object_id, reset.detail], ['owner@example.test', 'preparer@example.test', 'Lost phone; all sessions revoked']);
  assert.equal((await h.json('/state', undefined, await h.login('preparer@example.test'), 403)).mfa, 'enroll');
  // The enrollment report lists every person's factor state.
  const report = (await (await h.request('/api/blotter/team/mfa-report', undefined, h.owner)).text()).trim().split('\r\n').map(line => line.split(','));
  const column = name => report[0].indexOf(name), row = address => report.find(r => r[0] === address);
  assert.deepEqual(['owner@example.test', 'preparer@example.test', 'reviewer@example.test'].map(a => row(a)[column('enrolled')]), ['yes', 'no', 'no']);
  assert.ok(report.slice(1).every(r => r[column('policy_required')] === 'yes'));
  // Once the reviewer enrolls, their agent key works again; five wrong codes lock verification for a while.
  const rs = await h.json('/mfa/totp/start', {}, reviewer);
  await h.json('/mfa/totp/confirm', { id: rs.id, code: totp(rs.secret) }, reviewer);
  await h.json('/agent/context', undefined, '', 200, auth);
  const later = await h.login('reviewer@example.test');
  for (let i = 0; i < 5; i++) await h.json('/mfa/verify', { code: wrongCode(rs.secret) }, later, 400);
  await h.json('/mfa/verify', { code: totp(rs.secret, 1) }, later, 429);
  // Configurable limits: an idle session ends; a session older than the lifetime ends even while in use.
  await h.json('/team/session-limits', { idleMinutes: 0 }, h.owner, 400);
  await h.json('/team/session-limits', { idleMinutes: 1 }, h.owner);
  await h.json('/state', undefined, reviewer);
  for (let i = 0; i < 3; i++) { await new Promise(r => setTimeout(r, 21_000)); await h.json('/state', undefined, h.owner); }
  assert.match((await h.json('/state', undefined, reviewer, 401)).error, /inactivity/);
  await h.json('/state', undefined, reviewer, 401);
  await h.json('/team/session-limits', { idleMinutes: 1, sessionMinutes: 1 }, h.owner);
  assert.match((await h.json('/state', undefined, h.owner, 401)).error, /time limit/);
});
