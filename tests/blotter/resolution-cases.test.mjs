import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { harness } from './harness.mjs';
import { enroll } from './erasure-fixture.mjs';
import { address, contact, definition, setup, answer, portal, tokenOf, save } from './organizers-fixture.mjs';
import { resolutionStaffJourney, resolutionPhoneJourney } from './resolution-cases-ui.mjs';

const collection = { ...definition, name: '433-A financial information', kind: 'tax', collectionForm: '433-A', questions: definition.questions.map(q => ({ ...q,
  label: { ownership: 'Self-employed during this period?', owners: 'Business income and expenses', bookkeeping: 'Household income and living expenses' }[q.key],
  ...(q.key === 'owners' ? { request: 'Business income support' } : {}) })) };
const fixture = h => setup(h, { definition: collection, templateName: 'Resolution collection work' });
const casePath = job => `/jobs/${job.id}/resolution-case`;
const review = organizer => ({ organizerId: organizer.id, revision: organizer.revision, version: organizer.definition.version, reviewed: true });
const current = async (h, job) => (await h.json(`/jobs/${job.id}/organizers`, undefined, h.owner)).organizers[0];
const create = (h, job, organizer) => h.json(casePath(job), review(organizer), h.owner);
async function invite(h, s, job = s.job) {
  const organizer = await current(h, job);
  const sent = await h.json(`/jobs/${job.id}/organizers/send`, { revision: organizer.revision, assignments: s.assignments }, s.prep);
  return { a: tokenOf(sent.recipients.find(r => r.contactId === s.a.id)), b: tokenOf(sent.recipients.find(r => r.contactId === s.b.id)) };
}
async function complete(h, s, tokens) {
  let own = (await h.json(portal(tokens.a))).organizers[0];
  own = await save(h, tokens.a, own, { ownership: answer('No') }, true);
  let other = (await h.json(portal(tokens.b))).organizers[0];
  await save(h, tokens.b, other, { bookkeeping: answer('synthetic-blotter-433 household information') }, true);
}
async function signoff(h, s) {
  let detail = await h.json(`/jobs/${s.job.id}`, undefined, s.prep);
  for (const r of detail.requests.filter(r => r.organizer_active)) {
    if (!r.files.length) await h.json(`/requests/${r.id}/files`, { name: 'synthetic-blotter-433.txt', mime: 'text/plain', contentBase64: Buffer.from('synthetic-blotter-433 retained original').toString('base64') }, s.prep);
    await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, s.prep);
  }
  for (const step of detail.steps.filter(step => step.state === 'ready')) await h.json(`/jobs/${s.job.id}/steps`, { ordinal: step.ordinal, done: true }, s.prep);
  detail = await h.json(`/jobs/${s.job.id}`, undefined, s.prep);
  detail = await h.json(`/jobs/${s.job.id}/submit`, { revision: detail.job.revision }, s.prep);
  await h.json(`/jobs/${s.job.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Practitioner inspected the collected information' }, s.reviewer);
}

test('Reviewed 433-A collection on a native case preserves two-contact responsibility, phone resume, exact evidence and attributed corrected originals without inferring a resolution', async () => {
  const h = await harness();
  try {
    const s = await fixture(h), path = casePath(s.job), body = review(s.organizer);
    await h.json(`/jobs/${s.job.id}/organizers/send`, { revision: s.organizer.revision, assignments: s.assignments }, h.owner, 409);
    await h.json(path, { ...body, reviewed: false }, h.owner, 400);
    await h.json(path, { ...body, revision: 'stale' }, h.owner, 409);
    await h.json(path, body, s.prep, 403); await h.json(path, body, s.outside, 403); await h.json(path, undefined, s.outside, 404);
    await resolutionStaffJourney(h, s, 'create');
    const initial = await h.json(path, undefined, h.owner);
    assert.equal(initial.case.organizer_id, s.organizer.id); assert.equal(initial.case.job_id, s.job.id);
    assert.equal(initial.case.reviewed_by, address('owner')); assert.equal(initial.case.definition_version, 1);
    await h.json(path, body, h.owner, 409);
    const tokens = await invite(h, s);
    let own = (await h.json(portal(tokens.a))).organizers[0], other = (await h.json(portal(tokens.b))).organizers[0];
    assert.deepEqual(own.questions.map(q => q.key), ['ownership']); assert.deepEqual(other.questions.map(q => q.key), ['bookkeeping']);
    await save(h, tokens.a, own, { owners: answer('Hidden required section') }, false, 409);
    await save(h, tokens.b, other, { ownership: answer('Yes') }, false, 403);
    own = await save(h, tokens.a, own, { ownership: answer('Yes') });
    await save(h, tokens.a, own, {}, true, 409);
    assert.deepEqual((await h.json(path, undefined, h.owner)).answers, {}, 'Drafts never become case facts');
    assert.equal((await h.json(`/jobs/${s.job.id}`, undefined, s.prep)).answers[0].value, null);
    own = await save(h, tokens.a, own, { ownership: answer('No') });
    await resolutionPhoneJourney(h, s, tokens.a);
    other = (await h.json(portal(tokens.b))).organizers[0];
    await save(h, tokens.b, other, { bookkeeping: answer('Household monthly income 4800 and expenses 3600') }, true);
    let view = await h.json(path, undefined, s.reviewer);
    assert.deepEqual(view.organizer.completeness.unresolved, []);
    assert.equal(view.answers.owners.value, 'Corrected monthly business profit 2400');
    assert.equal(view.organizer.submissions[0].answers.owners.value, 'Monthly business profit 2200');
    assert.equal(view.organizer.submissions[1].answers.owners.value, 'Corrected monthly business profit 2400');
    const bytes = Buffer.from('synthetic-blotter-433 original supporting bytes');
    assert.equal(view.files.length, 1); assert.equal(view.files[0].sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(Buffer.from(await (await h.request('/api/blotter/files/' + view.files[0].id, undefined, s.prep)).arrayBuffer()), bytes);
    await h.json(`/portal/${tokens.b}/requests/${view.organizer.requests[0].id}`, { name: 'foreign.txt', contentBase64: bytes.toString('base64') }, undefined, 404);
    const mailCount = h.mails.length;
    await resolutionStaffJourney(h, s, 'review');
    view = await h.json(path, undefined, s.reviewer);
    assert.equal(view.organizer.submissions[0].reviewed_by, address('owner'));
    assert.ok(view.organizer.submissions[0].reviewed_at);
    assert.equal(view.transcriptContext, 'unavailable'); assert.match(view.resolutionDecision, /Practitioner decision required/);
    assert.equal(h.mails.length, mailCount, 'Case inspection and review send nothing');
    assert.equal((await h.json(`/jobs/${s.job.id}`, undefined, s.prep)).answers[0].value, 'Yes');
    const history = await h.json(`/clients/${s.client.id}/history`, undefined, h.owner);
    assert.equal(history.history.filter(e => e.action === 'resolution.case_created' && e.actor === address('owner')).length, 1);
    const nextDefinition = { ...collection, version: 2, questions: collection.questions.map(q => q.key === 'bookkeeping' ? { ...q, label: 'Revised household information' } : q) };
    await h.json(`/templates/${s.template.id}/organizer`, { expectedVersion: 1, organizer: nextDefinition }, s.reviewer);
    assert.equal((await h.json(path, undefined, h.owner)).organizer.definition.version, 1, 'A published revision cannot rewrite the reviewed job snapshot');
    const next = await s.start('2026-02-01'), nextOrganizer = await current(h, next);
    await create(h, next, nextOrganizer); const nextTokens = await invite(h, s, next);
    let carried = (await h.json(portal(nextTokens.a))).organizers[0];
    assert.equal(carried.questions[0].value, 'Yes'); assert.equal(carried.questions[0].confirmed, false); assert.ok(carried.questions[0].carriedFrom);
    assert.deepEqual((await h.json(casePath(next), undefined, h.owner)).answers, {});
    await save(h, nextTokens.a, carried, {}, true, 409);
    assert.equal((await h.json(`/jobs/${next.id}`, undefined, s.prep)).answers[0].value, null);
    carried = await save(h, nextTokens.a, carried, { ownership: answer('No') });
    assert.deepEqual((await h.json(casePath(next), undefined, h.owner)).answers, {}, 'Even a confirmed draft does not choose a case fact');
    await save(h, nextTokens.a, carried, {}, true);
    assert.equal((await h.json(casePath(next), undefined, h.owner)).answers.ownership.value, 'No');
    assert.equal((await h.json(`/jobs/${next.id}`, undefined, s.prep)).answers[0].value, 'No');
  } finally { await h.close(); }
});

test('Case collection rechecks live contact and staff authority, isolates clients and erases drafts with a stale-restore fence', async () => {
  const h = await harness(); let restored;
  try {
    const s = await fixture(h), record = await create(h, s.job, s.organizer), tokens = await invite(h, s);
    const foreign = await h.json('/clients', { name: 'synthetic-blotter-434', contacts: [contact('Other contact', address('other'))] }, h.owner);
    const job = await h.json('/jobs', { clientId: foreign.id, templateId: s.template.id, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'Practitioner target', preparerEmail: address('reviewer'), reviewerEmail: address('owner') }, h.owner);
    await h.json(casePath(job), review(s.organizer), h.owner, 404);
    await h.json(casePath(job), undefined, s.prep, 404);
    const foreignOrganizer = await current(h, job); await create(h, job, foreignOrganizer);
    const sent = await h.json(`/jobs/${job.id}/organizers/send`, { revision: foreignOrganizer.revision, assignments: Object.fromEntries(collection.questions.map(q => [q.key, foreign.contacts[0].id])) }, h.owner);
    const foreignToken = tokenOf(sent.recipients[0]);
    await h.json(`${portal(foreignToken)}/${encodeURIComponent(s.organizer.id)}`, undefined, undefined, 404);
    const key = await h.json('/keys', { label: 'synthetic-blotter-433 preparation' }, h.owner), auth = { authorization: 'Bearer ' + key.key };
    await h.json(casePath(s.job), undefined, '', 401, auth); await h.json(casePath(s.job), review(s.organizer), '', 401, auth);
    await h.json('/access/people', { email: address('reviewer'), readOnly: false, clientIds: [s.client.id] }, h.owner);
    await h.json(casePath(s.job), undefined, s.reviewer);
    await h.json(casePath(job), undefined, s.reviewer, 404);
    await h.json('/access/people', { email: address('reviewer'), readOnly: false, clientIds: [] }, h.owner);
    await h.json(casePath(s.job), undefined, s.reviewer, 404);
    await h.json('/access/people', { email: address('reviewer'), readOnly: false, clientIds: [s.client.id] }, h.owner);
    const factor = await enroll(h, s.reviewer), unconfirmed = await h.login(address('reviewer'));
    assert.equal((await h.json(casePath(s.job), undefined, unconfirmed, 403)).mfa, 'verify');
    await h.json('/mfa/verify', { recoveryCode: factor.recovery[0] }, unconfirmed);
    await h.json(casePath(s.job), undefined, unconfirmed);
    await complete(h, s, tokens);
    const oldArchive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const before = await current(h, s.job);
    let own = (await h.json(portal(tokens.a))).organizers[0];
    const c = (await h.json(`/clients/${s.client.id}/contacts`, undefined, h.owner)).find(c => c.id === s.a.id);
    await h.json(`/clients/${s.client.id}/contacts`, { id: c.id, revision: c.revision, portal: false }, h.owner);
    await h.json(portal(tokens.a), undefined, undefined, 404);
    await save(h, tokens.a, own, { ownership: answer('Yes') }, true, 404);
    assert.deepEqual((await current(h, s.job)).submissions, before.submissions, 'Revocation cannot add or alter originals');
    await h.json('/team', { email: address('prep'), name: 'Revoked preparer', role: 'preparer', active: false }, h.owner);
    await h.json(casePath(s.job), undefined, s.prep, 401);
    await h.json(`/organizers/${s.organizer.id}/review`, { submissionId: before.submissions[0].id, note: 'Revoked attempt' }, s.prep, 401);
    const body = { revision: before.revision, confirm: before.definition.name, reason: 'Principal requested answer erasure' };
    await h.json(`/organizers/${s.organizer.id}/erase`, body, h.owner);
    const after = await h.json(casePath(s.job), undefined, h.owner);
    assert.deepEqual(after.answers, {}); assert.ok(after.organizer.submissions.every(s => s.answers === null));
    assert.deepEqual(after.case, record.case, 'Erasure preserves structural case links and review attribution');
    await h.json(casePath(s.job), review(s.organizer), h.owner, 409);
    await save(h, tokens.b, { id: s.organizer.id, revision: before.revision }, { bookkeeping: answer('Replay erased data') }, true, 404);
    const latest = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness(); await restored.json('/restore', { archive: oldArchive, journal: latest, confirm: 'RESTORE' }, restored.owner, 409);
    await restored.json('/restore', { archive: latest, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    const portable = await restored.json(casePath(s.job), undefined, restored.owner);
    assert.deepEqual(portable.case, record.case); assert.deepEqual(portable.answers, {});
    assert.ok(portable.organizer.erased_at); await restored.json(portal(tokens.b), undefined, undefined, 404);
  } finally { await restored?.close(); await h.close(); }
});

test('Resolution originals honor holds and signed-work custody through client erasure, portable case links and stale-restore refusal', async () => {
  const h = await harness(); let restored;
  try {
    const s = await fixture(h), record = await create(h, s.job, s.organizer), tokens = await invite(h, s);
    await complete(h, s, tokens);
    const before = await current(h, s.job);
    const hold = await h.json(`/clients/${s.client.id}/retention`, { scope: 'job', targetId: s.job.id, kind: 'hold', reason: 'Resolution evidence under review', owner: address('owner'), reviewDate: '2999-01-01' }, h.owner);
    const erase = { revision: before.revision, confirm: before.definition.name, reason: 'Try erasure' };
    assert.match((await h.json(`/organizers/${s.organizer.id}/erase`, erase, h.owner, 409)).error, /Resolution evidence under review/);
    assert.deepEqual((await current(h, s.job)).submissions, before.submissions);
    await h.json(`/retention/${hold.id}/release`, { reason: 'Review complete' }, h.owner);
    await signoff(h, s);
    assert.match((await h.json(`/organizers/${s.organizer.id}/erase`, erase, h.owner, 409)).error, /signed-off work retention/);
    const oldArchive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness(); await restored.json('/restore', { archive: oldArchive, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    const portable = await restored.json(casePath(s.job), undefined, restored.owner);
    assert.deepEqual(portable.case, record.case); assert.deepEqual(portable.organizer.submissions, (await current(h, s.job)).submissions);
    assert.equal(portable.answers.bookkeeping.value, 'synthetic-blotter-433 household information');
    await restored.json(portal(tokens.a), undefined, undefined, 404);
    await restored.close(); restored = undefined;
    await h.json(`/clients/${s.client.id}/lifecycle`, { lifecycle: 'archived', revision: (await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner)).revision }, h.owner);
    const preview = await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, h.owner);
    assert.deepEqual(preview.blockers, []);
    assert.ok(preview.retained.some(r => r.key === 'consumed_originals' && r.count === 2));
    const receipt = await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: s.client.name, reason: 'Verified client deletion request' }, h.owner);
    assert.ok(receipt.retained.exceptions.some(r => r.key === 'consumed_originals' && r.count === 2));
    const kept = await current(h, s.job);
    assert.deepEqual(kept.submissions, before.submissions, 'Both consumed originals survive whole-client erasure');
    const after = await h.json(casePath(s.job), undefined, h.owner);
    assert.deepEqual(after.case, record.case); assert.deepEqual(after.answers, {}); assert.equal(after.organizer, null); assert.equal(after.erased, true);
    assert.equal((await h.json(`/clients/${s.client.id}/retained-records`, { reason: 'Inspect retained resolution custody' }, h.owner)).records.some(r => r.id === s.job.id), true);
    const latest = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness(); await restored.json('/restore', { archive: oldArchive, journal: latest, confirm: 'RESTORE' }, restored.owner, 409);
    await restored.json('/restore', { archive: latest, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    assert.deepEqual((await restored.json(casePath(s.job), undefined, restored.owner)).case, record.case);
    assert.deepEqual((await current(restored, s.job)).submissions, before.submissions);
    await h.json(portal(tokens.b), undefined, undefined, 404);
  } finally { await restored?.close(); await h.close(); }
});
