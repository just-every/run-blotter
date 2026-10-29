// Native activity-suggestion journey moved intact from flows.test.mjs and extended
// with separate calendar consent. No registration is added to the test budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { enroll } from './erasure-fixture.mjs';
import { calendarConsentJourney } from './calendar-consent-ui.mjs';

const address = name => [name, 'example.test'].join(String.fromCharCode(64));
const prepEmail = address('preparer'), reviewerEmail = address('reviewer');
const door = '/time/calendar-consent';
const read = (h, cookie, status = 200) => h.json(door, undefined, cookie, status);
const input = (view, choice, requestId) => ({ staffId: view.staffId, source: view.source, wordingVersion: view.wordingVersion,
  reviewToken: view.reviewToken, lastId: view.lastId, requestId, choice });
const choice = (h, cookie, view, value, key, status = 200) => h.json(door, input(view, value, key), cookie, status);
const archiveRows = (archive, table) => archive.trim().split('\n').map(JSON.parse).flatMap(part => part.items ?? []).filter(item => item.table === table).map(item => item.row);
const member = (h, email, active = true) => h.json('/team', { email, name: email.split(String.fromCharCode(64))[0], role: email === reviewerEmail ? 'reviewer' : 'preparer', active }, h.owner);
const login = async (h, email) => { await h.json('/team/invite', { email }, h.owner); return h.login(email); };

