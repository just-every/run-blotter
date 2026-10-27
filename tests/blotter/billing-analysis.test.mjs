import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { reportFixture } from './reports-fixture.mjs';

const filters = { from: '2026-01-01', to: '2026-03-31' };
const path = extra => '/reports/performance?' + new URLSearchParams({ ...filters, ...extra });
const group = (id, name, currency, jobIds, money = {}) => ({ id, name, currency, jobIds: [...jobIds].sort(),
  approvedTimeCents: 0, fixedFeeCents: 0, expenseChargeCents: 0, expenseCostCents: 0,
  marginBeforeStaffCostCents: 0, unbilledCents: 0, approvedExportCents: 0, ...money });

test('BILL-003: native client and service financial groups retain sources, currencies and live export reservations', async () => {
  const h = await harness();
  try {
    const s = await reportFixture(h);
    const time = await h.json(`/jobs/${s.open.id}/time`, { date: '2026-02-02', minutes: 30, description: 'Review February records' }, s.prep);
    await h.json('/timesheets/submit', { weekStart: '2026-02-02' }, s.prep);
    await h.json(`/time/${time.id}/review`, { decision: 'approve' }, s.reviewer);
    const template = await h.json('/templates', { name: 'Australian source work', recurrence: 'monthly', steps: 'Review records', requests: 'Source records', feeCents: 0, currency: 'AUD' }, h.owner);
    const aud = await h.json('/jobs', { clientId: s.client.id, templateId: template.id, workTypeId: s.type.id,
      periodStart: '2026-03-01', dueDate: '2026-04-15', dueNote: 'Recorded engagement target',
      preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
    const expense = await h.json(`/jobs/${aud.id}/expenses`, { kind: 'filing_fee', date: '2026-03-02', description: 'Australian source fee', costCents: 700, billable: true, markupPercent: 20 }, s.prep);
    await h.json(`/expenses/${expense.id}/decide`, { decision: 'approve' }, s.reviewer);

    const report = await h.json(path(), undefined, h.owner);
    const otherJob = report.jobs.find(j => j.client_id === s.other.id);
    const usd = { approvedTimeCents: 9000, fixedFeeCents: 5000, expenseChargeCents: 1100, expenseCostCents: 1000,
      marginBeforeStaffCostCents: 14100, unbilledCents: 3000, approvedExportCents: 12100 };
    const australian = { expenseChargeCents: 840, expenseCostCents: 700, marginBeforeStaffCostCents: 140, unbilledCents: 840 };
    const expected = {
      clients: [group(s.client.id, s.client.name, 'AUD', [aud.id], australian),
        group(s.client.id, s.client.name, 'USD', [s.complete.id, s.open.id], usd),
        group(s.other.id, s.other.name, 'USD', [otherJob.id])],
      services: [group(s.type.id, s.type.name, 'AUD', [aud.id], australian),
        group(s.type.id, s.type.name, 'USD', [s.complete.id, s.open.id, otherJob.id], usd)],
    };
    assert.deepEqual(report.financialBreakdowns, expected);
    for (const groups of Object.values(report.financialBreakdowns)) {
      for (const entry of groups) {
        assert.equal(new Set(entry.jobIds).size, entry.jobIds.length);
        assert.ok(entry.jobIds.every(id => report.jobs.some(j => j.id === id && j.financial.currency === entry.currency)));
      }
    }
    const done = report.jobs.find(j => j.id === s.complete.id);
    assert.equal(done.financial.sources.time[0].id, s.time.id);
    assert.equal(done.financial.sources.expenses[0].id, s.expense.id);
    assert.ok(done.financial.sources.exports.every(e => e.exportId === s.exp.id));
    const repeat = await h.json(path(), undefined, s.reviewer);
    assert.deepEqual(repeat.financialBreakdowns, expected);
    assert.deepEqual(repeat.jobs.map(j => j.financial), report.jobs.map(j => j.financial));

    const sourceKeys = (await h.json('/billing', undefined, h.owner)).unbilled.filter(l => l.job_id === s.open.id).map(l => l.source_key);
    const draft = await h.json('/exports', { title: 'February reviewed time', sourceKeys }, h.owner);
    await h.json('/exports', { title: 'Duplicate reservation', sourceKeys }, h.owner, 409);
    const reserved = await h.json(path(), undefined, h.owner);
    const withoutUnbilled = structuredClone(expected);
    withoutUnbilled.clients.find(g => g.id === s.client.id && g.currency === 'USD').unbilledCents = 0;
    withoutUnbilled.services.find(g => g.currency === 'USD').unbilledCents = 0;
    assert.deepEqual(reserved.financialBreakdowns, withoutUnbilled);
    await h.json(`/exports/${draft.id}/void`, { reason: 'Return the reserved time to unbilled work' }, h.owner);
    assert.deepEqual((await h.json(path(), undefined, h.owner)).financialBreakdowns, expected);

    const clientOnly = await h.json(path({ client: s.other.id }), undefined, h.owner);
    assert.deepEqual(clientOnly.financialBreakdowns, { clients: [expected.clients[2]], services: [group(s.type.id, s.type.name, 'USD', [otherJob.id])] });
    const february = await h.json(path({ from: '2026-02-01', to: '2026-02-28', client: s.client.id, workType: s.type.id, assignee: 'prep@example.test' }), undefined, h.owner);
    const openMoney = { approvedTimeCents: 3000, marginBeforeStaffCostCents: 3000, unbilledCents: 3000 };
    assert.deepEqual(february.financialBreakdowns, { clients: [group(s.client.id, s.client.name, 'USD', [s.open.id], openMoney)], services: [group(s.type.id, s.type.name, 'USD', [s.open.id], openMoney)] });
    for (const filter of [{ workType: 'absent' }, { assignee: 'absent@example.test' }]) {
      assert.deepEqual((await h.json(path(filter), undefined, h.owner)).financialBreakdowns, { clients: [], services: [] });
    }
    await h.json(path(), undefined, s.prep, 403);
    await h.json(path(), undefined, '', 401);
  } finally {
    await h.close();
  }
});

// One end-to-end revenue flow: real HTTP, database and invoice authority; Stripe alone is a network-edge fake.
test('REVENUE-001 / BASE-001: cited scope leakage and duplicate correction, declined amendment and confirmed ACH return retain owned open balances without charging or write-off', async () => {
  const {stripeEdge}=await import('./stripe-edge.mjs');
  const {revenueFixture,assertRevenueFlow}=await import('./revenue-proof.mjs');
  const {revenueJourney}=await import('./revenue-ui.mjs');
  const {assertRevenueCustody}=await import('./revenue-custody.mjs');
  const edge=stripeEdge(),h=await harness({bindings:{STRIPE_SECRET_KEY:'synthetic-blotter-2',STRIPE_WEBHOOK_SECRET:'synthetic-blotter-1'},stripeResponse:edge.respond});
  try {const s=await revenueFixture(h);const {read}=await assertRevenueFlow(h,edge,s,revenueJourney);await assertRevenueCustody(h,s,read);}finally{await h.close();}
});
