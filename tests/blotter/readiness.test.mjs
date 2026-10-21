import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { readinessPortalJourney } from './readiness-ui.mjs';

const people = { preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' };
const bytes = Buffer.from('Native statement bytes; no ledger connection claimed').toString('base64');
async function setup(h) {
  for (const [email, role] of [[people.preparerEmail,'preparer'],[people.reviewerEmail,'reviewer'],['other@example.test','preparer'],['unassigned-reviewer@example.test','reviewer']]) {
    await h.json('/team', { email, name: email, role }, h.owner);
    await h.json('/team/invite', { email }, h.owner);
  }
  const prep = await h.login(people.preparerEmail), reviewer = await h.login(people.reviewerEmail), other = await h.login('other@example.test'), unassignedReviewer = await h.login('unassigned-reviewer@example.test');
  const client = await h.json('/clients', { name: 'Cedar Lane LLC', contactName: 'Alex Rivera', contactEmail: 'alex@example.test' }, h.owner);
  const template = await h.json('/templates', { name: 'Monthly bookkeeping', recurrence: 'monthly', tasks: [{ label: 'Review statement', when: { question: 'cash', equals: ['Yes','No'] } }], requests: 'Bank statement', questions: [{ key: 'cash', label: 'Any new bank accounts?', options: ['Yes','No'] }] }, h.owner);
  const start = (periodStart, extra = {}) => h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart, dueDate: '2027-04-15', dueNote: 'Recorded engagement date', ...people, ...extra }, h.owner);
  return { prep, reviewer, other, unassignedReviewer, client, template, start };
}
async function satisfy(h, jobId, prep) {
  const detail = await h.json('/jobs/' + jobId, undefined, prep);
  const file = await h.json(`/requests/${detail.requests[0].id}/files`, { name: 'Bank.txt', mime: 'text/plain', contentBase64: bytes }, prep);
  await h.json(`/requests/${detail.requests[0].id}/decide`, { decision: 'accept' }, prep);
  await h.json(`/jobs/${jobId}/steps`, { ordinal: 1, done: true }, prep);
  return file;
}
const prepare = (h, jobId, sourceKind, sourceId, cookie, extra = {}) => h.json(`/jobs/${jobId}/readiness/questions`, { sourceKind, sourceId }, cookie, 200, extra);
const decide = (h, jobId, qId, decision, cookie, expected = 200) => h.json(`/jobs/${jobId}/readiness/questions/${qId}/decide`, { decision, reason: 'Reviewed the cited evidence and current client response' }, cookie, expected);
const map = (h, jobId, cookie) => h.json(`/jobs/${jobId}/readiness`, undefined, cookie);

