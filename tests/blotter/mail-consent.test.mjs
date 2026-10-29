import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { harness } from './harness.mjs';
import { enterpriseProvider } from './enterprise-provider.mjs';
import { mailConsentJourney } from './mail-consent-ui.mjs';

const address = n => [`synthetic-blotter-${n}`, 'example.test'].join('@');
const read = (h, cookie, status = 200) => h.json('/time/mail-consent', undefined, cookie, status);
const input = (view, choice, requestId) => ({ reviewToken: view.reviewToken, lastId: view.lastId, wordingVersion: view.wordingVersion, choice, requestId });
const save = (h, cookie, view, choice, key, status = 200) => h.json('/time/mail-consent', input(view, choice, key), cookie, status);
const archiveRows = archive => archive.trim().split('\n').flatMap(line => JSON.parse(line).items ?? []).filter(item => item.table === 'b_mail_consents').map(item => item.row);
async function member(h, n, role = 'preparer') {
  const email = address(n); await h.json('/team', { email, name: `Staff ${n}`, role }, h.owner); await h.json('/team/invite', { email }, h.owner);
  return { email, cookie: await h.login(email) };
}
async function enroll(h, cookie) {
  const start = await h.json('/mfa/totp/start', {}, cookie); let bits = 0, value = 0; const bytes = [];
  for (const char of start.secret) { value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) - 1));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), offset = mac[19] & 15;
  return h.json('/mfa/totp/confirm', { id: start.id, code: String((mac.readUInt32BE(offset) & 0x7fffffff) % 1e6).padStart(6, '0') }, cookie);
}

