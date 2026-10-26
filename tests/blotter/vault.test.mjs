// VAULT-001 client credential vault, through the portal link, staff doors, agent key, search, mail, CSV export and archives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { harness } from './harness.mjs';

const totp = (secret, offset = 0) => {
  let bits = 0, value = 0; const key = [];
  for (const c of secret) { value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c); bits += 5; if (bits >= 8) { key.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const mac = createHmac('sha1', Buffer.from(key)).update(counter).digest(), o = mac[19] & 15;
  return String((mac.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
};
const enroll = async (h, who) => { const start = await h.json('/mfa/totp/start', {}, who); const done = await h.json('/mfa/totp/confirm', { id: start.id, code: totp(start.secret, -1) }, who); return { secret: start.secret, recovery: done.recoveryCodes }; };
const PASSWORD = 'synthetic-blotter-1', USERNAME = 'cedar-lane-sales';

test('VAULT-001 credential vault: client adds through the portal, assigned preparer reveals after step-up and is logged, unassigned and revoked staff are refused, absent from search, agents, mail and exports, archives encrypt or exclude', async () => {
  const h = await harness(), restored = [];
  try {
    for (const [email, role] of [['reviewer@example.test', 'reviewer'], ['prep@example.test', 'preparer'], ['outside@example.test', 'preparer']]) {
      await h.json('/team', { email, name: email, role }, h.owner); await h.json('/team/invite', { email }, h.owner);
    }
    const prep = await h.login('prep@example.test'), outside = await h.login('outside@example.test');
    const client = await h.json('/clients', { name: 'Cedar Lane LLC', contacts: [{ name: 'Alex Owner', email: 'alex@example.test', roles: ['primary'], authorized: true, portal: true, requestConsent: true, emailConsent: true }] }, h.owner);
    const template = await h.json('/templates', { name: 'Monthly sales tax', recurrence: 'monthly', steps: 'File return', requests: 'Sales report' }, h.owner);
    const job = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-09-01', dueDate: '2026-10-23', dueNote: 'Recorded by staff', preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
    const link = await h.json(`/jobs/${job.id}/reminders`, { contactId: client.contacts[0].id }, h.owner);
    const portal = `/portal/${new URL(link.portalUrl).pathname.split('/').at(-1)}/credentials`;

    // The client adds a state sales-tax portal login through their link; nothing is ever read back.
    const login = { label: 'Ohio sales-tax portal', url: 'https://gateway.ohio.gov', username: USERNAME, password: 'first-draft-password', notes: 'Security question: first car', rotateBy: '2026-01-15' };
    await h.json(portal, login, '', 403, { origin: 'https://outside.example.test' });
    const added = await h.json(portal, login);
    const listed = await h.json(portal);
    assert.deepEqual(listed.credentials.map(c => c.label), ['Ohio sales-tax portal']);
    await h.json(portal, { ...login, id: added.id, revision: 0, password: PASSWORD }, '', 409);
    await h.json(portal, { ...login, id: added.id, revision: listed.credentials[0].revision, password: PASSWORD });
    assert.ok(!JSON.stringify(await h.json(portal)).includes(USERNAME), 'The portal never returns a stored login');

    // Staff permitted on the client list it by name only; an unassigned preparer cannot see or reveal it.
    const staff = await h.json(`/clients/${client.id}/credentials`, undefined, prep);
    assert.equal(staff.credentials[0].updated_by, 'client upload link');
    assert.equal(staff.credentials[0].rotationDue, true, 'The optional rotation date shows as due');
    assert.ok(!JSON.stringify(staff).includes(PASSWORD) && !JSON.stringify(staff).includes(USERNAME));
    await h.json(`/clients/${client.id}/credentials`, undefined, outside, 404);
    await h.json(`/credentials/${added.id}/reveal`, { code: '000000' }, outside, 404);

    // A reveal needs a step-up in this session within five minutes, even after the sign-in check; refusals are logged too.
    assert.match((await h.json(`/credentials/${added.id}/reveal`, { code: '000000' }, prep, 409)).error, /second factor/);
    const { secret, recovery } = await enroll(h, prep);
    await h.json(`/credentials/${added.id}/reveal`, { code: String((Number(totp(secret)) + 1) % 1e6).padStart(6, '0') }, prep, 400);
    const code = totp(secret, 1), shown = await h.json(`/credentials/${added.id}/reveal`, { code }, prep);
    assert.deepEqual([shown.username, shown.password, shown.url], [USERNAME, PASSWORD, 'https://gateway.ohio.gov']);
    await h.json(`/credentials/${added.id}/reveal`, { code }, prep, 400);
    assert.equal((await h.json(`/credentials/${added.id}/reveal`, {}, prep)).password, PASSWORD, 'The step-up holds for this session');
    const otherSession = await h.login('prep@example.test');
    await h.json('/mfa/verify', { recoveryCode: recovery[0] }, otherSession);
    assert.equal((await h.json(`/credentials/${added.id}/reveal`, {}, otherSession, 403)).mfa, 'step-up', 'A verified sign-in alone does not reveal');
    const log = (await h.json(`/clients/${client.id}/credentials`, undefined, h.owner)).reveals.map(r => `${r.actor} ${r.outcome}`).sort();
    assert.deepEqual(log, ['prep@example.test refused: no second factor set up', 'prep@example.test refused: second factor not confirmed', 'prep@example.test refused: second factor not confirmed', 'prep@example.test refused: step-up required', 'prep@example.test revealed', 'prep@example.test revealed']);
    assert.ok((await h.json(`/clients/${client.id}/history`, undefined, h.owner)).history.some(e => e.action === 'vault.revealed' && e.actor === 'prep@example.test'));

    // Never in search, agent context, mail or a plain CSV export; agent keys cannot reach the vault.
    for (const q of [USERNAME, 'synthetic-blotter', 'gateway']) assert.ok(!JSON.stringify((await h.json(`/search?q=${encodeURIComponent(q)}`, undefined, h.owner)).results).match(/cedar-lane-sales|synthetic-blotter/), `search for ${q} finds no credential`);
    const key = await h.json('/keys', { label: 'Assistant' }, h.owner), auth = { authorization: 'Bearer ' + key.key };
    assert.ok(!JSON.stringify(await h.json('/agent/context', undefined, '', 200, auth)).includes(USERNAME));
    await h.json(`/clients/${client.id}/credentials`, undefined, '', 401, auth);
    await h.json(`/credentials/${added.id}/reveal`, { code: '000000' }, '', 401, auth);
    assert.ok(!h.mails.some(m => JSON.stringify(m).includes(PASSWORD) || JSON.stringify(m).includes(USERNAME)));
    await h.json('/team/rates', { email: 'prep@example.test', rateCents: 9000, effectiveFrom: '2026-10-01' }, h.owner);
    const entry = await h.json(`/jobs/${job.id}/time`, { date: '2026-10-02', minutes: 30, description: 'Filed sales tax return' }, prep);
    await h.json('/timesheets/submit', { weekStart: '2026-09-28' }, prep);
    await h.json(`/time/${entry.id}/review`, { decision: 'approve' }, h.owner);
    const draft = await h.json('/exports', { title: 'October billing', sourceKeys: ['time:' + entry.id] }, h.owner);
    const revision = (await h.json('/billing', undefined, h.owner)).exports.find(e => e.id === draft.id).revision;
    await h.json(`/exports/${draft.id}/approve`, { revision, reviewNote: 'Checked' }, h.owner);
    const exported = await (await h.request(`/api/blotter/exports/${draft.id}/csv`, undefined, h.owner)).text();
    assert.ok(exported.includes('Cedar Lane LLC') && !exported.includes(USERNAME) && !exported.includes(PASSWORD));

    // Archives carry ciphertext only ("encrypt", the default) or drop it ("exclude"), at the principal's choice.
    const rows = archive => archive.trim().split('\n').map(JSON.parse).filter(p => p.kind === 'part').flatMap(p => p.items).filter(i => i.kind === 'row' && i.table === 'b_vault_credentials');
    await h.json('/credentials/archive-mode', { mode: 'exclude' }, prep, 403);
    const encrypted = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    await h.json('/credentials/archive-mode', { mode: 'exclude' }, h.owner);
    const excluded = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.ok(rows(encrypted)[0].row.sealed && rows(excluded)[0].row.sealed === null);
    for (const archive of [encrypted, excluded]) assert.ok(!archive.includes(PASSWORD) && !archive.includes(USERNAME));
    for (const [archive, message] of [[encrypted, /another installation's vault key/], [excluded, /excluded from the archive/]]) {
      const target = await harness(); restored.push(target);
      await target.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, target.owner);
      assert.deepEqual((await target.json(`/clients/${client.id}/credentials`, undefined, target.owner)).credentials.map(c => c.label), ['Ohio sales-tax portal']);
      const own = await enroll(target, target.owner);
      assert.match((await target.json(`/credentials/${added.id}/reveal`, { code: totp(own.secret, 1) }, target.owner, 409)).error, message);
    }

    // Revoking the contact's authority closes their link; erasing a credential keeps its name and log and fences older archives.
    const contact = client.contacts[0];
    await h.json(`/clients/${client.id}/contacts`, { id: contact.id, revision: contact.revision, name: contact.name, email: contact.email, roles: ['primary'], authorized: false, portal: false, requestConsent: false, emailConsent: true, active: true }, h.owner);
    await h.json(portal, { ...login, password: PASSWORD }, '', 404);
    await h.json(`/credentials/${added.id}/erase`, { confirm: 'Ohio sales-tax portal', reason: 'Client closed the account' }, prep, 403);
    await h.json(`/credentials/${added.id}/erase`, { confirm: 'wrong', reason: 'Client closed the account' }, h.owner, 400);
    await h.json(`/credentials/${added.id}/erase`, { confirm: 'Ohio sales-tax portal', reason: 'Client closed the account' }, h.owner);
    const erased = (await h.json(`/clients/${client.id}/credentials`, undefined, h.owner));
    assert.equal(erased.credentials[0].erase_reason, 'Client closed the account'); assert.equal(erased.reveals.length, 6);
    await h.json(`/credentials/${added.id}/reveal`, {}, prep, 410);
    const afterErase = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.equal(rows(afterErase)[0].row.sealed, null);
    const stale = await harness(); restored.push(stale);
    assert.match((await stale.json('/restore', { archive: encrypted, journal: afterErase, confirm: 'RESTORE' }, stale.owner, 409)).error, /erasure/);

    // Revoking the preparer's access (reassigning their only job) refuses their next reveal.
    const handover = { jobIds: [job.id], preparerEmail: 'outside@example.test' };
    await h.json('/bulk/reassign', { ...handover, fingerprint: (await h.json('/bulk/reassign/preview', handover, h.owner)).fingerprint }, h.owner);
    await h.json(`/credentials/${added.id}/reveal`, {}, prep, 404);
  } finally { await h.close(); for (const r of restored) await r.close(); }
});
