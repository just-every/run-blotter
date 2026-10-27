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

async function timeFixture(h) {
  const email = 'time-writer@example.test', otherEmail = 'time-other@example.test';
  for (const address of [email, otherEmail]) {
    await h.json('/team', { email: address, name: address, role: 'preparer' }, h.owner);
    await h.json('/team/invite', { email: address }, h.owner);
    await h.json('/team/rates', { email: address, rateCents: 7200, currency: 'USD', effectiveFrom: '2026-01-01' }, h.owner);
  }
  const prep = await h.login(email), other = await h.login(otherEmail);
  const client = await h.json('/clients', { name: 'Native time subject' }, h.owner);
  const template = await h.json('/templates', { name: 'Time work', recurrence: 'monthly', steps: 'Prepare', requests: 'Statement' }, h.owner);
  const start = (periodStart, preparerEmail) => h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart, preparerEmail, reviewerEmail: 'owner@example.test', dueDate: '2026-12-01', dueNote: 'Recorded target' }, h.owner);
  const job = await start('2026-01-01', email), foreign = await start('2026-02-01', otherEmail);
  return { email, otherEmail, prep, other, client, job, foreign, payload: { jobId: job.id, date: '2026-10-02', minutes: 25, description: 'Native API preparation', taskOrdinal: 1, billable: false } };
}

test('API-002 native time writes: once-only own unsubmitted time, validation, current rates, locks and live staff authority', async () => {
  const h = await harness();
  try {
    const f = await timeFixture(h), headers = { 'idempotency-key': 'synthetic-blotter-time-1' };
    const write = (payload = f.payload, cookie = f.prep, expected = 200, extra = headers) => h.json('/v1/time', payload, cookie, expected, extra);
    const [first, second] = await Promise.all([write(), write()]);
    assert.equal(first.id, second.id); assert.equal(first.entryId, first.id);
    assert.deepEqual([first.replayed,second.replayed].sort(), [false,true]);
    assert.deepEqual([first.minutes,first.rateCents,first.amountCents,first.currency,first.taskOrdinal,first.billable], [25,7200,3000,'USD',1,false]);
    let sheet = await h.json('/timesheets', undefined, f.prep);
    assert.deepEqual(sheet.entries.map(e => [e.id,e.person_email,e.status,e.billable]), [[first.id,f.email,null,0]]);
    const audits = (await h.json('/team', undefined, h.owner)).audit.filter(a => a.action === 'time.added');
    assert.equal(audits.length,1); assert.equal(audits[0].actor,f.email); assert.equal(audits[0].object_id,first.id);
    assert.equal((await write(Object.fromEntries(Object.entries(f.payload).reverse()))).id, first.id);
    await write({ ...f.payload, minutes: 26 }, f.prep, 409);
    assert.deepEqual((await h.json('/team', undefined, h.owner)).audit.filter(a => a.action === 'time.added'), audits);
    for (const key of ['', 'bad key', 'x'.repeat(129)]) await write(f.payload,f.prep,400,{'idempotency-key':key});
    await write(f.payload,f.prep,400,{});
    for (const invalid of [{ minutes:0 }, { date:'2026-02-30' }, { description:'' }, { taskOrdinal:2 }, { personEmail:f.otherEmail }, { rateCents:1 }, { currency:'AUD' }, { status:'approved' }, { billable:'true' }]) {
      const key = { 'idempotency-key':randomUUID() };
      await write({...f.payload,...invalid},f.prep,invalid.taskOrdinal?404:400,key);
      assert.equal((await write(f.payload,f.prep,200,key)).replayed,false,'Validation must not consume the receipt');
    }
    await write({...f.payload,jobId:f.foreign.id},f.prep,404,{'idempotency-key':'synthetic-blotter-foreign'});
    const ownedByOther = await write({...f.payload,jobId:f.foreign.id},f.other);
    assert.notEqual(ownedByOther.id,first.id,'Actors have separate key spaces');
    await h.json('/team/rates', { email:f.email,rateCents:9600,currency:'USD',effectiveFrom:'2026-01-01' }, h.owner);
    assert.deepEqual(await write(), {...first,replayed:true}, 'Replay preserves the original rate snapshot');
    const newer=await write(f.payload,f.prep,200,{'idempotency-key':'synthetic-blotter-new-rate'});
    assert.deepEqual([newer.rateCents,newer.amountCents],[9600,4000]);
    await h.json('/periods/close',{startDate:'2026-11-01',endDate:'2026-11-30',note:'Closed empty period'},h.owner);
    await write({...f.payload,date:'2026-11-01'},f.prep,409,{'idempotency-key':'synthetic-blotter-locked'});
    await h.json('/team/rates',{email:f.email,rateCents:9600,currency:'AUD',effectiveFrom:'2026-01-01'},h.owner);
    await write(f.payload,f.prep,409,{'idempotency-key':'synthetic-blotter-currency'});
    assert.equal((await write()).rateCents,7200);
    await write(f.payload,h.owner,409,{'idempotency-key':'synthetic-blotter-missing-rate'});
    await h.json('/access/people',{email:f.email,readOnly:true,clientIds:[f.client.id]},h.owner);
    await write(f.payload,f.prep,403);
    await h.json('/access/people',{email:f.email,readOnly:false,clientIds:[f.client.id]},h.owner);
    assert.equal((await write()).id,first.id,'A scoped writer retains native own-job authority');
    await h.json('/access/people',{email:f.email,readOnly:false,clientIds:[]},h.owner);
    await write(f.payload,f.prep,404);
    await h.json('/access/people',{email:f.email,readOnly:false,clientIds:[f.client.id]},h.owner);
    await write(f.payload,'',401);
    const agent=await h.json('/keys',{label:'synthetic-blotter-time-agent'},h.owner);
    await write(f.payload,'',401,{...headers,authorization:'Bearer '+agent.key});
    await enroll(h,h.owner);
    const integration=await h.json('/integration-keys',{label:'synthetic-blotter-time-integration',reason:'Read native time only',clientIds:[f.client.id],actions:['time:read']},h.owner);
    await write(f.payload,'',403,{...headers,authorization:'Bearer '+integration.key});
    await h.json('/team/mfa-policy',{required:true},h.owner);
    assert.equal((await write(f.payload,f.prep,403)).mfa,'enroll');
    const factor=await enroll(h,f.prep);
    assert.equal((await write()).id,first.id);
    await h.json('/team/mfa-policy',{required:false},h.owner);
    const fresh=await h.login(f.email);
    assert.equal((await write(f.payload,fresh,403)).mfa,'verify');
    await h.json('/mfa/verify',{recoveryCode:factor.recoveryCodes[0]},fresh);
    assert.equal((await write(f.payload,fresh)).id,first.id);
    const reassignment={jobIds:[f.job.id],preparerEmail:f.otherEmail};
    const preview=await h.json('/bulk/reassign/preview',reassignment,h.owner);
    await h.json('/bulk/reassign',{...reassignment,fingerprint:preview.fingerprint},h.owner);
    await write(f.payload,fresh,404);
    await h.json('/team',{email:f.email,name:'Time writer',role:'preparer',active:false},h.owner);
    await write(f.payload,fresh,401);
  } finally { await h.close(); }
});