// One sanity journey covers the personal choice, its refusals and unchanged native outcomes.
test('Separate personal mail choice is explicit, attributed, once-only and withdrawable without activating providers or changing native time', async () => {
  const h = await harness();
  try {
    const prep = await member(h, 701), reviewer = await member(h, 702, 'reviewer');
    const client = await h.json('/clients', { name: 'Synthetic mail consent client' }, h.owner);
    await h.json('/team/rates', { scope: 'client', clientId: client.id, rateCents: 12000, effectiveFrom: '2020-01-01' }, h.owner);
    const template = await h.json('/templates', { name: 'Synthetic mail consent work', recurrence: 'monthly', steps: 'Review work', requests: 'Statement' }, h.owner);
    const job = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-10-01', dueDate: '2027-01-15', dueNote: 'Recorded schedule', preparerEmail: prep.email, reviewerEmail: reviewer.email }, h.owner);
    let view = await read(h, prep.cookie);
    assert.deepEqual([view.optedIn, view.mailboxesConnected, view.suggestionsAvailable, view.history], [false, false, false, []]);
    assert.match(view.wording, /withdraw/); assert.match(view.wording, /no provider access/);
    assert.equal((await h.json('/time/suggestions', undefined, prep.cookie)).consentedAt, null);
    view = await save(h, prep.cookie, view, 'decline', 'synthetic-blotter-703');
    const request = input(view, 'opt_in', 'synthetic-blotter-704'), shown = view;
    await h.json('/time/mail-consent', { ...request, personId: (await read(h, reviewer.cookie)).personId }, prep.cookie, 400);
    await h.json('/time/mail-consent', { ...request, actor: reviewer.email }, prep.cookie, 400);
    await h.json('/time/mail-consent', { ...request, wordingVersion: 'synthetic-blotter-705' }, prep.cookie, 409);
    const nativeOff = await h.json('/time/suggestions', undefined, prep.cookie), mailCount = h.mails.length;
    const [one, two] = await Promise.all([h.json('/time/mail-consent', request, prep.cookie), h.json('/time/mail-consent', request, prep.cookie)]);
    assert.equal(one.lastId, two.lastId); assert.equal(one.history.length, 2); assert.equal(one.optedIn, true);
    const event = one.history[0];
    assert.deepEqual([event.personId, event.personEmail, event.actorId, event.actor, event.source, event.wordingVersion, event.wording, event.choice], [one.personId, prep.email, one.personId, prep.email, 'mail', shown.wordingVersion, shown.wording, 'opt_in']);
    assert.ok(Number.isFinite(Date.parse(event.at))); assert.equal(event.historical, false);
    const audits = (await h.json('/team', undefined, h.owner)).audit.filter(a => a.action === 'mail.choice_recorded');
    assert.equal(audits.length, 2); assert.ok(audits.some(a => a.object_id === event.id && a.actor === prep.email));
    assert.equal((await read(h, reviewer.cookie)).history.length, 0); assert.equal((await read(h, h.owner)).optedIn, false);
    assert.deepEqual(await h.json('/time/suggestions', undefined, prep.cookie), nativeOff);
    await h.json('/time/mail-consent', { ...request, choice: 'withdraw' }, prep.cookie, 409);
    await save(h, prep.cookie, shown, 'withdraw', 'synthetic-blotter-706', 409);
    view = await save(h, prep.cookie, one, 'withdraw', 'synthetic-blotter-707');
    assert.equal(view.optedIn, false); assert.equal(view.history[0].choice, 'withdraw');
    await h.json('/time/mail-consent', request, prep.cookie, 409);
    await save(h, prep.cookie, one, 'opt_in', 'synthetic-blotter-708', 409);
    // Two independently submitted choices from the same review cannot both commit.
    const race = await Promise.all([h.send('/api/blotter/time/mail-consent', input(view, 'opt_in', 'synthetic-blotter-709'), prep.cookie), h.send('/api/blotter/time/mail-consent', input(view, 'decline', 'synthetic-blotter-710'), prep.cookie)]);
    assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
    view = await read(h, prep.cookie); view = await save(h, prep.cookie, view, 'withdraw', 'synthetic-blotter-711');
    const key = await h.json('/keys', { label: 'Synthetic assistant' }, h.owner), bearer = { authorization: 'Bearer ' + key.key };
    await h.json('/time/mail-consent', request, '', 401, bearer); await read(h, '', 401);
    assert.equal((await h.send('/api/blotter/agent/time/mail-consent', request, '', bearer)).status, 404);
    assert.equal(h.mails.length, mailCount, 'No consent request reaches a provider');
    // Native TIME-001 remains the only suggestion source and requires separate human approval.
    await h.json('/time/suggestions/consent', { consent: true }, prep.cookie);
    await h.json(`/jobs/${job.id}/steps`, { ordinal: 1, done: true }, prep.cookie);
    const native = await h.json('/time/suggestions', undefined, prep.cookie);
    assert.deepEqual(native.pending.map(s => [s.job_id, s.sources.map(a => a.action)]), [[job.id, ['step.done']]]);
    const effects = async () => {
      const tables = ['b_activity_consent','b_time','b_time_suggestions','b_thread_messages','b_invoices','b_provider_payments','b_payment_mandates', ...(await h.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%calendar%'").all()).results.map(r => r.name)];
      return Promise.all(tables.map(async table => [table, (await h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results]));
    };
    const before = await effects(), calls = h.mails.length;
    await mailConsentJourney(h, prep.cookie, () => h.json('/access/people', { email: prep.email, readOnly: true, clientIds: [client.id] }, h.owner));
    await h.json('/access/people', { email: prep.email, readOnly: false, clientIds: [client.id] }, h.owner);
    assert.deepEqual(await effects(), before); assert.equal(h.mails.length, calls);
    assert.deepEqual(await h.json('/time/suggestions', undefined, prep.cookie), native);
    const suggestion = native.pending[0];
    const approved = await h.json('/time/suggestions/decide', { jobId: job.id, day: suggestion.day, decision: 'approve', minutes: 17, description: 'Native work review', billable: false }, prep.cookie);
    assert.equal(approved.entry.minutes, 17); assert.equal(approved.entry.billable, false);
    assert.deepEqual((await h.json('/jobs/' + job.id, undefined, prep.cookie)).time.map(t => t.id), [approved.entry.id]);
    const plan = await h.json(`/clients/${client.id}/erasure/preview`, undefined, h.owner);
    assert.ok(!plan.blockers.some(b => b.includes('Unclassified')), 'Mail evidence is classified staff data');
    await h.json('/access/people', { email: prep.email, readOnly: false, clientIds: [client.id] }, h.owner);
    const scoped = await read(h, prep.cookie);
    assert.equal((await save(h, prep.cookie, scoped, 'opt_in', 'synthetic-blotter-712')).optedIn, true, 'Scoped staff can choose for themselves without firm-wide access');
    await h.json('/access/people', { email: prep.email, readOnly: true, clientIds: [client.id] }, h.owner);
    const readOnlyChoice = await read(h, prep.cookie);
    const withdrawn = await save(h, prep.cookie, readOnlyChoice, 'withdraw', 'synthetic-blotter-713');
    assert.equal(withdrawn.optedIn, false, 'Read-only client access cannot prevent personal withdrawal');
    assert.equal(withdrawn.history.length, readOnlyChoice.history.length + 1);
    assert.deepEqual([withdrawn.history[0].choice, withdrawn.history[0].actorId, withdrawn.history[0].personId], ['withdraw', withdrawn.personId, withdrawn.personId]);
    assert.deepEqual(await save(h, prep.cookie, readOnlyChoice, 'withdraw', 'synthetic-blotter-713'), withdrawn);
    const withdrawalAudits = (await h.json('/team', undefined, h.owner)).audit.filter(a => a.action === 'mail.choice_recorded' && a.object_id === withdrawn.lastId);
    assert.equal(withdrawalAudits.length, 1); assert.equal(withdrawalAudits[0].actor, prep.email);
    await save(h, prep.cookie, withdrawn, 'opt_in', 'synthetic-blotter-714', 403);
    await h.json(`/jobs/${job.id}/steps`, { ordinal: 1, done: false }, prep.cookie, 403);
    assert.deepEqual(await read(h, prep.cookie), withdrawn, 'Refused writes cannot change the withdrawn choice');

  } finally { await h.close(); }
});

test('Live session and MFA loss, native deactivation, offboarding and restore cannot revive or transfer personal mail consent', async () => {
  const h = await harness(); let restored;
  try {
    const prep = await member(h, 721), successor = await member(h, 722);
    let cookie = prep.cookie, view = await read(h, cookie);
    const untouched = await member(h, 731), untouchedView = await read(h, untouched.cookie);
    await h.json('/team', { email: untouched.email, name: 'Staff 731', role: 'preparer', active: false }, h.owner);
    await h.json('/team', { email: untouched.email, name: 'Staff 731', role: 'preparer', active: true }, h.owner);
    const untouchedFresh = await h.login(untouched.email);
    await save(h, untouchedFresh, untouchedView, 'opt_in', 'synthetic-blotter-732', 409);
    assert.equal((await read(h, untouchedFresh)).history.length, 0, 'Even an unsubmitted first choice from a revoked session stays stale after reactivation');
    view = await save(h, cookie, view, 'opt_in', 'synthetic-blotter-723');
    const oldRequest = input(view, 'opt_in', 'synthetic-blotter-724');
    const codes = await enroll(h, cookie), unconfirmed = await h.login(prep.email);
    await read(h, unconfirmed, 403); await h.json('/time/mail-consent', oldRequest, unconfirmed, 403);
    await h.json('/mfa/verify', { recoveryCode: codes.recoveryCodes[0] }, unconfirmed);
    assert.equal((await read(h, unconfirmed)).optedIn, true);
    await h.json('/team/mfa-reset', { email: prep.email, reason: 'Synthetic lost factor' }, h.owner);
    await read(h, cookie, 401); await h.json('/time/mail-consent', oldRequest, unconfirmed, 401);
    cookie = await h.login(prep.email); view = await read(h, cookie);
    await h.json('/team', { email: prep.email, name: 'Staff 721', role: 'preparer', active: false }, h.owner);
    await read(h, cookie, 401); await h.json('/time/mail-consent', oldRequest, cookie, 401);
    await h.json('/team', { email: prep.email, name: 'Staff 721', role: 'preparer', active: true }, h.owner);
    await read(h, cookie, 401); cookie = await h.login(prep.email);
    let fresh = await read(h, cookie); assert.equal(fresh.optedIn, false); assert.ok(fresh.history[0].invalidatedAt);
    await save(h, cookie, view, 'opt_in', 'synthetic-blotter-725', 409);
    fresh = await save(h, cookie, fresh, 'opt_in', 'synthetic-blotter-726'); assert.equal(fresh.optedIn, true);
    const body = { email: prep.email, workSuccessor: successor.email, reviewSuccessor: successor.email };
    const preview = await h.json('/team/offboard/preview', body, h.owner);
    await h.json('/team/offboard', { ...body, fingerprint: preview.fingerprint }, h.owner);
    assert.equal((await read(h, successor.cookie)).optedIn, false); assert.deepEqual((await read(h, successor.cookie)).history, []);
    await h.json('/team', { email: prep.email, name: 'Staff 721', role: 'preparer', active: true }, h.owner);
    cookie = await h.login(prep.email); view = await read(h, cookie); assert.equal(view.optedIn, false);
    await save(h, cookie, fresh, 'opt_in', 'synthetic-blotter-727', 409);
    // Principal and member histories retain original identities in portable, inactive records.
    const principal = await read(h, h.owner); await save(h, h.owner, principal, 'opt_in', 'synthetic-blotter-728');
    const source = (await h.db.prepare('SELECT * FROM b_mail_consents ORDER BY person_id,sequence').all()).results;
    const response = await h.request('/api/blotter/backup', undefined, h.owner); assert.equal(response.status, 200);
    const archive = await response.text(), exported = archiveRows(archive);
    assert.equal(exported.length, source.length);
    for (const row of exported) assert.deepEqual(row, { ...source.find(s => s.id === row.id), restored: 1 });
    restored = await harness(); await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    const after = await read(restored, restored.owner); assert.equal(after.optedIn, false); assert.equal(after.suggestionsAvailable, false);
    assert.ok(after.history.some(event => event.id === exported.find(r => r.person_id === principal.personId).id && event.historical && event.personId === principal.personId));
    await save(restored, restored.owner, principal, 'opt_in', 'synthetic-blotter-729', 409);
    const restoredRows = archiveRows(await (await restored.request('/api/blotter/backup', undefined, restored.owner)).text());
    assert.deepEqual(restoredRows.sort((a,b) => a.id.localeCompare(b.id)), exported.sort((a,b) => a.id.localeCompare(b.id)));
    await restored.json('/team', { email: prep.email, name: 'Staff 721', role: 'preparer', active: true }, restored.owner);
    await restored.json('/team/invite', { email: prep.email }, restored.owner);
    const newStaffCookie = await restored.login(prep.email), newStaff = await read(restored, newStaffCookie);
    assert.equal(newStaff.optedIn, false); assert.notEqual(newStaff.personId, view.personId);
    assert.deepEqual(newStaff.history.map(event => event.id).sort(), exported.filter(row => row.person_id === view.personId).map(row => row.id).sort());
    assert.ok(newStaff.history.every(event => event.historical && event.personId === view.personId && event.actorId === view.personId));
    await save(restored, newStaffCookie, view, 'opt_in', 'synthetic-blotter-733', 409);
    const reconsented = await save(restored, newStaffCookie, newStaff, 'opt_in', 'synthetic-blotter-734');
    assert.equal(reconsented.history[0].personId, newStaff.personId); assert.equal(reconsented.history[0].historical, false);

    const newChoice = await save(restored, restored.owner, after, 'opt_in', 'synthetic-blotter-730');
    assert.equal(newChoice.optedIn, true); assert.notEqual(newChoice.personId, principal.personId); assert.equal(newChoice.history[0].historical, false);
  } finally { await restored?.close(); await h.close(); }
});

test('Entra deactivation and group removal require a new personal mail choice after fresh enterprise sign-in', async () => {
  const provider = enterpriseProvider(), h = await harness({ bindings: provider.bindings, identityResponse: provider.response });
  try {
    const prep = await member(h, 741, 'reviewer');
    await h.json('/enterprise', { required: true, requireMfa: true, reason: 'Synthetic firm SSO' }, h.owner);
    await h.json('/enterprise/identities', { email: prep.email, subject: 'synthetic-blotter-staff', reason: 'Synthetic verified association' }, h.owner);
    const identity = (await h.json('/enterprise', undefined, h.owner)).identities[0];
    await h.json('/enterprise/mappings', { groupId: 'synthetic-blotter-742', role: 'reviewer', reason: 'Synthetic staff mapping' }, h.owner);
    const token = (await h.json('/enterprise/token', { reason: 'Synthetic provisioning' }, h.owner)).token;
    const scim = async (path, body, expected = 200) => { const response = await h.send('/scim/v2' + path, body, '', { authorization: 'Bearer ' + token }, 'PATCH'); assert.equal(response.status, expected, await response.clone().text()); return response.json(); };
    let response = await h.send('/scim/v2/Groups', { externalId: 'synthetic-blotter-742', displayName: 'Synthetic staff', members: [{ value: identity.id }] }, '', { authorization: 'Bearer ' + token });
    assert.equal(response.status, 201); const group = await response.json();
    const cookies = response => response.headers.getSetCookie().map(s => s.split(';')[0]).join('; ');
    const signin = async () => {
      provider.setClaims({}); const start = await h.request('/auth/oidc/enterprise/start', {}); assert.equal(start.status, 303);
      const location = new URL(start.headers.get('location')); provider.setNonce(location.searchParams.get('nonce'));
      const callback = await h.request('/auth/oidc/enterprise/callback?code=synthetic-blotter-code&state=' + location.searchParams.get('state'), undefined, cookies(start));
      assert.equal(callback.status, 303, await callback.clone().text()); return cookies(callback);
    };
    let cookie = await signin(), view = await read(h, cookie);
    assert.equal(view.optedIn, false); view = await save(h, cookie, view, 'opt_in', 'synthetic-blotter-743');
    const old = input(view, 'opt_in', 'synthetic-blotter-744'), calls = provider.calls.length, mails = h.mails.length;
    await save(h, cookie, view, 'withdraw', 'synthetic-blotter-745');
    assert.equal(provider.calls.length, calls); assert.equal(h.mails.length, mails);
    view = await read(h, cookie); view = await save(h, cookie, view, 'opt_in', 'synthetic-blotter-746');
    await scim('/Users/' + identity.id, { Operations: [{ op: 'Replace', path: 'active', value: false }] });
    await read(h, cookie, 401); await h.json('/time/mail-consent', old, cookie, 401);
    await scim('/Users/' + identity.id, { Operations: [{ op: 'Replace', path: 'active', value: true }] });
    await scim('/Groups/' + group.id, { Operations: [{ op: 'Add', path: 'members', value: [{ value: identity.id }] }] });
    cookie = await signin(); let fresh = await read(h, cookie);
    assert.equal(fresh.optedIn, false); assert.ok(fresh.history[0].invalidatedAt);
    await save(h, cookie, view, 'opt_in', 'synthetic-blotter-747', 409);
    fresh = await save(h, cookie, fresh, 'opt_in', 'synthetic-blotter-748'); assert.equal(fresh.optedIn, true);
    await scim('/Groups/' + group.id, { Operations: [{ op: 'Remove', path: 'members', value: [{ value: identity.id }] }] });
    await read(h, cookie, 401);
    await scim('/Groups/' + group.id, { Operations: [{ op: 'Add', path: 'members', value: [{ value: identity.id }] }] });
    cookie = await signin(); const returned = await read(h, cookie); assert.equal(returned.optedIn, false);
    await save(h, cookie, fresh, 'opt_in', 'synthetic-blotter-749', 409);
    assert.equal((await read(h, h.owner)).history.length, 0);
  } finally { await h.close(); }
});
