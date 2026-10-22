// ERASURE-002 retention, hold and erasure policy through the built Worker's doors (ct 22 Oct 2026):
// principal-only doors, periods and clocks, scoped holds, open-work refusals, the digest-bound preview,
// marker redaction with signed work and billing evidence retained, the sealed retained remainder, named
// outside copies, Ready to erase, the journal and the stale-restore fence. Fakes only the mail provider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { retentionJourney } from './erasure-ui.mjs';
import { build, contact, finishOpenWork, approvedExport, signedOff, team, SENTINEL, IDENTITY, b64, enroll, totp } from './erasure-fixture.mjs';

const file = (h, id, who = h.owner) => h.request('/api/blotter/files/' + id, undefined, who);
const rowsOf = archive => archive.trim().split('\n').map(JSON.parse).filter(p => p.kind === 'part').flatMap(p => p.items).filter(i => i.kind === 'row');
const years = n => new Date(Date.now() - n * 365 * 864e5).toISOString();

test('ERASURE-002 / BASE-001 / policy journey: principal-only doors, clocks and holds, preview, approved marker redaction keeping signed work and billing evidence, sealed remainder, named outside copies, journal and stale restore', async () => {
  const h = await harness(), target = await harness();
  try {
    const s = await build(h);
    const archive = async () => (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const old = await archive();
    for (const sentinel of [SENTINEL.organizer, SENTINEL.thread, 'alex@example.test', IDENTITY.name]) assert.ok(old.includes(sentinel), sentinel);
    const id = s.client.id, bearer = { authorization: 'Bearer ' + s.key.key };

    // Authority: only the principal, only as a person. A reviewer, a preparer and an agent key are refused every door.
    const doors = [['get', `/clients/${id}/retention`], ['post', `/clients/${id}/retention`], ['post', `/retention/${id}/release`], ['get', '/retention/periods'], ['post', '/retention/periods'], ['get', '/retention/holds'], ['get', '/retention/ready'],
      ['post', '/retention/ready/confirm'], ['post', `/clients/${id}/deletion-requests`], ['post', `/clients/${id}/engagements`], ['get', `/clients/${id}/engagements`], ['post', `/clients/${id}/external-copies`], ['get', `/clients/${id}/erasure/preview`],
      ['post', `/clients/${id}/erasure`], ['get', '/erasure-journal'], ['post', `/clients/${id}/retained-records`]];
    for (const [method, path] of doors) {
      for (const who of [s.reviewer, s.prep]) await h.json(path, method === 'get' ? undefined : {}, who, 403);
      await h.json(path, method === 'get' ? undefined : {}, '', 401, bearer);
    }

    // Periods: default 7, a warning below 7, SIGN-001's 3-year floor.
    const periods = await h.json('/retention/periods', undefined, h.owner);
    assert.deepEqual(periods.map(p => [p.class, p.years]), [['signed_work', 7], ['engagement', 7], ['efile_auth', 7], ['signed_documents', 7], ['billing', 7]]);
    const five = await h.json('/retention/periods', { class: 'billing', years: 5, reason: 'Firm policy' }, h.owner);
    assert.ok(five.warning.statute.includes('6107(b)') && five.warning.publication583.length >= 4, 'Below 7 the setting shows the statute and Publication 583');
    await h.json('/retention/periods', { class: 'efile_auth', years: 2, reason: 'Shorter' }, h.owner, 400);
    await h.json('/retention/periods', { class: 'efile_auth', years: 3, reason: 'SIGN-001 floor' }, h.owner);
    await h.json('/retention/periods', { class: 'billing', years: 0, reason: 'None' }, h.owner, 400);
    await h.json('/retention/periods', { class: 'billing', years: 7, reason: 'Back to the default' }, h.owner);

    // A practitioner-recorded signed engagement is held, by the principal or a named reviewer, with a review date.
    const letter = (await h.json(`/clients/${id}/engagements`, undefined, h.owner)).find(e => e.id === s.letter.id);
    assert.equal(letter.label, 'practitioner-recorded, not signed through Blotter');
    assert.match(letter.sha256, /^[0-9a-f]{64}$/);
    const hold = { scope: 'engagement', targetId: s.letter.id, kind: 'hold', reason: 'Engagement under dispute', owner: 'reviewer@example.test', reviewDate: '2999-01-01' };
    await h.json(`/clients/${id}/retention`, { ...hold, owner: 'prep@example.test' }, h.owner, 400);
    await h.json(`/clients/${id}/retention`, { ...hold, reviewDate: '2020-01-01' }, h.owner, 400);
    const engagementHold = await h.json(`/clients/${id}/retention`, hold, h.owner);
    // A retain-until date can only extend retention.
    const retain = await h.json(`/clients/${id}/retention`, { scope: 'job', targetId: s.signed.id, kind: 'retain', until: '2040-12-31', reason: 'Seven-year record' }, h.owner);
    await h.json(`/clients/${id}/retention`, { scope: 'client', kind: 'retain', until: '2020-01-01', reason: 'Earlier' }, h.owner, 400);
    await h.json(`/clients/${id}/retention`, { scope: 'job', targetId: s.signed.id, kind: 'retain', until: '2040-12-30', reason: 'Earlier than the last' }, h.owner, 400);
    await h.json(`/clients/${id}/retention`, { scope: 'job', targetId: s.other.id, kind: 'hold', reason: 'Wrong client', owner: 'reviewer@example.test', reviewDate: '2999-01-01' }, h.owner, 404);
    await h.json(`/retention/${retain.id}/release`, { reason: 'Test: the clock decides below' }, h.owner);
    await h.json(`/clients/${id}/external-copies`, { kind: 'document', system: 'Google Drive: Engagements folder', holder: 'Pat Preparer, firm administrator', note: 'Shared folder copy' }, h.owner);
    await h.json(`/clients/${id}/external-copies`, { kind: 'buyer', system: 'Acquirer data room', holder: 'Northwind Advisory (practice buyer)' }, h.owner);
    await h.json(`/clients/${id}/deletion-requests`, { requester: 'Alex Owner', channel: 'Email from alex@example.test', receivedOn: '2026-10-20', verification: 'Called back on the number on file', reason: 'Client left the practice' }, h.owner);
    const request = (await h.json(`/clients/${id}/retention`, undefined, h.owner)).requests[0];

    // Refused until archived, then while the client has open work; naming the records.
    let preview = await h.json(`/clients/${id}/erasure/preview`, undefined, h.owner);
    assert.match(preview.blockers[0], /Archive the client/);
    const detail = await h.json(`/clients/${id}/detail`, undefined, h.owner);
    await h.json(`/clients/${id}/lifecycle`, { lifecycle: 'archived', revision: detail.revision }, h.owner);
    preview = await h.json(`/clients/${id}/erasure/preview`, undefined, h.owner);
    assert.equal(preview.eligible, false);
    assert.ok(preview.blockers.some(b => /Open job: Close/.test(b)), 'The open job is named');
    await h.json(`/clients/${id}/erasure`, { planHash: preview.planHash, confirm: IDENTITY.name, reason: 'Too early' }, h.owner, 409);
    const pendingRun = await h.json('/agent/prepare-rollforward', { jobId: s.open.id, dueDate: '2027-04-28', dueNote: 'Next' }, '', 200, bearer);
    assert.ok((await h.json(`/clients/${id}/erasure/preview`, undefined, h.owner)).blockers.some(b => /pending agent run/.test(b)));
    await h.json(`/proposals/${pendingRun.id}/decide`, { decision: 'decline', reason: 'Not needed' }, h.owner);
    await finishOpenWork(h, s);
    const exportId = await approvedExport(h, s);
    const csvBefore = await (await h.request(`/api/blotter/exports/${exportId}/csv`, undefined, h.owner)).text();
    const exportRow = async () => (await h.json('/billing', undefined, h.owner)).exports.find(x => x.id === exportId);
    const shaBefore = (await exportRow()).csv_sha256;
    const { secret } = await enroll(h, s.prep);
    assert.equal((await h.json(`/credentials/${s.credential.id}/reveal`, { code: totp(secret, 1) }, s.prep)).password, SENTINEL.credential);

    // Preview: every class with its action and count, clocks and expiry dates, named holds, outside copies; nothing changes.
    preview = await h.json(`/clients/${id}/erasure/preview`, undefined, h.owner);
    assert.deepEqual(preview.blockers, [], preview.blockers.join(' | '));
    assert.equal(preview.eligible, true);
    const byClass = Object.fromEntries(preview.classes.map(c => [c.class, c]));
    assert.deepEqual(Object.keys(byClass).sort(), ['api', 'billing', 'contact', 'derived_ai', 'efile_auth', 'engagement', 'link', 'message', 'notification', 'organizer', 'prospect', 'readiness', 'signed_documents', 'signed_work', 'vault']);
    assert.ok(byClass.signed_work.retained >= 4 && byClass.billing.retained >= 2 && byClass.engagement.retained === 1 && byClass.vault.marker >= 1 && byClass.message.marker > 0 && byClass.readiness.removed === 1 && byClass.derived_ai.removed + byClass.derived_ai.marker >= 1);
    assert.ok(preview.records.length >= 4 && preview.records.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.clock) && r.expiry > r.clock && r.years === 7));
    const signedJob=(await h.json(`/jobs/${s.open.id}`,undefined,h.owner)).job,{timeZone}=await h.json('/firm/settings',undefined,h.owner);
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(signedJob.signed_off_at)).map(p=>[p.type,p.value]));
    const expectedClock=[letter.signed_date,`${parts.year}-${parts.month}-${parts.day}`].sort().at(-1);
    assert.deepEqual(preview.records.filter(r => r.kind === 'engagement').map(r => r.clock), [expectedClock], 'The engagement clock is the later of its signed date and latest sign-off in the firm timezone');
    const copies = preview.externalCopies.map(c => `${c.source}|${c.holder}`);
    for (const wanted of ['principal-recorded|Pat Preparer, firm administrator', 'principal-recorded|Northwind Advisory (practice buyer)']) assert.ok(copies.includes(wanted), wanted);
    for (const source of ['relay-mail', 'relay-mail-recipients', 'file-downloads', 'billing-downloads']) assert.ok(preview.externalCopies.some(c => c.source === source), `observed copy ${source}`);
    assert.ok(preview.externalCopies.every(c => /Not erased by Blotter/.test(c.action)));
    assert.equal(preview.holds.find(m => m.id === engagementHold.id).owner, 'reviewer@example.test');
    assert.equal((await h.json(`/clients/${id}/erasure/preview`, undefined, h.owner)).planHash, preview.planHash, 'A preview changes nothing');

    await retentionJourney(h, 'before', IDENTITY.name);

    // Approval: the digest, a reason and the typed client name; a changed preview is refused as stale; one atomic batch.
    await h.json(`/clients/${id}/erasure`, { planHash: preview.planHash, confirm: IDENTITY.name, reason: 'Client asked' }, s.reviewer, 403);
    await h.json(`/clients/${id}/erasure`, { planHash: 'f'.repeat(64), confirm: IDENTITY.name, reason: 'Client asked' }, h.owner, 409);
    await h.json(`/clients/${id}/erasure`, { planHash: preview.planHash, confirm: 'Cedar Lane', reason: 'Client asked' }, h.owner, 400);
    await h.json(`/clients/${id}/erasure`, { planHash: preview.planHash, confirm: IDENTITY.name, reason: '' }, h.owner, 400);
    const receipt = await h.json(`/clients/${id}/erasure`, { planHash: preview.planHash, confirm: IDENTITY.name, reason: 'Client asked for deletion', requestId: request.id }, h.owner);
    assert.deepEqual(Object.fromEntries(receipt.steps.map(c => [c.table, c.count])), Object.fromEntries(preview.erase.map(e => [e.table, e.count])), 'Recorded counts equal the previewed counts');
    assert.equal(receipt.planHash, preview.planHash);
    await h.json(`/clients/${id}/erasure`, { planHash: preview.planHash, confirm: IDENTITY.name, reason: 'Again' }, h.owner, 409);

    // Signed work, the held engagement and approved billing stay whole; the rest is marker-redacted or gone.
    assert.equal(await (await file(h, s.signedFile)).text(), SENTINEL.accepted, 'Accepted documents of signed-off work stay');
    assert.equal(await (await file(h, s.engagementFile)).text(), 'Engagement job working paper');
    assert.equal((await file(h, s.intakeFile)).status, 200, 'Accepted documents on the closed job stay too');
    assert.equal(await (await h.request(`/api/blotter/engagements/${s.letter.id}/file`, undefined, h.owner)).text(), SENTINEL.engagement);
    assert.equal(await (await h.request(`/api/blotter/exports/${exportId}/csv`, undefined, h.owner)).text(), csvBefore, 'Approved billing bytes are unchanged');
    assert.equal((await exportRow()).csv_sha256, shaBefore);
    assert.equal((await h.json('/jobs/' + s.signed.id, undefined, h.owner)).job.status, 'signed_off');
    const closed = await h.json('/jobs/' + s.open.id, undefined, h.owner);
    assert.equal(closed.job.sign_off_note, 'Close signed off');
    assert.deepEqual(closed.time.map(t => t.description), ['Reconcile bank'], 'Time a billing export snapshotted keeps its description');
    assert.deepEqual(closed.expenses.map(e => e.description), ['[erased]'], 'Unbilled expense text is replaced');
    const after = await archive();
    for (const gone of [SENTINEL.thread, SENTINEL.credential, 'alex@example.test:', 'Blair Bookkeeper', 'blair@example.test', 'Courier to Cedar Lane', IDENTITY.address]) assert.ok(!after.includes(gone), `${gone} is absent from new archives`);
    for (const stays of [b64(SENTINEL.engagement), b64(SENTINEL.accepted), 'Signed off and filed', SENTINEL.organizer]) assert.ok(after.includes(stays), `${stays} stays`);
    // The legal name survives only inside approved billing evidence and the sealed remainder, never in a plain row.
    for (const row of rowsOf(after)) for (const value of [IDENTITY.name, IDENTITY.ein]) if (JSON.stringify(row).includes(value)) assert.equal(row.table, 'b_exports', `${row.table} names the client`);
    // Derived AI data: preparations nobody consumed, agent output; run and decision ids stay.
    const readiness = await h.json(`/jobs/${s.open.id}/readiness`, undefined, h.owner);
    assert.deepEqual(readiness.questions.map(q => [q.id, q.status]), [[s.decided.id, 'declined']], 'The decision the signed-off job consumed stays; the undecided preparation is deleted');
    const plan = (await h.json('/state', undefined, h.owner)).proposals.find(p => p.id === s.roll.id);
    assert.equal(plan.decided_by, 'owner@example.test');
    assert.deepEqual(JSON.parse(plan.payload), {}, 'The agent plan is gone; its decision stays');
    // Links revoked, shares gone, the reveal log kept under opaque labels; only a hashed suppression remains.
    assert.equal((await h.request('/api/blotter/shared-files/' + s.share.token)).status, 404);
    assert.equal((await h.request(`/api/blotter/portal/${s.token}`)).status, 404);
    const creds = await h.json(`/clients/${id}/credentials`, undefined, h.owner);
    assert.ok(creds.credentials.every(c => c.erased_at));
    assert.ok(creds.reveals.length >= 1 && creds.reveals.every(r => /^Credential [0-9a-f]{8}$/.test(r.label) && r.actor === 'prep@example.test'), 'The reveal log stays under opaque labels');
    const marketing = await h.json(`/marketing-consents?clientId=${s.other.id}`, undefined, h.owner);
    assert.ok(JSON.stringify(marketing).includes('withdraw'), 'The withdrawal carried to the other client contact');
    await h.json('/marketing-consents', { contactId: s.other.contacts[0].id, kind: 'grant', source: 'staff_evidence', actedAt: '2026-10-02T10:00:00Z', evidence: 'Asked at the front desk', wording: 'Email me offers', wordingVersion: 'v1' }, h.owner, 409);

    // The mapped marketing import consults the erased withdrawals too: only an opt-in captured after the erasure could be mapped.
    const fields = ['client_id', 'client_name', 'entity_type', 'contact_name', 'contact_email', 'contact_roles', 'authorized', 'email_consent', 'tags', 'marketing_opt_in', 'marketing_captured_at', 'marketing_wording', 'marketing_wording_version', 'marketing_language', 'marketing_evidence'];
    const grant = (n, email) => ({ client_id: 'mapped-' + n, client_name: 'Mapped client ' + n, entity_type: 'individual', contact_name: 'Mapped ' + n, contact_email: email, contact_roles: 'primary', authorized: 'true', email_consent: 'true', tags: 'tax',
      marketing_opt_in: 'true', marketing_captured_at: '2026-10-01T10:00:00-04:00', marketing_wording: 'Yes email me the newsletter.', marketing_wording_version: 'v1', marketing_language: 'en', marketing_evidence: 'Signed consent record' });
    const csv = rows => [fields.join(','), ...rows.map(r => fields.map(k => JSON.stringify(String(r[k] ?? ''))).join(','))].join('\n');
    const mapped = rows => h.json('/import/preview', { csv: csv(rows), filename: 'Consent.csv', mapping: Object.fromEntries(fields.map(k => [k, k])) }, h.owner);
    assert.ok((await mapped([grant(1, 'alex@example.test')])).summary.errors.some(e => /withdrew consent before a client erasure/.test(e)));
    assert.deepEqual((await mapped([grant(2, 'newcomer@example.test')])).summary.errors, []);

    // Ordinary surfaces: a random Erased client label, the legal name only behind the audited retained-records door.
    const erased = await h.json(`/clients/${id}/detail`, undefined, h.owner);
    assert.match(erased.name, /^Erased client [0-9a-f]{8}$/);
    assert.ok(!erased.name.includes(id.slice(0, 8)), 'The label is random, not derived from the id');
    assert.ok(erased.contacts.every(c => /^Erased contact [0-9a-f]{8}$/.test(c.name)));
    assert.ok(erased.contacts.every(c => c.language === 'en'), 'A contact language preference (PORTAL-005) is erased with the contact');
    for (const door of ['/state', '/inbox', '/search?q=Cedar', '/search?q=123456789', '/agent/context', `/clients/${id}/history`]) {
      const text = JSON.stringify(await h.json(door, undefined, door === '/agent/context' ? '' : h.owner, 200, door === '/agent/context' ? bearer : {}));
      assert.ok(!text.includes(IDENTITY.name) && !text.includes(IDENTITY.address) && !text.includes('Cedar Lane'), `${door} shows no legal name: ${text.slice(Math.max(0, text.indexOf('Cedar Lane') - 200), text.indexOf('Cedar Lane') + 100)}`);
    }
    await h.json(`/clients/${id}/retained-records`, { reason: '' }, h.owner, 400);
    const read = await h.json(`/clients/${id}/retained-records`, { reason: 'Responding to an IRS inquiry' }, h.owner);
    assert.deepEqual([read.identity.legalName, read.identity.taxpayerId, read.identity.address['Street address']], [IDENTITY.name, IDENTITY.ein, IDENTITY.address]);
    assert.ok(read.records.length >= 4 && read.reads.length === 1 && read.reads[0].actor === 'owner@example.test');
    assert.ok((await h.json(`/clients/${id}/history`, undefined, h.owner)).history.some(e => e.action === 'retained.read'), 'Every use of the retained door is logged');
    const history = JSON.stringify(await h.json(`/clients/${id}/history`, undefined, h.owner));
    assert.ok(history.includes('client.erased') && !history.includes('alex@example.test'), 'Audit rows stay with their values replaced');

    await retentionJourney(h, 'after', 'Erased client');

    // The receipt names every outside copy with its owner and holds no erased value.
    const journal = await h.json('/erasure-journal', undefined, h.owner);
    assert.equal(journal.receipts.length, 1);
    assert.ok(journal.epoch >= 1 && journal.tombstones.length >= 1);
    const named = journal.receipts[0].retained.externalCopies.map(c => c.holder);
    for (const holder of ['Northwind Advisory (practice buyer)', 'Pat Preparer, firm administrator', 'The mail provider (provider-retained)', 'The recipients (recipient-controlled)']) assert.ok(named.includes(holder), holder);
    assert.ok(named.some(n => /named downloader/.test(n)), 'Staff downloads are named with the downloader');
    assert.ok(journal.receipts[0].retained.exceptions.every(e => e.owner && e.reason));
    assert.ok(!JSON.stringify(journal).includes(IDENTITY.name) && !JSON.stringify(journal).includes('alex@example.test'), 'The journal never stores client values');
    assert.equal((await h.json(`/clients/${id}/retention`, undefined, h.owner)).requests[0].erasure_id, receipt.id, 'The deletion request is linked to its erasure');

    // Inside a hold the single-item doors are refused naming it; release it and the door works.
    await h.json(`/files/${s.letter.id}/erase`, { confirm: 'engagement-letter.txt', reason: 'Try' }, h.owner, 409).then(r => assert.match(r.error, /Engagement under dispute|hold/));
    await h.json(`/retention/${engagementHold.id}/release`, { reason: 'Dispute settled' }, h.owner);

    // Ready to erase: the clock seeded eight years back; confirming keeps the record, kind, revision and SHA-256.
    const dropAndSeed = async () => {
      const triggers = (await h.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN ('b_jobs_signed_off','b_exports_transition')").all()).results;
      for (const t of triggers) await h.db.prepare(`DROP TRIGGER ${t.name}`).run();
      await h.db.prepare("UPDATE b_jobs SET signed_off_at=?,due_date='2018-04-15' WHERE client_id=?").bind(years(8), id).run();
      await h.db.prepare('UPDATE b_engagements SET signed_date=? WHERE client_id=?').bind(years(9).slice(0, 10), id).run();
      await h.db.prepare("UPDATE b_exports SET approved_at=? WHERE id=?").bind(years(8), exportId).run();
      for (const t of triggers) await h.db.prepare(t.sql).run();
    };
    await dropAndSeed();
    const ready = await h.json('/retention/ready', undefined, h.owner);
    assert.deepEqual(ready.ready.map(r => r.kind).sort(), ['engagement', 'export', 'job', 'job', 'job']);
    const engagementItem = ready.ready.find(r => r.kind === 'engagement');
    await h.json('/retention/ready/confirm', { kind: 'engagement', id: engagementItem.id, reason: '' }, h.owner, 400);
    await h.json('/retention/ready/confirm', { kind: 'engagement', id: engagementItem.id, reason: 'Period ended' }, s.reviewer, 403);
    await h.json('/retention/ready/confirm', { kind: 'engagement', id: engagementItem.id, reason: 'Period ended' }, h.owner);
    assert.equal((await h.request(`/api/blotter/engagements/${s.letter.id}/file`, undefined, h.owner)).status, 404, 'Its bytes are gone');
    const kept = (await h.json(`/clients/${id}/engagements`, undefined, h.owner)).find(e => e.id === s.letter.id);
    assert.equal(kept.sha256, letter.sha256, 'The SHA-256 stays');
    await h.json('/retention/ready/confirm', { kind: 'engagement', id: engagementItem.id, reason: 'Again' }, h.owner, 409);
    // Lengthening a period recomputes only unerased records; the erased one is never revived.
    await h.json('/retention/periods', { class: 'signed_work', years: 30, reason: 'Longer' }, h.owner);
    assert.deepEqual((await h.json('/retention/ready', undefined, h.owner)).ready.map(r => r.kind).sort(), ['export']);
    await h.json('/retention/periods', { class: 'signed_work', years: 1, reason: 'Shorter' }, h.owner);
    await h.json('/retention/periods', { class: 'engagement', years: 30, reason: 'Longer' }, h.owner);
    const again = await h.json('/retention/ready', undefined, h.owner);
    assert.deepEqual(again.ready.map(r => r.kind).sort(), ['export', 'job', 'job', 'job'], 'Engagements already erased are not listed again');
    const jobItem = again.ready.find(r => r.id === s.signed.id);
    await h.json('/retention/ready/confirm', { kind: 'job', id: jobItem.id, reason: 'Period ended' }, h.owner);
    assert.equal((await file(h, s.signedFile)).status, 404, 'Accepted bytes go only when their clock expires');
    assert.equal((await h.json('/jobs/' + s.signed.id, undefined, h.owner)).job.signed_off_by, 'reviewer@example.test', 'Sign-off attribution stays');
    await h.json('/retention/ready/confirm', { kind: 'export', id: exportId, reason: 'Period ended' }, h.owner);
    const spent = await exportRow();
    assert.deepEqual([spent.csv_sha256, spent.status], [shaBefore, 'approved'], 'Number, totals and SHA-256 stay');
    assert.equal(await (await h.request(`/api/blotter/exports/${exportId}/csv`, undefined, h.owner)).text(), '', 'The bytes go');

    // Export the journal; restore the pre-erasure archive with the newer journal and be refused naming the erasure.
    const latest = await archive();
    const stale = await target.request('/api/blotter/restore', { archive: old, journal: latest, confirm: 'RESTORE' }, target.owner);
    assert.equal(stale.status, 409);
    assert.match((await stale.json()).error, /erasure/);
    // A fresh destination without the journal restores only after the unverified-history acknowledgment, recorded in the import report.
    assert.match((await target.json('/restore', { archive: latest, confirm: 'RESTORE' }, target.owner, 409)).error, /erasure history unverified/);
    const report = await target.json('/restore', { archive: latest, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, target.owner);
    assert.equal(report.phase, 'complete');
    assert.deepEqual([report.erasureHistory.status, report.erasureHistory.acknowledgedBy], ['unverified', 'owner@example.test']);
    assert.match((await target.json(`/clients/${id}/detail`, undefined, target.owner)).name, /^Erased client /);
    assert.equal((await target.json('/erasure-journal', undefined, target.owner)).receipts.length, 1);
  } finally { await h.close(); await target.close(); }
});