test('TIME-001 activity suggestions: only consented actions suggest time with their sources; reject one, approve another, and only approved minutes reach WIP; nobody else sees or decides them; calendar consent is independent and restores inactive', async () => {
  const h = await harness();
  try {
    await h.json('/clients/fields', { key: 'service_tier', label: 'Service tier', type: 'choice', choices: 'Essentials, Plus, Premier', required: true }, h.owner);
    await member(h, prepEmail); await member(h, reviewerEmail);
    const preparer = await login(h, prepEmail), reviewer = await login(h, reviewerEmail);
    const template = await h.json('/templates', { name: 'Quarterly BAS', recurrence: 'quarterly', steps: 'Reconcile bank\nDraft BAS', requests: 'Bank statements\nSales invoices', feeCents: 33000 }, h.owner);

  const mill = await h.json('/clients', { name: 'Granite Mill Bakery', fields: { service_tier: 'Plus' } }, h.owner);
  await h.json('/team/rates', { scope: 'client', clientId: mill.id, rateCents: 12000, effectiveFrom: '2026-01-01' }, h.owner);
  const start = periodStart => h.json('/jobs', { clientId: mill.id, templateId: template.id, periodStart, dueDate: '2027-06-30', dueNote: 'Client calendar', preparerEmail: prepEmail, reviewerEmail: reviewerEmail }, h.owner);
  const early = await start('2026-01-01'), payroll = await start('2026-04-01'), sales = await start('2026-07-01');
  const discuss = (j, title) => h.json(`/jobs/${j.id}/threads`, { title, body: 'Working through this today.', mentions: [] }, preparer);
  const mine = async (who = preparer) => h.json('/time/suggestions', undefined, who);
  // Off by default: actions before consent never suggest time.
  await discuss(early, 'Before consent');
  assert.deepEqual(await mine(), { consentedAt: null, pending: [], decided: [] });
  await h.json('/time/suggestions/consent', { consent: 'yes' }, preparer, 400);
  await h.json('/time/suggestions/consent', { consent: true }, preparer);
  await h.json('/time/suggestions/consent', { consent: true }, preparer, 409);
  await h.json(`/jobs/${sales.id}/steps`, { ordinal: 1, done: true }, preparer);
  const opened = await discuss(payroll, 'Payroll split');
  await h.json(`/threads/${opened.thread.id}/messages`, { body: 'Split confirmed with the client.' }, preparer);
  await h.json(`/threads/${opened.thread.id}/messages`, { body: 'Thanks.' }, reviewer);
  let state = await mine();
  const shown = Object.fromEntries(state.pending.map(s => [s.job_id, s.sources.map(a => [a.action, a.detail]).sort()]));
  assert.deepEqual(shown, { [payroll.id]: [['thread.opened', 'Payroll split'], ['thread.replied', 'Payroll split']], [sales.id]: [['step.done', 'Reconcile bank']] });
  const [forSales, forPayroll] = [sales, payroll].map(j => state.pending.find(s => s.job_id === j.id));
  // Only the person sees and decides their suggestions.
  assert.deepEqual((await mine(reviewer)).pending, []);
  await h.json('/time/suggestions/decide', { jobId: sales.id, day: forSales.day, decision: 'reject' }, reviewer, 404);
  await h.json('/time/suggestions/decide', { jobId: sales.id, day: forSales.day, decision: 'reject' }, h.owner, 404);
  await h.json('/time/suggestions/decide', { jobId: sales.id, day: forSales.day, decision: 'reject', reason: 'A two-minute tick-off' }, preparer);
  await h.json('/time/suggestions/decide', { jobId: sales.id, day: forSales.day, decision: 'approve', minutes: 5, description: 'Late change of mind', billable: true }, preparer, 404);
  // Approval records nothing silently: it needs the minutes and an explicit billable choice.
  const approve = { jobId: payroll.id, day: forPayroll.day, decision: 'approve', minutes: 25, description: 'Payroll split query' };
  await h.json('/time/suggestions/decide', approve, preparer, 400);
  const approved = await h.json('/time/suggestions/decide', { ...approve, billable: true }, preparer);
  assert.deepEqual([approved.entry.date, approved.entry.minutes, approved.entry.amountCents, approved.entry.billable], [forPayroll.day, 25, 5000, true]);
  await h.json('/time/suggestions/decide', { ...approve, billable: true }, preparer, 404);
  state = await mine();
  assert.deepEqual(state.pending, []);
  assert.deepEqual(state.decided.map(d => [d.job_id, d.status, d.entry_id, JSON.parse(d.sources).length]), [[payroll.id, 'approved', approved.entry.id, 2], [sales.id, 'rejected', null, 1]]);
  await h.json(`/time/${approved.entry.id}/delete`, {}, reviewer, 403);
  // Only approved minutes enter WIP: the rejected suggestion recorded nothing, and the approved entry waits for timesheet approval.
  const wipFor = async j => (await h.json('/billing', undefined, reviewer)).unbilled.filter(l => l.job_id === j.id).map(l => [l.kind, l.minutes]);
  assert.deepEqual(await wipFor(payroll), []);
  const day = new Date(forPayroll.day + 'T00:00:00Z'), monday = new Date(day - ((day.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
  await h.json('/timesheets/submit', { weekStart: monday }, preparer);
  await h.json(`/time/${approved.entry.id}/review`, { decision: 'approve' }, reviewer);
  assert.deepEqual(await wipFor(payroll), [['time', 25]]);
  assert.deepEqual([await wipFor(sales), (await h.json('/jobs/' + sales.id, undefined, reviewer)).time], [[], []]);
  // Withdrawing consent removes pending suggestions; consenting again never revives earlier actions.
  await discuss(early, 'After consent');
  assert.deepEqual((await mine()).pending.map(s => s.job_id), [early.id]);
  await h.json('/time/suggestions/consent', { consent: false }, preparer);
  assert.deepEqual([(await mine()).consentedAt, (await mine()).pending], [null, []]);
  await h.json('/time/suggestions/consent', { consent: true }, preparer);
  assert.deepEqual((await mine()).pending, []);
    await calendarChoices(h, preparer, reviewer, mill);
  } finally { await h.close(); }
});

async function calendarChoices(h, preparer, reviewer, client) {
  const native = () => h.json('/time/suggestions', undefined, preparer), nativeBefore = await native();
  const tables = ['b_time','b_time_suggestions','b_capacity_blocks','b_invoices','b_provider_payments','b_integration_keys','b_integration_hooks','b_automation_attempts'];
  const effects = () => Promise.all(tables.map(table => h.db.prepare(`SELECT count(*) n FROM ${table}`).first().then(row => row.n)));
  const before = await effects(), mailCount = h.mails.length;
  let view = await read(h, preparer);
  assert.deepEqual([view.optedIn, view.connected, view.suggestionsAvailable, view.providerAccessGranted, view.history], [false,false,false,false,[]]);
  assert.equal(view.source, 'calendar');
  const wording = 'I allow my connected calendar events to be used for optional time suggestions. Private events must never be used, and no time may be recorded until I approve it. I can withdraw this choice at any time. Calendars are not connected and calendar suggestions remain unavailable. This choice grants no provider access and does not change my native work-action consent.';
  assert.equal(view.wording, wording, 'The personal choice records the full presented informed-consent wording');
  const shown = view, request = input(view, 'opt_in', 'synthetic-blotter-701');
  await read(h, '', 401); await h.json(door, request, '', 401);
  await h.json(door, { ...request, actor: prepEmail }, preparer, 400);
  await h.json(door, { ...request, wordingVersion: 'synthetic-blotter-702' }, preparer, 409);
  const other = await read(h, reviewer);
  await h.json(door, { ...request, staffId: other.staffId }, preparer, 403);
  await h.json(door, request, reviewer, 403);
  const key = await h.json('/keys', { label: 'Synthetic calendar exclusion' }, h.owner);
  await h.json(door, request, '', 401, { authorization: 'Bearer ' + key.key });
  assert.equal((await h.request('/api/blotter/agent/time/calendar-consent', request, '', { authorization: 'Bearer ' + key.key })).status, 404);
  view = await choice(h, preparer, view, 'decline', 'synthetic-blotter-703');
  assert.equal(view.optedIn, false); assert.equal(view.history[0].choice, 'decline');
  const optIn = input(view, 'opt_in', 'synthetic-blotter-704');
  const [one, two] = await Promise.all([h.json(door, optIn, preparer), h.json(door, optIn, preparer)]);
  assert.equal(one.lastId, two.lastId); assert.equal(one.history.length, 2);
  view = one; assert.equal(view.optedIn, true);
  const event = view.history[0];
  assert.deepEqual([event.staffId,event.personEmail,event.source,event.wordingVersion,event.wording,event.choice,event.actorId,event.actor],
    [shown.staffId,prepEmail,'calendar',shown.wordingVersion,wording,'opt_in',shown.staffId,prepEmail]);
  assert.ok(Number.isFinite(Date.parse(event.at)));
  const audit = (await h.json('/team', undefined, h.owner)).audit.filter(a => a.action === 'calendar.choice_recorded' && a.object_id === event.id);
  assert.equal(audit.length, 1); assert.equal(audit[0].actor, prepEmail); assert.match(audit[0].detail, /opt_in.*no provider access/);
  await h.json(door, { ...optIn, choice: 'withdraw' }, preparer, 409);
  await h.json(door, request, preparer, 409);
  view = await choice(h, preparer, view, 'withdraw', 'synthetic-blotter-705');
  assert.equal(view.optedIn, false); assert.equal(view.history[0].choice, 'withdraw');
  await h.json(door, optIn, preparer, 409);
  // Competing intentions based on one presentation cannot both commit.
  const race = await Promise.all(['opt_in','decline'].map((value, i) => h.request('/api/blotter'+door, input(view,value,`synthetic-blotter-70${6+i}`), preparer)));
  assert.deepEqual(race.map(r => r.status).sort(), [200,409]);
  const next = await read(h, preparer);
  assert.equal(next.history.length, 4);
  view = await choice(h, preparer, next, 'withdraw', 'synthetic-blotter-708');
  assert.equal((await read(h, reviewer)).history.length, 0);
  assert.equal((await h.json(door+'?staffId='+shown.staffId, undefined, reviewer)).staffId, other.staffId, 'A query cannot inspect another person');
  await calendarConsentJourney(h, preparer);
  assert.deepEqual(await native(), nativeBefore, 'Calendar choices do not change native consent, sources or decisions');
  assert.deepEqual(await effects(), before, 'No calendar commitment, suggestion, time, billing or connector effect is created');
  assert.equal(h.mails.length, mailCount, 'The provider edge receives no consent request');
  await h.json('/time/suggestions/consent', { consent: false }, preparer);
  const calendarBefore = await read(h, preparer);
  await h.json('/time/suggestions/consent', { consent: true }, preparer);
  assert.deepEqual(await read(h, preparer), calendarBefore, 'Changing native consent never changes the separate calendar history');
  await calendarLifecycle(h, preparer, reviewer, client);
}

async function calendarLifecycle(h, preparer, reviewer, client) {
  const original = await read(h, preparer), pending = input(original, 'opt_in', 'synthetic-blotter-711');
  await member(h, prepEmail, false);
  await read(h, preparer, 401); await h.json(door, pending, preparer, 401);
  await member(h, prepEmail);
  await read(h, preparer, 401);
  let fresh = await h.login(prepEmail), view = await read(h, fresh);
  assert.equal(view.optedIn, false); assert.ok(view.history.every(event => event.invalidatedAt));
  await h.json(door, pending, fresh, 409);
  view = await choice(h, fresh, view, 'opt_in', 'synthetic-blotter-712');
  const successor = address('synthetic-blotter-713'); await member(h, successor); const successorSession = await login(h, successor);
  const offboard = { email: prepEmail, workSuccessor: successor, reviewSuccessor: reviewerEmail };
  const preview = await h.json('/team/offboard/preview', offboard, h.owner);
  assert.deepEqual(preview.problems, []);
  await h.json('/team/offboard', { ...offboard, fingerprint: preview.fingerprint }, h.owner);
  await read(h, fresh, 401);
  assert.deepEqual((await read(h, successorSession)).history, [], 'The successor receives no personal choice history or consent');
  await member(h, prepEmail); fresh = await h.login(prepEmail);
  let after = await read(h, fresh); assert.equal(after.optedIn, false);
  assert.deepEqual(after.history.map(event => [event.id,event.staffId,event.choice,event.actor,event.at]), view.history.map(event => [event.id,event.staffId,event.choice,event.actor,event.at]));
  await h.json(door, pending, fresh, 409);
  const factor = await enroll(h, fresh), newSession = await h.login(prepEmail);
  assert.equal((await read(h, newSession, 403)).mfa, 'verify');
  await h.json(door, input(after,'opt_in','synthetic-blotter-714'), newSession, 403);
  await h.json('/mfa/verify', { recoveryCode: factor.recovery[0] }, newSession);
  after = await choice(h, newSession, await read(h,newSession), 'opt_in', 'synthetic-blotter-715');
  await enroll(h, h.owner);
  await h.json('/team/mfa-policy', { required: true }, h.owner);
  assert.equal((await read(h, successorSession, 403)).mfa, 'enroll');
  await h.json(door, input(await read(h, newSession),'withdraw','synthetic-blotter-716'), successorSession, 403);
  await h.json('/team/mfa-policy', { required: false }, h.owner);
  const stillUnverified = await h.login(prepEmail);
  assert.equal((await read(h, stillUnverified, 403)).mfa, 'verify', 'Enrolled staff still owe a factor when firm policy is optional');
  const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
  const carried = archiveRows(archive, 'b_calendar_consents');
  assert.equal(carried.length, after.history.length); assert.ok(carried.every(event => event.restored === 1));
  const byId = entries => entries.sort((a,b) => a[0].localeCompare(b[0]));
  assert.deepEqual(byId(carried.map(e => [e.id,e.staff_id,e.person_email,e.source,e.wording,e.choice,e.actor_id,e.actor,e.at])),
    byId(after.history.map(e => [e.id,e.staffId,e.personEmail,e.source,e.wording,e.choice,e.actorId,e.actor,e.at])));
  const restored = await harness();
  try {
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    await read(restored, newSession, 401);
    const restoredSession = await login(restored, prepEmail), history = await read(restored, restoredSession);
    assert.equal(history.optedIn, false); assert.ok(history.history.every(e => e.historical));
    assert.notEqual(history.staffId, after.staffId, 'Fresh installation enrollment has its own immutable staff identity');
    assert.deepEqual(history.history, after.history.map(e => ({ ...e, historical: true })));
    await restored.json(door, input(after,'opt_in','synthetic-blotter-715'), restoredSession, 403);
    await restored.json(door, { ...input(original,'opt_in','synthetic-blotter-711'), staffId: history.staffId }, restoredSession, 409);
    assert.equal((await read(restored, restoredSession)).optedIn, false);
    const chosen = await choice(restored, restoredSession, history, 'opt_in', 'synthetic-blotter-717');
    assert.equal(chosen.optedIn, true); assert.equal(chosen.history[0].staffId, history.staffId);
  } finally { await restored.close(); }
  // A real preview discovers every stored class and refuses unclassified records.
  const erasure = await h.json(`/clients/${client.id}/erasure/preview`, undefined, h.owner);
  assert.ok(erasure.classes.length > 0);
  await h.json('/access/people', { email: prepEmail, clientIds: [client.id], readOnly: false, reason: 'Personal calendar choice stays independent of client scope' }, h.owner);
  assert.equal((await read(h, newSession)).optedIn, true);
  await h.json('/access/people', { email: prepEmail, clientIds: [client.id], readOnly: true, reason: 'Read-only source choice' }, h.owner);
  await h.json(door, input(await read(h,newSession),'withdraw','synthetic-blotter-718'), newSession, 403);
  await h.json('/access/people', { email: prepEmail, clientIds: [client.id], readOnly: false, reason: 'Restore writable personal choice' }, h.owner);
  await h.request('/auth/signout', {}, newSession);
  await read(h, newSession, 401); await h.json(door, pending, newSession, 401);
}
