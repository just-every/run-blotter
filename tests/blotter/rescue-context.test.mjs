import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { enroll, team } from './erasure-fixture.mjs';
import { rescueContextJourney } from './rescue-context-ui.mjs';

const address = name => [name, 'example.test'].join('@');
const people = { preparerEmail: address('prep'), reviewerEmail: address('reviewer') };
const week = '2026-10-12';
const archiveRows = archive => archive.trim().split('\n').flatMap(line => JSON.parse(line).items ?? []);
const sourceTables = new Set(['b_clients', 'b_jobs', 'b_job_steps', 'b_requests', 'b_job_deadlines', 'b_client_obligations', 'b_deadline_rules', 'b_capacity', 'b_capacity_blocks', 'b_files', 'b_portal_items', 'b_time', 'b_invoices', 'b_provider_payments', 'b_proposals']);
const sources = archive => archiveRows(archive).filter(item => sourceTables.has(item.table));
const backup = async h => (await h.request('/api/blotter/backup', undefined, h.owner)).text();

// One multi-client sanity journey through HTTP, the built screen and portable archives.
test('Principal inspects live source-linked deadline risks without execution, with current authority and erasure fencing', async () => {
  const h = await harness(), copies = [];
  try {
    const staff = await team(h);
    const clients = [
      await h.json('/clients', { name: 'Synthetic Blotter 501', entityType: 'individual' }, h.owner),
      await h.json('/clients', { name: 'Synthetic Blotter 502', entityType: 'business' }, h.owner),
    ];
    const excluded = await h.json('/clients', { name: 'Synthetic Blotter 503', entityType: 'individual' }, h.owner);
    for (const rule of ['us-1040', 'us-1065']) await h.json(`/deadlines/rules/${rule}/approve`, {}, h.owner);
    const prerequisite = await h.json('/templates', { name: 'Prior books', recurrence: 'annual', steps: 'Finish books', requests: 'Source records' }, h.owner);
    const template = await h.json('/templates', { name: 'Return risk', recurrence: 'annual', requests: 'Source records', tasks: [
      { label: 'Prepare records', assignee: 'preparer', estimateMinutes: 120, dueFrom: 'due', dueDays: -1 },
      { label: 'Review documents', assignee: 'reviewer', after: [1], afterDocuments: [1], afterJob: { templateId: prerequisite.id, gate: 'signed_off' }, dueFrom: 'due', dueDays: 0 },
    ] }, h.owner);
    const jobs = [], obligations = [], previous = [];
    for (const [n, client] of clients.entries()) {
      const obligation = await h.json(`/clients/${client.id}/obligations`, { ruleKey: n ? 'us-1065' : 'us-1040', state: 'CA', internalDays: 5 }, h.owner);
      obligations.push(obligation.id);
      previous.push(await h.json('/jobs', { clientId: client.id, templateId: prerequisite.id, periodStart: '2025-01-01', dueDate: '2026-12-31', dueNote: 'Recorded prior-work target', ...people }, h.owner));
      jobs.push(await h.json('/jobs', { clientId: client.id, templateId: template.id, obligationId: obligation.id, periodStart: '2025-01-01', ...people }, h.owner));
    }
    await h.json(`/jobs/${jobs[0].id}/deadline/extension`, {}, h.owner);
    await h.json(`/jobs/${jobs[1].id}/deadline/override`, { date: '2026-10-16', reason: 'Recorded working target; statutory source remains unchanged' }, h.owner);
    await h.json('/capacity/people', { email: people.preparerEmail, weeklyMinutes: 600, skills: ['1040'] }, h.owner);
    const leave = await h.json('/capacity/blocks', { email: people.preparerEmail, kind: 'leave', startsOn: week, endsOn: '2026-10-16', label: 'Recorded absence' }, h.owner);
    const door = ids => '/rescue-context?' + new URLSearchParams({ week, clients: ids.join(',') });
    const selectedDoor = door(clients.map(c => c.id));
    const read = (who = h.owner, expected = 200, extra = {}) => h.json(selectedDoor, undefined, who, expected, extra);
    await h.json('/rescue-context?week=' + week, undefined, h.owner, 400);
    await h.json('/rescue-context?' + new URLSearchParams({ week: '2026-10-13', clients: clients[0].id }), undefined, h.owner, 400);
    await h.json(door(Array.from({ length: 11 }, (_, n) => 'synthetic-blotter-' + n)), undefined, h.owner, 400);
    const before = await backup(h), mails = h.mails.length, ai = h.aiCalls.length;
    const view = await read();
    assert.deepEqual(view.clientIds, clients.map(c => c.id).sort());
    assert.equal(view.jobs.length, 2); assert.ok(!JSON.stringify(view).includes(excluded.id));
    const first = view.jobs.find(j => j.id === jobs[0].id), second = view.jobs.find(j => j.id === jobs[1].id);
    assert.deepEqual([first.dates.working, first.dates.statutory, first.dates.original, first.dates.extension.due, first.dates.extension.applies, first.dates.internal],
      ['2026-10-15', '2026-04-15', '2026-04-15', '2026-10-15', true, '2026-10-09']);
    assert.deepEqual([second.dates.working, second.dates.statutory, second.dates.original, second.dates.override, second.dates.extension.applies],
      ['2026-10-16', '2026-03-15', '2026-03-16', '2026-10-16', false]);
    assert.match(second.dates.shiftNote, /Sunday/);
    for (const [n, j] of [first, second].entries()) {
      const detail = await h.json('/jobs/' + j.id, undefined, h.owner);
      assert.equal(j.obligation.id, obligations[n]); assert.equal(j.obligation.ruleVersion, detail.deadline.rule_version);
      assert.equal(j.obligation.sourceUrl, detail.deadline.source_url); assert.equal(j.obligation.sourceTitle, detail.deadline.source_title);
      const raw = await h.request('/api/blotter' + j.obligation.href.replace('/api/blotter', ''), undefined, h.owner);
      assert.equal(raw.status, 200); assert.ok((await raw.json()).obligations.some(o => o.id === obligations[n] && o.rule.version === j.obligation.ruleVersion));
      assert.equal((await h.request(j.obligation.ruleHref, undefined, h.owner)).status, 200);
      assert.ok(j.risks.some(r => r.code === 'document' && r.requestId === detail.requests[0].id && r.requestHref === j.href));
      assert.ok(j.risks.some(r => r.code === 'dependency' && r.taskOrdinal === 2 && r.prerequisiteJobId === previous[n].id));
      assert.ok(j.risks.some(r => r.code === 'dependency' && /Waiting for task 1/.test(r.reason)));
      assert.ok(j.risks.some(r => r.code === 'dependency' && /Source records/.test(r.reason)));
      assert.ok(j.risks.some(r => r.code === 'leave' && r.blockId === leave.id && r.person === people.preparerEmail));
      assert.ok(j.risks.some(r => r.code === 'over_capacity')); assert.ok(j.risks.some(r => r.code === 'estimate'));
      assert.ok(j.risks.every(r => r.obligationId === obligations[n] && r.ruleVersion === j.obligation.ruleVersion));
      assert.deepEqual(j.tasks[1].dependencies.requests.map(r => [r.id, r.ordinal, r.href]), [[detail.requests[0].id, 1, j.href]]);
      assert.equal(j.tasks[1].dependencies.job.href, '/api/blotter/jobs/' + previous[n].id);
    }
    const p = view.people.find(p => p.email === people.preparerEmail);
    assert.deepEqual([p.weeklyMinutes, p.availableMinutes, p.leaveMinutes, p.demandMinutes, p.skills], [600, 0, 600, 240, ['1040']]);
    assert.match(view.coverage.ledger, /Unavailable/); assert.match(view.coverage.estimates, /unknown demand/); assert.match(view.coverage.plan, /not a source-complete feasible rescue plan/);
    assert.ok(second.risks.some(r => r.code === 'skills_unknown')); assert.ok(second.risks.some(r => r.code === 'capacity_default'));
    assert.deepEqual(sources(await backup(h)), sources(before)); assert.equal(h.mails.length, mails); assert.equal(h.aiCalls.length, ai);
    const audit = archiveRows(await backup(h)).filter(r => r.table === 'b_audit' && r.row.action === 'rescue.context_inspected');
    assert.ok(audit.length); assert.equal(audit.at(-1).row.actor, address('owner'));
    assert.deepEqual(JSON.parse(audit.at(-1).row.detail).clientIds, view.clientIds);
    assert.ok(!audit.at(-1).row.detail.includes('Source records'), 'Read attribution stores identifiers, not copied source payload');
    console.log('PROBE RESCUE-001 sources: selected two-client HTTP week -> exact obligation versions, distinct dates, request and dependency links, leave and demand risks; no product effects');
    await rescueContextJourney(h, clients, week);
    console.log('PROBE RESCUE-001 screen: built Capacity screen -> explicit selection, source links, risk and unknown labels, keyboard inspection; 1440 and 390 proof captured when requested');

    // Every read reflects current capacity, estimates and document state.
    await h.json('/capacity/blocks/' + leave.id + '/delete', {}, h.owner);
    await h.json('/capacity/people', { email: people.preparerEmail, weeklyMinutes: 1200, skills: ['1040', '1065'] }, h.owner);
    await h.json(`/jobs/${jobs[0].id}/estimates`, { ordinal: 1, minutes: 60 }, h.owner);
    await h.json(`/jobs/${jobs[0].id}/estimates`, { ordinal: 2, minutes: 30 }, h.owner);
    await h.json(`/jobs/${jobs[0].id}/estimates`, { review: true, minutes: 45 }, h.owner);
    const request = (await h.json('/jobs/' + jobs[0].id, undefined, h.owner)).requests[0];
    const file = await h.json(`/requests/${request.id}/files`, { name: 'synthetic-blotter-501.txt', mime: 'text/plain', contentBase64: Buffer.from('synthetic-blotter-501 source bytes').toString('base64') }, h.owner);
    let changed = (await read()).jobs.find(j => j.id === jobs[0].id);
    assert.equal(changed.requests[0].state, 'collected'); assert.match(changed.risks.find(r => r.code === 'document').reason, /human acceptance/);
    await h.json(`/requests/${request.id}/decide`, { decision: 'accept' }, h.owner);
    changed = (await read()).jobs.find(j => j.id === jobs[0].id);
    assert.equal(changed.requests.length, 0); assert.ok(!changed.risks.some(r => ['document', 'leave', 'over_capacity', 'estimate'].includes(r.code)));
    assert.equal(changed.tasks[0].estimateMinutes, 60); assert.ok(!changed.tasks[1].blockers.some(b => /Source records/.test(b)));
    const current = await read(), capacity = current.people.find(p => p.email === people.preparerEmail);
    assert.deepEqual([capacity.weeklyMinutes, capacity.availableMinutes, capacity.demandMinutes, capacity.skills], [1200, 1200, 180, ['1040', '1065']]);
    console.log('PROBE RESCUE-001 freshness: capacity, estimate, upload and acceptance HTTP changes -> next read reflects current facts without resolving task or job prerequisites');

    // No existing agent or integration capability can enter this person-only door.
    await read(staff.prep, 403); await read(staff.reviewer, 403);
    const key = await h.json('/keys', { label: 'synthetic-blotter-501' }, h.owner);
    await read('', 401, { authorization: 'Bearer ' + key.key });
    await h.json('/agent/rescue-context?' + new URLSearchParams({ week, clients: clients[0].id }), undefined, '', 404, { authorization: 'Bearer ' + key.key });
    const factors = await enroll(h, h.owner);
    const integration = await h.json('/integration-keys', { label: 'synthetic-blotter-502', reason: 'Read native metadata', clientIds: [clients[0].id], actions: ['work:read'] }, h.owner);
    await read('', 401, { authorization: 'Bearer ' + integration.key });
    await h.json(`/keys/${key.id}/revoke`, {}, h.owner); await read('', 401, { authorization: 'Bearer ' + key.key });
    const fresh = await h.login(address('owner'));
    assert.equal((await read(fresh, 403)).mfa, 'verify');
    await h.json('/mfa/verify', { recoveryCode: factors.recovery[0] }, fresh); await read(fresh);
    await h.send('/auth/signout', {}, fresh); await read(fresh, 401);
    await h.json('/team', { email: people.reviewerEmail, name: 'Departed reviewer', role: 'reviewer', active: false }, h.owner); await read(staff.reviewer, 401);
    console.log('PROBE RESCUE-001 authority: staff, agent and integration bearers, unconfirmed factor, signed-out and deactivated sessions -> refused; confirmed principal -> served');

    const lifecycle = async value => h.json(`/clients/${clients[1].id}/lifecycle`, { lifecycle: value, revision: (await h.json(`/clients/${clients[1].id}/detail`, undefined, h.owner)).revision }, h.owner);
    await lifecycle('archived'); await read(h.owner, 404); await lifecycle('active'); await read();
    const archive = await backup(h), restored = await harness(); copies.push(restored);
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    const restoredView = await restored.json(selectedDoor, undefined, restored.owner);
    assert.deepEqual(restoredView, await read()); assert.deepEqual(sources(await backup(restored)), sources(archive));
    console.log('PROBE RESCUE-001 portability: HTTP backup and fresh restore -> exact native source rows and live context equality; no persisted aggregate or authority created');
    await h.json(`/files/${file.id}/erase`, { confirm: 'synthetic-blotter-501.txt', reason: 'Source removed at client request' }, h.owner);
    await read(h.owner, 409);
    const latest = await backup(h), stale = await harness(); copies.push(stale);
    await stale.json('/restore', { archive, journal: latest, confirm: 'RESTORE' }, stale.owner, 409);
    console.log('PROBE RESCUE-001 erasure: archived client and erased document source -> refused; older archive with newer erasure journal -> stale restore refused');
  } finally { for (const copy of copies) await copy.close(); await h.close(); }
});
