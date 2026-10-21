import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { harness } from './harness.mjs';

async function enroll(h, cookie) {
  const start = await h.json('/mfa/totp/start', {}, cookie);
  let bits = 0, value = 0; const bytes = [];
  for (const char of start.secret) { value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) - 1));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), offset = mac[19] & 15;
  return h.json('/mfa/totp/confirm', { id: start.id, code: String((mac.readUInt32BE(offset) & 0x7fffffff) % 1e6).padStart(6, '0') }, cookie);
}

// One named public-door journey covers the write's business effect and inherited boundaries.
test('API-002 / BASE-001 native client writes: atomic concurrent replay, conflicts, validation, attribution, MFA, revocation and portable receipts', async () => {
  const h = await harness(); let restored;
  const payload = { name: 'Cedar River Tax LLC', ein: '92-7654321', services: ['1120-S', 'Monthly bookkeeping'], contacts: [{ name: 'Morgan Rivera', email: 'morgan@example.test', roles: ['primary'], authorized: true, portal: true, emailConsent: true }] };
  const key = randomUUID(), headers = { 'idempotency-key': key };
  const write = (body = payload, cookie = h.owner, expected = 200, extra = headers) => h.json('/v1/clients', body, cookie, expected, extra);
  try {
    const [first, second] = await Promise.all([write(), write()]);
    assert.equal(first.id, second.id); assert.equal(first.clientId, first.id);
    assert.deepEqual([first.replayed, second.replayed].sort(), [false, true]);
    assert.equal(first.contacts.length, 1);
    assert.equal((await h.json('/state', undefined, h.owner)).clients.filter(c => c.name === payload.name).length, 1);
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    assert.equal((await write(reordered)).id, first.id, 'Object key order does not make a second client');
    await write({ ...payload, name: 'Different intent' }, h.owner, 409);
    // Inspect the same client history the operator sees, rather than private SQL.
    const history = await h.json(`/clients/${first.id}/history`, undefined, h.owner);
    assert.ok(JSON.stringify(history).includes('client.added'));
    assert.ok(JSON.stringify(history).includes('owner@example.test'));
    const auditBefore = (await h.json('/team', undefined, h.owner)).audit;
    await write();
    assert.deepEqual((await h.json('/team', undefined, h.owner)).audit, auditBefore, 'Replay creates no second audit/effect');
    for (const invalidKey of ['', 'bad space', 'x'.repeat(129)]) await write(payload, h.owner, 400, { 'idempotency-key': invalidKey });
    await write(payload, h.owner, 400, {});
    const failedKey = { 'idempotency-key': randomUUID() };
    await write({ ...payload, ein: 'invalid' }, h.owner, 400, failedKey);
    assert.equal((await write({ name: 'Corrected invalid request' }, h.owner, 200, failedKey)).replayed, false, 'Failed validation consumes neither key nor client');
    // Existing configurable required fields apply unchanged to the new public write.
    await h.json('/clients/fields', { key: 'tax_year', label: 'Tax year', type: 'text', required: true }, h.owner);
    const requiredKey = { 'idempotency-key': randomUUID() };
    await write({ name: 'Required field client' }, h.owner, 400, requiredKey);
    await write({ name: 'Required field client', fields: { tax_year: '2026' } }, h.owner, 200, requiredKey);
    await write(payload, '', 401);
    const agent = await h.json('/keys', { label: 'No integration authority' }, h.owner);
    await write(payload, '', 401, { ...headers, authorization: 'Bearer ' + agent.key });
    const member = 'api-write-reviewer@example.test';
    await h.json('/team', { email: member, name: 'API reviewer', role: 'reviewer' }, h.owner);
    await h.json('/team/invite', { email: member }, h.owner);
    const reviewer = await h.login(member);
    const memberPayload = { name: 'Reviewer client', fields: { tax_year: '2026' } };
    const made = await write(memberPayload, reviewer);
    assert.notEqual(made.id, first.id, 'A different actor has a separate replay key space');
    await h.json('/team', { email: member, name: 'API reviewer', role: 'preparer' }, h.owner);
    await write(memberPayload, reviewer, 403);
    await h.json('/team', { email: member, name: 'API reviewer', role: 'reviewer' }, h.owner);
    await enroll(h, h.owner);
    await h.json('/team/mfa-policy', { required: true }, h.owner);
    assert.equal((await write(memberPayload, reviewer, 403)).mfa, 'enroll');
    const factor = await enroll(h, reviewer);
    assert.equal((await write(memberPayload, reviewer)).id, made.id);
    await h.json('/team/mfa-policy', { required: false }, h.owner);
    const newSession = await h.login(member);
    assert.equal((await write(memberPayload, newSession, 403)).mfa, 'verify', 'Enrolled staff owe a factor in each new session even with policy off');
    await h.json('/mfa/verify', { recoveryCode: factor.recoveryCodes[0] }, newSession);
    assert.equal((await write(memberPayload, newSession)).id, made.id);
    await h.json('/team', { email: member, name: 'API reviewer', role: 'reviewer', active: false }, h.owner);
    await write(memberPayload, newSession, 401);
    // Receipts contain only request/key digests and record references, never raw payloads or credentials.
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.ok(!archive.includes(key)); assert.ok(!archive.includes(agent.key));
    restored = await harness();
    await restored.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    const replayed = await restored.json('/v1/clients', payload, restored.owner, 200, headers);
    assert.equal(replayed.id, first.id); assert.equal(replayed.replayed, true);
    assert.equal((await restored.json('/state', undefined, restored.owner)).clients.filter(c => c.name === payload.name).length, 1);
    await restored.json('/v1/clients', { ...payload, name: 'Conflicting restored request' }, restored.owner, 409, headers);
    await restored.json('/v1/clients', payload, h.owner, 401, headers);
  } finally { await restored?.close(); await h.close(); }
});