test('ERASURE-002 / holds by client and record class leave named exceptions, refuse the single-item doors inside them, merged clients are erased with their survivor, and an unclassified store stops the preview', async () => {
  const h = await harness();
  try {
    const s = await team(h);
    const client = await h.json('/clients', { name: 'Maple Works LLC' }, h.owner);
    const twin = await h.json('/clients', { name: 'Maple Works Inc' }, h.owner);
    const template = await h.json('/templates', { name: 'Close', recurrence: 'monthly', steps: 'Reconcile', requests: 'Bank statement\nPayroll register' }, h.owner);
    const job = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'Target', preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
    const fileId = await signedOff(h, s, job, { name: 'return.txt', mime: 'text/plain', contentBase64: b64('Return bytes') });
    const credential = await h.json(`/clients/${client.id}/credentials`, { label: 'State portal', username: 'maple-user', password: 'synthetic-blotter-1', notes: '' }, h.owner);
    const comparison = await h.json(`/clients/compare?a=${client.id}&b=${twin.id}`, undefined, h.owner);
    const merge = await h.json('/clients/merge', { survivor: client.id, merged: twin.id, keep: Object.fromEntries(comparison.fields.filter(f => !f.same && f.key !== 'source').map(f => [f.key, 'survivor'])) }, h.owner);
    const detail = await h.json(`/clients/${client.id}/detail`, undefined, h.owner);
    await h.json(`/clients/${client.id}/lifecycle`, { lifecycle: 'archived', revision: detail.revision }, h.owner);
    const erase = (planHash, name = 'Maple Works LLC') => h.json(`/clients/${client.id}/erasure`, { planHash, confirm: name, reason: 'Client left' }, h.owner);
    const preview = () => h.json(`/clients/${client.id}/erasure/preview`, undefined, h.owner);
    const hold = (extra, who = 'owner@example.test') => h.json(`/clients/${client.id}/retention`, { kind: 'hold', reason: 'Counsel asked', owner: who, reviewDate: '2999-01-01', ...extra }, h.owner);

    // A held record class: its records stay, the preview names the hold, and the single-item door is refused naming it.
    const vaultHold = await hold({ scope: 'class', class: 'vault' });
    const firmHold = await hold({ scope: 'class', class: 'message', firmWide: true });
    const firm = await h.json('/retention/holds', undefined, h.owner);
    assert.deepEqual(firm.holds.map(x => [x.class, x.client_name, x.reviewDue]).sort(), [['message', null, false], ['vault', 'Maple Works LLC', false]]);
    const held = await preview();
    assert.ok(held.classes.find(c => c.class === 'vault').held >= 1 && held.classes.find(c => c.class === 'vault').holds[0].id === vaultHold.id);
    assert.match((await h.json(`/credentials/${credential.id}/erase`, { confirm: 'State portal', reason: 'Try' }, h.owner, 409)).error, /ERASURE-002 hold/);
    await h.json(`/clients/${client.id}/retention`, { scope: 'file', targetId: fileId, kind: 'hold', reason: 'Exhibit', owner: 'owner@example.test', reviewDate: '2999-01-01' }, h.owner);
    assert.match((await h.json(`/files/${fileId}/erase`, { confirm: 'return.txt', reason: 'Try' }, h.owner, 409)).error, /Exhibit/);

    // A hold on the whole client: access links are revoked, everything else stays, and the client is not erased.
    const clientHold = await hold({ scope: 'client' });
    const frozen = await preview();
    assert.ok(frozen.eligible && frozen.classes.every(c => c.removed === 0 && c.marker === 0 || c.class === 'link'), 'Under a client hold only access revocation runs');
    await erase(frozen.planHash);
    assert.equal((await h.json(`/clients/${client.id}/detail`, undefined, h.owner)).name, 'Maple Works LLC');
    assert.ok(!(await h.json(`/clients/${client.id}/credentials`, undefined, h.owner)).credentials[0].erased_at);

    // Release the holds: the client, its credential and the merged record are erased; the merge cannot be undone.
    for (const m of [clientHold, vaultHold, firmHold]) await h.json(`/retention/${m.id}/release`, { reason: 'Matter closed' }, h.owner);
    const fileHold = (await h.json(`/clients/${client.id}/retention`, undefined, h.owner)).marks.find(m => m.scope === 'file');
    await h.json(`/retention/${fileHold.id}/release`, { reason: 'Matter closed' }, h.owner);

    // An unclassified table, or an unclassified byte column, stops the preview: the registry fails closed.
    await h.db.prepare('CREATE TABLE b_mystery(id TEXT, payload_base64 TEXT)').run();
    const stopped = await preview();
    assert.equal(stopped.eligible, false);
    assert.match(stopped.blockers[0], /Unclassified.*table b_mystery/);
    await h.db.prepare('DROP TABLE b_mystery').run();
    await h.db.prepare('ALTER TABLE b_notices ADD COLUMN extra_bytes TEXT').run();
    assert.match((await preview()).blockers[0], /column b_notices\.extra_bytes/);
    await h.db.prepare('ALTER TABLE b_notices DROP COLUMN extra_bytes').run();

    const ready = await preview();
    assert.deepEqual(ready.blockers, []);
    const receipt = await erase(ready.planHash);
    assert.ok(receipt.steps.some(x => x.table === 'b_client_merges'));
    assert.ok(!(await h.json(`/clients/${client.id}/credentials`, undefined, h.owner)).credentials[0].sealed);
    assert.match((await h.db.prepare('SELECT name FROM b_clients WHERE id=?').bind(twin.id).first()).name, /^Erased client [0-9a-f]{8}$/, 'The merged record is erased with its survivor');
    const history = JSON.stringify(await h.json('/clients/merges', undefined, h.owner));
    assert.ok(!history.includes('Maple Works'), 'The merge history keeps ids with the personal values replaced');
    await h.json(`/clients/merges/${merge.id}/undo`, {}, h.owner, 409);
    assert.equal((await h.json('/erasure-journal', undefined, h.owner)).receipts.length, 2, 'The held run and the completed run are both journaled');
  } finally { await h.close(); }
});
