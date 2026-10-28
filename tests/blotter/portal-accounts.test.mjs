// The signed-in client portal through the built Worker. Only the mail edge is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { harness } from './harness.mjs';
import { readBilling } from './portal-billing-fixture.mjs';
import { portalBillingJourney } from './portal-billing-ui.mjs';
import { portalAccountJourney, spanishAccountEnrollment, spanishAccountVerification } from './portal-accounts-ui.mjs';

const acknowledge = 'erasure history unverified: supply your latest erasure journal';
const person = (name, email, extra = {}) => ({ name, email, roles: ['primary'], authorized: true, portal: true, requestConsent: true, emailConsent: true, ...extra });
const firm = { name: 'Cedar Practice', ein: '123456789', entity: 'LLC', address: '10 Main Street', city: 'Boston', state: 'MA', zip: '02108', fiscalYearEnd: '12-31', services: ['Bookkeeping'], currency: 'USD', timeZone: 'America/New_York', notificationStart: '00:00', notificationEnd: '00:00', calendars: [] };
/** A small solid-colour PNG logo. */
function png(width, height, [r, g, b]) {
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(8 + data.length + 4); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), 8 + data.length); return out; };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.concat(Array.from({ length: height }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())])));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
/** RFC 6238 codes, each a later 30-second step than the account's last one (the server refuses a replayed step). */
const used = new Map();
function code(secret, currentStep = false) {
  let bits = 0, value = 0; const bytes = [];
  for (const char of secret) { value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const now = Math.floor(Date.now() / 30000), step = Math.max(now + (currentStep ? 0 : -1), (used.get(secret) ?? 0) + 1);
  assert.ok(step <= now + 1, 'the journey ran out of authenticator steps'); used.set(secret, step);
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), offset = mac[19] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1e6).padStart(6, '0');
}

