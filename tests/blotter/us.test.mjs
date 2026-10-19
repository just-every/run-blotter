// US defaults and retained Australian history, through the real Worker doors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

const member = async (h, email, role) => {
  await h.json('/team', { email, name: role, role }, h.owner);
  await h.json('/team/invite', { email }, h.owner);
  return h.login(email);
};

test('US-001 money: USD defaults, stored AUD remains distinct through time, billing CSV and archive restore', async () => {
  const h = await harness();
  let restored;
  try {
    await member(h, 'reviewer@example.test', 'reviewer');
    const clients = {};
    const jobs = {};
    const expenses = {};
    for (const code of ['USD', 'AUD']) {
      clients[code] = await h.json('/clients', { name: `${code} client`, ...(code === 'USD' ? { ein: '12-3456789' } : { abn: '51 824 753 556' }) }, h.owner);
      const template = await h.json('/templates', { name: `${code} monthly close`, recurrence: 'monthly', steps: 'Review source', requests: 'Statement', feeCents: 5000, ...(code === 'AUD' ? { currency: code } : {}) }, h.owner);
      assert.equal(template.currency, code);
      jobs[code] = await h.json('/jobs', { clientId: clients[code].id, templateId: template.id, periodStart: '2026-11-01', dueDate: '2026-11-20', dueNote: 'Client engagement target checked by the principal', preparerEmail: 'owner@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
      assert.equal(jobs[code].currency, code);
      expenses[code] = await h.json(`/jobs/${jobs[code].id}/expenses`, { kind: 'filing_fee', date: '2026-11-02', description: 'Agency fee', costCents: 100, billable: true }, h.owner);
      assert.equal(expenses[code].currency, code);
      await h.json(`/expenses/${expenses[code].id}/decide`, { decision: 'approve' }, h.owner);
    }
    await h.json('/team/rates', { email: 'owner@example.test', rateCents: 1000, effectiveFrom: '2026-01-01' }, h.owner);
    const usdTime = await h.json(`/jobs/${jobs.USD.id}/time`, { date: '2026-11-02', minutes: 60, description: 'Close preparation' }, h.owner);
    assert.equal(usdTime.currency, 'USD');
    await h.json(`/jobs/${jobs.AUD.id}/time`, { date: '2026-11-02', minutes: 60, description: 'Historical work' }, h.owner, 409);
    await h.json('/team/rates', { scope: 'client', clientId: clients.AUD.id, currency: 'AUD', rateCents: 1000, effectiveFrom: '2026-01-01' }, h.owner);
    const audTime = await h.json(`/jobs/${jobs.AUD.id}/time`, { date: '2026-11-02', minutes: 60, description: 'Historical work' }, h.owner);
    assert.equal(audTime.currency, 'AUD');
    await h.json('/timesheets/submit', { weekStart: '2026-11-02' }, h.owner);
    for (const entry of [usdTime, audTime]) await h.json(`/time/${entry.id}/review`, { decision: 'approve' }, h.owner);
    const billing = await h.json('/billing', undefined, h.owner);
    assert.equal(billing.wip.totalCents, null, 'Different currencies have no combined money total');
    assert.deepEqual(Object.fromEntries(Object.entries(billing.wip.byCurrency).map(([code, v]) => [code, v.totalCents])), { USD: 1100, AUD: 1100 });
    await h.json('/exports', { title: 'Must not convert', sourceKeys: billing.unbilled.map(l => l.source_key) }, h.owner, 409);
    const csvs = [];
    for (const code of ['USD', 'AUD']) {
      const chosen = billing.unbilled.filter(l => l.currency === code);
      const draft = await h.json('/exports', { title: `${code} bill`, sourceKeys: chosen.map(l => l.source_key) }, h.owner);
      assert.equal(draft.totalCents, 1100);
      const saved = (await h.json('/billing', undefined, h.owner)).exports.find(e => e.id === draft.id);
      assert.equal(JSON.parse(saved.snapshot).currency, code);
      await h.json(`/exports/${draft.id}/approve`, { revision: saved.revision, reviewNote: 'Compared source amounts and currency' }, h.owner);
      const csv = await (await h.request(`/api/blotter/exports/${draft.id}/csv`, undefined, h.owner)).text();
      const records = csv.trim().split('\r\n').map(line => line.split(','));
      assert.ok(records.slice(1).every(r => r.at(-1) === code));
      assert.ok(records.slice(1, -1).every(r => r[4] === (code === 'AUD' ? 'ABN' : 'EIN')));
      assert.equal(Number(records.at(-1).at(-2)), 1100);
      csvs.push({ id: draft.id, csv });
    }
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness();
    await restored.json('/restore', { archive, confirm: 'RESTORE' }, restored.owner);
    const after = await restored.json('/state', undefined, restored.owner);
    assert.deepEqual(after.jobs.map(j => [j.id, j.currency, j.fee_cents]).sort(), Object.values(jobs).map(j => [j.id, j.currency, j.fee_cents]).sort());
    for (const { id, csv } of csvs) assert.equal(await (await restored.request(`/api/blotter/exports/${id}/csv`, undefined, restored.owner)).text(), csv);
  } finally { await restored?.close(); await h.close(); }
});

test('US-001 client IDs: EIN validation and CSV replay preserve legacy ABNs; authorized digit search stays masked', async () => {
  const h = await harness();
  try {
    const preparer = await member(h, 'preparer@example.test', 'preparer');
    const reviewer = await member(h, 'reviewer@example.test', 'reviewer');
    const company = await h.json('/clients', { name: 'Maple Lane LLC', ein: '12-3456789' }, h.owner);
    const legacy = await h.json('/clients', { name: 'Historical Australian client', abn: '51 824 753 556' }, h.owner);
    await h.json('/clients', { name: 'Invalid', ein: '12345678' }, h.owner, 400);
    await h.json('/clients', { name: 'Both', ein: '123456789', abn: '51824753556' }, h.owner, 400);
    const csv = 'client_id,client_name,ein,abn\nUS-1,Maple duplicate,12-3456789,\nAU-1,Legacy duplicate,,51 824 753 556\n';
    const preview = await h.json('/import/preview', { csv }, h.owner);
    assert.equal(preview.summary.errors.length, 0);
    let imported = await h.json('/import/commit', { csv, fingerprint: preview.fingerprint }, h.owner);
    while (imported.job.state !== 'completed') imported = await h.json('/import/resume', { id: imported.job.id }, h.owner);
    const count = (await h.json('/state', undefined, h.owner)).clients.length;
    await h.json('/import/commit', { csv, fingerprint: preview.fingerprint }, h.owner);
    assert.equal((await h.json('/state', undefined, h.owner)).clients.length, count);
    const pairs = await h.json('/clients/duplicates', undefined, h.owner);
    assert.ok(pairs.some(p => p.reasons.includes('same EIN')));
    assert.ok(pairs.some(p => p.reasons.includes('same legacy ABN')));
    for (const [id, digits, kind] of [[company.id, '6789', 'EIN'], [legacy.id, '3556', 'legacy ABN']]) {
      for (const actor of [h.owner, reviewer]) {
        const hits = (await h.json('/search?q=' + digits, undefined, actor)).results.filter(r => r.type === 'client');
        const hit = hits.find(r => r.id === id);
        assert.ok(hit);
        assert.equal(hit.taxId, '•••••' + digits);
        assert.equal(hit.taxIdType, kind);
        assert.ok(!JSON.stringify(hits).includes(id === company.id ? '123456789' : '51824753556'));
      }
      assert.equal((await h.json('/search?q=' + digits, undefined, preparer)).results.length, 0);
    }
    const state = await h.json('/state', undefined, h.owner);
    assert.equal(state.clients.find(c => c.id === company.id).abn, '123456789');
    assert.equal(state.clients.find(c => c.id === legacy.id).abn, '51824753556');
  } finally { await h.close(); }
});

test('US-001 firm setup: US practice details, filing calendar, local DST clock and durable notification hours survive restore', async () => {
  const h = await harness(); let restored;
  try {
    const reviewer = await member(h, 'reviewer@example.test', 'reviewer');
    const settings = { name: 'Maple Practice LLC', currency: 'USD', ein: '12-3456789', entity: 'LLC', address: '125 Main Street', city: 'Albany', state: 'NY', zip: '12207', fiscalYearEnd: '06-30', services: ['Bookkeeping', 'Payroll', 'Federal and state tax', 'Sales tax'], timeZone: 'America/New_York', notificationStart: '09:00', notificationEnd: '17:00', calendars: [{ name: '941 payroll', jurisdiction: 'Federal', dueDate: '2026-10-31', source: 'Principal recorded engagement calendar; verify before filing' }, { name: 'Sales tax', jurisdiction: 'New York', dueDate: '2026-11-20', source: 'Client filing schedule reviewed by principal' }] };
    const saved = await h.json('/firm/settings', settings, h.owner);
    assert.deepEqual(saved, { ...settings, ein: '123456789' });
    assert.deepEqual((await h.json('/firm/settings', undefined, h.owner)).calendars, settings.calendars);
    await h.json('/firm/settings', settings, reviewer, 403);
    await h.json('/firm/settings', undefined, reviewer, 403);
    for (const bad of [{ ein: '123' }, { zip: '000' }, { state: 'XX' }, { timeZone: 'US/NoSuchZone' }, { fiscalYearEnd: '02-30' }, { notificationStart: '25:00' }, { calendars: [{ ...settings.calendars[0], dueDate: '2026-02-30' }] }]) await h.json('/firm/settings', { ...settings, ...bad }, h.owner, 400);
    assert.equal((await h.json('/firm/settings', undefined, h.owner)).ein, saved.ein, 'invalid saves are atomic');
    for (const [at, localDate, localTime, zone, allowed] of [
      ['2026-03-08T06:30:00Z', '2026-03-08', '01:30', 'EST', false], ['2026-03-08T07:30:00Z', '2026-03-08', '03:30', 'EDT', false],
      ['2026-11-01T05:30:00Z', '2026-11-01', '01:30', 'EDT', false], ['2026-11-01T06:30:00Z', '2026-11-01', '01:30', 'EST', false],
      ['2026-11-02T14:00:00Z', '2026-11-02', '09:00', 'EST', true], ['2026-11-02T22:00:00Z', '2026-11-02', '17:00', 'EST', false],
    ]) {
      const p = await h.json('/firm/time?at=' + encodeURIComponent(at), undefined, h.owner);
      assert.deepEqual([p.localDate, p.localTime, p.zone, p.notificationsAllowed], [localDate, localTime, zone, allowed]);
    }
    const llc = await h.json('/clients', { name: 'Maple Lane LLC', ein: '98-7654321' }, h.owner);
    const individual = await h.json('/clients', { name: 'Alex Rivera', contactName: 'Alex Rivera', contactEmail: 'alex@example.test' }, h.owner);
    const jobs = [];
    for (const [name, recurrence, client] of [['Quarterly payroll — 941, state withholding and unemployment', 'quarterly', llc], ['New York sales-tax filing', 'quarterly', llc], ['1040 federal and state annual return', 'annual', individual], ['1099-NEC and W-2 year-end', 'annual', llc]]) {
      const t = await h.json('/templates', { name, recurrence, steps: 'Prepare workpapers\nIndependent review', requests: 'Source records', feeCents: 12500 }, h.owner);
      const j = await h.json('/jobs', { clientId: client.id, templateId: t.id, periodStart: '2026-01-01', dueDate: settings.calendars[0].dueDate, dueNote: settings.calendars[0].source, preparerEmail: 'owner@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
      assert.equal(j.currency, 'USD'); assert.equal(j.due_date, '2026-10-31'); jobs.push(j);
    }
    // Queue a real mention outside today's configured one-minute window, then fire the Cron Trigger in it.
    const local = await h.json('/firm/time', undefined, h.owner);
    const minute = (Number(local.localTime.slice(0, 2)) * 60 + Number(local.localTime.slice(3)) + 120) % 1440;
    const hhmm = n => `${String(Math.floor((n % 1440) / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    const narrow = { ...settings, notificationStart: hhmm(minute), notificationEnd: hhmm(minute + 1) };
    await h.json('/firm/settings', narrow, h.owner);
    const mailsBefore = h.mails.length;
    await h.json(`/jobs/${jobs[0].id}/threads`, { title: 'Check payroll calendar', body: 'Please review the state filing dates.', mentions: ['reviewer@example.test'] }, h.owner);
    assert.equal(h.mails.length, mailsBefore);
    let alerts = await h.json('/notifications', undefined, reviewer);
    assert.ok(alerts.some(n => n.delivery.startsWith('deferred:')));
    // Find an actual future instant in the chosen local minute, including DST via the public clock door.
    const current = new Date(local.at), release = new Date(current.getTime() + 120 * 60000);
    await h.scheduled(release.toISOString());
    alerts = await h.json('/notifications', undefined, reviewer);
    assert.ok(alerts.some(n => n.delivery.startsWith('accepted by')));
    assert.equal(h.mails.length, mailsBefore + 1);
    await h.scheduled(release.toISOString()); assert.equal(h.mails.length, mailsBefore + 1, 'cron never resends a completed notification');
    await h.json('/firm/settings', { ...settings, notificationStart: '22:00', notificationEnd: '06:00' }, h.owner);
    assert.equal((await h.json('/firm/time?at=2026-11-02T04:00:00Z', undefined, h.owner)).notificationsAllowed, true);
    assert.equal((await h.json('/firm/time?at=2026-11-02T17:00:00Z', undefined, h.owner)).notificationsAllowed, false);
    await h.json('/firm/settings', { ...settings, currency: 'AUD' }, h.owner);
    const historicalDefault = await h.json('/templates', { name: 'Australian historical service', recurrence: 'monthly', steps: 'Review work', requests: 'Source evidence', feeCents: 300 }, h.owner);
    assert.equal(historicalDefault.currency, 'AUD');
    const unchanged = await h.json('/jobs/' + jobs[0].id, undefined, h.owner);
    assert.equal(unchanged.job.currency, 'USD');
    await h.json('/firm/settings', settings, h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness(); await restored.json('/restore', { archive, confirm: 'RESTORE' }, restored.owner);
    assert.deepEqual(await restored.json('/firm/settings', undefined, restored.owner), saved);
    const state = await restored.json('/state', undefined, restored.owner);
    assert.equal(state.firm.timeZone, settings.timeZone); assert.equal(state.jobs.length, jobs.length);
    assert.ok(state.clients.some(c => c.id === individual.id));
  } finally { await restored?.close(); await h.close(); }
});
