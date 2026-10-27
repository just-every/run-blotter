import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { harness } from './harness.mjs';

let h, prep, other, client, hidden, jobs, entries;
const firstEmail = 'pages-prep@example.test', otherEmail = 'pages-other@example.test';
const path = (route, query = {}) => `/v1/${route}?${new URLSearchParams(query)}`;
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
async function allPages(route, query, cookie) {
  const items = [], cursors = new Set();
  let cursor;
  do {
    const page = await h.json(path(route, { ...query, ...(cursor ? { cursor } : {}) }), undefined, cookie);
    assert.ok(page.items.length <= Number(query.limit));
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor !== null) { assert.equal(typeof cursor, 'string'); assert.ok(!cursors.has(cursor)); cursors.add(cursor); }
  } while (cursor !== null);
  assert.equal(new Set(items.map(item => item.id)).size, items.length, 'Pages never duplicate a record');
  return items;
}

before(async () => {
  h = await harness();
  for (const email of [firstEmail, otherEmail]) {
    await h.json('/team', { email, name: email, role: 'preparer' }, h.owner);
    await h.json('/team/invite', { email }, h.owner);
    await h.json('/team/rates', { email, rateCents: 6000, effectiveFrom: '2026-01-01' }, h.owner);
  }
  prep = await h.login(firstEmail); other = await h.login(otherEmail);
  client = await h.json('/clients', { name: 'Page ties café' }, h.owner);
  const second = await h.json('/clients', { name: 'Zebra page client' }, h.owner);
  const template = await h.json('/templates', { name: 'Page preparation', recurrence: 'monthly', steps: 'Prepare', requests: 'Statement' }, h.owner);
  const start = (clientId, month, preparerEmail = firstEmail, dueDate = '2026-10-28') => h.json('/jobs', {
    clientId, templateId: template.id, periodStart: `2026-${month}-01`, dueDate,
    dueNote: 'Practitioner recorded target', preparerEmail, reviewerEmail: 'owner@example.test',
  }, h.owner);
  jobs = [];
  for (const month of ['01', '02', '03']) jobs.push(await start(client.id, month));
  jobs.push(await start(second.id, '04'));
  jobs.push(await start(second.id, '05', firstEmail, '2026-11-01'));
  hidden = await start(client.id, '06', otherEmail);
  entries = [];
  for (const date of ['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-02', '2026-10-03']) {
    entries.push(await h.json('/v1/time', { jobId: jobs[0].id, date, minutes: 15, description: 'Page boundary work' }, prep, 200, { 'idempotency-key': `synthetic-blotter-page-${entries.length}` }));
  }
  await h.json(`/jobs/${hidden.id}/time`, { date: '2026-10-02', minutes: 30, description: 'Private second preparer time' }, other);
});
after(async () => { await h?.close(); });

test('API-002 native work pages: tied due/client keys, filters, live visibility and cursor validation', async () => {
  const listed = await allPages('work', { limit: 2 }, prep);
  assert.deepEqual(listed.map(item => item.id).sort(), jobs.map(item => item.id).sort());
  const ordered = [...listed].sort((a, b) => cmp(a.due_date, b.due_date) || cmp(a.client_name, b.client_name) || cmp(a.id, b.id));
  assert.deepEqual(listed.map(item => item.id), ordered.map(item => item.id));
  assert.deepEqual((await allPages('work', { limit: 1 }, other)).map(item => item.id), [hidden.id]);
  const filtered = await allPages('work', { limit: 1, client: client.id, dueFrom: '2026-10-28', dueTo: '2026-10-28' }, prep);
  assert.deepEqual(filtered.map(item => item.id).sort(), jobs.slice(0, 3).map(item => item.id).sort());
  const page = await h.json(path('work', { limit: 1, client: client.id }), undefined, h.owner);
  assert.ok(page.nextCursor);
  const decoded = JSON.parse(Buffer.from(page.nextCursor, 'base64url').toString('utf8'));
  for (const altered of [{ ...decoded, v: 2 }, { ...decoded, after: ['2026-10-28'] }]) {
    await h.json(path('work', { client: client.id, cursor: Buffer.from(JSON.stringify(altered)).toString('base64url') }), undefined, h.owner, 400);
  }
  await h.json(path('work', { cursor: page.nextCursor }), undefined, h.owner, 400);
  await h.json(path('time', { cursor: page.nextCursor }), undefined, h.owner, 400);
  for (const cursor of ['?', '', Buffer.from('{"v":9}').toString('base64url')]) await h.json(path('work', { cursor }), undefined, h.owner, 400);
  for (const limit of ['0', '101', '1.5', 'NaN', '']) await h.json(path('work', { limit }), undefined, h.owner, 400);
  await h.json(path('work', { dueFrom: '2026-13-01' }), undefined, h.owner, 400);
  await h.json(path('work', { dueFrom: '2026-11-01', dueTo: '2026-10-01' }), undefined, h.owner, 400);
  assert.equal((await h.json(path('work'), undefined, h.owner)).items.length, jobs.length + 1);
  await h.json(path('work'), undefined, '', 401);
  // A copied owner's position cannot be used by a different actor.
  const ownerPage = await h.json(path('work', { limit: 1 }), undefined, h.owner);
  await h.json(path('work', { cursor: ownerPage.nextCursor }), undefined, other, 400);
  // Existing sessions and cursors cannot retain a lead role after a role change.
  await h.json('/team', { email: firstEmail, name: 'Pages preparer', role: 'reviewer' }, h.owner);
  const leadPage = await h.json(path('work', { limit: 1 }), undefined, prep);
  await h.json('/team', { email: firstEmail, name: 'Pages preparer', role: 'preparer' }, h.owner);
  await h.json(path('work', { cursor: leadPage.nextCursor }), undefined, prep, 400);
  assert.ok((await h.json(path('work'), undefined, prep)).items.every(item => item.preparer_email === firstEmail));
});

