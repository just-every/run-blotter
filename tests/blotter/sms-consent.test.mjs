// Optional native consent through real portal and staff HTTP doors; only paid mail is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { billingSession } from './portal-billing-fixture.mjs';
import { smsConsentJourney, smsStaffJourney } from './sms-consent-ui.mjs';

const address = n => [`synthetic-blotter-${n}`, 'example.test'].join('@');
const person = (n, extra = {}) => ({ name: `Synthetic contact ${n}`, email: address(n), phone: '(202) 555-0147', roles: ['primary'], authorized: true, portal: true, emailConsent: true, requestConsent: true, ...extra });
const make = async (h, n, extra = {}) => {
  const client = await h.json('/clients', { name: `Synthetic entity ${n}`, contacts: [person(n, extra)] }, h.owner);
  return { client, billing: client.contacts[0] };
};
const door = s => `/client/entities/${s.client.id}/sms-consent`;
const read = (h, s, cookie, status = 200) => h.json(door(s), undefined, cookie, status);
const input = (view, choice, requestId) => ({ requestId, contactRevision: view.contactRevision, phone: view.phone, language: view.language, wordingVersion: view.wordingVersion, lastId: view.lastId, choice });
const save = (h, s, cookie, view, choice, requestId, status = 200) => h.json(door(s), input(view, choice, requestId), cookie, status);
const staff = (h, s, cookie = h.owner, status = 200) => h.json(`/clients/${s.client.id}/sms-consent`, undefined, cookie, status);
const events = async h => (await h.db.prepare('SELECT * FROM b_sms_consents ORDER BY client_id,contact_id,sequence').all()).results;
const audits = async h => (await h.db.prepare("SELECT * FROM b_audit WHERE action='sms.choice_recorded' ORDER BY rowid").all()).results;
const archiveRows = archive => archive.trim().split('\n').flatMap(line => JSON.parse(line).items ?? []).filter(item => item.table === 'b_sms_consents').map(item => item.row);
const enroll = (h, s) => billingSession(h, s);
const reopen = async (h, s) => {
  const access = await h.json(`/clients/${s.client.id}/portal-access`, undefined, h.owner);
  const grant = access.grants.find(g => g.contactId === s.billing.id);
  await h.json(`/portal-accounts/${grant.accountId}/reset`, { reason: 'Synthetic fresh enrollment' }, h.owner);
  return enroll(h, s);
};
const edit = async (h, s, values) => {
  const contact = (await h.json(`/clients/${s.client.id}/contacts`, undefined, h.owner)).find(c => c.id === s.billing.id);
  return h.json(`/clients/${s.client.id}/contacts`, { id: contact.id, revision: contact.revision, ...values }, h.owner);
};
const archiveClient = async (h, s) => h.json(`/clients/${s.client.id}/lifecycle`, { lifecycle: 'archived', revision: (await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner)).revision }, h.owner);

