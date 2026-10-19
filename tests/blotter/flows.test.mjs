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

test('sessions, roles and origin checks guard every handler', async () => {
  await h.json('/state', undefined, '', 401);
  await h.json('/clients', { name: 'X' }, '', 401);
  await h.json('/clients', { name: 'Denied' }, preparer, 403);
  await h.json('/templates', { name: 'Denied', recurrence: 'monthly', steps: 'a', requests: 'b' }, preparer, 403);
  await h.json('/team', { email: 'x@example.test', name: 'X', role: 'preparer' }, reviewer, 403);
  await h.json('/team/rates', { email: 'preparer@example.test', rateCents: 1 }, reviewer, 403);
  await h.json('/clients', { name: 'Cross-site' }, h.owner, 403, { origin: 'https://outside.example.test' });
  await h.json('/backup', undefined, reviewer, 403);
  await h.json('/import/preview', { csv: 'client_name\nA' }, reviewer, 403);
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

test('the Inbox wall reads what clients owe, dated reminders, a received document and a review return, for the jobs the person may read', async () => {
  const chase = await h.json('/clients', { name: 'Garcia', contactName: 'Elena Garcia', contactEmail: 'elena@garcia.example' }, h.owner);
  const start = { clientId: chase.id, templateId: template.id, periodStart: '2026-10-01', dueDate: '2026-11-12', dueNote: 'Firm close rule', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  const mine = await h.json('/jobs', start, h.owner);
  const theirs = await h.json('/jobs', { ...start, periodStart: '2026-07-01', preparerEmail: 'reviewer@example.test' }, h.owner);
  const card = async (who, id) => (await h.json('/inbox', undefined, who)).jobs.find(j => j.id === id);
  // Asked: every request still requested, no reminder yet; the preparer never sees another preparer's job.
  let wall = await h.json('/inbox', undefined, preparer);
  assert.ok(!wall.jobs.some(j => j.id === theirs.id));
  let c = wall.jobs.find(j => j.id === mine.id);
  assert.deepEqual(c.requests.map(r => r.status), ['requested', 'requested']);
  assert.deepEqual(c.reminders, []);
  assert.equal(c.returned, null);
  // A reminder is dated on the card; an upload on the client's link makes the document received.
  await h.json(`/jobs/${mine.id}/reminders`, {}, preparer);
  const token = portalToken(h.mails.at(-1));
  c = await card(preparer, mine.id);
  assert.equal(c.reminders.length, 1);
  assert.ok(Date.parse(c.reminders[0].at) > 0);
  assert.equal((await h.request(`/api/blotter/portal/${token}/requests/${c.requests[0].id}`, { name: 'bank.csv', mime: 'text/csv', contentBase64: b64('a,b') })).status, 200);
  c = await card(preparer, mine.id);
  assert.equal(c.requests[0].status, 'received');
  assert.ok(c.requests[0].received_at);
  // All in, prepared and submitted; the reviewer returns it and the card carries the return and its note.
  for (const r of c.requests) { if (r.status === 'requested') await h.request(`/api/blotter/portal/${token}/requests/${r.id}`, { name: 'inv.txt', mime: 'text/plain', contentBase64: b64('x') }); await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, preparer); }
  let detail = await h.json('/jobs/' + mine.id, undefined, preparer);
  for (const s of detail.steps) await h.json(`/jobs/${mine.id}/steps`, { ordinal: s.ordinal, done: true }, preparer);
  detail = await h.json(`/jobs/${mine.id}/submit`, { revision: (await h.json('/jobs/' + mine.id, undefined, preparer)).job.revision }, preparer);
  await h.json(`/jobs/${mine.id}/review`, { revision: detail.job.revision, decision: 'return', note: 'Bank total does not tie' }, reviewer);
  c = await card(preparer, mine.id);
  assert.equal(c.returned.note, 'Bank total does not tie');
  assert.equal(c.returned.by, 'Riley Reviewer');
  assert.ok(c.requests.every(r => r.status === 'accepted'));
  assert.ok((await h.json('/inbox', undefined, reviewer)).jobs.some(j => j.id === theirs.id));
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

test('MSG-001 message templates: a firm template with an attachment renders per client, unresolved fields are refused by name, edits never change sent messages or their files, preparers copy but cannot edit', async () => {
  const body = 'Hello {{contact_first_name}},\n\nFor {{work_item}}, due {{due_date}}, we still need:\n{{outstanding_requests}}\n\nUpload here: {{portal_link}}\n{{sender_name}}, {{firm_name}}';
  await h.json('/messages/templates', { scope: 'firm', name: 'Bad', subject: 'x', body: 'Hi {{nickname}}' }, h.owner, 400);
  await h.json('/messages/templates', { scope: 'firm', name: 'Mine', subject: 'x', body: 'y' }, preparer, 403);
  const checklist = { name: 'month-end-checklist.pdf', mime: 'application/pdf', contentBase64: b64('%PDF month-end checklist v1') };
  const sha = text => createHash('sha256').update(text).digest('hex');
  await h.json('/messages/templates', { scope: 'firm', name: 'Too many', subject: 'x', body: 'y', attachments: Array(6).fill(checklist) }, h.owner, 400);
  const close = await h.json('/messages/templates', { scope: 'firm', name: 'Month-end close request', category: 'Document requests', subject: '{{client_name}}: documents for {{period}}', body, attachments: [checklist] }, h.owner);
  const tide = await h.json('/clients', { name: 'Tide Pool Studio', contactEmail: 'studio@tidepool.example', fields: { service_tier: 'Plus' } }, h.owner);
  const tideJob = await h.json('/jobs', { clientId: tide.id, templateId: template.id, periodStart: '2026-04-01', dueDate: '2026-07-28', dueNote: 'Lodgement program', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  // The firm name is not set yet: preview names it and sending is refused.
  assert.deepEqual((await h.json(`/jobs/${nextJob.id}/reminders/preview`, { templateId: close.id }, reviewer)).missing.map(m => m.label), ['firm name']);
  assert.match((await h.json(`/jobs/${nextJob.id}/reminders`, { templateId: close.id }, reviewer, 409)).error, /firm name/);
  await h.json('/firm', { name: 'Harbour & Co Accounting' }, reviewer, 403);
  await h.json('/firm', { name: 'Harbour & Co Accounting' }, h.owner);
  const harbour = await h.json(`/jobs/${nextJob.id}/reminders/preview`, { templateId: close.id }, reviewer);
  const outstanding = (await h.json('/jobs/' + nextJob.id, undefined, reviewer)).requests.filter(r => r.status === 'requested').map(r => `- ${r.label}`).join('\n');
  assert.equal(harbour.subject, 'Harbour Lane Cafe Pty Ltd: documents for Oct–Dec 2026');
  assert.deepEqual(harbour.attachments.map(f => [f.name, f.size, f.sha256]), [['month-end-checklist.pdf', 27, sha('%PDF month-end checklist v1')]]);
  assert.equal(harbour.body, `Hello Mia,\n\nFor Quarterly BAS Oct–Dec 2026, due ${nextJob.due_date}, we still need:\n${outstanding}\n\nUpload here: [secure upload link, created when you send]\nRiley Reviewer, Harbour & Co Accounting`);
  // A client with no contact name is refused naming the field, until the sender fills it in.
  const sales = (await h.json('/jobs/' + tideJob.id, undefined, reviewer)).requests.find(r => r.label === 'Sales invoices');
  await h.json(`/requests/${sales.id}/files`, { name: 'sales.csv', mime: 'text/csv', contentBase64: b64('INV-7,220') }, reviewer);
  await h.json(`/requests/${sales.id}/decide`, { decision: 'accept' }, reviewer);
  const studio = await h.json(`/jobs/${tideJob.id}/reminders/preview`, { templateId: close.id }, reviewer);
  assert.deepEqual([studio.subject, studio.missing.map(m => m.label)], ['Tide Pool Studio: documents for Apr–Jun 2026', ['contact first name']]);
  // Each client's own outstanding list is rendered.
  assert.match(studio.body, /we still need:\n- Bank statements\n\n/);
  assert.notEqual(outstanding, '- Bank statements');
  assert.match((await h.json(`/jobs/${tideJob.id}/reminders`, { templateId: close.id }, reviewer, 409)).error, /contact first name/);
  await h.json(`/jobs/${tideJob.id}/reminders`, { templateId: close.id, values: { contact_first_name: 'Lena' } }, reviewer);
  assert.match(h.mails.at(-1).text, /^Hello Lena,/);
  await h.json(`/jobs/${nextJob.id}/reminders`, { templateId: close.id }, reviewer);
  const sent = h.mails.at(-1), stored = (await h.json('/jobs/' + nextJob.id, undefined, reviewer)).reminders[0];
  assert.equal(sent.subject, harbour.subject);
  assert.match(sent.text, /Upload here: https:\/\/127\.0\.0\.1:\d+\/portal\/up_[0-9a-f]{64}\n/);
  assert.deepEqual([stored.subject, stored.template_id, stored.template_version], [harbour.subject, close.id, 1]);
  // The template's file goes with the message, and the reminder records exactly which file it was.
  assert.deepEqual(sent.attachments.map(a => [a.filename, a.content_type, Buffer.from(a.content, 'base64').toString()]), [['month-end-checklist.pdf', 'application/pdf', '%PDF month-end checklist v1']]);
  assert.deepEqual(JSON.parse(stored.attachments).map(f => [f.name, f.sha256]), [['month-end-checklist.pdf', sha('%PDF month-end checklist v1')]]);
  assert.equal(stored.message, harbour.body.replace('[secure upload link, created when you send]', `${h.origin}/portal/…`));
  // Only the principal edits firm templates; a preparer saves a personal copy and edits that.
  await h.json(`/messages/templates/${close.id}`, { subject: 'x', body: 'y' }, reviewer, 403);
  await h.json(`/messages/templates/${close.id}`, { subject: 'x', body: 'y' }, preparer, 403);
  const copy = await h.json(`/messages/templates/${close.id}/copy`, {}, preparer);
  assert.deepEqual(copy.attachments.map(f => f.name), ['month-end-checklist.pdf']);
  await h.json(`/messages/templates/${copy.id}`, { subject: 'My {{period}} request', body }, preparer);
  assert.deepEqual((await h.json('/messages/templates', undefined, reviewer)).templates.map(t => t.name), ['Month-end close request']);
  assert.deepEqual((await h.json('/messages/templates?q=MONTH-END', undefined, preparer)).templates.map(t => [t.scope, t.version]), [['firm', 1], ['personal', 2]]);
  assert.equal((await h.json('/messages/templates?category=Billing', undefined, preparer)).templates.length, 0);
  // A new version changes the next message only; the sent one keeps its text.
  assert.equal((await h.json(`/messages/templates/${close.id}`, { subject: 'Reminder: {{client_name}} {{period}}', body }, h.owner)).version, 2);
  await h.json(`/jobs/${tideJob.id}/reminders`, { templateId: close.id, values: { contact_first_name: 'Lena' } }, reviewer);
  assert.equal(h.mails.at(-1).subject, 'Reminder: Tide Pool Studio Apr–Jun 2026');
  assert.equal((await h.json('/jobs/' + tideJob.id, undefined, reviewer)).reminders[0].template_version, 2);
  assert.deepEqual(h.mails.at(-1).attachments.map(a => a.filename), ['month-end-checklist.pdf']);
  // Replacing the file is a new version too: the next message carries the new file, the sent ones keep theirs.
  const revised = { name: 'month-end-checklist-2027.pdf', mime: 'application/pdf', contentBase64: b64('%PDF month-end checklist v2') };
  assert.equal((await h.json(`/messages/templates/${close.id}`, { subject: 'Reminder: {{client_name}} {{period}}', body, attachments: [revised] }, h.owner)).version, 3);
  await h.json(`/jobs/${tideJob.id}/reminders`, { templateId: close.id, values: { contact_first_name: 'Lena' } }, reviewer);
  assert.deepEqual(h.mails.at(-1).attachments.map(a => [a.filename, Buffer.from(a.content, 'base64').toString()]), [['month-end-checklist-2027.pdf', '%PDF month-end checklist v2']]);
  const tideSent = (await h.json('/jobs/' + tideJob.id, undefined, reviewer)).reminders.map(r => [r.template_version, JSON.parse(r.attachments).map(f => f.name)]);
  assert.deepEqual(tideSent, [[3, ['month-end-checklist-2027.pdf']], [2, ['month-end-checklist.pdf']], [1, ['month-end-checklist.pdf']]]);
  assert.deepEqual((await h.json('/jobs/' + nextJob.id, undefined, reviewer)).reminders[0], stored);
  await h.json(`/messages/templates/${close.id}/delete`, {}, h.owner);
  await h.json(`/jobs/${nextJob.id}/reminders`, { templateId: close.id }, reviewer, 404);
  assert.deepEqual((await h.json('/jobs/' + nextJob.id, undefined, reviewer)).reminders[0], stored);
});

test('DUE-002 tax notices: open from a client upload, verify the deadline, assign, link a transcript and receipt, follow up; a failed response stays open and closing needs evidence and an outcome', async () => {
  const upload = (await h.json('/jobs/' + job.id, undefined, reviewer)).requests.flatMap(r => r.files).find(f => f.channel === 'portal' && !f.erased_at);
  const pdf = name => ({ name: name + '.pdf', mime: 'application/pdf', contentBase64: b64('%PDF ' + name) });
  const base = { fileId: upload.id, agency: 'IRS', jurisdiction: 'federal', noticeType: 'CP2000', taxPeriod: '2025', noticeDate: '2026-10-01', responseDue: '2026-10-30',
    assigneeEmail: 'preparer@example.test', authorization: 'Form 2848 on file, CAF 0001-23456R' };
  await h.json('/notices', base, preparer, 403);
  await h.json('/notices', { ...base, responseDue: '2026-09-01' }, reviewer, 400);
  const opened = await h.json('/notices', base, reviewer), id = opened.notice.id;
  assert.deepEqual([opened.notice.client_id, opened.source.id, opened.source.channel, opened.notice.due_verified_at], [client.id, upload.id, 'portal', null]);
  // The assigned practitioner checks the date on the notice and corrects it; the change is recorded.
  const verified = await h.json(`/notices/${id}/deadline`, { responseDue: '2026-10-31' }, preparer);
  assert.deepEqual([verified.notice.response_due, verified.notice.due_verified_by], ['2026-10-31', 'preparer@example.test']);
  assert.deepEqual((await h.json('/notices', undefined, preparer)).map(n => [n.id, n.response_due]), [[id, '2026-10-31']]);
  const add = (body, expected = 200) => h.json(`/notices/${id}/events`, body, preparer, expected);
  await add({ kind: 'transcript', note: 'Account transcript 2025' }, 400);
  const transcript = await add({ kind: 'transcript', note: 'Account transcript for 2025, pulled under the 2848', file: pdf('transcript') });
  await add({ kind: 'client_question', note: 'Asked Mia for the missing 1099-B' });
  await add({ kind: 'follow_up', note: 'Check for the IRS reply', followUpOn: '2027-01-15' });
  const failed = await add({ kind: 'response_submitted', note: 'Fax did not go through', result: 'failed', file: pdf('fax-error') });
  assert.equal((await h.json('/notices', undefined, reviewer)).find(n => n.id === id).next_follow_up, '2027-01-15');
  // A failed response keeps the notice open; closing needs an outcome and evidence.
  assert.match((await h.json(`/notices/${id}/close`, { outcome: 'resolved', note: 'Sent', evidenceEventId: transcript.id }, preparer, 409)).error, /latest response is not accepted/);
  const accepted = await add({ kind: 'response_submitted', note: 'Response mailed by certified post', result: 'accepted' });
  await h.json(`/notices/${id}/close`, { outcome: 'resolved', note: 'Sent' }, preparer, 400);
  await h.json(`/notices/${id}/close`, { outcome: 'resolved', note: 'Sent', evidenceEventId: accepted.id }, preparer, 409);
  await h.json(`/notices/${id}/close`, { outcome: 'resolved', note: 'Sent', evidenceEventId: failed.id }, preparer, 409);
  const receipt = await add({ kind: 'receipt', note: 'IRS letter accepting the response', file: pdf('irs-acceptance') });
  const closed = await h.json(`/notices/${id}/close`, { outcome: 'resolved', note: 'The IRS accepted the response; no change to tax', evidenceEventId: receipt.id }, preparer);
  assert.deepEqual([closed.notice.status, closed.notice.outcome, closed.notice.evidence_event_id, closed.notice.closed_by], ['closed', 'resolved', receipt.id, 'preparer@example.test']);
  assert.deepEqual(closed.events.map(e => [e.kind, e.result]), [['transcript', null], ['client_question', null], ['follow_up', null], ['response_submitted', 'failed'], ['response_submitted', 'accepted'], ['receipt', null]]);
  assert.equal(await (await h.request(`/api/blotter/notices/${id}/events/${receipt.id}/file`, undefined, preparer)).text(), '%PDF irs-acceptance');
  await add({ kind: 'note', note: 'Too late' }, 409);
  // A documented exception closes without evidence, by the assignee, a reviewer or the principal.
  const other = await h.json('/notices', { ...base, noticeType: 'CP14', assigneeEmail: 'reviewer@example.test' }, h.owner);
  await h.json(`/notices/${other.notice.id}/close`, { outcome: 'exception', note: 'Client engaged other counsel' }, preparer, 403);
  await h.json(`/notices/${other.notice.id}/close`, { outcome: 'exception' }, reviewer, 400);
  assert.equal((await h.json(`/notices/${other.notice.id}/close`, { outcome: 'exception', note: 'Client engaged other counsel' }, reviewer)).notice.outcome, 'exception');
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
test('WORK-003 dependencies: a close feeds a tax engagement, an organizer answer picks the branch, completions advance only eligible tasks, cycles are refused and an exception is recorded without faking evidence', async () => {
  const close = await h.json('/templates', { name: 'Monthly close', recurrence: 'monthly', steps: 'Reconcile bank\nClose the books', requests: 'Bank statements' }, h.owner);
  const questions = [{ key: 'itemized', label: 'Itemizing deductions this year?', options: ['yes', 'no'] }];
  const base = { name: '1040 with close', recurrence: 'annual', steps: 'unused', requests: 'W-2 forms\nCharity receipts', questions };
  // Cycles, self-waits and unknown references are refused when the template is saved.
  assert.match((await h.json('/templates', { ...base, tasks: [{ label: 'A', after: [2] }, { label: 'B', after: [3] }, { label: 'C', after: [1] }] }, h.owner, 400)).error, /Dependency cycle: task 1 → task 2 → task 3 → task 1/);
  await h.json('/templates', { ...base, tasks: [{ label: 'A', after: [1] }] }, h.owner, 400);
  await h.json('/templates', { ...base, tasks: [{ label: 'A', when: { question: 'married', equals: 'yes' } }] }, h.owner, 400);
  await h.json('/templates', { ...base, tasks: [{ label: 'A', when: { question: 'itemized', equals: 'maybe' } }] }, h.owner, 400);
  await h.json('/templates', { ...base, tasks: [{ label: 'A', afterDocuments: [3] }] }, h.owner, 400);
  await h.json('/templates', { ...base, tasks: [{ label: 'A', afterJob: { templateId: 'nope' } }] }, h.owner, 404);
  const tax = await h.json('/templates', { ...base, tasks: [
    { label: 'Collect organizer', assignee: 'preparer' },
    { label: 'Review Schedule A', assignee: 'preparer', after: [1], afterDocuments: [2], when: { question: 'itemized', equals: 'yes' } },
    { label: 'Standard deduction check', assignee: 'reviewer', after: [1], when: { question: 'itemized', equals: ['no'] } },
    { label: 'Prepare return', assignee: 'preparer', after: [2, 3], afterJob: { templateId: close.id, gate: 'signed_off' } },
    { label: 'Reconcile W-2 wages', assignee: 'preparer', afterDocuments: [1], requiresAttachment: true },
  ] }, h.owner);
  const bakery = await h.json('/clients', { name: 'Okafor Bakery LLC', contactName: 'Ada Okafor', contactEmail: 'ada@okafor.example', fields: { service_tier: 'Plus' } }, h.owner);
  const people = { preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  const work = await h.json('/jobs', { clientId: bakery.id, templateId: tax.id, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'Federal filing deadline', ...people }, h.owner);
  const view = async (who = preparer) => h.json('/jobs/' + work.id, undefined, who);
  const state = async () => (await view()).steps.map(s => [s.state, s.blockers]);
  assert.deepEqual(await state(), [
    ['ready', []],
    ['blocked', ['Waiting for the answer to "Itemizing deductions this year?"', 'Waiting for task 1: Collect organizer', "Waiting for the client's Charity receipts to be accepted"]],
    ['blocked', ['Waiting for the answer to "Itemizing deductions this year?"', 'Waiting for task 1: Collect organizer']],
    ['blocked', ['Waiting for task 2: Review Schedule A', 'Waiting for task 3: Standard deduction check', 'Waiting for a Monthly close job covering 2026-12-31; none exists yet']],
    ['blocked', ["Waiting for the client's W-2 forms to be accepted"]]]);
  // A blocked task cannot be completed; the refusal names what it waits for.
  assert.deepEqual((await h.json(`/jobs/${work.id}/steps`, { ordinal: 3, done: true }, reviewer, 409)).blockers.length, 2);
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 1, done: true }, preparer);
  // An exception never chooses a branch: the answer must be recorded.
  assert.match((await h.json(`/jobs/${work.id}/steps/3/exception`, { reason: 'Skip' }, reviewer, 409)).error, /Record the answer/);
  await h.json(`/jobs/${work.id}/answers`, { key: 'itemized', value: 'maybe' }, preparer, 400);
  let detail = await h.json(`/jobs/${work.id}/answers`, { key: 'itemized', value: 'no' }, preparer);
  assert.deepEqual([detail.answers[0].value, detail.answers[0].answered_by], ['no', 'preparer@example.test']);
  // The organizer answer takes the standard-deduction branch: Schedule A no longer applies and is never required.
  assert.deepEqual(detail.steps.map(s => s.state), ['done', 'not_applicable', 'ready', 'blocked', 'blocked']);
  assert.ok(detail.steps[2].ready_at);
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 2, done: true }, preparer, 409);
  assert.ok((await h.json('/notifications', undefined, reviewer)).some(n => n.kind === 'task_ready' && n.job_id === work.id && n.summary.startsWith('Standard deduction check is ready')));
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 3, done: true }, reviewer);
  assert.deepEqual((await view()).steps[3].blockers, ['Waiting for a Monthly close job covering 2026-12-31; none exists yet']);
  // The December close feeds the return: until it is signed off the return waits for it, then it advances on its own.
  const closeJob = await h.json('/jobs', { clientId: bakery.id, templateId: close.id, periodStart: '2026-12-01', dueDate: '2027-01-20', dueNote: 'Firm close calendar', ...people }, h.owner);
  assert.deepEqual((await view()).steps[3].blockers, ['Waiting for Monthly close Dec 2026 to be signed off']);
  const closeDetail = await h.json('/jobs/' + closeJob.id, undefined, preparer);
  for (const s of closeDetail.steps) await h.json(`/jobs/${closeJob.id}/steps`, { ordinal: s.ordinal, done: true }, preparer);
  await h.json(`/requests/${closeDetail.requests[0].id}/files`, { name: 'dec.pdf', mime: 'application/pdf', contentBase64: b64('%PDF dec') }, preparer);
  await h.json(`/requests/${closeDetail.requests[0].id}/decide`, { decision: 'accept' }, preparer);
  const submitted = await h.json(`/jobs/${closeJob.id}/submit`, {}, preparer);
  assert.equal((await view()).steps[3].state, 'blocked');
  await h.json(`/jobs/${closeJob.id}/review`, { revision: submitted.job.revision, decision: 'signoff', note: 'December close reviewed' }, reviewer);
  detail = await view();
  assert.deepEqual([detail.steps[3].state, detail.steps[3].prerequisite.status, !!detail.steps[3].ready_at], ['ready', 'signed_off', true]);
  assert.ok((await h.json('/notifications', undefined, preparer)).some(n => n.kind === 'task_ready' && n.summary.startsWith('Prepare return is ready')));
  assert.ok((await h.json('/team', undefined, h.owner)).audit.some(a => a.action === 'task.ready' && a.object_id === work.id && a.detail === '4: Prepare return'));
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 4, done: true }, preparer);
  // An authorized exception needs a reason; it lets the wage task go ahead without accepting the W-2 or its own attachment.
  await h.json(`/jobs/${work.id}/steps/5/exception`, { reason: 'Client is mailing the W-2; wages agreed from payroll report' }, preparer, 403);
  await h.json(`/jobs/${work.id}/steps/5/exception`, {}, reviewer, 400);
  detail = await h.json(`/jobs/${work.id}/steps/5/exception`, { reason: 'Client is mailing the W-2; wages agreed from payroll report' }, reviewer);
  assert.deepEqual([detail.steps[4].state, detail.steps[4].exception_by, detail.steps[4].exception_waived], ['ready', 'reviewer@example.test', ["Waiting for the client's W-2 forms to be accepted"]]);
  await h.json(`/jobs/${work.id}/steps/5/exception`, { reason: 'again' }, reviewer, 409);
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 5, done: true }, preparer, 400);
  await h.json(`/jobs/${work.id}/steps`, { ordinal: 5, done: true, attachment: { name: 'payroll.csv', mime: 'text/csv', contentBase64: b64('wages,52000') } }, preparer);
  detail = await view();
  assert.deepEqual(detail.requests.map(r => r.status), ['requested', 'requested']);
  assert.ok((await h.json('/team', undefined, h.owner)).audit.some(a => a.action === 'step.exception' && a.detail.startsWith('5: Client is mailing the W-2')));
  // Review still needs every client document: the exception completed nothing it waited for.
  assert.match((await h.json(`/jobs/${work.id}/submit`, {}, preparer, 409)).error, /Accept every requested client document/);
  for (const r of detail.requests) {
    await h.json(`/requests/${r.id}/files`, { name: r.label + '.pdf', mime: 'application/pdf', contentBase64: b64('%PDF ' + r.label) }, preparer);
    await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, preparer);
  }
  assert.equal((await h.json('/state', undefined, preparer)).jobs.find(j => j.id === work.id).open_steps, 0);
  assert.equal((await h.json(`/jobs/${work.id}/submit`, {}, preparer)).job.status, 'review');
});