test('API-002 native time pages: descending keys, inclusive dates, own-person scope and bound cursors', async () => {
  const listed = await allPages('time', { limit: 2, from: '2026-10-01', to: '2026-10-03' }, prep);
  assert.deepEqual(listed.map(item => item.id).sort(), entries.map(item => item.id).sort());
  assert.deepEqual(listed.map(item => [item.person_email,item.minutes,item.rate_cents,item.amount_cents,item.currency,item.description,item.status]), entries.map(() => [firstEmail,15,6000,1500,'USD','Page boundary work',null]), 'Versioned writes read back exactly once with native snapshots and no submission');
  const ordered = [...listed].sort((a, b) => cmp(b.date, a.date) || cmp(b.created_at, a.created_at) || cmp(b.id, a.id));
  assert.deepEqual(listed.map(item => item.id), ordered.map(item => item.id));
  const tied = await allPages('time', { limit: 1, from: '2026-10-02', to: '2026-10-02' }, prep);
  assert.deepEqual(tied.map(item => item.id).sort(), entries.filter(item => item.date === '2026-10-02').map(item => item.id).sort());
  assert.equal((await allPages('time', { limit: 1 }, other)).length, 1);
  assert.deepEqual(await allPages('time', { limit: 1, person: otherEmail }, prep), []);
  assert.equal((await allPages('time', { limit: 1, person: otherEmail }, h.owner)).length, 1);
  const page = await h.json(path('time', { limit: 1, from: '2026-10-01', to: '2026-10-03' }), undefined, h.owner);
  assert.ok(page.nextCursor);
  for (const change of [{ from: '2026-10-02' }, { to: '2026-10-02' }, { person: otherEmail }]) {
    await h.json(path('time', { from: '2026-10-01', to: '2026-10-03', ...change, cursor: page.nextCursor }), undefined, h.owner, 400);
  }
  for (const query of [{ from: '2026-02-30' }, { to: '2026-13-01' }, { from: '2026-10-03', to: '2026-10-01' }, { from: '2026-1-01' }, { cursor: 'bad' }, { limit: 101 }, { limit: 0 }, { limit: '2.5' }]) {
    await h.json(path('time', query), undefined, h.owner, 400);
  }
  await h.json(path('time', { from: '2026-10-01', to: '2026-10-03', cursor: page.nextCursor }), undefined, prep, 400);
  assert.equal((await h.json(path('time', { limit: 100 }), undefined, h.owner)).items.length, entries.length + 1);
  assert.equal((await h.json('/timesheets', undefined, prep)).entries.length, entries.length);
  await h.json(path('time'), undefined, '', 401);
});

