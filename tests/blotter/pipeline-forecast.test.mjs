import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

test('CAPACITY-003 / CRM-005: open requested services appear in baseline and saved scenarios with stage, source and annual fee basis, without converting fees to hours or mutating live work', async () => {
  const h = await harness();
  try {
    for (const [email, role] of [['reviewer@example.test', 'reviewer'], ['preparer@example.test', 'preparer']]) {
      await h.json('/team', { email, name: role, role }, h.owner);
      await h.json('/team/invite', { email }, h.owner);
    }
    const preparer = await h.login('preparer@example.test');
    const stage = await h.json('/pipeline/stages', { name: 'Scoping work', position: 15 }, h.owner);
    const base = { contactName: 'Dana', contactEmail: 'dana@example.test', services: ['Monthly bookkeeping', 'Annual return'], source: 'Referral', estimatedFeeCents: 850000, currency: 'USD', ownerEmail: 'reviewer@example.test' };
    const open = await h.json('/prospects', { ...base, name: 'Open practice', stageId: stage.id }, h.owner);
    const lost = await h.json('/prospects', { ...base, name: 'Lost practice' }, h.owner);
    const won = await h.json('/prospects', { ...base, name: 'Won practice' }, h.owner);
    const stages = (await h.json('/pipeline', undefined, h.owner)).stages;
    await h.json(`/prospects/${lost.id}/stage`, { stageId: stages.find(s => s.kind === 'lost').id, reason: 'Selected another firm' }, h.owner);
    const onboarding = await h.json('/templates', { name: 'Onboarding', recurrence: 'annual', steps: 'Gather records', requests: 'Prior records' }, h.owner);
    await h.json(`/prospects/${won.id}/win`, { templateId: onboarding.id, preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test', periodStart: '2031-01-01', dueDate: '2031-02-15', dueNote: 'Agreed start' }, h.owner);
    const window = { from: '2032-04-12', weeks: 2 };
    const live = async () => {
      const state = await h.json('/state', undefined, h.owner);
      return { clients: state.clients, jobs: state.jobs, rules: await h.json('/rules', undefined, h.owner), capacity: await h.json('/capacity?week=2032-04-12', undefined, h.owner), prospects: (await h.json('/pipeline', undefined, h.owner)).prospects };
    };
    const before = await live();
    await h.json('/capacity/forecast', window, preparer, 403);
    const changes = { hires: [{ name: 'Potential hire', weeklyMinutes: 1200, skills: ['Monthly bookkeeping'], startsOn: window.from }] };
    const view = await h.json('/capacity/forecast', { ...window, changes }, h.owner);
    const expected = base.services.map(service => [open.id, 'Open practice', service, stage.id, stage.name, base.source, base.ownerEmail, base.estimatedFeeCents, base.currency]);
    assert.deepEqual(view.baseline.pipeline.map(p => [p.prospectId, p.prospect, p.service, p.stageId, p.stage, p.source, p.ownerEmail, p.estimatedAnnualFeeCents, p.currency]), expected);
    assert.deepEqual(view.compared.pipeline, view.baseline.pipeline);
    for (const line of view.baseline.pipeline) {
      assert.equal(line.status, 'unestimated');
      assert.equal(line.minutes, null);
      assert.equal(line.weekStart, null);
      assert.match(line.feeBasis, /whole prospect/);
      assert.match(line.basis, /no prospect work budget/);
    }
    assert.deepEqual(view.baseline.demand, { point: 0, low: 0, high: 0 });
    assert.deepEqual(view.compared.demand, view.baseline.demand);
    assert.equal(view.baseline.lines.length, 0);
    assert.ok(view.baseline.weeks.every(w => w.demand.high === 0 && w.confidence.reasons.length === 0));
    const saved = await h.json('/capacity/scenarios', { name: 'Pipeline hiring context', ...window, changes }, h.owner);
    const reopened = await h.json('/capacity/forecast', { scenarioId: saved.id }, h.owner);
    assert.deepEqual(reopened.baseline.pipeline, view.baseline.pipeline);
    assert.deepEqual(reopened.compared.pipeline, view.compared.pipeline);
    assert.deepEqual(await live(), before);
  } finally {
    await h.close();
  }
});