test('API-002 / BASE-001 native time receipts: portable replay, deleted-record refusal, client erasure and stale restore fence', async () => {
  const h=await harness();let restored;
  try {
    const f=await timeFixture(h), key='synthetic-blotter-time-portable', headers={'idempotency-key':key};
    await h.json('/team/rates',{email:'owner@example.test',rateCents:6000,effectiveFrom:'2026-01-01'},h.owner);
    const made=await h.json('/v1/time',f.payload,h.owner,200,headers);
    const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
    assert.ok(!archive.includes(key));
    restored=await harness();
    await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
    const replay=await restored.json('/v1/time',f.payload,restored.owner,200,headers);
    assert.deepEqual(replay,{...made,replayed:true});
    assert.deepEqual((await restored.json('/v1/time?limit=1',undefined,restored.owner)).items.map(e=>e.id),[made.id]);
    await restored.json('/v1/time',f.payload,h.owner,401,headers);
    await restored.json(`/time/${made.id}/delete`,{},restored.owner);
    await restored.json('/v1/time',f.payload,restored.owner,404,headers);
    assert.deepEqual((await restored.json('/v1/time',undefined,restored.owner)).items,[]);
    // Complete the jobs through their native review doors before erasure.
    for(const [j,cookie] of [[f.job,f.prep],[f.foreign,f.other]]) {
      const detail=await h.json(`/jobs/${j.id}`,undefined,cookie);
      const request=detail.requests[0];
      await h.json(`/requests/${request.id}/files`,{name:'statement.txt',mime:['text','plain'].join('/'),contentBase64:Buffer.from('Synthetic statement').toString('base64')},cookie);
      await h.json(`/requests/${request.id}/decide`,{decision:'accept'},cookie);
      await h.json(`/jobs/${j.id}/steps`,{ordinal:1,done:true},cookie);
      const ready=await h.json(`/jobs/${j.id}`,undefined,cookie);
      const submitted=await h.json(`/jobs/${j.id}/submit`,{revision:ready.job.revision},cookie);
      await h.json(`/jobs/${j.id}/review`,{revision:submitted.job.revision,decision:'signoff',note:'Reviewed work'},h.owner);
    }
    const detail=await h.json(`/clients/${f.client.id}/detail`,undefined,h.owner);
    await h.json(`/clients/${f.client.id}/lifecycle`,{revision:detail.revision,lifecycle:'archived'},h.owner);
    const preview=await h.json(`/clients/${f.client.id}/erasure/preview`,undefined,h.owner);
    assert.equal(preview.eligible,true);
    assert.ok(JSON.stringify(preview).includes('Native time API replay receipts'));
    await h.json(`/clients/${f.client.id}/erasure`,{planHash:preview.planHash,confirm:f.client.name,reason:'Confirmed removal'},h.owner);
    await h.json('/v1/time',f.payload,h.owner,404,headers);
    const after=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
    assert.ok(!after.includes('Native API preparation'));
    await h.json('/restore',{archive,confirm:'RESTORE'},h.owner,409);
  } finally { await restored?.close();await h.close(); }
});