test('PORTAL-002 / BASE-001 / ERASURE-002: invited contacts sign in with a second factor to only their entities, recover a lost factor, lose a revoked entity mid-session, and archives carry accounts without factors or sessions', async () => {
  const h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-17' } }); let restored;
  try {
    for (const [address, role] of [['reviewer@example.test', 'reviewer'], ['prep@example.test', 'preparer']]) { await h.json('/team', { email: address, name: address.split('@')[0], role }, h.owner); await h.json('/team/invite', { email: address }, h.owner); }
    const prep = await h.login('prep@example.test'), reviewer = await h.login('reviewer@example.test');
    await h.json('/firm/settings', firm, h.owner);
    const cedar = await h.json('/clients', { name: 'Cedar Lane LLC', contacts: [person('Pat Lee', 'pat@example.test', { roles: ['primary', 'billing'] }), person('Nora Noportal', 'nora@example.test', { portal: false })] }, h.owner);
    const birch = await h.json('/clients', { name: 'Birch Street Cafe', contacts: [person('Pat Lee', 'pat@example.test'), person('Sam Ortiz', 'sam@example.test', { language: 'es' })] }, h.owner);
    const [patCedar, nora] = ['pat', 'nora'].map(n => cedar.contacts.find(c => c.email.startsWith(n))), [patBirch, sam] = ['pat', 'sam'].map(n => birch.contacts.find(c => c.email.startsWith(n)));
    // Cedar has work, a document shared with Pat and a bill addressed to Pat.
    const template = await h.json('/templates', { name: 'Monthly bookkeeping', recurrence: 'monthly', steps: 'Review sources', requests: 'Bank statement', feeCents: 10000, currency: 'USD' }, h.owner);
    const job = await h.json('/jobs', { clientId: cedar.id, templateId: template.id, periodStart: '2026-11-01', dueDate: '2026-12-15', dueNote: 'Recorded engagement date', preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
    const deliverable = await h.json(`/jobs/${job.id}/deliverables`, { title: 'Cedar financial statements', name: 'cedar.pdf', mime: 'application/pdf', contentBase64: Buffer.from('%PDF-1.4 Cedar statements').toString('base64'), contactId: patCedar.id }, prep);
    await h.json('/invoices/authority', { authority: 'blotter', reason: 'Native invoice authority selected' }, h.owner);
    const entitlement = await h.json('/invoice-entitlements', { jobId: job.id, kind: 'milestone', reference: 'MS-1', description: 'Milestone MS-1', amountCents: 25000, authorization: 'Client accepted MS-1' }, h.owner);
    const invoiceInput = { title: 'November bookkeeping', issueDate: '2026-11-20', dueDate: '2026-12-20', terms: 'Payment due on the recorded date', taxCents: 0, taxTreatment: 'No sales tax under the client supplied treatment', taxAuthorization: 'Principal reviewed REF-1', jobId: job.id, sourceKeys: [entitlement.sourceKey], contactId: patCedar.id };
    const draft = await h.json('/invoices', { ...invoiceInput, previewHash: (await h.json('/invoices/preview', invoiceInput, h.owner)).previewHash }, h.owner);
    await h.json(`/invoices/${draft.id}/issue`, { revision: draft.revision, snapshotHash: draft.snapshotHash, reviewNote: 'Compared entitlement and recipient' }, h.owner);

    const other = await h.json(`/clients/${cedar.id}/contacts`, person('Separate bill recipient', ['synthetic-blotter-501', 'example.test'].join('@'), { roles: ['billing'] }), h.owner);
    const extra = async (contactId, amount, issue) => {
      const source = await h.json('/invoice-entitlements', { jobId: job.id, kind: 'milestone', reference: `synthetic-blotter-${amount}`, description: 'Separate authorized scope', amountCents: amount, authorization: 'Explicit separate engagement fee' }, h.owner);
      const input = { ...invoiceInput, contactId, sourceKeys: [source.sourceKey], title: `Separate scope ${amount}` };
      const d = await h.json('/invoices', { ...input, previewHash: (await h.json('/invoices/preview', input, h.owner)).previewHash }, h.owner);
      if (issue) await h.json(`/invoices/${d.id}/issue`, { revision: d.revision, snapshotHash: d.snapshotHash, reviewNote: 'Checked the separate recipient' }, h.owner);
      return d;
    };
    const foreignBill = await extra(other.id, 1234, true), unissuedBill = await extra(patCedar.id, 567, false);

    // Invitations: staff who may edit contacts invite one portal-enabled contact per entity.
    await h.json(`/clients/${cedar.id}/contacts/${patCedar.id}/portal-invite`, {}, prep, 403);
    await h.json(`/clients/${cedar.id}/contacts/${nora.id}/portal-invite`, {}, h.owner, 409);
    await h.json(`/clients/${cedar.id}/contacts/${patBirch.id}/portal-invite`, {}, h.owner, 409);
    await h.json(`/clients/${cedar.id}/contacts/${patCedar.id}/portal-invite`, {}, reviewer);
    await h.json(`/clients/${birch.id}/contacts/${patBirch.id}/portal-invite`, {}, h.owner);
    const unknownAccountInvitation = await h.json(`/clients/${birch.id}/contacts/${sam.id}/portal-invite`, {}, h.owner);
    // Branding (principal only): a PNG or JPEG logo and an accent colour that clients see on the portal, even before they sign in.
    const logo = png(120, 40, [31, 111, 80]), upload = { name: 'logo.png', mime: 'image/png', contentBase64: logo.toString('base64') };
    await h.json('/portal-branding', { accent: '#1f6f50', logo: upload }, reviewer, 403);
    await h.json('/portal-branding', { logo: { name: 'logo.svg', mime: 'image/svg+xml', contentBase64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64') } }, h.owner, 400);
    await h.json('/portal-branding', { accent: 'green' }, h.owner, 400);
    const branded = await h.json('/portal-branding', { accent: '#1F6F50', logo: upload }, h.owner);
    assert.deepEqual([branded.accent, await h.json('/client/branding', undefined, '')], ['#1f6f50', branded]);
    const served = await h.request(branded.logo);
    assert.deepEqual([served.headers.get('content-type'), served.headers.get('x-content-type-options'), Buffer.from(await served.arrayBuffer()).equals(logo)], ['image/png', 'nosniff', true]);
    const tokenFrom = (to, kind, n = -1) => h.mails.filter(m => m.to.includes(to) && m.text.includes(`/client?${kind}=`)).at(n).text.match(new RegExp(`/client\\?${kind}=(p[il]_[0-9a-f]{64})`))[1];
    const [patCedarInvite, patBirchInvite] = [0, 1].map(n => tokenFrom('pat@example.test', 'invite', n)), samInvite = tokenFrom('sam@example.test', 'invite');
    const enter = async (path, token) => { const r = await h.request(`/api/blotter/client/${path}`, { token }); assert.equal(r.status, 200, await r.clone().text()); return r.headers.get('set-cookie').split(';')[0]; };
    const as = cookie => ({ cookie, get: (path, expected = 200) => h.json('/client' + path, undefined, cookie, expected), post: (path, body, expected = 200) => h.json('/client' + path, body, cookie, expected) });

    // Pat accepts Cedar; nothing about any entity shows until the required second factor is set up.
    const browserFirst = await portalAccountJourney(h, { stage: 'invitation', inviteUrl: `${h.origin}/client?invite=${patCedarInvite}` });
    const first = as(browserFirst ?? await enter('accept', patCedarInvite));
    await h.request('/api/blotter/client/accept', { token: patCedarInvite }).then(r => assert.equal(r.status, 404, 'An invitation works once'));
    assert.deepEqual(await first.get('/me').then(m => [m.mfa, m.entities]), ['enroll', []]);
    assert.equal((await first.get(`/entities/${cedar.id}`, 403)).mfa, 'enroll');
    await first.get(`/entities/${cedar.id}/billing`, 403);
    await portalAccountJourney(h, { stage: 'enrollment', clientCookie: first.cookie });
    const patKey = (await first.post('/factor/start', {})).secret;
    await first.post('/factor/confirm', { code: '000000' }, 400);
    const patCodes = (await first.post('/factor/confirm', { code: code(patKey) })).recoveryCodes;
    assert.equal(patCodes.length, 10);
    assert.deepEqual((await first.get('/me')).entities.map(e => e.name), ['Cedar Lane LLC'], 'An entity opens only after its own invitation is accepted');
    // Accepting Birch starts a session that must verify the factor; then Pat switches between both entities.
    const pat = as(await enter('accept', patBirchInvite));
    assert.equal((await pat.get('/me')).mfa, 'verify'); await pat.get(`/entities/${birch.id}`, 403);
    await pat.get(`/entities/${cedar.id}/billing`, 403);
    await pat.post('/verify', { code: '123456' }, 400);
    await pat.post('/verify', { code: code(patKey) });
    const patMe = await pat.get('/me');
    assert.deepEqual([patMe.firm, patMe.entities.map(e => e.name)], ['Cedar Practice', ['Birch Street Cafe', 'Cedar Lane LLC']]);
    const cedarView = await pat.get(`/entities/${cedar.id}`);
    assert.deepEqual([cedarView.work.map(w => w.title), cedarView.documents.map(d => d.name), cedarView.bills.map(b => b.balanceCents)], [['Monthly bookkeeping'], ['cedar.pdf'], [25000]]);
    const billingSource = { client: cedar, billing: patCedar };
    const initialBilling = await readBilling(h, billingSource, pat.cookie);
    assert.deepEqual(initialBilling.invoices.map(i => [i.id, i.currency, i.balanceCents]), [[draft.id, 'USD', 25000]]);
    assert.deepEqual(initialBilling.payments, []);
    assert.ok(!JSON.stringify(initialBilling).includes(foreignBill.id) && !JSON.stringify(initialBilling).includes(unissuedBill.id));
    const credit = await h.json('/invoice-credits', { clientId: cedar.id, kind: 'credit', reference: 'synthetic-blotter-502', amountCents: 1000, reason: 'Approved credit for prior work' }, h.owner);
    await h.json(`/invoices/${draft.id}/credits`, { creditId: credit.id, amountCents: 1000, reason: 'Apply approved credit' }, h.owner);
    await h.json(`/invoices/${draft.id}/write-off`, { amountCents: 500, reason: 'Approved fee adjustment' }, h.owner);
    const statement = await readBilling(h, billingSource, pat.cookie);
    assert.deepEqual(statement.totals, { invoicedCents: 25000, creditsAppliedCents: 1000, writtenOffCents: 500, paidCents: 0, openCents: 23500 });
    assert.deepEqual(statement.invoices.map(i => [i.id, i.creditsAppliedCents, i.writtenOffCents, i.paidCents, i.balanceCents]), [[draft.id, 1000, 500, 0, 23500]]);
    await portalBillingJourney(h, { cookie: pat.cookie, clientId: cedar.id, expectedOpenCents: 23500, expectedInvoiceIds: [draft.id] });
    const currentPat = (await h.json(`/clients/${cedar.id}/contacts`, undefined, h.owner)).find(c => c.id === patCedar.id);
    await h.json(`/clients/${cedar.id}/contacts`, { id: currentPat.id, revision: currentPat.revision, language: 'es' }, h.owner);
    await portalBillingJourney(h, { cookie: pat.cookie, clientId: cedar.id, language: 'es', expectedOpenCents: 23500, expectedInvoiceIds: [draft.id] });
    await h.json(`/clients/${cedar.id}/contacts`, { id: currentPat.id, revision: currentPat.revision, language: 'en' }, h.owner);
    const fileDoor = `/api/blotter/client/entities/${cedar.id}/files/${encodeURIComponent(cedarView.documents[0].ref)}`, billDoor = `/api/blotter/client/entities/${cedar.id}/bills/${cedarView.bills[0].id}/pdf`;
    assert.equal(await (await h.request(fileDoor, undefined, pat.cookie)).text(), '%PDF-1.4 Cedar statements');
    assert.equal((await (await h.request(billDoor, undefined, pat.cookie)).arrayBuffer()).byteLength > 0, true);

    // BILL-005 inherits this newly shipped authenticated file door too.
    const gate = await h.json(`/jobs/${job.id}/payment-gates`, { deliverableId: deliverable.deliverableId, invoiceId: draft.id, reason: 'Release final statements when this engagement is paid' }, h.owner);
    assert.equal((await pat.get(`/entities/${cedar.id}`)).documents[0].locked, true);
    assert.equal((await h.request(fileDoor, undefined, pat.cookie)).status, 402, 'An authenticated account cannot bypass the unpaid final-copy gate');
    await portalAccountJourney(h, { clientCookie: pat.cookie, clientId: cedar.id, locked: true });
    await h.json(`/payment-gates/${gate.id}/override`, { reason: 'Partner approved this final copy for the client meeting' }, h.owner);
    assert.equal((await pat.get(`/entities/${cedar.id}`)).documents[0].locked, false);
    assert.equal(await (await h.request(fileDoor, undefined, pat.cookie)).text(), '%PDF-1.4 Cedar statements');

    // Sam holds Birch only: Cedar and its files answer exactly like an entity that does not exist.
    const samInvitationMail = h.mails.find(m => m.to.includes('sam@example.test') && m.text.includes('/client?invite='));
    assert.match(samInvitationMail.subject, /Su portal de clientes/); assert.match(samInvitationMail.text, /&lang=es/);
    const samSession = as(await enter('accept', samInvite));
    assert.equal((await samSession.get('/me')).language, 'es');
    await spanishAccountEnrollment(h, { clientCookie: samSession.cookie, inviteUrl: samInvitationMail.text.match(/https:\/\/[^\s]+\/client\?invite=[^\s]+/)[0], code: secret => code(secret, true) });
    assert.equal((await samSession.get(`/entities/${birch.id}`)).language, 'es');
    const empty = await readBilling(h, { client: birch, billing: sam }, samSession.cookie);
    assert.deepEqual([empty.invoices, empty.payments, empty.totals.openCents], [[], [], 0]);
    await portalBillingJourney(h, { cookie: samSession.cookie, clientId: birch.id, language: 'es', expectedOpenCents: 0, empty: true });
    await samSession.get(`/entities/${cedar.id}/billing`, 404);
    assert.equal((await h.request(`/api/blotter/client/entities/${cedar.id}/bills/${foreignBill.id}/pdf`, undefined, pat.cookie)).status, 404);
    assert.deepEqual((await samSession.get('/me')).entities.map(e => e.name), ['Birch Street Cafe']);
    assert.deepEqual(await samSession.get(`/entities/${cedar.id}`, 404), await samSession.get('/entities/no-such-client', 404));
    assert.equal((await h.request(fileDoor, undefined, samSession.cookie)).status, 404);

    // Sign in by emailed link: the reply is the same for an unknown address, only the address with access is mailed, and the link works once.
    const mailed = async address => { const n = h.mails.length, r = await h.request('/api/blotter/client/sign-in', { email: address }); assert.equal(r.status, 202);
      for (let i = 0; i < 60 && h.mails.length === n; i++) await new Promise(done => setTimeout(done, 50)); return [await r.json(), h.mails.slice(n).map(m => m.to[0])]; };
    const [strangerReply, strangerMail] = await mailed('stranger@example.test'), [patReply, patMail] = await mailed('pat@example.test');
    assert.deepEqual([strangerReply, strangerMail, patMail], [patReply, [], ['pat@example.test']]);
    await mailed('sam@example.test');
    const samSignInMail = h.mails.filter(m => m.to.includes('sam@example.test') && m.text.includes('/client?signin=')).at(-1);
    assert.match(samSignInMail.subject, /Iniciar sesión/); assert.match(samSignInMail.text, /&lang=es/);
    const samAgain = as(await enter('sign-in/confirm', tokenFrom('sam@example.test', 'signin')));
    assert.deepEqual([(await samAgain.get('/me')).mfa, (await samAgain.get('/me')).language], ['verify', 'es']);
    await spanishAccountVerification(h, samAgain.cookie);
    const link = tokenFrom('pat@example.test', 'signin'), lost = as(await enter('sign-in/confirm', link));
    assert.equal((await h.request('/api/blotter/client/sign-in/confirm', { token: link })).status, 404);

    // Recover a lost factor: a recovery code opens only the setup of a new authenticator, which then ends every other session.
    assert.equal((await lost.get('/me')).mfa, 'verify');
    await portalAccountJourney(h, { stage: 'recovery', clientCookie: lost.cookie, recoveryCode: patCodes[1] });
    assert.deepEqual(await lost.post('/verify', { recoveryCode: patCodes[0] }), { verified: false, recovered: true, next: 'enroll' });
    assert.equal((await lost.get(`/entities/${cedar.id}`, 403)).mfa, 'enroll');
    await lost.get(`/entities/${cedar.id}/billing`, 403);
    const newKey = (await lost.post('/factor/start', {})).secret;
    assert.equal((await lost.post('/factor/confirm', { code: code(newKey) })).recoveryCodes.length, 10);
    await pat.get('/me', 401); await first.get('/me', 401);
    await pat.get(`/entities/${cedar.id}/billing`, 401);
    await mailed('pat@example.test');
    const later = as(await enter('sign-in/confirm', tokenFrom('pat@example.test', 'signin')));
    await later.post('/verify', { code: code(patKey) }, 400);
    await later.post('/verify', { recoveryCode: patCodes[1] }, 400);
    await later.post('/verify', { code: code(newKey) });
    await portalAccountJourney(h, { clientCookie: later.cookie, clientId: cedar.id });

    // Revoke Pat on Cedar mid-session: the entity, its document and its bill refuse at once, as for an entity Pat never held; Birch still opens.
    assert.equal((await h.request(fileDoor, undefined, later.cookie)).status, 200);
    await h.json(`/payment-gates/${gate.id}/override`, { revoke: true, reason: 'Restore the payment condition' }, h.owner);
    assert.equal((await h.request(fileDoor, undefined, later.cookie)).status, 402);
    await h.json(`/clients/${cedar.id}/contacts/${patCedar.id}/portal-revoke`, { reason: '' }, reviewer, 400);
    await h.json(`/clients/${cedar.id}/contacts/${patCedar.id}/portal-revoke`, { reason: 'Pat left Cedar Lane LLC' }, prep, 403);
    await h.json(`/clients/${cedar.id}/contacts/${patCedar.id}/portal-revoke`, { reason: 'Pat left Cedar Lane LLC' }, reviewer);
    assert.deepEqual(await later.get(`/entities/${cedar.id}`, 404), await later.get('/entities/no-such-client', 404));
    await later.get(`/entities/${cedar.id}/billing`, 404);
    assert.deepEqual([(await h.request(fileDoor, undefined, later.cookie)).status, (await h.request(billDoor, undefined, later.cookie)).status], [404, 404]);
    assert.doesNotMatch(await (await h.request(fileDoor, undefined, later.cookie)).text(), /INV-|paid|locked/, 'A revoked account grant reveals no gate details');
    assert.deepEqual((await later.get('/me')).entities.map(e => e.name), ['Birch Street Cafe']);
    assert.equal((await later.get(`/entities/${birch.id}`)).name, 'Birch Street Cafe');
    const history = (await h.json(`/clients/${cedar.id}/history`, undefined, h.owner)).history.map(e => [e.action, e.actor]);
    assert.ok(history.some(([action, actor]) => action === 'portal.revoked' && actor === 'reviewer@example.test') && history.some(([action]) => action === 'portal.invited'), 'Invitations and revocations are in the client history');

    // Policy and factor resets are the principal's; a reset ends the client's sessions at once.
    await h.json('/portal-policy', { mfaRequired: false, reason: 'Try' }, reviewer, 403);
    assert.equal((await h.json('/portal-policy', undefined, reviewer)).mfaRequired, true, 'A second factor is required until the principal says otherwise');
    const samAccount = (await h.json(`/clients/${birch.id}/portal-access`, undefined, h.owner)).grants.find(g => g.contactId === sam.id).accountId;
    await h.json(`/portal-accounts/${samAccount}/reset`, { reason: 'Lost phone' }, reviewer, 403);
    const knownReset = await h.json(`/portal-accounts/${samAccount}/reset`, { reason: 'Sam lost the phone holding the authenticator' }, h.owner);
    assert.deepEqual(await h.json('/portal-accounts/no-such-account/reset', { reason: 'Reset requested for an unknown account' }, h.owner), knownReset, 'Reset responses do not disclose whether the account exists');
    await samSession.get('/me', 401);
    await samSession.get(`/entities/${birch.id}/billing`, 401);
    await portalAccountJourney(h, { stage: 'reset', clientCookie: samSession.cookie });

    // The invitation lifetime is seven days; expired links never start a session.
    const knownAccountInvitation = await h.json(`/clients/${birch.id}/contacts/${sam.id}/portal-invite`, {}, h.owner);
    assert.deepEqual(knownAccountInvitation, unknownAccountInvitation, 'Invitation responses do not disclose whether the address already has an account');
    const expired = { accountId: samAccount };
    const invitation = await h.db.prepare('SELECT created_at,expires_at FROM b_portal_invitations WHERE contact_id=? ORDER BY created_at DESC LIMIT 1').bind(sam.id).first();
    assert.equal(Date.parse(invitation.expires_at) - Date.parse(invitation.created_at), 7 * 86400000);
    await h.db.prepare("UPDATE b_portal_invitations SET expires_at='2000-01-01T00:00:00.000Z' WHERE contact_id=? AND used_at IS NULL").bind(sam.id).run();
    assert.equal((await h.request('/api/blotter/client/accept', { token: tokenFrom('sam@example.test', 'invite') })).status, 404);
    await h.json(`/clients/${birch.id}/contacts/${sam.id}/portal-invite`, {}, h.owner);
    const fresh = as(await enter('accept', tokenFrom('sam@example.test', 'invite')));
    const freshKey = (await fresh.post('/factor/start', {})).secret;
    // Five incorrect codes lock even a correct code out, across the account's sessions.
    await h.db.prepare("UPDATE b_portal_failures SET at='2000-01-01T00:00:00.000Z' WHERE account_id=?").bind(expired.accountId).run();
    const valid = code(freshKey), invalid = String((Number(valid) + 1) % 1000000).padStart(6, '0');
    for (let attempt = 0; attempt < 5; attempt++) await fresh.post('/factor/confirm', { code: invalid }, 400);
    await fresh.post('/factor/confirm', { code: valid }, 429);
    await h.db.prepare("UPDATE b_portal_failures SET at='2000-01-01T00:00:00.000Z' WHERE account_id=?").bind(expired.accountId).run();
    await fresh.post('/factor/confirm', { code: valid });
    const session = await h.db.prepare('SELECT created_at,expires_at FROM b_portal_sessions WHERE account_id=? AND revoked_at IS NULL').bind(expired.accountId).first();
    assert.equal(Date.parse(session.expires_at) - Date.parse(session.created_at), 8 * 3600000);
    await h.db.prepare("UPDATE b_portal_sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE account_id=?").bind(expired.accountId).run();
    await fresh.get('/me', 401);
    await fresh.get(`/entities/${birch.id}/billing`, 401);
    await portalAccountJourney(h, { stage: 'expiry', clientCookie: fresh.cookie });
    const beforeInvite = as(await enter('accept', (await (async () => {
      await h.json(`/clients/${birch.id}/contacts/${sam.id}/portal-invite`, {}, h.owner);
      return tokenFrom('sam@example.test', 'invite');
    })())));
    await beforeInvite.get('/me');
    await h.json(`/clients/${birch.id}/contacts/${sam.id}/portal-invite`, {}, h.owner);
    await beforeInvite.get('/me', 401);
    await portalAccountJourney(h, { stage: 'revocation', clientCookie: beforeInvite.cookie });
    const beforeDisable = as(await enter('accept', tokenFrom('sam@example.test', 'invite')));
    const currentSam = (await h.json(`/clients/${birch.id}/contacts`, undefined, h.owner)).find(c => c.id === sam.id);
    await h.json(`/clients/${birch.id}/contacts`, { id: sam.id, revision: currentSam.revision, active: false }, h.owner);
    await beforeDisable.get('/me', 401);
    await beforeDisable.get(`/entities/${birch.id}/billing`, 401);
    const disabledSam = (await h.json(`/clients/${birch.id}/contacts`, undefined, h.owner)).find(c => c.id === sam.id);
    await h.json(`/clients/${birch.id}/contacts`, { id: sam.id, revision: disabledSam.revision, active: true }, h.owner);

    // Archives carry accounts and grants but never sessions, links or factors: a restored account sets up a new factor.
    await h.stepUp(h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.ok(!/p[ils]_[0-9a-f]{64}/.test(archive), 'No portal token in the archive');
    restored = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-18' } });
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge }, restored.owner);
    const carried = (await restored.json(`/clients/${birch.id}/portal-access`, undefined, restored.owner)).grants;
    assert.deepEqual(carried.map(g => [g.email, g.status, g.factor]).sort(), [['pat@example.test', 'active', false], ['sam@example.test', 'active', false]]);
    assert.equal((await restored.request(`/api/blotter/client/entities/${birch.id}`, undefined, later.cookie)).status, 401);
    assert.deepEqual(await restored.json('/client/branding', undefined, ''), branded, 'The branding is firm configuration and crosses the archive');

    // Whole-client erasure (ERASURE-002): Birch's grants are revoked, and an account that opens no other entity loses its address and factor.
    const archived = await h.json(`/clients/${birch.id}/detail`, undefined, h.owner);
    await h.json(`/clients/${birch.id}/lifecycle`, { revision: archived.revision, lifecycle: 'archived' }, h.owner);
    const preview = await h.json(`/clients/${birch.id}/erasure/preview`, undefined, h.owner);
    assert.equal(preview.eligible, true, JSON.stringify(preview.blockers));
    const receipt = JSON.stringify(await h.json(`/clients/${birch.id}/erasure`, { planHash: preview.planHash, confirm: 'Birch Street Cafe', reason: 'Client asked to be forgotten' }, h.owner));
    assert.ok(['b_portal_grants', 'b_portal_accounts', 'b_portal_sessions'].every(table => receipt.includes(table)), 'The receipt names the portal records');
    await later.get('/me', 401);
    await later.get(`/entities/${birch.id}/billing`, 401);
    assert.ok(!JSON.stringify(await h.json(`/clients/${birch.id}/portal-access`, undefined, h.owner)).includes('sam@example.test'));
  } finally { await restored?.close(); await h.close(); }
});
