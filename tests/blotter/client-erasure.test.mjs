// ERASURE-002 whole-client erasure through the built Worker's doors: retention marks, preview,
// approval by plan hash, named exceptions, journal export and stale-archive refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

const b64 = text => Buffer.from(text).toString('base64');
const contact = (name, email) => ({ name, email, roles: ['primary'], authorized: true, portal: true, requestConsent: true, emailConsent: true });
const tokenOf = recipient => new URL(recipient.portalUrl).pathname.split('/').at(-1);
const SENTINEL = { organizer: 'Sentinel organizer answer', thread: 'Sentinel thread text', engagement: 'Signed engagement letter bytes', intake: 'Sentinel bank statement bytes', note: 'Sentinel request note', credential: 'sentinel-password-1' };
const organizer = { name: 'Close organizer', kind: 'bookkeeping', version: 1, questions: [{ key: 'notes', label: 'Bookkeeper notes', type: 'text', required: true }] };

async function build(h) {
  for (const [email, role] of [['reviewer@example.test', 'reviewer'], ['prep@example.test', 'preparer']]) { await h.json('/team', { email, name: email, role }, h.owner); await h.json('/team/invite', { email }, h.owner); }
  const reviewer = await h.login('reviewer@example.test'), prep = await h.login('prep@example.test');
  await h.json('/team/rates', { email: 'prep@example.test', rateCents: 9000, effectiveFrom: '2026-01-01' }, h.owner);
  const client = await h.json('/clients', { name: 'Cedar Lane LLC', contacts: [contact('Alex Owner', 'alex@example.test'), contact('Blair Bookkeeper', 'blair@example.test')] }, h.owner);
  const other = await h.json('/clients', { name: 'Birch Street Cafe', contacts: [contact('Alex at Birch', 'alex@example.test')] }, h.owner);
  const [alex] = client.contacts.filter(c => c.email === 'alex@example.test');
  const template = await h.json('/templates', { name: 'Close', recurrence: 'monthly', steps: 'Reconcile', requests: 'Bank statement', organizer }, h.owner);
  const start = (periodStart, clientId = client.id) => h.json('/jobs', { clientId, templateId: template.id, periodStart, dueDate: '2027-04-15', dueNote: 'Recorded engagement target', preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  const signOff = async (job, file) => {
    let d = await h.json('/jobs/' + job.id, undefined, prep);
    const upload = await h.json(`/requests/${d.requests[0].id}/files`, file, prep);
    d = await h.json('/jobs/' + job.id, undefined, prep);
    for (const r of d.requests) await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, prep);
    for (const s of d.steps) await h.json(`/jobs/${job.id}/steps`, { ordinal: s.ordinal, done: true }, prep);
    d = await h.json(`/jobs/${job.id}/submit`, { revision: (await h.json('/jobs/' + job.id, undefined, prep)).job.revision }, prep);
    await h.json(`/jobs/${job.id}/review`, { revision: d.job.revision, decision: 'signoff', note: 'Engagement signed and filed' }, reviewer);
    return upload.id;
  };
  const engagement = await start('2026-01-01'), signed = await start('2026-02-01'), open = await start('2026-03-01');
  const engagementFile = await signOff(engagement, { name: 'engagement-letter.txt', mime: 'text/plain', contentBase64: b64(SENTINEL.engagement) });
  const signedFile = await signOff(signed, { name: 'signed-return.txt', mime: 'text/plain', contentBase64: b64('Signed return bytes') });
  // Open work: a file, a note, a thread, billable time and an expense, a stored credential, an organizer answer from the client.
  let d = await h.json('/jobs/' + open.id, undefined, prep);
  const intakeFile = (await h.json(`/requests/${d.requests[0].id}/files`, { name: 'bank.txt', mime: 'text/plain', contentBase64: b64(SENTINEL.intake) }, prep)).id;
  const retainedFile = (await h.json(`/requests/${d.requests[0].id}/files`, { name: 'retained.txt', mime: 'text/plain', contentBase64: b64('Retained until later bytes') }, prep)).id;
  await h.json(`/jobs/${open.id}/threads`, { anchor: 'request:' + d.requests[0].id, title: 'Statement query', body: SENTINEL.thread, correction: false }, prep);
  await h.json(`/jobs/${open.id}/time`, { date: '2026-10-02', minutes: 50, description: 'Reconcile bank' }, prep);
  await h.json(`/jobs/${open.id}/expenses`, { kind: 'postage', date: '2026-11-03', description: 'Courier to Cedar Lane', costCents: 1200, billable: false }, prep);
  await h.json(`/clients/${client.id}/credentials`, { label: 'State portal', url: 'https://gateway.example.test', username: 'sentinel-user', password: SENTINEL.credential, notes: 'n' }, h.owner);
  d = await h.json(`/jobs/${open.id}/organizers`, undefined, h.owner);
  const o = d.organizers[0], sent = await h.json(`/jobs/${open.id}/organizers/send`, { revision: o.revision, assignments: { notes: alex.id }, body: 'Please complete {{portal_link}}' }, prep);
  const token = tokenOf(sent.recipients[0]), portal = `/portal/${token}/organizers/${encodeURIComponent(o.id)}`;
  const mine = (await h.json(`/portal/${token}/organizers`)).organizers[0];
  await h.json(portal, { revision: mine.revision, answers: { notes: { value: SENTINEL.organizer, confirmed: true } }, submit: true });
  // Marketing: the contact withdrew; the same address belongs to another client's contact.
  await h.json('/marketing-consents', { contactId: alex.id, kind: 'withdraw', source: 'staff_reply', actedAt: '2026-10-01T10:00:00Z', evidence: 'Replied: please stop' }, h.owner);
  return { reviewer, prep, client, other, alex, engagement, signed, open, engagementFile, signedFile, intakeFile, retainedFile, token };
}

test('ERASURE-002 / BASE-001 / whole-client erasure keeps held and signed evidence, erases eligible payloads, journals counts and fences stale archives', async () => {
  const h = await harness(), target = await harness();
  try {
    const s = await build(h);
    const archive = async () => (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const old = await archive();
    for (const sentinel of [SENTINEL.organizer, SENTINEL.thread, 'alex@example.test', 'Cedar Lane LLC']) assert.ok(old.includes(sentinel), sentinel);

    // Authority: only the principal, only a person, and the client must be archived first.
    for (const who of [s.reviewer, s.prep]) {
      await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, who, 403);
      await h.json(`/clients/${s.client.id}/retention`, { scope: 'client', kind: 'hold', reason: 'x' }, who, 403);
    }
    await h.json('/erasure-journal', undefined, s.prep, 403);
    let preview = await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, h.owner);
    assert.equal(preview.eligible, false);
    assert.match(preview.blockers[0], /Archive the client/);
    await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: 'Cedar Lane LLC', reason: 'Too early' }, h.owner, 409);
    const detail = await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner);
    await h.json(`/clients/${s.client.id}/lifecycle`, { lifecycle: 'archived', revision: detail.revision }, h.owner);

    // Principal-set retention: a client hold blocks everything until released; job and file marks keep named records.
    const clientHold = await h.json(`/clients/${s.client.id}/retention`, { scope: 'client', kind: 'hold', reason: 'Litigation hold from counsel' }, h.owner);
    assert.match((await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, h.owner)).blockers[0], /Litigation hold from counsel/);
    await h.json(`/retention/${clientHold.id}/release`, { reason: 'Counsel cleared the matter' }, h.owner);
    await h.json(`/clients/${s.client.id}/retention`, { scope: 'job', targetId: s.engagement.id, kind: 'hold', reason: 'Held signed engagement' }, h.owner);
    await h.json(`/clients/${s.client.id}/retention`, { scope: 'file', targetId: s.retainedFile, kind: 'retain', until: '2999-01-01', reason: 'Seven-year record' }, h.owner);
    await h.json(`/clients/${s.client.id}/retention`, { scope: 'file', targetId: s.intakeFile, kind: 'retain', until: '2020-01-01', reason: 'Expired retention' }, h.owner);
    await h.json(`/clients/${s.client.id}/retention`, { scope: 'job', targetId: s.open.id, kind: 'hold', reason: 'x' }, s.reviewer, 403);
    await h.json(`/clients/${s.client.id}/retention`, { scope: 'job', targetId: s.other.id, kind: 'hold', reason: 'Wrong client' }, h.owner, 404);
    await h.json(`/clients/${s.client.id}/external-copies`, { kind: 'document', system: 'Google Drive: Engagements/Cedar Lane', holder: 'Pat Preparer, firm administrator', note: 'Shared folder copy' }, h.owner);
    await h.json(`/clients/${s.client.id}/external-copies`, { kind: 'buyer', system: 'Acquirer data room', holder: 'Northwind Advisory (practice buyer)' }, h.owner);

    // Preview: counts, named retained records, external copies with owners; nothing changes.
    preview = await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, h.owner);
    assert.equal(preview.eligible, true);
    const erase = Object.fromEntries(preview.erase.map(e => [e.table, e.count]));
    assert.deepEqual([erase.b_client_contacts, erase.b_files, erase.b_thread_messages, erase.b_vault_credentials, erase.b_clients], [2, 2, 1, 1, 1]);
    assert.ok(erase.b_organizer_submissions >= 1 && erase.b_marketing_consents >= 1 && erase.b_time === 1 && erase.b_expenses === 1);
    const kept = Object.fromEntries(preview.retained.map(r => [r.key, r]));
    assert.equal(kept.held_jobs.count, 1);
    assert.equal(kept.signed_off_jobs.count, 1);
    assert.equal(kept.billing_time.count, 1);
    assert.ok(kept.suppression_digests.count >= 1 && kept.audit_history.count > 0);
    assert.deepEqual(preview.externalCopies.map(c => [c.kind, c.holder, c.status]), [['document', 'Pat Preparer, firm administrator', 'open'], ['buyer', 'Northwind Advisory (practice buyer)', 'open']]);
    assert.ok(preview.externalCopies.every(c => /Not erased by Blotter/.test(c.action)));
    assert.equal((await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, h.owner)).planHash, preview.planHash, 'A preview changes nothing');

    // Approval is bound to the exact plan and the typed client name.
    await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: 'Cedar Lane LLC', reason: 'Client asked' }, s.reviewer, 403);
    await h.json(`/clients/${s.client.id}/erasure`, { planHash: 'f'.repeat(64), confirm: 'Cedar Lane LLC', reason: 'Client asked' }, h.owner, 409);
    await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: 'Cedar Lane', reason: 'Client asked' }, h.owner, 400);
    await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: 'Cedar Lane LLC', reason: '' }, h.owner, 400);
    const receipt = await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: 'Cedar Lane LLC', reason: 'Client asked for deletion' }, h.owner);
    assert.deepEqual(Object.fromEntries(receipt.steps.map(c => [c.table, c.count])), erase, 'Recorded counts equal the previewed counts');
    assert.equal(receipt.planHash, preview.planHash);
    await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: 'Cedar Lane LLC', reason: 'Again' }, h.owner, 409);

    // Eligible payloads and derived data are gone; held, retained and signed records remain.
    const file = async id => (await h.request('/api/blotter/files/' + id, undefined, h.owner));
    assert.equal((await file(s.engagementFile)).status, 200, 'Held job file stays');
    assert.equal(await (await file(s.engagementFile)).text(), SENTINEL.engagement);
    assert.equal(await (await file(s.retainedFile)).text(), 'Retained until later bytes');
    for (const id of [s.signedFile, s.intakeFile]) assert.equal((await file(id)).status, 404, 'Eligible file bytes are erased');
    const after = await archive();
    for (const gone of [SENTINEL.organizer, SENTINEL.thread, SENTINEL.credential, 'alex@example.test:', 'Blair Bookkeeper', 'blair@example.test', 'Cedar Lane LLC', b64(SENTINEL.intake), b64('Signed return bytes'), 'Courier to Cedar Lane']) assert.ok(!after.includes(gone), `${gone} is absent from new archives`);
    for (const stays of [b64(SENTINEL.engagement), b64('Retained until later bytes'), 'Engagement signed and filed']) assert.ok(after.includes(stays), `${stays} stays`);
    assert.equal((await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner)).lifecycle, 'archived');
    assert.match((await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner)).name, /^Erased client /);
    assert.equal((await h.json('/jobs/' + s.signed.id, undefined, h.owner)).job.status, 'signed_off', 'Signed-off job stays');
    assert.equal((await h.json('/jobs/' + s.open.id, undefined, h.owner)).time.length, 1, 'Billing time stays');

    // The withdrawal survives as a digest and still binds the other client's contact with the same address.
    const log = await h.json(`/marketing-consents?clientId=${s.other.id}`, undefined, h.owner);
    assert.ok(JSON.stringify(log).includes('withdraw'), 'Withdrawal carried to the other client contact');
    await h.json('/marketing-consents', { contactId: s.other.contacts[0].id, kind: 'grant', source: 'staff_evidence', actedAt: '2026-10-02T10:00:00Z', evidence: 'Asked at the front desk', wording: 'Email me offers', wordingVersion: 'v1' }, h.owner, 409);

    // The journal export names every exception with its owner and carries the newest checkpoint.
    const journal = await h.json('/erasure-journal', undefined, h.owner);
    assert.equal(journal.receipts.length, 1);
    assert.ok(journal.epoch >= 1 && journal.tombstones.length >= 1);
    assert.deepEqual(journal.receipts[0].retained.externalCopies.map(c => c.holder).sort(), ['Northwind Advisory (practice buyer)', 'Pat Preparer, firm administrator']);
    assert.ok(journal.receipts[0].retained.exceptions.every(e => e.owner && e.reason));
    assert.ok(!JSON.stringify(journal).includes('Cedar Lane'), 'The journal never stores values');

    // A stale archive cannot bring the erased client back; the newer one restores the redacted state.
    const stale = await target.request('/api/blotter/restore', { archive: old, journal: after, confirm: 'RESTORE' }, target.owner);
    assert.equal(stale.status, 409);
    assert.match((await stale.json()).error, /erasure/);
    assert.equal((await target.json('/restore', { archive: after, confirm: 'RESTORE' }, target.owner)).phase, 'complete');
    assert.match((await target.json(`/clients/${s.client.id}/detail`, undefined, target.owner)).name, /^Erased client /);
    assert.equal(await (await target.request('/api/blotter/files/' + s.engagementFile, undefined, target.owner)).text(), SENTINEL.engagement);
    assert.equal((await target.json('/erasure-journal', undefined, target.owner)).receipts.length, 1);
  } finally { await h.close(); await target.close(); }
});
