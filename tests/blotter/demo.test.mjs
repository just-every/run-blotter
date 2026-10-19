// Demo mode: a lived-in Morgan & Co practice opens for the owner; the waiting
// preparations approve, and the client reminder and an invitation send nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

test('Demo: the sample practice opens with work in every state; approvals complete and nothing is mailed', async () => {
  const h = await harness({ bindings: { RER_DEMO: '1' } });
  try {
    const state = await h.json('/state', undefined, h.owner);
    assert.equal(state.actor.name, 'Jordan Morgan');
    assert.ok(state.clients.length >= 15 && state.clients.some(c => c.name === 'Chen Family Cafe LLC'));
    for (const status of ['open', 'review', 'signed_off']) assert.ok(state.jobs.some(j => j.status === status), status);
    assert.notEqual(state.jobs[0].status, 'signed_off', 'work in progress comes first');
    assert.ok(state.people.some(p => p.name === 'Riley Tan' && p.role === 'reviewer'));
    const pending = state.proposals.filter(p => p.status === 'pending');
    assert.deepEqual(pending.map(p => p.kind).sort(), ['export', 'reminder', 'rollforward']);

    const returned = [];
    for (const j of state.jobs.filter(j => j.status === 'open' && j.submitted_at)) {
      const detail = await h.json(`/clients/${j.client_id}/history`, undefined, h.owner);
      if (detail.history.some(a => a.action === 'job.returned' && a.detail.includes('state account'))) returned.push(detail);
    }
    assert.ok(returned.length, 'review-returned work includes its reviewer note');
    const waiting = state.jobs.find(j => j.client_name === 'Oak City Landscaping' && j.status === 'open' && j.open_requests > 0);
    assert.ok(waiting);
    assert.ok((await h.json(`/jobs/${waiting.id}`, undefined, h.owner)).reminders.length >= 2, 'waiting-client work retains reminder history');

    // Each waiting preparation approves through Blotter's own doors.
    for (const p of pending) {
      const done = await h.json(`/proposals/${p.id}/decide`, { decision: 'approve' }, h.owner);
      if (p.kind === 'reminder') {
        assert.equal(done.result.delivery, 'accepted by demo mail');
        const view = await (await h.request(new URL(done.result.portalUrl).pathname.replace('/portal/', '/api/blotter/portal/'))).json();
        assert.ok(view.requests.some(r => r.status === 'requested'), 'the client sees what is outstanding');
      }
    }
    const billing = await h.json('/billing', undefined, h.owner);
    assert.ok(billing.exports.some(e => e.status === 'approved') && billing.exports.filter(e => e.status === 'draft').length >= 2);

    // The principal signs off a job waiting for them.
    const review = state.jobs.find(j => j.status === 'review' && j.reviewer_email === state.actor.email) ?? state.jobs.find(j => j.status === 'review');
    await h.json(`/jobs/${review.id}/review`, { revision: review.revision, decision: 'signoff', note: 'Looks right.' }, h.owner);

    await h.json('/team', { email: 'jamie@morganco.example', name: 'Jamie Lee', role: 'preparer' }, h.owner);
    assert.equal((await h.json('/team/invite', { email: 'jamie@morganco.example' }, h.owner)).status, 'accepted');
    assert.equal(h.mails.length, 0, 'nothing reaches the mail provider');
    const page = await h.request('/app', undefined, h.owner);
    assert.equal(page.status, 200, page.headers.get('location'));
    const html = await page.text();
    assert.ok(!html.includes('Demo Demo'));
    assert.equal(html.match(/<[a-z]+[^>]*\sdata-rer-name[\s>=]/g)?.length, 1, 'one brand marker: Blotter Demo once');
  } finally { await h.close(); }
});