test('A current contact declines, opts in explicitly, withdraws and safely replays one attributed choice without creating delivery or changing other consent', async () => {
  const h = await harness();
  try {
    const s = await make(h, 601), other = await make(h, 602), samePerson = await make(h, 603, { email: address(601) });
    // Matching phones and even an account shared across entities never share SMS choices.
    const cookie = await enroll(h, s), foreign = await enroll(h, other);
    await h.json(`/clients/${samePerson.client.id}/contacts/${samePerson.billing.id}/portal-invite`, {}, h.owner);
    const sharedToken = h.mails.findLast(m => m.text.includes('/client?invite=') && m.to.includes(s.billing.email)).text.match(/invite=(pi_[0-9a-f]{64})/)[1];
    const sharedResponse = await h.request('/api/blotter/client/accept', { token: sharedToken });
    assert.equal(sharedResponse.status, 200);
    const shared = sharedResponse.headers.get('set-cookie').split(';')[0];
    // Inviting another entity ends the earlier account session; accept its completed-factor session afresh.
    const mine = await reopen(h, s);
    let view = await read(h, s, mine);
    assert.deepEqual([view.phone, view.optedIn, view.sendingAvailable, view.carrierVerified, view.history], ['+12025550147', false, false, false, []]);
    assert.equal((await read(h, samePerson, mine)).optedIn, false);
    await read(h, other, mine, 404); await read(h, s, foreign, 404);
    await h.json('/marketing-consents', { contactId: s.billing.id, kind: 'grant', source: 'staff_evidence', actedAt: '2026-01-01T12:00:00Z',
      wording: 'Send optional practice email updates', wordingVersion: 'synthetic-blotter-625', evidence: 'Synthetic contact requested email updates' }, h.owner);
    assert.equal((await read(h, s, mine)).history.length, 0, 'Marketing email consent creates no SMS consent');
    const fields = ['client_id','client_name','contact_name','contact_email','contact_phone','authorized','portal','email_consent','request_consent'];
    const mappedInput = { csv: [fields.join(','), ['synthetic-blotter-626','Imported synthetic entity','Imported contact',address(626),'+12025550147','true','true','true','true'].join(',')].join('\n'),
      filename: 'synthetic-blotter-626.csv', mapping: Object.fromEntries(fields.map(key => [key,key])) };
    const preview = await h.json('/import/preview', mappedInput, h.owner);
    let imported = await h.json('/import/commit', { ...mappedInput, fingerprint: preview.fingerprint }, h.owner);
    while (imported.job.state !== 'completed') imported = await h.json('/import/resume', { id: imported.job.id }, h.owner);
    const importedClient = (await h.json('/state', undefined, h.owner)).clients.find(client => client.name === 'Imported synthetic entity');
    const importedContact = (await h.json(`/clients/${importedClient.id}/contacts`, undefined, h.owner))[0];
    assert.equal(importedContact.phone, '+12025550147');
    const importedScope = { client: importedClient, billing: importedContact }, importedCookie = await enroll(h, importedScope);
    let importedChoice = await read(h, importedScope, importedCookie);
    assert.equal(importedChoice.history.length, 0, 'Imported consent flags and a matching phone never create an SMS choice');
    importedChoice = await save(h, importedScope, importedCookie, importedChoice, 'opt_in', 'synthetic-blotter-628');
    const changedInput = { ...mappedInput, csv: mappedInput.csv.replace('+12025550147', '+12025550148') };
    const changedPreview = await h.json('/import/preview', changedInput, h.owner);
    await h.json('/import/commit', { ...changedInput, fingerprint: changedPreview.fingerprint }, h.owner, 409);
    assert.equal((await read(h, importedScope, importedCookie)).optedIn, true, 'A refused reimport does not alter the recorded client choice');
    await edit(h, importedScope, { phone: '+12025550148' });
    const currentImportedCookie = await reopen(h, importedScope);
    const changedChoice = await read(h, importedScope, currentImportedCookie);
    assert.deepEqual([changedChoice.phone, changedChoice.optedIn], ['+12025550148', false]);
    let undo = await h.json('/import/undo', { id: imported.job.id }, h.owner);
    while (undo.job.state === 'undoing') undo = await h.json('/import/undo', { id: imported.job.id }, h.owner);
    const undoneChoice = await read(h, importedScope, currentImportedCookie);
    assert.deepEqual([undoneChoice.phone, undoneChoice.optedIn, undoneChoice.history.length], ['+12025550148', false, 1], 'Import undo preserves native contact changes and consent history');
    await edit(h, importedScope, { phone: '+12025550147' });
    const revertedCookie = await reopen(h, importedScope), reverted = await read(h, importedScope, revertedCookie);
    assert.equal(reverted.optedIn, false, 'Returning an imported contact to its original phone never revives consent');
    await save(h, importedScope, revertedCookie, { ...importedChoice, lastId: null }, 'opt_in', 'synthetic-blotter-628', 409);
    const flags = await h.json(`/clients/${s.client.id}/contacts`, undefined, h.owner), mails = h.mails.length;
    const tables = ['b_thread_messages','b_reminders','b_bulk_recipients','b_invoice_reminders','b_automation_attempts','b_provider_payments','b_marketing_consents'];
    const effects = async () => Promise.all(tables.map(table => h.db.prepare(`SELECT count(*) n FROM ${table}`).first().then(row => row.n)));
    const before = await effects();
    await h.json(door(s), { ...input(view, 'opt_in', 'synthetic-blotter-603'), actor: 'staff' }, mine, 400);
    view = await save(h, s, mine, view, 'decline', 'synthetic-blotter-604');
    assert.equal(view.optedIn, false); assert.equal(view.history[0].choice, 'decline');
    await h.json(door(s), { ...input(view, 'opt_in', 'synthetic-blotter-605'), wordingVersion: 'synthetic-blotter-627' }, mine, 409);
    const shown = view, request = input(view, 'opt_in', 'synthetic-blotter-605');
    const responses = await Promise.all([h.json(door(s), request, mine), h.json(door(s), request, mine)]);
    assert.equal(responses[0].lastId, responses[1].lastId);
    view = responses[0];
    assert.equal(view.optedIn, true); assert.equal(view.history.length, 2);
    const receipt = view.history[0], grant = (await h.json(`/clients/${s.client.id}/portal-access`, undefined, h.owner)).grants.find(g => g.contactId === s.billing.id);
    assert.deepEqual([receipt.clientId, receipt.contactId, receipt.accountId, receipt.contactRevision, receipt.phone, receipt.wordingVersion, receipt.wording, receipt.language, receipt.choice],
      [s.client.id, s.billing.id, grant.accountId, shown.contactRevision, '+12025550147', shown.wordingVersion, shown.wording, 'en', 'opt_in']);
    assert.equal(receipt.actor, `client portal account ${grant.accountId}`); assert.ok(Number.isFinite(Date.parse(receipt.at)));
    assert.match(receipt.wording, /not carrier-verified/); assert.match(receipt.wording, /marketing texts/); assert.match(receipt.wording, /unavailable/);
    assert.equal((await audits(h)).filter(a => a.object_id === s.client.id).length, 2, 'Concurrent identical requests record exactly one attributed audit');
    await h.json(door(s), { ...request, choice: 'withdraw' }, mine, 409);
    await save(h, s, mine, shown, 'decline', 'synthetic-blotter-606', 409);
    assert.deepEqual((await staff(h, s)).events, view.history);
    view = await save(h, s, mine, view, 'withdraw', 'synthetic-blotter-607');
    assert.equal(view.optedIn, false); assert.equal(view.history[0].choice, 'withdraw');
    await h.json(door(s), request, mine, 409);
    assert.equal((await read(h, other, foreign)).history.length, 0);
    assert.equal((await read(h, samePerson, mine)).history.length, 0);
    await smsConsentJourney(h, s, mine);
    await smsStaffJourney(h, s);
    assert.deepEqual(await h.json(`/clients/${s.client.id}/contacts`, undefined, h.owner), flags, 'SMS choices leave every other contact flag and revision unchanged');
    assert.deepEqual(await effects(), before, 'No message, scheduled send, payment, marketing choice or provider work is created');
    assert.equal(h.mails.length, mails, 'The provider edge sees no request from consent capture');
    assert.ok((await audits(h)).filter(a => a.object_id === s.client.id).every(a => a.actor === receipt.actor && a.object_id === s.client.id && a.detail.includes('no sending authority')));
    assert.equal((await read(h, s, mine)).sendingAvailable, false);
    assert.equal((await h.request(`/api/blotter/clients/${s.client.id}/sms-consent`, request, h.owner)).status, 404, 'Staff have no choice write door');
    assert.equal((await h.request('/api/blotter'+door(s), request, h.owner)).status, 401, 'A staff session cannot impersonate a portal choice');
    await read(h, s, cookie, 401); await read(h, samePerson, shared, 401);
  } finally { await h.close(); }
});