test('WORK-002 recurring work: monthly and fiscal-year rules create each period inside a three-month lead time once, claim existing jobs, skip, pause, catch up and never alter a created job', async () => {
  const monthly = await h.json('/templates', { name: 'Monthly bookkeeping', recurrence: 'monthly', steps: 'Reconcile\nClose', requests: 'Bank statements\nReceipts' }, h.owner);
  const fiscal = await h.json('/templates', { name: '1120-S return', recurrence: 'annual', steps: 'Prepare\nReview', requests: 'Trial balance' }, h.owner);
  const firm = await h.json('/clients', { name: 'Lindqvist Studio Inc', fields: { service_tier: 'Premier' } }, h.owner);
  const people = { clientId: firm.id, preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  const monthlyRule = { ...people, templateId: monthly.id, firstPeriod: '2027-01-01', endPeriod: '2027-10-01', leadMonths: 3, dueDays: 20, dueNote: 'Firm close: 20 days after month end', budgetMinutes: 240 };
  await h.json('/rules', monthlyRule, preparer, 403);
  await h.json('/rules', { ...people, templateId: fiscal.id, firstPeriod: '2026-07-01', months: [1], dueDays: 75, dueNote: 'x' }, h.owner, 400);
  const preview = (await h.json('/rules/preview', monthlyRule, h.owner)).schedule;
  assert.deepEqual(preview.slice(0, 2).map(p => [p.periodStart, p.label, p.createOn, p.dueDate]), [['2027-01-01', 'Jan 2027', '2026-10-01', '2027-02-20'], ['2027-02-01', 'Feb 2027', '2026-11-01', '2027-03-20']]);
  const rule = await h.json('/rules', monthlyRule, h.owner);
  await h.json('/rules', monthlyRule, reviewer, 409);
  const fy = await h.json('/rules', { ...people, templateId: fiscal.id, firstPeriod: '2026-07-01', leadMonths: 3, dueDays: 75, dueNote: 'Fiscal year end + 75 days (Form 1120-S, 15th day of the 3rd month)' }, reviewer);
  const jobs = async () => (await h.json('/state', undefined, h.owner)).jobs.filter(j => j.client_id === firm.id).map(j => [j.title, j.period_start, j.due_date]).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  // The hourly Cron Trigger: exactly the periods inside the lead time, each once, with fresh requests, budget and calculated due dates.
  await h.scheduled('2027-01-15T12:17:00Z');
  assert.deepEqual(await jobs(), [['1120-S return', '2026-07-01', '2027-09-13'],
    ['Monthly bookkeeping', '2027-01-01', '2027-02-20'], ['Monthly bookkeeping', '2027-02-01', '2027-03-20'], ['Monthly bookkeeping', '2027-03-01', '2027-04-20'], ['Monthly bookkeeping', '2027-04-01', '2027-05-20']]);
  const state = await h.json('/state', undefined, h.owner);
  const april = state.jobs.find(j => j.client_id === firm.id && j.period_start === '2027-04-01');
  const detail = await h.json('/jobs/' + april.id, undefined, h.owner);
  assert.deepEqual([detail.job.budget_minutes, detail.job.preparer_email, detail.requests.map(r => r.status)], [240, 'preparer@example.test', ['requested', 'requested']]);
  assert.equal(state.jobs.find(j => j.client_id === firm.id && j.template_id === fiscal.id).period_label, 'Jul 2026–Jun 2027');
  // A restarted scheduler repeats nothing.
  await h.scheduled('2027-01-15T13:17:00Z');
  assert.equal((await jobs()).length, 5);
  // Two existing future jobs are attached; advancing the horizon creates only the following period.
  const made = [];
  for (const periodStart of ['2027-05-01', '2027-06-01']) made.push(await h.json('/jobs', { ...people, templateId: monthly.id, periodStart, dueDate: periodStart.replace('-01', '-25'), dueNote: 'Set by hand' }, h.owner));
  for (const j of made) await h.json(`/rules/${rule.id}/claim`, { jobId: j.id }, h.owner);
  await h.json(`/rules/${rule.id}/claim`, { jobId: made[0].id }, h.owner, 409);
  // A person overrides a created job's due date; the scheduler never changes it back.
  const feb = state.jobs.find(j => j.client_id === firm.id && j.period_start === '2027-02-01');
  const override = { jobIds: [feb.id], dueDate: '2027-03-31', dueNote: 'Client on extended close' };
  await h.json('/bulk/reassign', { ...override, fingerprint: (await h.json('/bulk/reassign/preview', override, h.owner)).fingerprint }, h.owner);
  await h.scheduled('2027-04-10T09:17:00Z');
  let list = await jobs();
  assert.deepEqual(list.filter(j => j[0] === 'Monthly bookkeeping').map(j => j[1]), ['2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01', '2027-06-01', '2027-07-01']);
  assert.deepEqual(list.find(j => j[1] === '2027-02-01'), ['Monthly bookkeeping', '2027-02-01', '2027-03-31']);
  assert.deepEqual(list.find(j => j[1] === '2027-05-01'), ['Monthly bookkeeping', '2027-05-01', '2027-05-25']);
  // Pause the client's monthly rule and skip September; downtime then catch-up creates each missing period once.
  await h.json(`/rules/${rule.id}/status`, { status: 'paused', reason: 'Client restructuring' }, h.owner);
  await h.json(`/rules/${rule.id}/skip`, { periodStart: '2027-09-01', reason: 'Combined with October close' }, h.owner);
  await h.json(`/rules/${rule.id}/skip`, { periodStart: '2027-09-15', reason: 'x' }, h.owner, 400);
  await h.json(`/rules/${rule.id}/skip`, { periodStart: '2027-07-01', reason: 'x' }, h.owner, 409);
  await h.scheduled('2027-05-10T09:17:00Z');
  list = await jobs();
  assert.equal(list.filter(j => j[0] === 'Monthly bookkeeping').length, 7);
  assert.ok(list.some(j => j[0] === '1120-S return' && j[1] === '2027-07-01'));
  await h.json(`/rules/${rule.id}/status`, { status: 'active' }, h.owner);
  await h.scheduled('2027-09-01T09:17:00Z');
  await h.scheduled('2027-09-01T10:17:00Z');
  list = await jobs();
  // Through the last period (October) only: August and October, September skipped, nothing after the end.
  assert.deepEqual(list.filter(j => j[0] === 'Monthly bookkeeping').map(j => j[1]).slice(7), ['2027-08-01', '2027-10-01']);
  assert.equal(list.filter(j => j[0] === '1120-S return').length, 2);
  const view = await h.json('/rules', undefined, reviewer);
  const shown = view.rules.find(r => r.id === rule.id);
  assert.deepEqual([shown.status, shown.months.length], ['active', 12]);
  assert.deepEqual(view.held.filter(p => p.rule_id === rule.id).map(p => [p.period_start, p.kind]), [['2027-01-01', 'generated'], ['2027-02-01', 'generated'], ['2027-03-01', 'generated'], ['2027-04-01', 'generated'],
    ['2027-05-01', 'claimed'], ['2027-06-01', 'claimed'], ['2027-07-01', 'generated'], ['2027-08-01', 'generated'], ['2027-09-01', 'skipped'], ['2027-10-01', 'generated']]);
  assert.ok(view.runs.some(r => r.trigger === 'cron' && r.as_of === '2027-09-01' && r.created === 2));
  await h.json('/rules', undefined, preparer, 403);
  assert.equal((await h.json('/rules/run', {}, h.owner)).created, 0);
});

test('CRM-004 duplicate proposals: an imported client that duplicates a native one is proposed with its reasons, compared side by side and can be recorded as different', async () => {
  const native = await h.json('/clients', { name: 'Harbor & Pine Café, LLC', contactName: 'Jo Park', contactEmail: 'Jo@HarborPine.example', fields: { service_tier: 'Plus' } }, h.owner);
  const csv = 'client_id,client_name,abn,contact_name,contact_email,field:service_tier\nK-77,Harbor and Pine Cafe,,Jo Park,jo@harborpine.example,Plus\nK-78,Northwind Traders Inc,,Ann Lee,ann@northwind.example,Plus\n';
  const preview = await h.json('/import/preview', { csv }, h.owner);
  let imported = await h.json('/import/commit', { csv, fingerprint: preview.fingerprint }, h.owner);
  while (imported.job.state !== 'completed') imported = await h.json('/import/resume', { id: imported.job.id }, h.owner);
  const other = await h.json('/clients', { name: 'Northwind Traders Holdings', contactEmail: 'office@northwind-holdings.example', fields: { service_tier: 'Essentials' } }, h.owner);
  const copy = (await h.json('/state', undefined, h.owner)).clients.find(c => c.name === 'Harbor and Pine Cafe');
  const proposals = await h.json('/clients/duplicates', undefined, reviewer);
  const ours = proposals.find(p => [p.a.id, p.b.id].sort().join() === [native.id, copy.id].sort().join());
  assert.deepEqual(ours.reasons, ['same contact email', 'same name']);
  // Two of three distinct words in common is not similar enough to propose.
  const northwind = (await h.json('/state', undefined, h.owner)).clients.find(c => c.name === 'Northwind Traders Inc');
  assert.ok(!proposals.some(p => [p.a.id, p.b.id].includes(northwind.id) && [p.a.id, p.b.id].includes(other.id)));
  await h.json('/clients/duplicates', undefined, preparer, 403);
  const side = await h.json(`/clients/compare?a=${native.id}&b=${copy.id}`, undefined, h.owner);
  assert.deepEqual(side.fields.filter(f => !f.same).map(f => f.key), ['name', 'source']);
  assert.deepEqual([side.b.linked.jobs, side.reasons], [0, ['same contact email', 'same name']]);
  await h.json('/clients/duplicates/dismiss', { a: native.id, b: copy.id }, h.owner, 400);
  await h.json('/clients/duplicates/dismiss', { a: northwind.id, b: native.id, reason: 'x' }, h.owner, 409);
  await h.json('/clients/duplicates/dismiss', { a: native.id, b: copy.id, reason: 'Two cafes with one owner' }, h.owner);
  await h.json('/clients/duplicates/dismiss', { a: copy.id, b: native.id, reason: 'again' }, h.owner, 409);
  assert.ok(!(await h.json('/clients/duplicates', undefined, h.owner)).some(p => [p.a.id, p.b.id].includes(native.id) && [p.a.id, p.b.id].includes(copy.id)));
});

test('CRM-004 merge and undo: an imported duplicate keeps its source ID, takes signed-off jobs, resolved discussions, closed notices and expenses, undoes exactly, and a re-import matches the survivor; differing EINs need the principal\'s authority', async () => {
  const importAll = async csv => {
    const preview = await h.json('/import/preview', { csv }, h.owner);
    let run = await h.json('/import/commit', { csv, fingerprint: preview.fingerprint }, h.owner);
    while (run.job.state !== 'completed') run = await h.json('/import/resume', { id: run.job.id }, h.owner);
    return preview;
  };
  // The native client already carries a signed-off job, a closed notice and expenses; add a resolved client-wide discussion.
  const talk = await h.json(`/jobs/${nextJob.id}/threads`, { anchor: 'client', title: 'Entity check', body: 'Same cafe as the Karbon record.' }, h.owner);
  await h.json(`/threads/${talk.thread.id}/resolve`, { resolution: 'Confirmed one entity' }, h.owner);
  const csv = 'client_id,client_name,abn,contact_name,contact_email,field:service_tier\nK-90,Harbour Lane Cafe,10000000001,Mia Chen-Wu,MIA@harbourlane.example,Plus\n';
  await importAll(csv);
  const state = async () => (await h.json('/state', undefined, h.owner)).clients;
  const copy = (await state()).find(c => c.name === 'Harbour Lane Cafe');
  const proposed = (await h.json('/clients/duplicates', undefined, reviewer)).find(p => [p.a.id, p.b.id].sort().join() === [client.id, copy.id].sort().join());
  assert.deepEqual(proposed.reasons, ['same EIN', 'same contact email', 'same name']);
  const before = (await h.json(`/clients/compare?a=${client.id}&b=${copy.id}`, undefined, h.owner)).a.linked;
  assert.ok(before.jobs >= 2 && before.notices >= 1 && before.expenses >= 1 && before.threads >= 1);
  // The imported record survives with the native name and the imported contact; every differing field needs a choice.
  const merge = { survivor: copy.id, merged: client.id, keep: { name: 'merged', contact_name: 'survivor', 'fields.service_tier': 'survivor' } };
  await h.json('/clients/merge', merge, preparer, 403);
  assert.match((await h.json('/clients/merge', { ...merge, keep: { name: 'merged', 'fields.service_tier': 'survivor' } }, reviewer, 400)).error, /Contact name/);
  let done = await h.json('/clients/merge', { ...merge, keep: { ...merge.keep, name: 'survivor' } }, reviewer);
  assert.deepEqual([done.moved.jobs, done.moved.notices, done.moved.expenses, done.moved.threads], [before.jobs, before.notices, before.expenses, before.threads]);
  assert.deepEqual([done.undo, done.sourceIds.map(s => s.source_id)], ['available', ['K-90']]);
  const after = await state();
  assert.ok(!after.some(c => c.id === client.id));
  assert.deepEqual(['name', 'contact_name', 'contact_email'].map(k => after.find(c => c.id === copy.id)[k]), ['Harbour Lane Cafe', 'Mia Chen-Wu', 'mia@harbourlane.example']);
  // Invoice drafts follow: the moved jobs' unbilled fees, time and expenses bill to the survivor.
  const billed = async () => (await h.json('/billing', undefined, reviewer)).unbilled.filter(l => [job.id, nextJob.id].includes(l.job_id)).map(l => l.client);
  assert.ok((await billed()).length > 0 && (await billed()).every(n => n === 'Harbour Lane Cafe'));
  // The signed-off job, its time and portal history now belong to the survivor, and its people still see it.
  const moved = await h.json('/jobs/' + job.id, undefined, preparer);
  assert.deepEqual([moved.job.status, moved.client.id], ['signed_off', copy.id]);
  assert.equal((await h.json(`/clients/compare?a=${copy.id}&b=${client.id}`, undefined, h.owner)).b.linked.jobs, 0);
  await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2030-01-01', dueDate: '2030-02-01', dueNote: 'x', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner, 404);
  // Undo before any further edit restores both records exactly; it cannot run twice.
  await h.json(`/clients/merges/${done.id}/undo`, {}, preparer, 403);
  await h.json(`/clients/merges/${done.id}/undo`, {}, reviewer);
  await h.json(`/clients/merges/${done.id}/undo`, {}, reviewer, 409);
  const restored = await h.json(`/clients/compare?a=${client.id}&b=${copy.id}`, undefined, h.owner);
  assert.deepEqual([restored.a.linked, restored.b.linked.jobs], [before, 0]);
  assert.ok((await billed()).every(n => n === 'Harbour Lane Cafe Pty Ltd'));
  assert.deepEqual([restored.a.name, restored.b.name, (await h.json('/jobs/' + job.id, undefined, preparer)).client.id], ['Harbour Lane Cafe Pty Ltd', 'Harbour Lane Cafe', client.id]);
  // Merge again, then re-import the same source with a new row: K-90 matches the survivor and only the new client is created.
  done = await h.json('/clients/merge', merge, h.owner);
  const count = (await state()).length;
  const again = await importAll(csv + 'K-91,Bayside Bakery,,,,Plus\n');
  assert.deepEqual(again.clients.map(c => c.matches?.id ?? null), [copy.id, null]);
  assert.deepEqual((await state()).map(c => c.name).filter(n => /Harbour Lane|Bayside/.test(n)).sort(), ['Bayside Bakery', 'Harbour Lane Cafe Pty Ltd']);
  assert.equal((await state()).length, count + 1);
  // Once the survivor is edited, the merge can no longer be undone.
  await h.json(`/clients/${copy.id}/profile`, { tags: ['merged'] }, h.owner);
  assert.equal((await h.json('/clients/merges', undefined, reviewer)).find(m => m.id === done.id).undo, 'changed');
  assert.match((await h.json(`/clients/merges/${done.id}/undo`, {}, h.owner, 409)).error, /changed after the merge/);
  // Two entities with different EINs: a reviewer cannot join them; the principal can, only with a recorded reason.
  const [x, y] = [await h.json('/clients', { name: 'Acme Holdings', abn: '11111111111', fields: { service_tier: 'Plus' } }, h.owner), await h.json('/clients', { name: 'Acme Holdings', abn: '22222222222', fields: { service_tier: 'Plus' } }, h.owner)];
  const join = { survivor: x.id, merged: y.id, keep: { abn: 'survivor' } };
  assert.match((await h.json('/clients/merge', join, reviewer, 403)).error, /only the principal/);
  await h.json('/clients/merge', join, h.owner, 400);
  assert.equal((await h.json('/clients/merge', { ...join, authority: 'One company; the second EIN was a typo on the old engagement letter' }, h.owner)).authority, 'One company; the second EIN was a typo on the old engagement letter');
});

test('TIME-001 timers and budgets: a timer survives a new session, stops into snapshotted time, restarts once at a time, and the job shows actual against its approved budget', async () => {
  const shop = await h.json('/clients', { name: 'Timber Yard Supplies', fields: { service_tier: 'Plus' } }, h.owner);
  const start = { clientId: shop.id, templateId: template.id, periodStart: '2026-10-01', dueDate: '2026-11-20', dueNote: 'Client calendar', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  await h.json('/jobs', { ...start, budgetMinutes: 0 }, reviewer, 400);
  const work = await h.json('/jobs', { ...start, budgetMinutes: 60 }, reviewer);
  await h.json('/team/rates', { scope: 'client', clientId: shop.id, rateCents: 18000, effectiveFrom: '2026-01-01' }, h.owner);
  await h.json(`/jobs/${work.id}/timer`, { description: 'Bank reconciliation' }, '', 401);
  await h.json(`/jobs/${work.id}/timer`, { description: 'Bank reconciliation' }, h.owner);
  await h.json(`/jobs/${work.id}/timer`, { description: 'Second' }, h.owner, 409);
  // The timer lives on the server: a fresh sign-in sees it running and stops it.
  const later = await h.login('owner@example.test');
  const running = (await h.json('/jobs/' + work.id, undefined, later)).timer;
  assert.deepEqual([running.job_id, running.description], [work.id, 'Bank reconciliation']);
  await h.json('/timer/stop', {}, reviewer, 404);
  await new Promise(r => setTimeout(r, 1100));
  const first = await h.json('/timer/stop', {}, later);
  assert.deepEqual([first.minutes, first.date, first.amountCents], [1, running.started_at.slice(0, 10), Math.floor((first.rateCents + 30) / 60)]);
  await h.json('/timer/stop', {}, later, 404);
  // Restart, then discard: nothing is recorded for a discarded timer.
  await h.json(`/jobs/${work.id}/timer`, { description: 'Payroll check' }, later);
  await h.json('/timer/discard', {}, later);
  await h.json(`/jobs/${work.id}/timer`, { description: 'Payroll check' }, later);
  await h.json('/timer/stop', {}, later);
  await h.json(`/jobs/${work.id}/time`, { date: '2026-10-20', minutes: 70, description: 'Accounts payable review' }, later);
  const detail = await h.json('/jobs/' + work.id, undefined, reviewer);
  assert.deepEqual(detail.time.map(t => t.minutes).sort((a, b) => a - b), [1, 1, 70]);
  assert.deepEqual(detail.budget, { budgetMinutes: 60, actualMinutes: 72, actualCents: detail.time.reduce((s, t) => s + t.amount_cents, 0), varianceMinutes: 12 });
  // A preparer cannot time a job they cannot see.
  const hidden = await h.json('/jobs', { ...start, periodStart: '2026-07-01', preparerEmail: 'reviewer@example.test' }, h.owner);
  await h.json(`/jobs/${hidden.id}/timer`, { description: 'x' }, preparer, 404);
});

test('TIME-001 billable status and tasks: non-billable time keeps its amount and budget but never reaches WIP, an export or the margin; corrections carry status and task; a rate change leaves prior amounts; others cannot edit', async () => {
  const yard = await h.json('/clients', { name: 'Kestrel Freight Co', fields: { service_tier: 'Plus' } }, h.owner);
  const work = await h.json('/jobs', { clientId: yard.id, templateId: template.id, periodStart: '2027-02-01', dueDate: '2027-03-20', dueNote: 'Client calendar', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test', budgetMinutes: 120 }, reviewer);
  await h.json('/team/rates', { scope: 'client', clientId: yard.id, rateCents: 12000, effectiveFrom: '2027-01-01' }, h.owner);
  const log = (body, expected = 200) => h.json(`/jobs/${work.id}/time`, { date: '2027-02-02', ...body }, preparer, expected);
  await log({ minutes: 30, description: 'Unclear', billable: 'no' }, 400);
  await log({ minutes: 30, description: 'Unknown task', taskOrdinal: 99 }, 404);
  const billed = await log({ minutes: 60, description: 'Payroll reconciliation', taskOrdinal: 1 });
  const internal = await log({ minutes: 30, description: 'Internal training', billable: false });
  assert.deepEqual([billed.billable, billed.amountCents, internal.billable, internal.amountCents], [true, 12000, false, 6000]);
  // A rate change from March prices March time and leaves February's amounts as recorded.
  await h.json('/team/rates', { scope: 'client', clientId: yard.id, rateCents: 15000, effectiveFrom: '2027-03-01' }, h.owner);
  const march = await log({ date: '2027-03-01', minutes: 60, description: 'March close' });
  assert.equal(march.amountCents, 15000);
  // A timer started as non-billable records non-billable time.
  await h.json(`/jobs/${work.id}/timer`, { description: 'Firm admin', billable: false, taskOrdinal: 2 }, preparer);
  const timed = await h.json('/timer/stop', {}, preparer);
  assert.deepEqual([timed.billable, timed.taskOrdinal], [false, 2]);
  let detail = await h.json('/jobs/' + work.id, undefined, reviewer);
  assert.deepEqual(Object.fromEntries(detail.time.map(t => [t.description, [t.billable, t.amount_cents]])),
    { 'Payroll reconciliation': [1, 12000], 'Internal training': [0, 6000], 'March close': [1, 15000], 'Firm admin': [0, timed.amountCents] });
  assert.deepEqual(detail.time.map(t => t.task).sort(), ['Draft BAS', 'Reconcile bank', null, null].sort());
  assert.deepEqual([detail.budget.actualMinutes, detail.budget.varianceMinutes], [150 + timed.minutes, 30 + timed.minutes]);
  // Return both February entries; each correction keeps the entry's billable status unless the person changes it.
  await h.json('/timesheets/submit', { weekStart: '2027-02-01' }, preparer);
  for (const e of [billed, internal]) await h.json(`/time/${e.id}/review`, { decision: 'return', reason: 'Split the call out' }, reviewer);
  await h.json(`/time/${internal.id}/correct`, { minutes: 20, description: 'Internal training' }, reviewer, 403);
  const keptInternal = await h.json(`/time/${internal.id}/correct`, { minutes: 20, description: 'Internal training' }, preparer);
  const keptBilled = await h.json(`/time/${billed.id}/correct`, { minutes: 45, description: 'Payroll reconciliation' }, preparer);
  assert.deepEqual([keptInternal.billable, keptBilled.billable, keptBilled.amountCents, keptBilled.taskOrdinal], [false, true, 9000, 1]);
  const history = await h.json(`/time/${keptInternal.id}/history`, undefined, preparer);
  assert.match(history.audit.find(a => a.action === 'time.corrected').detail, new RegExp(`replaces ${internal.id} \\(2027-02-02, 30 min not billable`));
  await h.json(`/time/${keptInternal.id}/delete`, {}, preparer, 409);
  for (const e of [keptInternal, keptBilled]) await h.json(`/time/${e.id}/review`, { decision: 'approve' }, reviewer);
  await h.json(`/time/${keptInternal.id}/adjust`, { minutes: 10, reason: 'Extra session' }, preparer, 403);
  const adjustment = await h.json(`/time/${keptInternal.id}/adjust`, { minutes: 10, reason: 'Extra session' }, h.owner);
  // Only approved billable time is ready to bill: non-billable time and its adjustments stay out of WIP, exports and the margin.
  const lines = (await h.json('/billing', undefined, reviewer)).unbilled.filter(l => l.job_id === work.id);
  assert.deepEqual(lines.map(l => [l.source_key, l.amount_cents]), [['time:' + keptBilled.id, 9000]]);
  assert.match((await h.json('/exports', { title: 'Training', sourceKeys: ['time:' + keptInternal.id] }, reviewer, 409)).error, /Non-billable time cannot be billed/);
  await h.json('/exports', { title: 'Training adjustment', sourceKeys: ['adj:' + adjustment.id] }, reviewer, 409);
  detail = await h.json('/jobs/' + work.id, undefined, reviewer);
  assert.equal(detail.profitability.timeCents, 9000);
  assert.equal(detail.budget.actualMinutes, 45 + 20 + 10 + 60 + timed.minutes);
});

test('TIME-001 activity suggestions: only consented actions suggest time with their sources; reject one, approve another, and only approved minutes reach WIP; nobody else sees or decides them', async () => {
  const mill = await h.json('/clients', { name: 'Granite Mill Bakery', fields: { service_tier: 'Plus' } }, h.owner);
  await h.json('/team/rates', { scope: 'client', clientId: mill.id, rateCents: 12000, effectiveFrom: '2026-01-01' }, h.owner);
  const start = periodStart => h.json('/jobs', { clientId: mill.id, templateId: template.id, periodStart, dueDate: '2027-06-30', dueNote: 'Client calendar', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  const early = await start('2026-01-01'), payroll = await start('2026-04-01'), sales = await start('2026-07-01');
  const discuss = (j, title) => h.json(`/jobs/${j.id}/threads`, { title, body: 'Working through this today.', mentions: [] }, preparer);
  const mine = async (who = preparer) => h.json('/time/suggestions', undefined, who);
  // Off by default: actions before consent never suggest time.
  await discuss(early, 'Before consent');
  assert.deepEqual(await mine(), { consentedAt: null, pending: [], decided: [] });
  await h.json('/time/suggestions/consent', { consent: 'yes' }, preparer, 400);
  await h.json('/time/suggestions/consent', { consent: true }, preparer);
  await h.json('/time/suggestions/consent', { consent: true }, preparer, 409);
  await h.json(`/jobs/${sales.id}/steps`, { ordinal: 1, done: true }, preparer);
  const opened = await discuss(payroll, 'Payroll split');
  await h.json(`/threads/${opened.thread.id}/messages`, { body: 'Split confirmed with the client.' }, preparer);
  await h.json(`/threads/${opened.thread.id}/messages`, { body: 'Thanks.' }, reviewer);
  let state = await mine();
  const shown = Object.fromEntries(state.pending.map(s => [s.job_id, s.sources.map(a => [a.action, a.detail]).sort()]));
  assert.deepEqual(shown, { [payroll.id]: [['thread.opened', 'Payroll split'], ['thread.replied', 'Payroll split']], [sales.id]: [['step.done', 'Reconcile bank']] });
  const [forSales, forPayroll] = [sales, payroll].map(j => state.pending.find(s => s.job_id === j.id));
  // Only the person sees and decides their suggestions.
  assert.deepEqual((await mine(reviewer)).pending, []);
  await h.json('/time/suggestions/decide', { jobId: sales.id, day: forSales.day, decision: 'reject' }, reviewer, 404);
  await h.json('/time/suggestions/decide', { jobId: sales.id, day: forSales.day, decision: 'reject' }, h.owner, 404);
  await h.json('/time/suggestions/decide', { jobId: sales.id, day: forSales.day, decision: 'reject', reason: 'A two-minute tick-off' }, preparer);
  await h.json('/time/suggestions/decide', { jobId: sales.id, day: forSales.day, decision: 'approve', minutes: 5, description: 'Late change of mind', billable: true }, preparer, 404);
  // Approval records nothing silently: it needs the minutes and an explicit billable choice.
  const approve = { jobId: payroll.id, day: forPayroll.day, decision: 'approve', minutes: 25, description: 'Payroll split query' };
  await h.json('/time/suggestions/decide', approve, preparer, 400);
  const approved = await h.json('/time/suggestions/decide', { ...approve, billable: true }, preparer);
  assert.deepEqual([approved.entry.date, approved.entry.minutes, approved.entry.amountCents, approved.entry.billable], [forPayroll.day, 25, 5000, true]);
  await h.json('/time/suggestions/decide', { ...approve, billable: true }, preparer, 404);
  state = await mine();
  assert.deepEqual(state.pending, []);
  assert.deepEqual(state.decided.map(d => [d.job_id, d.status, d.entry_id, JSON.parse(d.sources).length]), [[payroll.id, 'approved', approved.entry.id, 2], [sales.id, 'rejected', null, 1]]);
  await h.json(`/time/${approved.entry.id}/delete`, {}, reviewer, 403);
  // Only approved minutes enter WIP: the rejected suggestion recorded nothing, and the approved entry waits for timesheet approval.
  const wipFor = async j => (await h.json('/billing', undefined, reviewer)).unbilled.filter(l => l.job_id === j.id).map(l => [l.kind, l.minutes]);
  assert.deepEqual(await wipFor(payroll), []);
  const day = new Date(forPayroll.day + 'T00:00:00Z'), monday = new Date(day - ((day.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  await h.json('/timesheets/submit', { weekStart: monday }, preparer);
  await h.json(`/time/${approved.entry.id}/review`, { decision: 'approve' }, reviewer);
  assert.deepEqual(await wipFor(payroll), [['time', 25]]);
  assert.deepEqual([await wipFor(sales), (await h.json('/jobs/' + sales.id, undefined, reviewer)).time], [[], []]);
  // Withdrawing consent removes pending suggestions; consenting again never revives earlier actions.
  await discuss(early, 'After consent');
  assert.deepEqual((await mine()).pending.map(s => s.job_id), [early.id]);
  await h.json('/time/suggestions/consent', { consent: false }, preparer);
  assert.deepEqual([(await mine()).consentedAt, (await mine()).pending], [null, []]);
  await h.json('/time/suggestions/consent', { consent: true }, preparer);
  assert.deepEqual((await mine()).pending, []);
});

test('ACCESS-006 offboarding: preview what a preparer owns, refuse a self-review transfer, move everything to two successors in one batch, keep past authors and revoke sessions and agent keys', async () => {
  await h.json('/team', { email: 'leaving@example.test', name: 'Lee Leaving', role: 'preparer' }, h.owner);
  await h.json('/team/invite', { email: 'leaving@example.test' }, h.owner);
  const lee = await h.login('leaving@example.test');
  const plan = await h.json('/templates', { name: 'Monthly payroll', recurrence: 'monthly', steps: 'unused', requests: 'Payroll register', tasks: [{ label: 'Run payroll', assignee: 'preparer' }, { label: 'File 941 notes', assignee: 'leaving@example.test' }] }, h.owner);
  const firm = await h.json('/clients', { name: 'Osprey Marine LLC', fields: { service_tier: 'Plus' } }, h.owner);
  const people = { clientId: firm.id, templateId: plan.id, preparerEmail: 'leaving@example.test', reviewerEmail: 'reviewer@example.test' };
  const jobs = [await h.json('/jobs', { ...people, periodStart: '2027-03-01', dueDate: '2027-04-15', dueNote: 'Firm close' }, h.owner), await h.json('/jobs', { ...people, periodStart: '2027-04-01', dueDate: '2027-05-15', dueNote: 'Firm close' }, h.owner)];
  const rule = await h.json('/rules', { ...people, firstPeriod: '2028-01-01', leadMonths: 0, dueDays: 15, dueNote: 'Firm close' }, h.owner);
  const opened = await h.json(`/jobs/${jobs[0].id}/threads`, { title: 'Payroll tax deposit', body: 'Deposit schedule changed to semiweekly.', mentions: [] }, lee);
  await h.json(`/jobs/${jobs[0].id}/portal/todos`, { body: 'Send the new hire W-4' }, lee);
  await h.json('/team/rates', { scope: 'client', clientId: firm.id, rateCents: 9000, effectiveFrom: '2026-01-01' }, h.owner);
  const unsent = await h.json(`/jobs/${jobs[0].id}/time`, { date: '2027-03-03', minutes: 30, description: 'Payroll setup' }, lee);
  await h.json(`/jobs/${jobs[1].id}/timer`, { description: 'April payroll' }, lee);
  const body = { email: 'leaving@example.test', workSuccessor: 'preparer@example.test', reviewSuccessor: 'reviewer@example.test' };
  await h.json('/team/offboard/preview', body, reviewer, 403);
  // Moving their preparation to the jobs' own reviewer would make that reviewer review their own work.
  assert.match((await h.json('/team/offboard/preview', { ...body, workSuccessor: 'reviewer@example.test' }, h.owner)).problems.join(), /reviewer@example.test cannot review their own work/);
  const preview = await h.json('/team/offboard/preview', body, h.owner);
  assert.deepEqual([preview.jobs.map(j => j.to.preparer), preview.tasks.map(t => t.label), preview.rules.map(r => r.to.preparer), preview.threads.map(t => t.title), preview.templates.map(t => t.name), preview.timer.description, preview.time.map(t => t.id), preview.sessions > 0, preview.problems],
    [['preparer@example.test', 'preparer@example.test'], ['File 941 notes', 'File 941 notes'], ['preparer@example.test'], ['Payroll tax deposit'], ['Monthly payroll'], 'April payroll', [unsent.id], true, []]);
  await h.json('/team/offboard', { ...body, fingerprint: 'stale' }, h.owner, 409);
  assert.deepEqual((await h.json('/team/offboard', { ...body, fingerprint: preview.fingerprint }, h.owner)).moved, { jobs: 2, tasks: 2, rules: 1, notices: 0, threads: 1, portal: 1, proposals: 0, templates: 1 });
  // Nothing is orphaned: work, tasks, the rule, the discussion and future jobs from the template belong to the successors.
  const detail = await h.json('/jobs/' + jobs[0].id, undefined, preparer);
  assert.deepEqual([detail.job.preparer_email, detail.steps.find(s => s.label === 'File 941 notes').assignee_email], ['preparer@example.test', 'preparer@example.test']);
  assert.deepEqual([detail.portal.todos[0].author, detail.portal.todos[0].owner_email], ['leaving@example.test', 'preparer@example.test']);
  assert.deepEqual((await h.json('/rules', undefined, h.owner)).rules.find(r => r.id === rule.id).preparer_email, 'preparer@example.test');
  const next = await h.json('/jobs', { ...people, preparerEmail: 'preparer@example.test', periodStart: '2027-05-01', dueDate: '2027-06-15', dueNote: 'Firm close' }, h.owner);
  assert.equal((await h.json('/jobs/' + next.id, undefined, preparer)).steps.find(s => s.label === 'File 941 notes').assignee_email, 'preparer@example.test');
  // The past message keeps its author; the open discussion has a new owner. Their time stays theirs and waits for approval; the timer recorded nothing.
  const thread = await h.json('/threads/' + opened.thread.id, undefined, preparer);
  assert.deepEqual([thread.thread.owner_email, thread.messages[0].author_email], ['preparer@example.test', 'leaving@example.test']);
  const entries = (await h.json('/timesheets', undefined, reviewer)).entries.filter(e => e.person_email === 'leaving@example.test');
  assert.deepEqual(entries.map(e => [e.id, e.status]), [[unsent.id, 'submitted']]);
  assert.match((await h.json('/team', undefined, h.owner)).audit.find(a => a.action === 'member.offboarded').detail, /timer on .* discarded, 1 time entries submitted/);
  // Deactivated with their sessions revoked, so reactivation alone does not let the old session back in.
  await h.json('/state', undefined, lee, 401);
  await h.json('/team', { email: 'leaving@example.test', name: 'Lee Leaving', role: 'preparer' }, h.owner);
  await h.json('/state', undefined, lee, 401);
  // An urgent deactivation cuts access at once (sessions and agent keys); the work is offboarded afterwards the same way.
  const again = await h.login('leaving@example.test');
  await h.json('/team', { email: 'leaving@example.test', name: 'Lee Leaving', role: 'reviewer' }, h.owner);
  const key = await h.json('/keys', { label: 'Lee assistant' }, again), bearer = { authorization: 'Bearer ' + key.key };
  await h.json('/agent/context', undefined, '', 200, bearer);
  const urgent = await h.json('/jobs', { ...people, preparerEmail: 'leaving@example.test', periodStart: '2027-06-01', dueDate: '2027-07-15', dueNote: 'Firm close' }, h.owner);
  await h.json('/team', { email: 'leaving@example.test', name: 'Lee Leaving', role: 'reviewer', active: false }, h.owner);
  await h.json('/state', undefined, again, 401);
  await h.json('/clients', { name: 'Denied' }, again, 401);
  await h.json('/agent/context', undefined, '', 401, bearer);
  const later = await h.json('/team/offboard/preview', body, h.owner);
  assert.deepEqual([later.active, later.jobs.map(j => j.id)], [false, [urgent.id]]);
  await h.json('/team/offboard', { ...body, fingerprint: later.fingerprint }, h.owner);
  assert.equal((await h.json('/jobs/' + urgent.id, undefined, preparer)).job.preparer_email, 'preparer@example.test');
  // Reactivation restores neither the old session nor the revoked agent key.
  await h.json('/team', { email: 'leaving@example.test', name: 'Lee Leaving', role: 'reviewer' }, h.owner);
  await h.json('/agent/context', undefined, '', 401, bearer);
  await h.json('/state', undefined, again, 401);
});

test('CRM-003 client history and unresolved items: a newest-first timeline with authors and job links, searchable by kind and text; open items name an owner, next action and due condition and change hands; a preparer sees only jobs they may read', async () => {
  const shop = await h.json('/clients', { name: 'Larkspur Books', contactName: 'Iris Lark', contactEmail: 'iris@larkspur.example', fields: { service_tier: 'Plus' } }, h.owner);
  const start = { clientId: shop.id, templateId: template.id, dueNote: 'Firm close' };
  const mine = await h.json('/jobs', { ...start, periodStart: '2027-01-01', dueDate: '2027-02-28', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  const theirs = await h.json('/jobs', { ...start, periodStart: '2027-04-01', dueDate: '2027-05-31', preparerEmail: 'reviewer@example.test', reviewerEmail: 'owner@example.test' }, h.owner);
  const bank = (await h.json('/jobs/' + mine.id, undefined, preparer)).requests.find(r => r.label === 'Bank statements');
  await h.json(`/jobs/${mine.id}/reminders`, {}, preparer);
  await h.json(`/requests/${bank.id}/files`, { name: 'bank.csv', mime: 'text/csv', contentBase64: b64('date,amount') }, preparer);
  await h.json(`/jobs/${mine.id}/steps`, { ordinal: 1, done: true }, preparer);
  await h.json(`/jobs/${theirs.id}/threads`, { title: 'Inventory count', body: 'Count on the 30th.', mentions: [] }, reviewer);
  const lead = await h.json(`/clients/${shop.id}/history`, undefined, reviewer);
  const events = lead.history.map(e => JSON.stringify([e.action, e.actor, e.job_id]));
  for (const e of [['client.added', 'owner@example.test', null], ['job.started', 'owner@example.test', mine.id], ['file.uploaded', 'preparer@example.test', mine.id], ['step.done', 'preparer@example.test', mine.id], ['thread.opened', 'reviewer@example.test', theirs.id]])
    assert.ok(events.includes(JSON.stringify(e)), JSON.stringify(e));
  assert.deepEqual(lead.history.map(e => e.at), lead.history.map(e => e.at).sort().reverse());
  assert.deepEqual((await h.json(`/clients/${shop.id}/history?kind=documents`, undefined, reviewer)).history.map(e => e.action), ['file.uploaded']);
  assert.deepEqual((await h.json(`/clients/${shop.id}/history?q=inventory`, undefined, reviewer)).history.map(e => e.action), ['thread.opened']);
  await h.json(`/clients/${shop.id}/history?kind=gossip`, undefined, reviewer, 400);
  // Every open item has a responsible person, a next action and a due condition.
  const items = lead.unresolved.map(i => JSON.stringify([i.kind, i.owner, i.nextAction, i.due]));
  for (const i of [['request', 'preparer@example.test', 'Accept or return “Bank statements”', 'job due 2027-02-28'], ['request', 'preparer@example.test', 'Collect “Sales invoices” from the client', 'job due 2027-02-28'],
    ['task', 'preparer@example.test', 'Complete “Draft BAS”', 'job due 2027-02-28'], ['discussion', 'reviewer@example.test', 'Resolve “Inventory count”', 'no follow-up date']])
    assert.ok(items.includes(JSON.stringify(i)), JSON.stringify(i));
  const reviewers = (await h.json(`/clients/${shop.id}/history?owner=reviewer@example.test`, undefined, reviewer)).unresolved;
  assert.ok(reviewers.length > 0 && reviewers.every(i => i.owner === 'reviewer@example.test'));
  // A preparer sees only the jobs they may read, and no client they have no work for.
  const own = await h.json(`/clients/${shop.id}/history`, undefined, preparer);
  assert.deepEqual(own.jobs.map(j => j.id), [mine.id]);
  assert.ok(own.history.length > 0 && own.history.every(e => e.job_id === mine.id));
  assert.ok(own.unresolved.every(i => i.jobId === mine.id));
  const quiet = await h.json('/clients', { name: 'Quietwater LLC', fields: { service_tier: 'Plus' } }, h.owner);
  await h.json(`/clients/${quiet.id}/history`, undefined, preparer, 404);
  // A reviewer or the principal hands items on; nobody is made to review their own work or own a discussion they cannot read.
  const find = (kind, action) => lead.unresolved.find(i => i.kind === kind && i.nextAction === action);
  const task = find('task', 'Complete “Draft BAS”'), collect = find('request', 'Collect “Sales invoices” from the client'), talk = find('discussion', 'Resolve “Inventory count”');
  const hand = (item, owner, who = reviewer, expected = 200) => h.json(`/clients/${shop.id}/unresolved/owner`, { kind: item.kind, id: item.id, owner }, who, expected);
  await hand(task, 'reviewer@example.test', preparer, 403);
  assert.match((await hand(collect, 'reviewer@example.test', reviewer, 409)).error, /cannot review their own work/);
  await hand(talk, 'preparer@example.test', reviewer, 400);
  await hand(task, 'reviewer@example.test');
  await hand(talk, 'owner@example.test');
  const after = await h.json(`/clients/${shop.id}/history?owner=reviewer@example.test`, undefined, reviewer);
  assert.ok(after.unresolved.some(i => i.kind === 'task' && i.nextAction === 'Complete “Draft BAS”'));
  assert.equal((await h.json('/threads/' + talk.id, undefined, h.owner)).thread.owner_email, 'owner@example.test');
  const handed = after.history.filter(e => e.action === 'item.owner_changed').map(e => [e.actor, e.detail]);
  // Trace the request from the reminder email through upload to acceptance, in order; billing exports of the client's work are in its history.
  await h.json(`/requests/${bank.id}/decide`, { decision: 'accept' }, preparer);
  const trace = (await h.json(`/clients/${shop.id}/history`, undefined, reviewer)).history.filter(e => ['reminder.sent', 'file.uploaded', 'request.accepted'].includes(e.action)).reverse();
  assert.deepEqual(trace.map(e => [e.action, e.actor, e.job_id]), [['reminder.sent', 'preparer@example.test', mine.id], ['file.uploaded', 'preparer@example.test', mine.id], ['request.accepted', 'preparer@example.test', mine.id]]);
  const billed = (await h.json('/jobs/' + job.id, undefined, reviewer)).job.client_id;
  assert.ok((await h.json(`/clients/${billed}/history?kind=billing`, undefined, reviewer)).history.some(e => e.action === 'export.approved'));
  assert.deepEqual(handed, [['reviewer@example.test', 'discussion Resolve “Inventory count”: reviewer@example.test to owner@example.test'], ['reviewer@example.test', 'task Complete “Draft BAS”: preparer@example.test to reviewer@example.test']]);
});

test('PORTAL-003 client progress, secure questions and to-dos: the client asks and completes one to-do; the preparer is alerted, answers, and sees the same progress after review; internal notes and another client\'s to-dos stay hidden; the question is in CRM-003 history with its owner', async () => {
  const home = await h.json('/clients', { name: 'Okafor household', contactName: 'Ada Okafor', contactEmail: 'ada@okafor.example', fields: { service_tier: 'Plus' } }, h.owner);
  const elsewhere = await h.json('/clients', { name: 'Brightwater Dental', contactName: 'Sam Bright', contactEmail: 'sam@brightwater.example', fields: { service_tier: 'Plus' } }, h.owner);
  const start = { templateId: template.id, periodStart: '2027-07-01', dueDate: '2027-10-28', dueNote: 'Lodgement', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  const work = await h.json('/jobs', { ...start, clientId: home.id }, h.owner), other = await h.json('/jobs', { ...start, clientId: elsewhere.id }, h.owner);
  // Staff choose what the client sees: a to-do on the link, an internal discussion that never leaves the firm.
  await h.json(`/jobs/${work.id}/portal/todos`, { body: 'Confirm your new bank account number', dueDate: '2027-08-15' }, preparer);
  await h.json(`/jobs/${other.id}/portal/todos`, { body: 'Send the dental equipment invoices' }, preparer);
  await h.json(`/jobs/${work.id}/threads`, { title: 'Internal: client may owe late fees', body: 'Do not mention the penalty yet.', mentions: [] }, preparer);
  await h.json(`/jobs/${work.id}/portal/todos`, { body: 'x' }, '', 401);
  await h.json(`/jobs/${work.id}/reminders`, {}, preparer);
  const token = portalToken(h.mails.at(-1)), link = '/api/blotter/portal/' + token;
  let view = await h.json('/portal/' + token, undefined);
  assert.deepEqual([view.progress.stage, view.progress.nextAction], ['collecting', 'Please upload 2 documents and complete 1 to-do.']);
  assert.deepEqual(view.progress.milestones.map(m => [m.key, m.done, m.detail]), [['documents', false, '0 of 2 received, 0 accepted'], ['preparation', false, '0 of 2 steps complete'], ['review', false, 'not started'], ['completed', false, 'not yet']]);
  const seen = JSON.stringify(view);
  for (const hidden of ['late fees', 'penalty', 'dental', 'preparer@example.test', other.id]) assert.ok(!seen.includes(hidden), hidden);
  assert.deepEqual(view.todos.map(t => [t.body, t.dueDate, t.status, t.from]), [['Confirm your new bank account number', '2027-08-15', 'open', 'your accountant']]);
  // The client asks a secure question on the engagement: same-origin only, owned by the job's preparer, who is alerted.
  assert.equal((await h.request(link + '/messages', { body: 'Do you need my home office receipts?' }, '', { origin: 'https://outside.example.test' })).status, 403);
  const asked = await (await h.request(link + '/messages', { body: 'Do you need my home office receipts?' })).json();
  assert.equal(asked.status, 'open');
  const alerts = await h.json('/notifications', undefined, preparer);
  assert.ok(alerts.some(a => a.kind === 'client_question' && a.job_id === work.id && a.summary.includes('home office receipts')));
  // The preparer's queue counts it; the client history shows it with its author and job, and as an unresolved item with its owner.
  assert.equal((await h.json('/state', undefined, preparer)).jobs.find(j => j.id === work.id).client_questions, 1);
  const history = await h.json(`/clients/${home.id}/history?kind=messages`, undefined, preparer);
  assert.ok(history.history.some(e => e.action === 'portal.question' && e.actor === 'client (portal link)' && e.job_id === work.id && e.object_id === asked.id));
  const question = history.unresolved.find(i => i.kind === 'client_question');
  assert.deepEqual([question.id, question.owner, question.nextAction, question.due], [asked.id, 'preparer@example.test', 'Answer the client: “Do you need my home office receipts?”', 'job due 2027-10-28']);
  assert.ok(history.unresolved.some(i => i.kind === 'client_todo' && i.owner === 'preparer@example.test' && i.due === 'client due 2027-08-15'));
  // Completing one to-do records the reply, alerts its owner and completes nothing else.
  const todo = view.todos[0];
  assert.equal((await h.request(`${link}/todos/${todo.id}`, { response: 'New BSB 062-000' })).status, 200);
  assert.equal((await h.request(`${link}/todos/${todo.id}`, {})).status, 409);
  const otherTodo = (await h.json('/jobs/' + other.id, undefined, preparer)).portal.todos[0];
  assert.equal((await h.request(`${link}/todos/${otherTodo.id}`, {})).status, 404);
  assert.ok((await h.json('/notifications', undefined, preparer)).some(a => a.kind === 'client_todo_done' && a.summary.includes('Confirm your new bank account number')));
  let detail = await h.json('/jobs/' + work.id, undefined, preparer);
  assert.deepEqual(detail.requests.map(r => r.status), ['requested', 'requested']);
  assert.ok(detail.steps.every(s => !s.done_at));
  assert.deepEqual([detail.portal.todos[0].status, detail.portal.todos[0].response], ['done', 'New BSB 062-000']);
  assert.equal((await h.json('/jobs/' + other.id, undefined, preparer)).portal.todos[0].status, 'open');
  // The preparer answers on the link; only that question closes.
  await h.json(`/jobs/${work.id}/portal/messages`, { body: 'Yes please, upload them with the bank statements.', replyTo: asked.id }, preparer);
  await h.json(`/jobs/${work.id}/portal/messages`, { body: 'Again', replyTo: asked.id }, preparer, 409);
  view = await h.json('/portal/' + token, undefined);
  assert.deepEqual(view.messages.map(m => [m.kind, m.from, m.status, m.replyTo]), [['question', 'you', 'answered', null], ['message', 'your accountant', 'sent', asked.id]]);
  assert.equal((await h.json('/state', undefined, preparer)).jobs.find(j => j.id === work.id).client_questions, 0);
  assert.ok(!(await h.json(`/clients/${home.id}/history`, undefined, preparer)).unresolved.some(i => i.kind.startsWith('client_')));
  // A second question changes hands like any unresolved item.
  const second = await (await h.request(link + '/messages', { body: 'When will you lodge?' })).json();
  await h.json(`/clients/${home.id}/unresolved/owner`, { kind: 'client_question', id: second.id, owner: 'reviewer@example.test' }, reviewer);
  assert.equal((await h.json(`/clients/${home.id}/history?owner=reviewer@example.test`, undefined, reviewer)).unresolved.find(i => i.id === second.id).owner, 'reviewer@example.test');
  // After the work goes to review, the client and the preparer see the same progress.
  for (const r of detail.requests) {
    await h.json(`/requests/${r.id}/files`, { name: r.label + '.pdf', mime: 'application/pdf', contentBase64: b64('%PDF') }, preparer);
    await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, preparer);
  }
  for (const s of detail.steps) await h.json(`/jobs/${work.id}/steps`, { ordinal: s.ordinal, done: true }, preparer);
  await h.json(`/jobs/${work.id}/submit`, {}, preparer);
  view = await h.json('/portal/' + token, undefined);
  detail = await h.json('/jobs/' + work.id, undefined, preparer);
  assert.deepEqual(view.progress, detail.portal.progress);
  assert.deepEqual([view.progress.stage, view.progress.nextAction], ['in_review', 'Nothing needed from you: your accountant is reviewing the work.']);
  assert.deepEqual(view.progress.milestones.map(m => [m.key, m.done, m.detail]), [['documents', true, '2 of 2 received, 2 accepted'], ['preparation', true, '2 of 2 steps complete'], ['review', false, 'in review'], ['completed', false, 'not yet']]);
  assert.ok(!JSON.stringify(view).includes('late fees'));
});

test('CAPACITY-001 workload capacity: a tax-season week with budgets, leave and a client meeting shows available hours, overloaded staff and affected jobs; adjusting an estimate updates totals and conflict explanations', async () => {
  const season = await h.json('/templates', { name: '1040 season', recurrence: 'annual', steps: 'unused', requests: 'W-2 forms', tasks: [
    { label: 'Prepare federal return', assignee: 'preparer', dueFrom: 'due', dueDays: -2, estimateMinutes: 900 },
    { label: 'Prepare state return', assignee: 'preparer', dueFrom: 'due', dueDays: -1, estimateMinutes: 600 },
    { label: 'Assemble e-file', assignee: 'preparer', dueFrom: 'due', dueDays: 0 }] }, h.owner);
  const ng = await h.json('/clients', { name: 'Ng family', fields: { service_tier: 'Plus' } }, h.owner), park = await h.json('/clients', { name: 'Park family', fields: { service_tier: 'Plus' } }, h.owner);
  const people = { templateId: season.id, periodStart: '2028-01-01', dueNote: 'Filing', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  const due = await h.json('/jobs', { ...people, clientId: ng.id, dueDate: '2029-03-09' }, h.owner);
  await h.json('/jobs', { ...people, clientId: park.id, dueDate: '2029-03-16' }, h.owner);
  // The principal loads budgets, leave and a client meeting; nobody else plans hours.
  await h.json('/capacity/people', { email: 'preparer@example.test', weeklyMinutes: 2400, skills: ['1040'] }, reviewer, 403);
  await h.json('/capacity/people', { email: 'preparer@example.test', weeklyMinutes: 2400, skills: ['1040'] }, h.owner);
  await h.json('/capacity/people', { email: 'reviewer@example.test', weeklyMinutes: 1800, skills: ['Review', '1040'] }, h.owner);
  await h.json('/capacity/blocks', { email: 'preparer@example.test', kind: 'leave', startsOn: '2029-03-07', endsOn: '2029-03-08', label: 'Family leave' }, h.owner);
  await h.json('/capacity/blocks', { email: 'reviewer@example.test', kind: 'meeting', startsOn: '2029-03-06', minutesPerDay: 120, label: 'Ng tax planning meeting', jobId: due.id }, h.owner);
  await h.json('/capacity/blocks', { email: 'reviewer@example.test', kind: 'meeting', startsOn: '2029-03-06', label: 'No length' }, h.owner, 400);
  await h.json(`/jobs/${due.id}/time`, { date: '2029-03-05', minutes: 45, description: 'Organizer intake' }, preparer);
  await h.json('/capacity?week=2029-03-06', undefined, h.owner, 400);
  const week = () => h.json('/capacity?week=2029-03-05&service=1040%20season', undefined, h.owner);
  let view = await week();
  const row = (v, address) => v.people.find(p => p.email === address);
  let pat = row(view, 'preparer@example.test'), riley = row(view, 'reviewer@example.test');
  assert.deepEqual([pat.weeklyMinutes, pat.leaveMinutes, pat.commitmentMinutes, pat.availableMinutes, pat.demandMinutes, pat.overMinutes, pat.overloaded, pat.actualMinutes], [2400, 960, 0, 1440, 1500, 60, true, 45]);
  assert.deepEqual([riley.weeklyMinutes, riley.commitmentMinutes, riley.availableMinutes, riley.demandMinutes, riley.overloaded, riley.skills], [1800, 120, 1680, 0, false, ['review', '1040']]);
  // Drill-down: estimates per job, with actual time beside them (never subtracted); the next week's job is not counted.
  assert.deepEqual(pat.jobs.map(l => [l.jobId, l.kind, l.label, l.due, l.estimateMinutes, l.actualMinutes]), [[due.id, 'preparation', 'Prepare federal return', '2029-03-07', 900, 45], [due.id, 'preparation', 'Prepare state return', '2029-03-08', 600, 45]]);
  assert.deepEqual(view.unscheduled.map(u => [u.jobId, u.label, u.reason]), [[due.id, 'Assemble e-file', 'no estimate'], [due.id, 'Review', 'no review estimate']]);
  assert.deepEqual(view.conflicts.map(c => [c.jobId, c.reasons]), [[due.id, ['Pat Preparer is over capacity by 1 h this week', 'Pat Preparer is on leave 2029-03-07 to 2029-03-08, before the due date 2029-03-09', '“Assemble e-file” has no estimate', '“Review” has no review estimate']]]);
  // Estimating the review adds review demand; reducing a task estimate clears the overload and its explanation.
  await h.json(`/jobs/${due.id}/estimates`, { review: true, minutes: 240 }, reviewer);
  await h.json(`/jobs/${due.id}/estimates`, { ordinal: 1, minutes: 600 }, preparer);
  await h.json(`/jobs/${due.id}/estimates`, { ordinal: 1, minutes: 600 }, await h.login('quinn@example.test'), 404);
  const before = view.totals;
  view = await week(); pat = row(view, 'preparer@example.test'); riley = row(view, 'reviewer@example.test');
  assert.deepEqual([pat.demandMinutes, pat.overloaded, riley.demandMinutes, riley.jobs.map(l => [l.kind, l.estimateMinutes])], [1200, false, 240, [['review', 240]]]);
  assert.equal(view.totals.demandMinutes, before.demandMinutes - 300 + 240);
  assert.deepEqual(view.conflicts.map(c => c.reasons), [['Pat Preparer is on leave 2029-03-07 to 2029-03-08, before the due date 2029-03-09', '“Assemble e-file” has no estimate']]);
  // Filter by skill; a preparer sees only their own row.
  assert.deepEqual((await h.json('/capacity?week=2029-03-05&skill=review', undefined, h.owner)).people.map(p => p.email), ['reviewer@example.test']);
  assert.deepEqual((await h.json('/capacity?week=2029-03-05', undefined, preparer)).people.map(p => p.email), ['preparer@example.test']);
});

test('CAPACITY-002 coverage: a preparer on leave, previewed skilled cover with capacity, a dependent close-and-return chain moved in order, self-review and ineligible overrides refused, notifications sent and uncovered work owned by the approving manager', async () => {
  for (const [address, name] of [['leaver@example.test', 'Lee Leaver'], ['cover@example.test', 'Cam Cover']]) await h.json('/team', { email: address, name, role: 'preparer' }, h.owner);
  const close = await h.json('/templates', { name: 'Coverage close', recurrence: 'monthly', steps: 'unused', requests: 'Bank statements', tasks: [{ label: 'Close the month', assignee: 'preparer', dueFrom: 'due', dueDays: -1, estimateMinutes: 120 }] }, h.owner);
  const ret = await h.json('/templates', { name: 'Coverage return', recurrence: 'annual', steps: 'unused', requests: 'W-2 forms', tasks: [{ label: 'Prepare return', assignee: 'preparer', dueFrom: 'due', dueDays: -1, estimateMinutes: 240, afterJob: { templateId: close.id, gate: 'signed_off' } }] }, h.owner);
  const audit = await h.json('/templates', { name: 'Coverage audit', recurrence: 'annual', steps: 'unused', requests: 'Ledger', tasks: [{ label: 'Audit fieldwork', assignee: 'preparer', dueFrom: 'due', dueDays: 0, estimateMinutes: 6000 }] }, h.owner);
  const firm = await h.json('/clients', { name: 'Coverage Holdings LLC', contactName: 'Ola Owner', contactEmail: 'ola@coverage.example', fields: { service_tier: 'Plus' } }, h.owner);
  const people = { clientId: firm.id, dueNote: 'Engagement letter', preparerEmail: 'leaver@example.test', reviewerEmail: 'reviewer@example.test' };
  const books = await h.json('/jobs', { ...people, templateId: close.id, periodStart: '2031-12-01', dueDate: '2032-01-10' }, h.owner);
  const taxes = await h.json('/jobs', { ...people, templateId: ret.id, periodStart: '2031-01-01', dueDate: '2032-01-20' }, h.owner);
  const fieldwork = await h.json('/jobs', { ...people, templateId: audit.id, periodStart: '2031-01-01', dueDate: '2032-01-12' }, h.owner);
  await h.json('/capacity/people', { email: 'cover@example.test', weeklyMinutes: 1200, skills: ['Coverage close', 'Coverage return'] }, h.owner);
  // The preparer goes on leave; a manager previews cover (a preparer cannot).
  await h.json('/capacity/blocks', { email: 'leaver@example.test', kind: 'leave', startsOn: '2032-01-05', endsOn: '2032-01-09', label: 'Parental leave' }, h.owner);
  const leave = { email: 'leaver@example.test', reason: 'leave', startsOn: '2032-01-05', endsOn: '2032-01-09', dueNote: 'Rescheduled for leave cover' };
  await h.json('/coverage/preview', leave, preparer, 403);
  const chain = [{ jobId: books.id, dueDate: '2032-01-14' }, { jobId: taxes.id, dueDate: '2032-01-21' }];
  // Dependency order: the return cannot fall due before the close it waits for.
  const backwards = await h.json('/coverage/preview', { ...leave, choices: [chain[0], { jobId: taxes.id, dueDate: '2032-01-12' }] }, reviewer);
  assert.match(backwards.lines.find(l => l.jobId === taxes.id).reasons.join(), /waits for Coverage close · Dec 2031, due 2032-01-14/);
  // Self-review and ineligible overrides are refused at approval.
  const selfReview = await h.json('/coverage/preview', { ...leave, choices: [{ ...chain[0], preparerEmail: 'reviewer@example.test' }, chain[1]] }, reviewer);
  assert.match(selfReview.lines.find(l => l.jobId === books.id).reasons.join(), /review their own work/);
  assert.match((await h.json('/coverage', { ...leave, choices: [{ ...chain[0], preparerEmail: 'reviewer@example.test' }, chain[1]], fingerprint: selfReview.fingerprint }, reviewer, 409)).error, /review their own work/);
  const outsider = await h.json('/coverage/preview', { ...leave, choices: [{ ...chain[0], preparerEmail: 'nobody@example.test' }, chain[1]] }, reviewer);
  assert.match(outsider.lines.find(l => l.jobId === books.id).reasons.join(), /nobody@example.test is not an active preparer/);
  // The feasible plan: the chain in dependency order to the skilled colleague with capacity; the oversized audit stays unresolved.
  const preview = await h.json('/coverage/preview', { ...leave, choices: chain }, reviewer);
  assert.deepEqual(preview.lines.map(l => [l.jobId, l.action, l.to.preparer, l.to.dueDate]), [
    [books.id, 'change', 'cover@example.test', '2032-01-14'], [fieldwork.id, 'unresolved', 'leaver@example.test', '2032-01-12'], [taxes.id, 'change', 'cover@example.test', '2032-01-21']]);
  assert.match(preview.conflicts[0].reason, /No eligible preparer is free on 2032-01-12 with 100 h of capacity/);
  assert.deepEqual(preview.notifications.filter(n => n.to === 'cover@example.test').map(n => n.jobId), [books.id, taxes.id]);
  const approved = await h.json('/coverage', { ...leave, choices: chain, fingerprint: preview.fingerprint }, reviewer);
  assert.deepEqual(approved.changed, [books.id, taxes.id]);
  await h.json('/coverage', { ...leave, choices: chain, fingerprint: preview.fingerprint }, reviewer, 409);
  // New owners and dates; the return's role task follows its new preparer.
  const after = await h.json('/jobs/' + taxes.id, undefined, h.owner);
  assert.deepEqual([after.job.preparer_email, after.job.due_date, after.job.due_note, after.steps[0].owner], ['cover@example.test', '2032-01-21', 'Rescheduled for leave cover', 'cover@example.test']);
  assert.ok(h.mails.some(m => m.to.includes('cover@example.test') && /You now prepare Coverage Holdings LLC · Coverage return/.test(m.subject)));
  assert.ok(h.mails.some(m => m.to.includes('leaver@example.test') && /covered by cover@example.test/.test(m.subject)));
  // The uncovered audit is the approving manager's conflict, in the plan and the client's unresolved items, until handed on and resolved.
  const [plan] = await h.json('/coverage', undefined, reviewer);
  assert.deepEqual(plan.conflicts.map(k => [k.job_id, k.owner_email, k.resolved_at]), [[fieldwork.id, 'reviewer@example.test', null]]);
  const item = (await h.json(`/clients/${firm.id}/history`, undefined, reviewer)).unresolved.find(i => i.kind === 'coverage');
  assert.deepEqual([item.jobId, item.owner], [fieldwork.id, 'reviewer@example.test']);
  await h.json(`/clients/${firm.id}/unresolved/owner`, { kind: 'coverage', id: item.id, owner: 'owner@example.test' }, reviewer);
  await h.json(`/coverage/conflicts/${item.id}/resolve`, { note: 'Contract auditor booked' }, reviewer, 404);
  await h.json(`/coverage/conflicts/${item.id}/resolve`, { note: 'Contract auditor booked' }, h.owner);
  assert.ok(!(await h.json(`/clients/${firm.id}/history`, undefined, h.owner)).unresolved.some(i => i.kind === 'coverage'));
});

test('CAPACITY-003 forecast: next tax season from recurring rules and prior actuals, as weekly ranges with confidence; a client with no actuals widens the range and is named; a hire and a lost client compared by skill; a saved scenario changes no live work', async () => {
  const individual = await h.json('/templates', { name: 'Individual 1040', recurrence: 'annual', steps: 'Prepare return', requests: 'Organizer' }, h.owner);
  const people = { templateId: individual.id, preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  const clients = {};
  for (const name of ['Ortiz household', 'Lowe household', 'Quint household']) clients[name] = await h.json('/clients', { name, fields: { service_tier: 'Plus' } }, h.owner);
  // Prior actuals: recorded time on signed-off jobs of earlier periods.
  const done = async (client, periodStart, minutes) => {
    const created = await h.json('/jobs', { ...people, clientId: client.id, periodStart, dueDate: '2031-06-30', dueNote: 'Filed' }, h.owner);
    for (const [n, m] of minutes.entries()) await h.json(`/jobs/${created.id}/time`, { date: `2030-0${n + 3}-0${n + 4}`, minutes: m, description: 'Return' }, preparer);
    let detail = await h.json('/jobs/' + created.id, undefined, preparer);
    for (const r of detail.requests) { await h.json(`/requests/${r.id}/files`, { name: 'organizer.pdf', mime: 'application/pdf', contentBase64: b64('%PDF organizer') }, preparer); await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, preparer); }
    for (const s of detail.steps) await h.json(`/jobs/${created.id}/steps`, { ordinal: s.ordinal, done: true }, preparer);
    detail = await h.json(`/jobs/${created.id}/submit`, { revision: (await h.json('/jobs/' + created.id, undefined, preparer)).job.revision }, preparer);
    await h.json(`/jobs/${created.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Filed' }, reviewer);
    return created;
  };
  const o2029 = await done(clients['Ortiz household'], '2029-01-01', [300]), o2030 = await done(clients['Ortiz household'], '2030-01-01', [500]);
  await done(clients['Ortiz household'], '2030-07-01', [1000, 1000]); // a mid-year period: not the same season, so not used
  const l2030 = await done(clients['Lowe household'], '2030-01-01', [400]);
  // Approved recurring engagements for the 2031 tax year, due 105 days after the year ends; Quint has never been prepared here.
  const rule = body => h.json('/rules', { ...people, firstPeriod: '2031-01-01', dueDays: 105, dueNote: 'Federal filing deadline', ...body }, h.owner);
  for (const name of ['Ortiz household', 'Lowe household']) await rule({ clientId: clients[name].id });
  await rule({ clientId: clients['Quint household'].id, budgetMinutes: 600 });
  const season = { from: '2032-04-12', weeks: 2 };
  await h.json('/capacity/forecast', season, preparer, 403);
  await h.json('/capacity/forecast', { ...season, from: '2032-04-13' }, h.owner, 400);
  const mine = l => l.workType === 'Individual 1040';
  let view = await h.json('/capacity/forecast', season, reviewer);
  assert.ok(view.assumptions.length >= 5);
  // Each estimate traces to its source: same-month prior actuals, or the rule's budget for a client with none.
  assert.deepEqual(view.baseline.lines.filter(mine).map(l => [l.client, l.due, l.basis, l.point, l.low, l.high, l.samples.map(s => [s.jobId, s.actualMinutes]), l.reason]), [
    ['Lowe household', '2032-04-14', 'mean of 1 prior actual in the same month', 400, 360, 440, [[l2030.id, 400]], null],
    ['Ortiz household', '2032-04-14', 'mean of 2 prior actuals in the same month', 400, 270, 550, [[o2029.id, 300], [o2030.id, 500]], null],
    ['Quint household', '2032-04-14', 'rule time budget', 600, 300, 900, [], 'Quint household has no prior actuals for Individual 1040']]);
  // Each week is a range with its stated confidence; the client without actuals lowers it and is named.
  let [first, second] = view.baseline.weeks;
  const quint = 'Quint household has no prior actuals for Individual 1040';
  assert.deepEqual([first.weekStart, first.confidence.level, first.confidence.reasons.includes(quint)], ['2032-04-12', 'low', true]);
  assert.deepEqual(first.skills.find(s => s.skill === 'individual 1040'), { skill: 'individual 1040', demand: { point: 1400, low: 930, high: 1890 }, capacityMinutes: 0, shortMinutes: 1890 });
  assert.equal(second.weekStart, '2032-04-19');
  // Scenario: a hypothetical 1040 hire and the lost client; compare by skill. Losing Quint narrows the week's range and lifts its confidence.
  const changes = { hires: [{ name: 'Seasonal preparer', weeklyMinutes: 2400, skills: ['Individual 1040'], startsOn: '2032-04-01' }], lostClients: [clients['Quint household'].id] };
  await h.json('/capacity/forecast', { ...season, changes: { lostClients: ['nope'] } }, h.owner, 404);
  view = await h.json('/capacity/forecast', { ...season, changes }, h.owner);
  [first] = view.compared.weeks;
  assert.deepEqual(first.skills.find(s => s.skill === 'individual 1040'), { skill: 'individual 1040', demand: { point: 800, low: 630, high: 990 }, capacityMinutes: 2400, shortMinutes: 0 });
  assert.ok(!first.confidence.reasons.includes(quint));
  assert.equal(first.capacityMinutes, view.baseline.weeks[0].capacityMinutes + 2400);
  assert.deepEqual(view.compared.removed.map(r => [r.client, r.reason]), [['Quint household', 'lost client']]);
  assert.deepEqual(view.compared.skills.find(s => s.skill === 'individual 1040').capacityMinutes, 4800);
  // Saving the scenario changes no live work; reopening it recomputes the same comparison.
  const live = async () => [await h.json('/rules', undefined, h.owner), (await h.json('/state', undefined, h.owner)).jobs, await h.json('/capacity?week=2032-04-12', undefined, h.owner)];
  const before = await live();
  await h.json('/capacity/scenarios', { name: 'Seasonal hire, Quint lost', ...season, changes }, preparer, 403);
  const saved = await h.json('/capacity/scenarios', { name: 'Seasonal hire, Quint lost', ...season, changes }, h.owner);
  assert.deepEqual(await live(), before);
  assert.deepEqual((await h.json('/capacity/scenarios', undefined, reviewer)).map(s => [s.id, s.name, s.from, s.weeks]), [[saved.id, 'Seasonal hire, Quint lost', '2032-04-12', 2]]);
  const reopened = await h.json('/capacity/forecast', { scenarioId: saved.id }, reviewer);
  assert.deepEqual([reopened.scenario.name, reopened.compared, reopened.baseline], ['Seasonal hire, Quint lost', view.compared, view.baseline]);
});

test('SEARCH-001 firm-wide search: a client by last name (with a typo), a phrase inside an uploaded PDF, a task, a portal message and a note, each opened; type filter and ranking; a preparer gets nothing from a client they cannot read; tax-id digits only for a principal or reviewer, always masked', async () => {
  const deflated = (await import('node:zlib')).deflateSync(Buffer.from('BT /F1 12 Tf 72 720 Td (Schedule C home office) Tj T* [(deduction) -250 (worksheet for 2031)] TJ ET'));
  const pdf = Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n2 0 obj\n<< /Length ${deflated.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), deflated, Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1')]);
  const okonkwo = await h.json('/clients', { name: 'Amara Okonkwo', abn: '51 824 753 556', contactName: 'Amara Okonkwo', contactEmail: 'amara@okonkwo.example', fields: { service_tier: 'Plus' } }, h.owner);
  const hidden = await h.json('/clients', { name: 'Okonkwo Holdings Trust', fields: { service_tier: 'Plus' } }, h.owner);
  const tasks = [{ label: 'Reconcile depreciation schedule', assignee: 'preparer' }];
  const sched = await h.json('/templates', { name: 'Schedule C review', recurrence: 'annual', steps: 'unused', requests: 'Home office records', tasks }, h.owner);
  const start = { templateId: sched.id, periodStart: '2031-01-01', dueDate: '2032-04-15', dueNote: 'Filing', reviewerEmail: 'reviewer@example.test' };
  const mine = await h.json('/jobs', { ...start, clientId: okonkwo.id, preparerEmail: 'preparer@example.test' }, h.owner);
  const theirs = await h.json('/jobs', { ...start, clientId: hidden.id, preparerEmail: 'reviewer@example.test', reviewerEmail: 'owner@example.test' }, h.owner);
  const upload = async (j, cookie) => { const r = (await h.json('/jobs/' + j.id, undefined, cookie)).requests[0]; return (await h.json(`/requests/${r.id}/files`, { name: 'home-office.pdf', mime: 'application/pdf', contentBase64: pdf.toString('base64') }, cookie)); };
  await upload(mine, preparer); await upload(theirs, reviewer);
  await h.json(`/jobs/${mine.id}/portal/messages`, { body: 'Please send the mileage logbook for the Okonkwo rideshare' }, preparer);
  await h.json(`/jobs/${theirs.id}/threads`, { anchor: 'client', title: 'Trust distribution minutes', body: 'Trustee resolution on the beneficiary distribution is missing' }, reviewer);
  const find = (q, cookie = reviewer, extra = '') => h.json(`/search?q=${encodeURIComponent(q)}${extra}`, undefined, cookie);
  await h.json('/search?q=', undefined, reviewer, 400);
  await h.json('/search?q=x&type=invoice', undefined, reviewer, 400);
  // A client by last name, tolerating a typo, opened through the client history door.
  for (const q of ['okonkwo', 'Okonkow']) assert.ok((await find(q)).results.some(r => r.type === 'client' && r.id === okonkwo.id), q);
  const byName = await find('Amara Okonkwo');
  assert.deepEqual([byName.results[0].type, byName.results[0].id], ['client', okonkwo.id]);
  assert.equal((await h.json(`/clients/${byName.results[0].open.clientId}/history`, undefined, reviewer)).client.name, 'Amara Okonkwo');
  // A phrase inside an uploaded PDF; the result opens the file itself.
  const doc = (await find('home office deduction worksheet', preparer)).results;
  assert.deepEqual(doc.map(r => [r.type, r.title]), [['document', 'home-office.pdf']]);
  assert.match(doc[0].snippet, /home office deduction worksheet/i);
  const file = await h.request('/api/blotter/files/' + doc[0].open.fileId, undefined, preparer);
  assert.equal(file.status, 200); assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
  // A task, a portal message and a note open their job; the type filter narrows.
  const task = (await find('depreciation', preparer)).results.find(r => r.type === 'task');
  assert.equal((await h.json('/jobs/' + task.open.jobId, undefined, preparer)).job.id, mine.id);
  const message = (await find('mileage logbook', preparer, '&type=portal%20message')).results;
  assert.deepEqual([...new Set(message.map(r => r.type))], ['portal message']);
  assert.equal(message[0].open.jobId, mine.id);
  const note = (await find('beneficiary distribution')).results.find(r => r.type === 'note');
  assert.equal((await h.json('/threads/' + note.open.threadId, undefined, reviewer)).thread.title, 'Trust distribution minutes');
  // Results rank by match, then recency: both PDFs match for the reviewer, the newer first.
  assert.deepEqual((await find('home office deduction', reviewer, '&type=document')).results.slice(0, 2).map(r => r.open.jobId), [theirs.id, mine.id]);
  // A preparer without access to a client gets nothing from it: not the client, its job, its PDF or its discussion.
  for (const q of ['Okonkwo Holdings', 'home office deduction', 'beneficiary distribution', 'Trust'])
    assert.ok(!JSON.stringify((await find(q, preparer)).results).includes(hidden.id) && !(await find(q, preparer)).results.some(r => r.open.jobId === theirs.id), q);
  // Tax-id digits match only for a principal or reviewer, and the number is shown masked.
  const tax = await find('3556', reviewer);
  assert.deepEqual(tax.results.filter(r => r.type === 'client').map(r => [r.id, r.taxId]), [[okonkwo.id, '•••••3556']]);
  assert.ok(!JSON.stringify(tax).includes('51824753556') && !JSON.stringify(await find('Amara', h.owner)).includes('51824753556'));
  assert.ok(!(await find('3556', preparer)).results.some(r => r.type === 'client'));
  // Erasing a document's bytes removes it from search.
  await h.json(`/files/${doc[0].open.fileId}/erase`, { confirm: 'home-office.pdf', reason: 'Client asked' }, h.owner);
  assert.deepEqual((await find('home office deduction', preparer)).results, []);
});

test('CRM-005 pipeline slice: prospects with source, services, fees and owner move through firm stages; lost needs a reason; winning creates exactly one client with its contact and onboarding job, and repeating the win creates nothing; the report shows conversion, stage age and fees by source and owner', async () => {
  const onboarding = await h.json('/templates', { name: 'New client onboarding', recurrence: 'annual', steps: 'Collect prior returns', requests: 'Prior-year returns' }, h.owner);
  const base = { contactName: 'Dana Reyes', contactEmail: 'dana@reyes.example', services: ['Monthly bookkeeping', '1120-S return'], ownerEmail: 'reviewer@example.test' };
  await h.json('/prospects', { ...base, name: 'Reyes Studio LLC', source: 'Website', estimatedFeeCents: 600000 }, preparer, 403);
  await h.json('/pipeline', undefined, preparer, 403);
  await h.json('/pipeline/stages', { name: 'Discovery call', position: 15 }, reviewer, 403);
  const discovery = await h.json('/pipeline/stages', { name: 'Discovery call', position: 15 }, h.owner);
  const reyes = await h.json('/prospects', { ...base, name: 'Reyes Studio LLC', source: 'Website', estimatedFeeCents: 600000 }, reviewer);
  const vega = await h.json('/prospects', { ...base, name: 'Vega Bakery', contactEmail: 'ops@vega.example', source: 'Website', estimatedFeeCents: 240000, ownerEmail: 'owner@example.test' }, h.owner);
  const kim = await h.json('/prospects', { ...base, name: 'Kim Dental PC', contactEmail: 'kim@kimdental.example', source: 'Referral', estimatedFeeCents: 900000 }, reviewer);
  assert.deepEqual([reyes.stage, reyes.source, JSON.parse(reyes.services), reyes.fee_cents, reyes.owner_email], ['Inquiry', 'Website', ['Monthly bookkeeping', '1120-S return'], 600000, 'reviewer@example.test']);
  const stages = (await h.json('/pipeline', undefined, reviewer)).stages, stage = name => stages.find(s => s.name === name).id;
  assert.deepEqual(stages.map(s => s.name), ['Inquiry', 'Discovery call', 'Consult booked', 'Proposal sent', 'Won', 'Lost']);
  await h.json(`/prospects/${reyes.id}/stage`, { stageId: discovery.id }, reviewer);
  await h.json(`/prospects/${reyes.id}/stage`, { stageId: stage('Proposal sent') }, reviewer);
  await h.json(`/prospects/${reyes.id}/stage`, { stageId: stage('Won') }, reviewer, 409);
  // Lost keeps a required reason.
  await h.json(`/prospects/${vega.id}/stage`, { stageId: stage('Lost') }, h.owner, 400);
  assert.equal((await h.json(`/prospects/${vega.id}/stage`, { stageId: stage('Lost'), reason: 'Chose a cheaper local firm' }, h.owner)).lost_reason, 'Chose a cheaper local firm');
  // Winning creates exactly one client with the contact and its onboarding job; the same win again creates nothing.
  const win = { templateId: onboarding.id, preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test', periodStart: '2031-01-01', dueDate: '2031-02-15', dueNote: 'Engagement start + 45 days', fields: { service_tier: 'Plus' } };
  await h.json(`/prospects/${vega.id}/win`, win, h.owner, 409);
  const clientsBefore = (await h.json('/state', undefined, h.owner)).clients.length;
  const first = await h.json(`/prospects/${reyes.id}/win`, win, reviewer);
  const again = await h.json(`/prospects/${reyes.id}/win`, win, reviewer);
  assert.deepEqual([first.repeated, again.repeated, again.clientId, again.jobId], [false, true, first.clientId, first.jobId]);
  const state = await h.json('/state', undefined, h.owner);
  assert.equal(state.clients.length, clientsBefore + 1);
  assert.deepEqual(state.clients.filter(c => c.name === 'Reyes Studio LLC').map(c => [c.id, c.contact_name, c.contact_email]), [[first.clientId, 'Dana Reyes', 'dana@reyes.example']]);
  const onboard = await h.json('/jobs/' + first.jobId, undefined, preparer);
  assert.deepEqual([onboard.job.client_id, onboard.job.title, onboard.steps.map(s => s.label)], [first.clientId, 'New client onboarding', ['Collect prior returns']]);
  await h.json(`/prospects/${reyes.id}/stage`, { stageId: stage('Lost'), reason: 'x' }, reviewer, 409);
  // The report: conversion, stage age and fees by source and owner.
  const { report, prospects } = await h.json('/pipeline', undefined, h.owner);
  const site = report.bySource.find(r => r.source === 'Website'), referral = report.bySource.find(r => r.source === 'Referral');
  assert.deepEqual([site.prospects, site.won, site.lost, site.conversionPercent, site.wonFeeCents, site.openFeeCents], [2, 1, 1, 50, 600000, 0]);
  assert.deepEqual([referral.open, referral.conversionPercent, referral.openFeeCents], [1, null, 900000]);
  assert.deepEqual(report.byOwner.map(r => [r.owner, r.prospects, r.won, r.lost]), [['owner@example.test', 1, 0, 1], ['reviewer@example.test', 2, 1, 0]]);
  assert.deepEqual(report.stageAge.find(s => s.stage === 'Inquiry'), { stage: 'Inquiry', open: 1, averageDays: 0, oldestDays: 0 });
  assert.equal(prospects.find(p => p.id === kim.id).stageAgeDays, 0);
});

test('WORK-007 work types and statuses: a 1040 type with a sub-status limited to it, moves on the board, queue and report by sub-status, review gates hold, and deleting a used sub-status needs a previewed move while history is kept', async () => {
  const returns = await h.json('/templates', { name: 'Individual return', recurrence: 'annual', steps: 'Prepare return', requests: 'W-2 forms' }, h.owner);
  const books = await h.json('/templates', { name: 'Monthly Bookkeeping', recurrence: 'monthly', steps: 'Reconcile', requests: 'Bank feed' }, h.owner);
  await h.json('/work-types', { name: '1040', templateId: returns.id }, reviewer, 403);
  await h.json('/work-types', { name: '1040', roles: ['partner', 'auditor'] }, h.owner, 400);
  const t1040 = await h.json('/work-types', { name: '1040', templateId: returns.id, budgetMinutes: 600, color: '#2563EB', roles: ['partner'] }, h.owner);
  await h.json('/work-types', { name: '1040' }, h.owner, 409);
  const docs = await h.json('/sub-statuses', { stage: 'waiting', name: 'on client documents' }, h.owner);
  const sig = await h.json('/sub-statuses', { stage: 'waiting', name: 'on 8879 signature', workTypeIds: [t1040.id], clientLabel: 'Waiting for your e-file signature' }, h.owner);
  const lane = await h.json('/clients', { name: 'Diaz household', contactName: 'Rosa Diaz', contactEmail: 'rosa@diaz.example', fields: { service_tier: 'Plus' } }, h.owner);
  const people = { clientId: lane.id, dueNote: 'Filing', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  // 1040 work needs a partner for sign-off: named at the start, never the preparer.
  const start1040 = { ...people, templateId: returns.id, workTypeId: t1040.id, periodStart: '2028-01-01', dueDate: '2029-04-15' };
  assert.match((await h.json('/jobs', start1040, h.owner, 400)).error, /needs a partner/);
  await h.json('/jobs', { ...start1040, partnerEmail: 'preparer@example.test' }, h.owner, 400);
  const ret = await h.json('/jobs', { ...start1040, partnerEmail: 'owner@example.test' }, h.owner);
  const book = await h.json('/jobs', { ...people, templateId: books.id, periodStart: '2028-02-01', dueDate: '2028-03-20' }, h.owner);
  // Every job has one work type (the chosen one, else its template's own) and starts Planned; the type's budget applies.
  assert.equal(ret.budget_minutes, 600);
  const model = await h.json('/work-types', undefined, preparer);
  assert.equal(model.workTypes.find(w => w.id === t1040.id).color, '#2563eb');
  const queued = await h.json('/queue', undefined, preparer);
  assert.deepEqual([ret.id, book.id].map(id => { const j = queued.find(q => q.id === id); return [j.work_type, j.stage]; }), [['1040', 'planned'], ['Monthly Bookkeeping', 'planned']]);
  await h.json(`/jobs/${ret.id}/reminders`, {}, preparer);
  const clientView = async () => (await h.json('/portal/' + portalToken(h.mails.at(-1)), undefined)).progress.status;
  assert.equal(await clientView(), 'Planned');
  // The 8879 sub-status is offered only for 1040 work.
  const move = (job, body, who = preparer, expected = 200) => h.json(`/jobs/${job.id}/status`, body, who, expected);
  assert.match((await move(book, { stage: 'waiting', subStatusId: sig.id }, preparer, 409)).error, /not offered for this work type/);
  await move(book, { stage: 'waiting', subStatusId: docs.id });
  await move(ret, { stage: 'waiting', subStatusId: docs.id });
  await move(ret, { stage: 'waiting', subStatusId: sig.id });
  await move(ret, { stage: 'in_progress', subStatusId: sig.id }, preparer, 400);
  // No sub-status or move reaches In review or Completed around the review gates.
  assert.match((await move(ret, { stage: 'in_review' }, preparer, 409)).error, /Submit the job for review/);
  assert.match((await move(ret, { stage: 'completed' }, h.owner, 409)).error, /sign-off completes/);
  // The client sees the label staff chose for the sub-status, not its internal name.
  assert.equal(await clientView(), 'Waiting for your e-file signature');
  // The queue filters by sub-status and work type; the report shows time in each status.
  assert.deepEqual((await h.json('/queue?subStatus=' + sig.id, undefined, preparer)).map(j => [j.id, j.sub_status]), [[ret.id, 'on 8879 signature']]);
  assert.deepEqual((await h.json('/queue?workType=' + t1040.id + '&stage=waiting', undefined, preparer)).map(j => j.id), [ret.id]);
  // A saved view keeps the filter for its owner only.
  const view = await h.json('/views', { name: 'Awaiting 8879', subStatus: sig.id }, preparer);
  assert.deepEqual((await h.json('/queue?view=' + view.id, undefined, preparer)).map(j => j.id), [ret.id]);
  assert.deepEqual((await h.json('/views', undefined, preparer)).map(v => v.name), ['Awaiting 8879']);
  await h.json('/queue?view=' + view.id, undefined, reviewer, 404);
  // Capacity's service filter selects by work type (CAPACITY-001), not by template name.
  assert.deepEqual([...new Set((await h.json('/capacity?week=2029-04-09&service=1040', undefined, h.owner)).unscheduled.map(u => u.jobId))], [ret.id]);
  assert.deepEqual((await h.json('/capacity?week=2029-04-09&service=Individual%20return', undefined, h.owner)).unscheduled, []);
  const report = await h.json('/reports/status-time?workType=' + t1040.id, undefined, h.owner);
  assert.deepEqual(report.map(r => [r.stage, r.subStatus, r.entries, r.now]), [['planned', null, 1, 0], ['waiting', 'on 8879 signature', 1, 1], ['waiting', 'on client documents', 1, 0]]);
  assert.ok(report.every(r => r.minutes >= 0 && r.averageMinutes >= 0));
  // Renaming keeps history; deleting a used sub-status is refused until a previewed move of its jobs.
  await h.json(`/sub-statuses/${sig.id}`, { name: 'on Form 8879 signature' }, h.owner);
  await h.json(`/sub-statuses/${sig.id}/delete`, {}, h.owner, 409);
  const preview = await h.json(`/sub-statuses/${sig.id}/delete/preview`, { toStage: 'in_progress' }, h.owner);
  assert.deepEqual([preview.jobs.map(j => j.id), preview.to], [[ret.id], { stage: 'in_progress', sub: null }]);
  await h.json(`/sub-statuses/${sig.id}/delete`, { toStage: 'in_progress', fingerprint: 'stale' }, h.owner, 409);
  assert.deepEqual(await h.json(`/sub-statuses/${sig.id}/delete`, { toStage: 'in_progress', fingerprint: preview.fingerprint }, h.owner), { deleted: sig.id, moved: 1 });
  assert.ok(!(await h.json('/work-types', undefined, h.owner)).subStatuses.some(s => s.id === sig.id));
  let detail = await h.json('/jobs/' + ret.id, undefined, preparer);
  assert.deepEqual([detail.job.open_stage, detail.job.sub_status_id], ['in_progress', null]);
  const trail = h => [h.from_stage, h.from_sub_status, h.to_stage, h.to_sub_status, h.by];
  assert.deepEqual(detail.statusHistory.map(trail), [
    [null, null, 'planned', null, 'owner@example.test'], ['planned', null, 'waiting', 'on client documents', 'preparer@example.test'],
    ['waiting', 'on client documents', 'waiting', 'on Form 8879 signature', 'preparer@example.test'], ['waiting', 'on Form 8879 signature', 'in_progress', null, 'owner@example.test']]);
  // Submission and sign-off move the stage and are recorded.
  const request = detail.requests[0];
  await h.json(`/requests/${request.id}/files`, { name: 'w2.pdf', mime: 'application/pdf', contentBase64: b64('%PDF') }, preparer);
  await h.json(`/requests/${request.id}/decide`, { decision: 'accept' }, preparer);
  await h.json(`/jobs/${ret.id}/steps`, { ordinal: 1, done: true }, preparer);
  const handover = { jobIds: [ret.id], preparerEmail: 'owner@example.test' };
  assert.deepEqual((await h.json('/bulk/reassign/preview', handover, h.owner)).lines[0].reasons, ['owner@example.test is the partner and cannot prepare this job']);
  await h.json(`/jobs/${ret.id}/submit`, {}, preparer);
  detail = await h.json('/jobs/' + ret.id, undefined, reviewer);
  // The reviewer's sign-off leaves it In review for the partner, who alone (with the principal) completes it.
  await h.json(`/jobs/${ret.id}/review`, { decision: 'signoff', note: 'Ready to file', revision: detail.job.revision }, reviewer);
  detail = await h.json('/jobs/' + ret.id, undefined, reviewer);
  assert.deepEqual([detail.job.status, detail.job.reviewed_by], ['review', 'reviewer@example.test']);
  assert.equal((await h.json('/queue?workType=' + t1040.id, undefined, h.owner))[0].sub_status, 'partner sign-off');
  assert.ok((await h.json(`/clients/${lane.id}/history`, undefined, h.owner)).unresolved.some(i => i.kind === 'partner_sign_off' && i.owner === 'owner@example.test'));
  await h.json(`/jobs/${ret.id}/review`, { decision: 'signoff', note: 'Again', revision: detail.job.revision }, reviewer, 403);
  await move(ret, { stage: 'in_review' }, h.owner, 409);
  await h.json(`/jobs/${ret.id}/review`, { decision: 'signoff', note: 'Partner approved', revision: detail.job.revision }, h.owner);
  detail = await h.json('/jobs/' + ret.id, undefined, reviewer);
  assert.deepEqual(detail.statusHistory.slice(-3).map(trail), [['in_progress', null, 'in_review', null, 'preparer@example.test'],
    ['in_review', null, 'in_review', 'partner sign-off', 'reviewer@example.test'], ['in_review', 'partner sign-off', 'completed', null, 'owner@example.test']]);
  assert.equal((await h.json('/queue?workType=' + t1040.id, undefined, h.owner))[0].stage, 'completed');
  await move(ret, { stage: 'planned' }, h.owner, 409);
});

test('WORK-006 plans, boards and calendars: plan a preparer’s week from the overdue queue, group a 1040 board by sub-status, move a card and see it in queue, calendar, plan and client views; review moves are refused, filters persist, a due-date move shows its consequences', async () => {
  const day = n => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const monday = d => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const today = day(0), week = monday(today);
  const season = await h.json('/templates', { name: 'Form 1040 season', recurrence: 'annual', steps: 'unused', requests: 'W-2 forms', tasks: [
    { label: 'Prepare 1040', assignee: 'preparer', dueFrom: 'due', dueDays: -2, estimateMinutes: 240 }, { label: 'E-file', assignee: 'preparer', after: [1] }] }, h.owner);
  const waits = await h.json('/templates', { name: 'Form 4868 extension', recurrence: 'annual', steps: 'unused', requests: 'Estimate worksheet', tasks: [{ label: 'File extension', assignee: 'preparer', afterDocuments: [1] }] }, h.owner);
  const type = 'wt-' + season.id;
  const organizer = await h.json('/sub-statuses', { stage: 'waiting', name: 'on client organizer', workTypeIds: [type], clientLabel: 'Waiting for your organizer' }, h.owner);
  const [nguyen, patel, kim] = await Promise.all(['Nguyen family', 'Patel family', 'Kim family'].map(name => h.json('/clients', { name, contactName: name, contactEmail: name.split(' ')[0].toLowerCase() + '@family.example', fields: { service_tier: 'Plus' } }, h.owner)));
  const people = { periodStart: '2025-01-01', dueNote: 'Federal filing deadline', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
  const late = await h.json('/jobs', { ...people, clientId: nguyen.id, templateId: season.id, dueDate: day(-3) }, h.owner);
  const soon = await h.json('/jobs', { ...people, clientId: patel.id, templateId: season.id, dueDate: day(10) }, h.owner);
  const other = await h.json('/jobs', { ...people, clientId: kim.id, templateId: season.id, dueDate: day(20), preparerEmail: 'reviewer@example.test', reviewerEmail: 'owner@example.test' }, h.owner);
  const stuck = await h.json('/jobs', { ...people, clientId: nguyen.id, templateId: waits.id, dueDate: day(30) }, h.owner);
  const ids = list => list.map(j => j.id);
  // The overdue queue: open work due before today, for this preparer.
  const overdue = await h.json(`/queue?workType=${type}&overdue=1&assignee=preparer@example.test`, undefined, preparer);
  assert.deepEqual([ids(overdue), overdue[0].overdue], [[late.id], true]);
  // Plan the week from it: the job and one of its tasks today; the principal plans another day for the preparer.
  await h.json('/plan', { day: today, jobId: late.id }, preparer);
  await h.json('/plan', { day: today, jobId: late.id, ordinal: 1 }, preparer);
  await h.json('/plan', { day: today, jobId: late.id }, preparer, 409);
  await h.json('/plan', { day: today, jobId: other.id }, preparer, 409);
  await h.json('/plan', { day: today, jobId: late.id, email: 'reviewer@example.test' }, preparer, 403);
  await h.json('/plan', { day: week, jobId: soon.id, email: 'preparer@example.test' }, h.owner);
  const planned = plan => plan.days.flatMap(d => d.items.map(i => [d.date, i.job_id, i.ordinal, i.task ?? null])).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const mine = await h.json('/plan?week=' + week, undefined, preparer);
  assert.deepEqual(planned(mine).filter(p => [late.id, soon.id].includes(p[1])), [[week, soon.id, 0, null], [today, late.id, 0, null], [today, late.id, 1, 'Prepare 1040']].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  assert.deepEqual(planned(await h.json(`/plan?week=${week}&email=preparer@example.test`, undefined, h.owner)), planned(mine));
  await h.json(`/plan?week=${week}&email=preparer@example.test`, undefined, reviewer, 403);
  // A 1040 board grouped by sub-status: a column per stage and each sub-status the type may use.
  await h.json('/board?groupBy=sub_status', undefined, preparer, 400);
  const column = (b, key) => ids(b.columns.find(c => c.key === key).jobs);
  let board = await h.json(`/board?workType=${type}&groupBy=sub_status`, undefined, preparer);
  assert.ok(board.columns.some(c => c.label === 'Waiting – on client organizer'));
  assert.deepEqual(column(board, 'planned'), [late.id, soon.id]);
  // Move an eligible card; moves into review are refused on the board as anywhere.
  await h.json(`/jobs/${late.id}/status`, { stage: 'waiting', subStatusId: organizer.id }, preparer);
  assert.match((await h.json(`/jobs/${late.id}/status`, { stage: 'in_review' }, preparer, 409)).error, /Submit the job for review/);
  board = await h.json(`/board?workType=${type}&groupBy=sub_status`, undefined, preparer);
  assert.deepEqual([column(board, `waiting|${organizer.id}`), column(board, 'planned')], [[late.id], [soon.id]]);
  // The same job's new status in the queue, the firm and client calendars, the plan and the client's own view.
  const inQueue = (await h.json(`/queue?workType=${type}`, undefined, preparer)).find(j => j.id === late.id);
  assert.deepEqual([inQueue.stage, inQueue.sub_status], ['waiting', 'on client organizer']);
  const range = `from=${day(-5)}&to=${day(35)}`;
  const firm = await h.json(`/calendar?${range}&workType=${type}`, undefined, h.owner);
  assert.deepEqual(firm.days.find(d => d.date === day(-3)).jobs.map(j => [j.id, j.stage, j.sub_status]), [[late.id, 'waiting', 'on client organizer']]);
  assert.deepEqual(firm.days.find(d => d.date === day(-5)).tasks.map(t => [t.job_id, t.label, t.owner]), [[late.id, 'Prepare 1040', 'preparer@example.test']]);
  const clientCalendar = await h.json(`/calendar?${range}&client=${nguyen.id}`, undefined, h.owner);
  assert.deepEqual(clientCalendar.days.flatMap(d => ids(d.jobs)), [late.id, stuck.id]);
  assert.equal((await h.json('/plan?week=' + week, undefined, preparer)).days.find(d => d.date === today).items[0].job.sub_status, 'on client organizer');
  await h.json(`/jobs/${late.id}/reminders`, {}, preparer);
  assert.equal((await h.json('/portal/' + portalToken(h.mails.at(-1)), undefined)).progress.status, 'Waiting for your organizer');
  // The move is in the job's WORK-007 status history.
  const moved = (await h.json('/jobs/' + late.id, undefined, preparer)).statusHistory.at(-1);
  assert.deepEqual([moved.from_stage, moved.to_stage, moved.to_sub_status, moved.by], ['planned', 'waiting', 'on client organizer', 'preparer@example.test']);
  // Assignee, due range, blocked and priority filters.
  assert.deepEqual(ids(await h.json(`/queue?workType=${type}&assignee=owner@example.test`, undefined, h.owner)), [other.id]);
  assert.deepEqual(ids(await h.json(`/queue?workType=${type}&dueFrom=${today}&dueTo=${day(20)}`, undefined, h.owner)), [soon.id, other.id]);
  const blocked = await h.json(`/queue?client=${nguyen.id}&blocked=yes`, undefined, preparer);
  assert.deepEqual([ids(blocked), blocked[0].blockers], [[stuck.id], ["Waiting for the client's Estimate worksheet to be accepted"]]);
  assert.deepEqual(ids(await h.json(`/queue?client=${nguyen.id}&blocked=no`, undefined, preparer)), [late.id]);
  await h.json(`/jobs/${late.id}/priority`, { priority: 'urgent' }, preparer, 400);
  await h.json(`/jobs/${late.id}/priority`, { priority: 'high' }, preparer);
  assert.deepEqual(ids(await h.json(`/queue?workType=${type}&priority=high`, undefined, preparer)), [late.id]);
  // Filters persist per person: a refresh opens the same board and calendar; another person keeps their own.
  await h.json('/filters/board', { workType: type, groupBy: 'sub_status', priority: 'high' }, preparer);
  board = await h.json('/board', undefined, preparer);
  assert.deepEqual([board.groupBy, board.filters.workType, board.filters.priority, board.columns.flatMap(c => ids(c.jobs))], ['sub_status', type, 'high', [late.id]]);
  assert.equal((await h.json('/board', undefined, reviewer)).groupBy, 'stage');
  await h.json('/filters/calendar', { client: nguyen.id }, h.owner);
  assert.deepEqual((await h.json('/calendar?' + range, undefined, h.owner)).days.flatMap(d => ids(d.jobs)), [late.id, stuck.id]);
  // Moving a due date on the calendar previews task dates, past-due warnings and capacity before the reschedule commits.
  const move = { jobId: soon.id, dueDate: day(-1), dueNote: 'Client asked to file early' };
  await h.json('/calendar/move/preview', move, preparer, 403);
  const preview = await h.json('/calendar/move/preview', move, h.owner);
  assert.deepEqual(preview.consequences.job, { from: day(10), to: day(-1) });
  assert.deepEqual(preview.consequences.tasks.map(t => [t.label, t.from, t.to, t.pastDue]), [['Prepare 1040', day(8), day(-3), true]]);
  assert.ok(preview.consequences.warnings.includes(`The new due date ${day(-1)} is already past`));
  const load = preview.consequences.capacity.filter(c => c.email === 'preparer@example.test').map(c => [c.week, c.demandAfter - c.demandBefore]);
  assert.deepEqual(load, [[monday(day(-3)), 240], [monday(day(8)), -240]].sort((a, b) => a[0].localeCompare(b[0])));
  await h.json('/bulk/reassign', { jobIds: [soon.id], dueDate: move.dueDate, dueNote: move.dueNote, fingerprint: preview.fingerprint }, h.owner);
  assert.deepEqual((await h.json(`/calendar?${range}&workType=${type}&client=`, undefined, h.owner)).days.find(d => d.date === day(-1)).jobs.map(j => j.id), [soon.id]);
});

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
