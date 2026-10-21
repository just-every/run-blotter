import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { workBulkJourney } from './work-bulk-ui.mjs';

test('WORK-004 principal bulk self-review is refused; individual work requires acknowledgment; groups preselect the bulk form', async () => {
  const h = await harness();
  try {
    const clients = [];
    for (const name of ['Cedar Books LLC', 'River Books LLC']) clients.push(await h.json('/clients', { name }, h.owner));
    const template = await h.json('/templates', { name: 'Quarterly close', recurrence: 'quarterly', steps: 'Reconcile accounts', requests: 'Close evidence' }, h.owner);
    const start = { templateId: template.id, periodStart: '2026-01-01', dueDate: '2026-04-15', dueNote: 'Firm approved close date', preparerEmail: 'owner@example.test', reviewerEmail: 'owner@example.test' };
    const batch = { ...start, clients: clients.map(c => ({ clientId: c.id })) };
    const preview = await h.json('/bulk/schedule/preview', batch, h.owner);
    assert.ok(preview.lines.every(l => l.action === 'conflict' && l.reasons.some(r => /cannot review their own work/.test(r))));
    await h.json('/bulk/schedule', { ...batch, fingerprint: preview.fingerprint }, h.owner, 409);
    assert.equal((await h.json('/state', undefined, h.owner)).jobs.length, 0);
    const job = await h.json('/jobs', { ...start, clientId: clients[0].id }, h.owner);
    let detail = await h.json('/jobs/' + job.id, undefined, h.owner);
    for (const request of detail.requests) {
      await h.json(`/requests/${request.id}/files`, {name:'reconciliation.txt',mime:'text/plain',contentBase64:Buffer.from('Reconciliation evidence').toString('base64')},h.owner);
      await h.json(`/requests/${request.id}/decide`,{decision:'accept'},h.owner);
    }
    for (const step of detail.steps) await h.json(`/jobs/${job.id}/steps`, { ordinal: step.ordinal, done: true }, h.owner);
    detail = await h.json('/jobs/' + job.id, undefined, h.owner);
    detail = await h.json(`/jobs/${job.id}/submit`, { revision: detail.job.revision }, h.owner);
    const decision = { revision: detail.job.revision, decision: 'signoff', note: 'Principal checked reconciliation' };
    await h.json(`/jobs/${job.id}/review`, decision, h.owner, 403);
    assert.equal((await h.json('/jobs/' + job.id, undefined, h.owner)).job.status, 'review');
    detail = await h.json(`/jobs/${job.id}/review`, { ...decision, selfReview: true }, h.owner);
    assert.equal(detail.job.status, 'signed_off');
    assert.equal(detail.job.signed_off_by, 'owner@example.test');
    await h.json('/team', { email: 'reviewer@example.test', name: 'Independent Reviewer', role: 'reviewer' }, h.owner);
    const [group] = await h.json('/groups', { name: 'All book clients', members: clients.map(c => ({ clientId: c.id, relationship: 'member' })) }, h.owner);
    await workBulkJourney(h, { clients, template, group });
  } finally { await h.close(); }
});