test('SMS choices require current factors, sessions, contacts and client authority; phone edits, merges and undo cannot revive prior choices', async () => {
  const h = await harness();
  try {
    const s = await make(h, 611), twin = await make(h, 612);
    let cookie = await enroll(h, s), view = await read(h, s, cookie);
    view = await save(h, s, cookie, view, 'opt_in', 'synthetic-blotter-613');
    const before = (await events(h)).length;
    const denied = async (status, who = cookie) => { await read(h, s, who, status); await save(h, s, who, view, 'opt_in', 'synthetic-blotter-614', status); assert.equal((await events(h)).length, before); };
    await h.json('/client/sign-out', {}, cookie); await denied(401);
    cookie = await reopen(h, s); view = await read(h, s, cookie);
    await h.json('/portal-policy', { mfaRequired: false, reason: 'Consent still requires a completed factor' }, h.owner);
    const account = (await h.json(`/clients/${s.client.id}/portal-access`, undefined, h.owner)).grants[0].accountId;
    await h.json(`/portal-accounts/${account}/reset`, { reason: 'Lost factor' }, h.owner); await denied(401);
    await h.json(`/clients/${s.client.id}/contacts/${s.billing.id}/portal-invite`, {}, h.owner);
    const token = h.mails.findLast(m => m.text.includes('/client?invite=') && m.to.includes(s.billing.email)).text.match(/invite=(pi_[0-9a-f]{64})/)[1];
    const response = await h.request('/api/blotter/client/accept', { token }); cookie = response.headers.get('set-cookie').split(';')[0];
    await denied(403); // Required by the consent door even under optional portal MFA.
    await h.json('/portal-policy', { mfaRequired: true, reason: 'Restore existing default' }, h.owner);
    cookie = await reopen(h, s); view = await read(h, s, cookie);
    await h.json(`/clients/${s.client.id}/contacts/${s.billing.id}/portal-revoke`, { reason: 'Contact left' }, h.owner); await denied(404);
    cookie = await reopen(h, s); view = await read(h, s, cookie);
    await edit(h, s, { phone: '+12025550148' }); await denied(401);
    cookie = await reopen(h, s); let changed = await read(h, s, cookie);
    assert.equal(changed.optedIn, false); assert.equal(changed.phone, '+12025550148'); assert.equal(changed.history[0].phone, '+12025550147');
    await save(h, s, cookie, view, 'opt_in', 'synthetic-blotter-615', 409);
    await edit(h, s, { phone: '+12025550147' }); cookie = await reopen(h, s);
    changed = await read(h, s, cookie); assert.equal(changed.optedIn, false, 'Restoring the old phone does not revive its consent');
    changed = await save(h, s, cookie, changed, 'opt_in', 'synthetic-blotter-616');
    await edit(h, s, { language: 'es' });
    assert.equal((await read(h, s, cookie)).optedIn, true, 'A language-only preference does not revoke an unchanged phone choice');
    await smsConsentJourney(h, s, cookie, 'es');
    // The survivor and moved contact both lose earlier SMS consent; original entity references do not move.
    const twinCookie = await enroll(h, twin), twinView = await read(h, twin, twinCookie);
    await save(h, twin, twinCookie, twinView, 'opt_in', 'synthetic-blotter-617');
    const priorEvents = await events(h), comparison = await h.json(`/clients/compare?a=${s.client.id}&b=${twin.client.id}`, undefined, h.owner);
    const merge = await h.json('/clients/merge', { survivor: s.client.id, merged: twin.client.id, authority: 'Reviewed both synthetic entities',
      keep: Object.fromEntries(comparison.fields.filter(f => !f.same && f.key !== 'source').map(f => [f.key, 'survivor'])),
      contactAuthority: { [s.billing.id]: 'Same synthetic entity approved', [twin.billing.id]: 'Same synthetic entity approved' } }, h.owner);
    await read(h, twin, twinCookie, 404);
    assert.equal((await read(h, s, cookie)).optedIn, false);
    assert.ok((await events(h)).every(event => event.invalidated_at));
    assert.deepEqual((await events(h)).map(e => [e.id, e.client_id, e.contact_id, e.phone, e.choice, e.actor, e.at]), priorEvents.map(e => [e.id, e.client_id, e.contact_id, e.phone, e.choice, e.actor, e.at]));
    assert.equal((await staff(h, s)).events.length, priorEvents.length, 'Current survivor staff inspect both original histories');
    await h.json(`/clients/merges/${merge.id}/undo`, { reason: 'Separate records again' }, h.owner);
    cookie = await reopen(h, s); assert.equal((await read(h, s, cookie)).optedIn, false);
    const restoredTwinCookie = await reopen(h, twin); assert.equal((await read(h, twin, restoredTwinCookie)).optedIn, false);
    await edit(h, s, { active: false }); await read(h, s, cookie, 401);
    const prepAddress = address(618);
    await h.json('/team', { email: prepAddress, name: 'Unassigned preparer', role: 'preparer' }, h.owner);
    await h.json('/team/invite', { email: prepAddress }, h.owner); const prep = await h.login(prepAddress);
    await staff(h, s, prep, 404);
    const reviewerAddress = address(619);
    await h.json('/team', { email: reviewerAddress, name: 'Scoped reviewer', role: 'reviewer' }, h.owner);
    await h.json('/team/invite', { email: reviewerAddress }, h.owner); const reviewer = await h.login(reviewerAddress);
    await staff(h, s, reviewer);
    await h.json('/access/people', { email: reviewerAddress, clientIds: [twin.client.id], readOnly: false, reason: 'Only separate entity access' }, h.owner);
    await staff(h, s, reviewer, 404);
  } finally { await h.close(); }
});