test('READY-001 / BASE-001: live native evidence map, prior answers, human-approved questions, received evidence and reviewer-only judgment without an agent verdict', async () => {
  const h = await harness(), copies = [];
  try {
    const s = await setup(h), prior = await s.start('2026-01-01');
    await h.json(`/jobs/${prior.id}/answers`, { key: 'cash', value: 'No' }, s.prep);
    await satisfy(h, prior.id, s.prep);
    let detail = await h.json(`/jobs/${prior.id}/submit`, {}, s.prep);
    await h.json(`/jobs/${prior.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Prior statement checked' }, s.reviewer);
    const current = await s.start('2026-02-01');
    await h.json(`/jobs/${current.id}/answers`, { key: 'cash', value: 'Yes' }, s.prep);
    let evidence = await map(h, current.id, s.prep);
    const requestId = evidence.documents[0].id;
    assert.equal(evidence.documents[0].state, 'missing');
    assert.equal(evidence.answers[0].state, 'judgment_required');
    assert.equal(evidence.answers[0].changed, true);
    assert.equal(evidence.answers[0].value, 'Yes');
    assert.equal(evidence.answers[0].previous.value, 'No');
    assert.equal(evidence.answers[0].previous.jobId, prior.id);
    assert.equal((await h.request(evidence.answers[0].previous.source, undefined, s.prep)).status, 200);
    assert.ok(evidence.documents[0].questionDraft.includes('Bank statement') && evidence.documents[0].questionDraft.includes('Feb 2026'));
    assert.match(evidence.coverage.ledger, /unavailable/);
    assert.match(evidence.coverage.signedScope, /unavailable/);
    assert.match(evidence.coverage.varianceAnalysis, /unavailable/);
    assert.match(evidence.coverage.interpretation, /not inferred contradictions/);
    const key = await h.json('/keys', { label: 'Readiness assistant' }, s.reviewer), auth = { authorization: 'Bearer ' + key.key };
    const before = await h.json('/jobs/' + current.id, undefined, s.prep), mailCount = h.mails.length;
    const q = await h.json(`/agent/jobs/${current.id}/readiness/questions`, { sourceKind: 'request', sourceId: requestId }, '', 200, auth);
    assert.equal((await h.json(`/agent/jobs/${current.id}/readiness/questions`, { sourceKind: 'request', sourceId: requestId }, '', 200, auth)).id, q.id);
    assert.equal(h.mails.length, mailCount, 'preparation never sends a message');
    assert.equal((await h.json('/jobs/' + current.id, undefined, s.prep)).portal.todos.length, before.portal.todos.length);
    assert.equal((await h.json('/jobs/' + current.id, undefined, s.prep)).job.revision, before.job.revision);
    await h.json(`/jobs/${current.id}/readiness/questions/${q.id}/decide`, { decision: 'approve', reason: 'Agent cannot decide' }, '', 401, auth);
    await decide(h, current.id, q.id, 'approve', s.prep);
    await decide(h, current.id, q.id, 'approve', s.prep, 409);
    evidence = await map(h, current.id, s.prep);
    assert.equal(evidence.questions[0].progress, 'awaiting_client');
    assert.equal(evidence.questions[0].decided_by, people.preparerEmail);
    const todoId = evidence.questions[0].todo_id;
    assert.equal((await h.json('/jobs/' + current.id, undefined, s.prep)).portal.todos.filter(t => t.id === todoId).length, 1);
    const rejected = await prepare(h, current.id, 'answer', 'cash', s.prep);
    await decide(h, current.id, rejected.id, 'decline', s.prep);
    assert.equal((await map(h, current.id, s.prep)).answers[0].state, 'judgment_required', 'declining an inference never resolves source judgment');
    const sent = await h.json(`/jobs/${current.id}/reminders`, {}, s.prep), token = new URL(sent.portalUrl).pathname.split('/').at(-1);
    const portal = await h.json(`/portal/${token}`, undefined);
    assert.ok(portal.todos.some(t => t.id === todoId));
    await readinessPortalJourney(h, token);
    let after = await map(h, current.id, s.prep);
    assert.equal(after.questions.find(q => q.id === rejected.id).status, 'declined');
    assert.equal(after.questions.find(x => x.id === q.id).progress, 'evidence_received_judgment_required');
    assert.equal(after.unresolvedJudgments, 1);
    assert.equal(after.documents[0].state, 'missing', 'a client response is not a document');
    const upload = await h.json(`/requests/${requestId}/files`, { name: 'Bank.txt', mime: 'text/plain', contentBase64: bytes }, s.prep);
    assert.equal((await map(h, current.id, s.prep)).documents[0].state, 'collected');
    await h.json(`/requests/${requestId}/decide`, { decision: 'accept' }, s.prep);
    assert.equal((await map(h, current.id, s.prep)).documents[0].state, 'validated');
    await h.json(`/jobs/${current.id}/steps`, { ordinal: 1, done: true }, s.prep);
    detail = await h.json(`/jobs/${current.id}/submit`, {}, s.prep);
    await h.json(`/jobs/${current.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Still needs readiness judgment' }, s.reviewer, 409);
    await decide(h, current.id, q.id, 'resolve', s.prep, 403);
    await decide(h, current.id, q.id, 'resolve', s.unassignedReviewer, 403);
    const archiveBefore = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const restored = await harness(); copies.push(restored);
    await restored.json('/restore', { archive: archiveBefore, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    const restoredMap = await map(restored, current.id, restored.owner);
    assert.deepEqual(restoredMap, await map(h, current.id, h.owner));
    assert.ok(!archiveBefore.includes(key.key));
    detail = await restored.json('/jobs/' + current.id, undefined, restored.owner);
    await restored.json(`/jobs/${current.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Restore must retain judgment gate' }, restored.owner, 409);
    await decide(h, current.id, q.id, 'resolve', s.reviewer);
    await decide(h, current.id, q.id, 'resolve', s.reviewer, 409);
    detail = await h.json('/jobs/' + current.id, undefined, s.prep);
    await h.json(`/jobs/${current.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Statement and new account evidence reviewed' }, s.reviewer);
    after = await map(h, current.id, s.prep);
    assert.equal(after.jobStatus, 'signed_off');
    assert.equal(after.questions.find(x => x.id === q.id).resolved_by, people.reviewerEmail);
    assert.equal(after.unresolvedJudgments, 0);
    await h.json(`/files/${upload.id}/erase`, { confirm: 'Bank.txt', reason: 'Client requested removal' }, h.owner);
    assert.equal((await map(h, current.id, s.prep)).documents[0].state, 'missing', 'accepted metadata never hides erased bytes');
    const latest = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.ok(latest.includes('readiness.approve') && latest.includes('readiness.decline') && latest.includes('readiness.resolve'));
    const stale = await harness(); copies.push(stale);
    await stale.json('/restore', { archive: archiveBefore, journal: latest, confirm: 'RESTORE' }, stale.owner, 409);
    await h.json(`/keys/${key.id}/revoke`, {}, s.reviewer);
    await h.json(`/agent/jobs/${current.id}/readiness`, undefined, '', 401, auth);
  } finally { await h.close(); for (const copy of copies) await copy.close(); }
});

test('READY-001 / BASE-001: changed evidence refuses stale approval, no foreign sources or hidden prior-period records, revoked staff lose access', async () => {
  const h = await harness();
  try {
    const s = await setup(h);
    const hidden = await s.start('2026-01-01', { preparerEmail: 'other@example.test' });
    await h.json(`/jobs/${hidden.id}/answers`, { key: 'cash', value: 'No' }, s.other);
    const current = await s.start('2026-02-01');
    let evidence = await map(h, current.id, s.prep);
    assert.equal(evidence.prior, null);
    assert.equal(evidence.answers[0].previous, null);
    assert.equal(evidence.answers[0].changed, null);
    await h.json(`/jobs/${current.id}/readiness`, undefined, s.other, 404);
    const foreignId = (await map(h, hidden.id, s.other)).documents[0].id;
    await h.json(`/jobs/${current.id}/readiness/questions`, { sourceKind: 'request', sourceId: foreignId }, s.prep, 404);
    const q = await prepare(h, current.id, 'request', evidence.documents[0].id, s.prep);
    await h.json(`/requests/${evidence.documents[0].id}/files`, { name: 'Bank.txt', mime: 'text/plain', contentBase64: bytes }, s.prep);
    await decide(h, current.id, q.id, 'approve', s.prep, 409);
    assert.equal((await h.json('/jobs/' + current.id, undefined, s.prep)).portal.todos.length, 0);
    await decide(h, current.id, q.id, 'decline', s.prep);
    const fresh = await prepare(h, current.id, 'request', evidence.documents[0].id, s.prep);
    assert.notEqual(fresh.id, q.id);
    const answer = await prepare(h, current.id, 'answer', 'cash', s.prep);
    await h.json(`/jobs/${current.id}/answers`, { key: 'cash', value: 'Yes' }, s.prep);
    await decide(h, current.id, answer.id, 'approve', s.prep, 409);
    await h.json('/team', { email: people.preparerEmail, name: 'Departed', role: 'preparer', active: false }, h.owner);
    await h.json(`/jobs/${current.id}/readiness`, undefined, s.prep, 401);
    evidence = await map(h, current.id, h.owner);
    assert.equal(evidence.questions.find(x => x.id === fresh.id).status, 'pending');
    assert.equal(evidence.unresolvedJudgments, 0);
  } finally { await h.close(); }
});
