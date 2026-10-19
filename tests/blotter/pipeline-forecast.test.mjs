import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

test('CAPACITY-003 / CRM-005: open requested services appear in baseline and saved scenarios as budgeted workload assumptions with stage, source and annual fee context, without converting fees to hours or mutating live work', async () => {
  const h = await harness();
  try {
    for (const [email, role] of [['reviewer@example.test', 'reviewer'], ['preparer@example.test', 'preparer']]) {
      await h.json('/team', { email, name: role, role }, h.owner);
      await h.json('/team/invite', { email }, h.owner);
    }
    const preparer = await h.login('preparer@example.test');
    const stage = await h.json('/pipeline/stages', { name: 'Scoping work', position: 15 }, h.owner);
    const monthly = await h.json('/templates', { name: 'Monthly source tasks', recurrence: 'monthly', steps: 'Close books', requests: 'Statements', tasks: [{ label: 'Close books', assignee: 'preparer', estimateMinutes: 120 }] }, h.owner);
    const monthlyType = await h.json('/work-types', { name: 'Monthly bookkeeping', templateId: monthly.id, budgetMinutes: 180 }, h.owner);
    await h.json('/templates', { name: 'Annual return', recurrence: 'annual', steps: 'Prepare', requests: 'Organizer', tasks: [{ label: 'Prepare return', assignee: 'preparer', estimateMinutes: 240 }] }, h.owner);
    const base = { contactName: 'Dana', contactEmail: 'dana@example.test', services: ['Monthly bookkeeping', 'Annual return', 'Advisory scope pending'], source: 'Referral', estimatedFeeCents: 850000, currency: 'USD', ownerEmail: 'reviewer@example.test' };
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
    const [monthlyLine, annualLine, unknown] = view.baseline.pipeline;
    assert.deepEqual([monthlyLine.point, monthlyLine.low, monthlyLine.high, monthlyLine.basis, monthlyLine.firstDueDate], [180, 90, 270, 'work type budget', window.from]);
    assert.deepEqual([annualLine.point, annualLine.low, annualLine.high, annualLine.basis], [240, 120, 360, 'template task estimates']);
    assert.deepEqual([unknown.status, unknown.point, unknown.minutes], ['unestimated', 0, null]);
    assert.match(unknown.basis, /no matching work type/);
    for (const line of view.baseline.pipeline) {
      assert.match(line.feeBasis, /whole prospect/);
      assert.match(line.assumption, /Scoping work.*assumed won without probability weighting/);
    }
    assert.deepEqual(view.baseline.demand, { point: 420, low: 210, high: 630 });
    assert.deepEqual(view.compared.demand, view.baseline.demand);
    assert.equal(view.baseline.lines.length, 3);
    assert.equal(view.baseline.weeks[0].confidence.level, 'low');
    assert.ok(view.baseline.weeks[0].confidence.reasons.some(r => r.includes('Open practice (Scoping work)') && r.includes('no budget or estimate')));
    assert.equal(view.baseline.weeks[1].demand.point, 0);
    const recurring = await h.json('/capacity/forecast', { ...window, weeks: 6 }, h.owner);
    assert.deepEqual(recurring.baseline.lines.filter(l => l.service === 'Monthly bookkeeping').map(l => [l.due, l.weekStart, l.point]), [['2032-04-12', '2032-04-12', 180], ['2032-05-12', '2032-05-10', 180]]);
    assert.equal(recurring.baseline.lines.filter(l => l.service === 'Annual return').length, 1);
    await h.json('/capacity/forecast', { ...window, changes: { pipeline: [{ prospectId: open.id, service: 'Not requested', workTypeId: monthlyType.id, firstDueDate: window.from }] } }, h.owner, 409);
    const chosen = { ...changes, services: [{ workType: 'Monthly bookkeeping', percent: 50 }], pipeline: [{ prospectId: open.id, service: 'Advisory scope pending', workTypeId: monthlyType.id, firstDueDate: '2032-04-19' }] };
    const mapped = await h.json('/capacity/forecast', { ...window, changes: chosen }, h.owner);
    assert.deepEqual(mapped.baseline.weeks.map(w => w.demand.point), [420, 180]);
    assert.deepEqual(mapped.compared.weeks.map(w => w.demand.point), [330, 90]);
    assert.equal(mapped.compared.weeks[0].skills.find(s => s.skill === 'monthly bookkeeping').capacityMinutes, 1200);
    assert.match(mapped.compared.lines.find(l => l.service === 'Advisory scope pending').basis, /50%/);
    assert.equal(mapped.baseline.lines.find(l => l.service === 'Advisory scope pending').due, '2032-04-19');
    const saved = await h.json('/capacity/scenarios', { name: 'Pipeline hiring context', ...window, changes: chosen }, h.owner);
    const reopened = await h.json('/capacity/forecast', { scenarioId: saved.id }, h.owner);
    assert.deepEqual(reopened.baseline, mapped.baseline);
    assert.deepEqual(reopened.compared, mapped.compared);
    assert.deepEqual(await live(), before);
  } finally {
    await h.close();
  }
});