test('API-002 / BASE-001 native client pages: exact fields, tied Unicode names, scope, bound cursors and read-only traversal', async () => {
  const made = [];
  for (const name of ['Client ties café', 'Client ties café', 'Ω client', '𐀀 client', '😀 client']) {
    made.push(await h.json('/clients', { name }, h.owner));
  }
  const individual = await h.json('/clients', { name: 'Archived individual', entityType: 'individual', ssnLast4: '7438', services: ['Tax'], tags: ['Pages'] }, h.owner);
  await h.json(`/clients/${individual.id}/lifecycle`, { revision: individual.revision, lifecycle: 'archived' }, h.owner);
  const duplicate = await h.json('/clients', { name: 'Merged duplicate' }, h.owner);
  const comparison = await h.json(`/clients/compare?a=${made[0].id}&b=${duplicate.id}`, undefined, h.owner);
  await h.json('/clients/merge', {
    survivor: made[0].id, merged: duplicate.id,
    keep: Object.fromEntries(comparison.fields.filter(f => !f.same && f.key !== 'source').map(f => [f.key, 'survivor'])),
  }, h.owner);
  const key = await h.json('/keys', { label: 'Client pages denial' }, h.owner);
  const before = await h.json('/state', undefined, h.owner), audit = (await h.json('/team', undefined, h.owner)).audit;
  const listed = await allPages('clients', { limit: 1 }, h.owner);
  const sqlCompare = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
  const ordered = [...before.clients].sort((a, b) => sqlCompare(a.name, b.name) || sqlCompare(a.id, b.id));
  assert.deepEqual(listed, ordered, 'Every native field and masked value survives pagination');
  assert.ok(!listed.some(c => c.id === duplicate.id), 'Merged clients stay excluded');
  assert.equal(listed.find(c => c.id === individual.id).ssn_last4, '•••••7438');
  assert.equal(listed.find(c => c.id === individual.id).lifecycle, 'archived');
  assert.equal(typeof listed.find(c => c.id === individual.id).services, 'string', 'Keep native workspace JSON fields');
  assert.deepEqual(await allPages('clients', { limit: 2 }, prep), (await h.json('/state', undefined, prep)).clients);
  assert.deepEqual(await allPages('clients', { limit: 1, client: individual.id }, prep), []);
  assert.deepEqual(await allPages('clients', { limit: 1, client: individual.id }, h.owner), [listed.find(c => c.id === individual.id)]);
  assert.deepEqual(await allPages('clients', { limit: 1, client: duplicate.id }, h.owner), []);
  assert.deepEqual(await allPages('clients', { limit: 1, client: 'missing' }, h.owner), []);
  assert.deepEqual((await h.json(path('clients'), undefined, h.owner)).items, listed);
  const first = await h.json(path('clients', { limit: 1 }), undefined, h.owner);
  const rest = await h.json(path('clients', { limit: 100, cursor: first.nextCursor }), undefined, h.owner);
  assert.deepEqual([...first.items, ...rest.items], listed, 'Changing page size retains the position');
  assert.equal(rest.nextCursor, null);
  const filtered = await h.json(path('clients', { client: individual.id }), undefined, h.owner);
  assert.equal(filtered.nextCursor, null);
  for (const query of [{ client: individual.id }, { client: duplicate.id }]) {
    await h.json(path('clients', { ...query, cursor: first.nextCursor }), undefined, h.owner, 400);
  }
  await h.json(path('clients', { cursor: first.nextCursor }), undefined, prep, 400);
  for (const route of ['work', 'time']) {
    await h.json(path(route, { cursor: first.nextCursor }), undefined, h.owner, 400);
    const page = await h.json(path(route, { limit: 1 }), undefined, h.owner);
    await h.json(path('clients', { cursor: page.nextCursor }), undefined, h.owner, 400);
  }
  const decoded = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString('utf8'));
  for (const altered of [{ ...decoded, v: 2 }, { ...decoded, after: ['name'] }, { ...decoded, after: ['name', 'id', 'extra'] }, { ...decoded, after: [7, 'id'] }, { ...decoded, after: ['', 'id'] }, { ...decoded, actor: { ...decoded.actor, role: 'reviewer' } }]) {
    await h.json(path('clients', { cursor: Buffer.from(JSON.stringify(altered)).toString('base64url') }), undefined, h.owner, 400);
  }
  for (const cursor of ['?', '', 'bad', Buffer.from('{"v":9}').toString('base64url')]) await h.json(path('clients', { cursor }), undefined, h.owner, 400);
  for (const limit of ['0', '101', '1.5', 'NaN', '']) await h.json(path('clients', { limit }), undefined, h.owner, 400);
  await h.json(path('clients'), undefined, '', 401);
  await h.json(path('clients'), undefined, '', 401, { authorization: 'Bearer ' + key.key });
  assert.deepEqual(await h.json('/state', undefined, h.owner), before);
  assert.deepEqual((await h.json('/team', undefined, h.owner)).audit, audit);
  // The same public read door retains portable client fields, never source credentials.
  const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
  assert.ok(!archive.includes(key.key));
  const restored = await harness();
  try {
    await restored.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    assert.deepEqual((await restored.json(path('clients', { limit: 100 }), undefined, restored.owner)).items, listed);
    await restored.json(path('clients'), undefined, prep, 401);
    await restored.json(path('clients'), undefined, '', 401, { authorization: 'Bearer ' + key.key });
  } finally { await restored.close(); }
});

