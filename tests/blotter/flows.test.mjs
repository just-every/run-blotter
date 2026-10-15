// The first release's jobs, end to end through the built Worker's HTTP doors.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  assert.equal((await h.request('/api/blotter/portal/' + portalToken(h.mails.at(-1)))).status, 404);
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
  await h.json('/team/rates', { email: 'preparer@example.test', rateCents: 9500 }, h.owner);
  const t1 = await h.json(`/jobs/${job.id}/time`, { date: '2026-10-02', minutes: 50, description: 'Reconcile bank' }, preparer);
  assert.equal(t1.amountCents, 7917); // 50 × 9500 ÷ 60 = 7916.67, rounded half up
  await h.json('/team/rates', { email: 'preparer@example.test', rateCents: 12000 }, h.owner);
  const t2 = await h.json(`/jobs/${nextJob.id}/time`, { date: '2026-10-03', minutes: 30, description: '=HYPERLINK("x")' }, preparer);
  assert.equal(t2.amountCents, 6000);
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
  draft = await h.json('/exports', { title: 'Draft', sourceKeys: ['time:' + t3.id] }, reviewer);
  await h.json(`/exports/${draft.id}/void`, { reason: 'Wrong month' }, reviewer);
  assert.ok((await h.json('/billing', undefined, reviewer)).unbilled.some(l => l.source_id === t3.id));
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
