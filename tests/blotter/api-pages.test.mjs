import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
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
    entries.push(await h.json(`/jobs/${jobs[0].id}/time`, { date, minutes: 15, description: 'Page boundary work' }, prep));
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
