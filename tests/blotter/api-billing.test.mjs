import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

const path = (query = {}) => '/v1/billing/exports?' + new URLSearchParams(query);
const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
async function pages(h, cookie, query = {}) {
  const items = [], seen = new Set();
  let cursor;
  do {
    const page = await h.json(path({ limit: 1, ...query, ...(cursor ? { cursor } : {}) }), undefined, cookie);
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor !== null) { assert.equal(typeof cursor, 'string'); assert.ok(!seen.has(cursor)); seen.add(cursor); }
  } while (cursor !== null);
  assert.equal(new Set(items.map(row => row.id)).size, items.length);
  return items;
}

test('API-002 / API-003 / BASE-001 native billing pages retain financial authority, filtered history and restored snapshots', async () => {
  const h = await harness();
  try {
    const reviewerEmail = 'billing-api-reviewer@example.test', prepEmail = 'billing-api-prep@example.test';
    for (const [email, role] of [[reviewerEmail, 'reviewer'], [prepEmail, 'preparer']]) {
      await h.json('/team', { email, role, name: email }, h.owner);
      await h.json('/team/invite', { email }, h.owner);
    }
    const reviewer = await h.login(reviewerEmail), prep = await h.login(prepEmail);
    await h.json('/team/rates', { email: prepEmail, rateCents: 6000, currency: 'USD', effectiveFrom: '2026-01-01' }, h.owner);
    const client = await h.json('/clients', { name: 'Billing API client' }, h.owner);
    const template = await h.json('/templates', { name: 'Billing API work', recurrence: 'annual', steps: 'Prepare', requests: 'Statement' }, h.owner);
    const job = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-01-01', dueDate: '2026-10-31', dueNote: 'Practitioner target', preparerEmail: prepEmail, reviewerEmail }, h.owner);
    const entries = [];
    for (let n = 0; n < 4; n++) entries.push(await h.json(`/jobs/${job.id}/time`, { date: '2026-10-05', minutes: 15 + n, description: 'Reviewed billing source ' + n }, prep));
    await h.json('/timesheets/submit', { weekStart: '2026-10-05' }, prep);
    const drafts = [];
    for (const [n, entry] of entries.entries()) {
      await h.json(`/time/${entry.id}/review`, { decision: 'approve' }, reviewer);
      drafts.push(await h.json('/exports', { title: 'API export ' + n, sourceKeys: ['time:' + entry.id] }, reviewer));
    }
    const firstDraft = (await h.json('/billing', undefined, reviewer)).exports.find(e => e.id === drafts[0].id);
    await h.json(`/exports/${firstDraft.id}/approve`, { revision: firstDraft.revision, reviewNote: 'Reviewed API billing' }, h.owner);
    await h.json(`/exports/${drafts[1].id}/void`, { reason: 'Reconcile later' }, reviewer);
    const key = await h.json('/keys', { label: 'Billing refusal' }, h.owner);
    const before = await h.json('/billing', undefined, h.owner), audit = (await h.json('/team', undefined, h.owner)).audit;
    const expected = before.exports.map(row => ({ ...row, currency: JSON.parse(row.snapshot).currency ?? 'AUD' }))
      .sort((a, b) => cmp(b.prepared_at, a.prepared_at) || cmp(b.id, a.id));
    const listed = await pages(h, reviewer);
    assert.deepEqual(listed, expected);
    assert.deepEqual(await pages(h, h.owner, { limit: 2 }), listed);
    assert.ok(listed.every(row => !Object.hasOwn(row, 'csv') && row.currency === 'USD'));
    assert.deepEqual(listed.map(row => row.total_cents).sort((a, b) => a - b), drafts.map(row => row.totalCents).sort((a, b) => a - b));
    const preparedDay = listed[0].prepared_at.slice(0, 10);
    assert.deepEqual(await pages(h, reviewer, { from: preparedDay, to: preparedDay }), listed);
    assert.deepEqual(await pages(h, reviewer, { to: '2020-01-01' }), []);
    for (const status of ['draft', 'approved', 'void']) {
      assert.deepEqual(await pages(h, reviewer, { status }), listed.filter(row => row.status === status));
    }
    const first = await h.json(path({ limit: 1 }), undefined, reviewer);
    assert.ok(first.nextCursor);
    const rest = await h.json(path({ cursor: first.nextCursor, limit: 100 }), undefined, reviewer);
    assert.deepEqual([...first.items, ...rest.items], listed);
    await h.json(path({ cursor: first.nextCursor }), undefined, h.owner, 400);
    await h.json(path({ cursor: first.nextCursor, status: 'draft' }), undefined, reviewer, 400);
    await h.json('/v1/clients?cursor=' + first.nextCursor, undefined, reviewer, 400);
    const decoded = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString('utf8'));
    for (const altered of [{ ...decoded, route: 'time' }, { ...decoded, after: ['invalid', 'id'] }, { ...decoded, after: [] }]) {
      await h.json(path({ cursor: Buffer.from(JSON.stringify(altered)).toString('base64url') }), undefined, reviewer, 400);
    }
    for (const query of [{ limit: 0 }, { limit: 101 }, { limit: '1.5' }, { cursor: '?' }, { status: '' }, { status: 'paid' }, { from: '2026-02-30' }, { to: 'bad' }, { from: '2026-12-01', to: '2026-01-01' }]) {
      await h.json(path(query), undefined, reviewer, 400);
    }
    await h.json(path(), undefined, prep, 403);
    await h.json(path(), undefined, '', 401);
    await h.json(path(), undefined, '', 401, { authorization: 'Bearer ' + key.key });
    assert.deepEqual(await h.json('/billing', undefined, h.owner), before, 'Read pages do not change billing');
    assert.deepEqual((await h.json('/team', undefined, h.owner)).audit, audit, 'Read pages add no mutations or grants');

    await h.json('/team', { email: reviewerEmail, name: 'Former reviewer', role: 'preparer' }, h.owner);
    await h.json(path({ cursor: first.nextCursor }), undefined, reviewer, 403);
    await h.json('/team', { email: reviewerEmail, name: 'Reviewer restored', role: 'reviewer' }, h.owner);
    assert.deepEqual(await pages(h, reviewer), listed);
    await h.json('/team', { email: reviewerEmail, name: 'Inactive reviewer', role: 'reviewer', active: false }, h.owner);
    await h.json(path(), undefined, reviewer, 401);

    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.ok(!archive.includes(key.key));
    const restored = await harness();
    try {
      await restored.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
      assert.deepEqual(await pages(restored, restored.owner), listed);
      await restored.json(path(), undefined, reviewer, 401);
      await restored.json(path(), undefined, '', 401, { authorization: 'Bearer ' + key.key });
    } finally { await restored.close(); }
  } finally { await h.close(); }
});