test('SMS evidence travels as inactive history; whole-client holds, reviewed redaction and receipts preserve attribution and fence stale restores', async () => {
  const h = await harness(); let restored, stale;
  try {
    const s = await make(h, 621), other = await make(h, 622), cookie = await enroll(h, s);
    let view = await read(h, s, cookie);
    view = await save(h, s, cookie, view, 'opt_in', 'synthetic-blotter-623');
    const original = view.history[0], archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const carried = archiveRows(archive);
    assert.equal(carried.length, 1); assert.equal(carried[0].restored, 1);
    assert.deepEqual([carried[0].client_id, carried[0].contact_id, carried[0].phone, carried[0].wording, carried[0].actor, carried[0].at], [s.client.id, s.billing.id, original.phone, original.wording, original.actor, original.at]);
    restored = await harness(); await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    await read(restored, s, cookie, 401);
    const fresh = await enroll(restored, s), history = await read(restored, s, fresh);
    assert.equal(history.optedIn, false); assert.equal(history.history[0].historical, true);
    assert.equal(history.history[0].wording, original.wording);
    await save(restored, s, fresh, { ...history, lastId: null }, 'opt_in', 'synthetic-blotter-623', 409);
    assert.equal((await read(restored, s, fresh)).optedIn, false);
    await archiveClient(h, s);
    const hold = await h.json(`/clients/${s.client.id}/retention`, { scope: 'client', kind: 'hold', reason: 'Synthetic counsel hold', owner: (await h.json('/state', undefined, h.owner)).actor.email, reviewDate: '2999-01-01' }, h.owner);
    let preview = await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, h.owner);
    assert.equal(preview.eligible, true); assert.ok(preview.classes.find(c => c.class === 'contact').held >= 2);
    const retained = await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: s.client.name, reason: 'Respect the hold' }, h.owner);
    assert.ok(retained.retained.holds.some(mark => mark.id === hold.id));
    assert.equal((await events(h))[0].phone, original.phone);
    await h.json(`/retention/${hold.id}/release`, { reason: 'Hold ended' }, h.owner);
    preview = await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, h.owner);
    assert.ok(preview.classes.find(c => c.class === 'contact').marker >= 2);
    const receipt = await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: s.client.name, reason: 'Erase synthetic phone and wording' }, h.owner);
    assert.ok(JSON.stringify(receipt).includes('b_sms_consents'));
    assert.ok(!JSON.stringify(receipt).includes(original.phone), 'Receipts contain counts and no erased phone');
    const redacted = (await staff(h, s)).events[0];
    assert.deepEqual([redacted.phone, redacted.wording, redacted.contactRevision], ['', '[erased]', '[erased]']);
    assert.deepEqual([redacted.actor, redacted.at, redacted.choice], [original.actor, original.at, 'opt_in']);
    assert.ok(redacted.erasedAt); await read(h, s, cookie, 401);
    assert.equal((await staff(h, other)).events.length, 0, 'A matching phone on a separate entity is untouched');
    const latest = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.equal(archiveRows(latest)[0].phone, '');
    stale = await harness(); await stale.json('/restore', { archive, journal: latest, confirm: 'RESTORE' }, stale.owner, 409);
    assert.equal((await events(stale)).length, 0, 'Stale restore cannot resurrect erased consent');
  } finally { await stale?.close(); await restored?.close(); await h.close(); }
});