test('API-002 / BASE-001 client cursors lose job/task authority and follow current roles, MFA and member status', async () => {
  const address = 'pages-reader@example.test';
  await h.json('/team', { email: address, name: 'Page reader', role: 'preparer' }, h.owner);
  await h.json('/team/invite', { email: address }, h.owner);
  let reader = await h.login(address);
  const clients = [];
  for (const name of ['A reader anchor', 'M reader job', 'Z reader task']) clients.push(await h.json('/clients', { name }, h.owner));
  const ordinary = await h.json('/templates', { name: 'Reader job', recurrence: 'annual', steps: 'Prepare', requests: 'Source' }, h.owner);
  const named = await h.json('/templates', { name: 'Reader named task', recurrence: 'annual', tasks: [{ label: 'Named task', assignee: address }], requests: 'Source' }, h.owner);
  const start = (clientId, templateId, preparerEmail) => h.json('/jobs', { clientId, templateId, preparerEmail, reviewerEmail: 'owner@example.test', periodStart: '2026-01-01', dueDate: '2026-12-01', dueNote: 'Recorded target' }, h.owner);
  await start(clients[0].id, ordinary.id, address);
  const assigned = await start(clients[1].id, ordinary.id, address);
  const taskJob = await start(clients[2].id, named.id, otherEmail);
  assert.deepEqual((await allPages('clients', { limit: 1 }, reader)).map(c => c.id), clients.map(c => c.id));
  assert.deepEqual((await allPages('clients', { limit: 1, client: clients[2].id }, reader)).map(c => c.id), [clients[2].id]);
  assert.equal((await h.json(`/jobs/${taskJob.id}`, undefined, reader)).job.access, 'task');
  await h.json('/team', { email: address, name: 'Page reader', role: 'reviewer' }, h.owner);
  assert.deepEqual(await allPages('clients', { limit: 2 }, reader), (await h.json('/state', undefined, h.owner)).clients);
  const lead = await h.json(path('clients', { limit: 1 }), undefined, reader);
  await h.json('/team', { email: address, name: 'Page reader', role: 'preparer' }, h.owner);
  await h.json(path('clients', { cursor: lead.nextCursor }), undefined, reader, 400);
  const first = await h.json(path('clients', { limit: 1 }), undefined, reader);
  const move = { jobIds: [assigned.id], preparerEmail: otherEmail };
  const preview = await h.json('/bulk/reassign/preview', move, h.owner);
  await h.json('/bulk/reassign', { ...move, fingerprint: preview.fingerprint }, h.owner);
  assert.deepEqual((await h.json(path('clients', { cursor: first.nextCursor }), undefined, reader)).items.map(c => c.id), [clients[2].id]);
  assert.deepEqual(await allPages('clients', { limit: 1, client: clients[1].id }, reader), []);
  const transfer = { email: address, workSuccessor: otherEmail, reviewSuccessor: 'owner@example.test' };
  const plan = await h.json('/team/offboard/preview', transfer, h.owner);
  assert.ok(plan.tasks.some(t => t.job_id === taskJob.id));
  await h.json('/team/offboard', { ...transfer, fingerprint: plan.fingerprint }, h.owner);
  await h.json(path('clients', { cursor: first.nextCursor }), undefined, reader, 401);
  await h.json('/team', { email: address, name: 'Page reader', role: 'preparer' }, h.owner);
  reader = await h.login(address);
  assert.deepEqual(await h.json(path('clients', { cursor: first.nextCursor }), undefined, reader), { items: [], nextCursor: null }, 'A new session for the same actor cannot recover transferred task scope');
  assert.deepEqual(await allPages('clients', { limit: 1, client: clients[2].id }, reader), []);
  await h.json(`/jobs/${taskJob.id}`, undefined, reader, 404);

  const enroll = async cookie => {
    const start = await h.json('/mfa/totp/start', {}, cookie);
    let bits = 0, value = 0; const bytes = [];
    for (const char of start.secret) { value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) - 1));
    const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), offset = mac[19] & 15;
    const code = String((mac.readUInt32BE(offset) & 0x7fffffff) % 1e6).padStart(6, '0');
    return h.json('/mfa/totp/confirm', { id: start.id, code }, cookie);
  };
  await enroll(h.owner);
  await h.json('/team/mfa-policy', { required: true }, h.owner);
  assert.equal((await h.json(path('clients'), undefined, reader, 403)).mfa, 'enroll');
  const enrolled = await enroll(reader);
  await h.json(path('clients'), undefined, reader);
  const second = await h.login(address);
  assert.equal((await h.json(path('clients'), undefined, second, 403)).mfa, 'verify');
  await h.json('/mfa/verify', { recoveryCode: enrolled.recoveryCodes[0] }, second);
  await h.json(path('clients'), undefined, second);
  await h.json('/team', { email: address, name: 'Page reader', role: 'preparer', active: false }, h.owner);
  await h.json(path('clients'), undefined, second, 401);
});
