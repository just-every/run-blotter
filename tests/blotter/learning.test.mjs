import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

const correction = 'Reconcile the merchant deposits before review';
const content = Buffer.from('Retained original merchant statement').toString('base64');
const people = { preparerEmail: 'prep@example.test', reviewerEmail: 'reviewer@example.test' };
const organizer = { name: 'Merchant close questions', kind: 'bookkeeping', questions: [
  { key: 'merchant', label: 'Were merchant deposits reconciled?', type: 'text', required: false },
] };

async function setup(h) {
  for (const [email, role] of [['prep@example.test','preparer'],['reviewer@example.test','reviewer'],['other@example.test','preparer']]) {
    await h.json('/team', { email, name: email, role }, h.owner);
    await h.json('/team/invite', { email }, h.owner);
  }
  const prep = await h.login(people.preparerEmail), reviewer = await h.login(people.reviewerEmail), outside = await h.login('other@example.test');
  const client = await h.json('/clients', { name: 'Cedar Lane LLC', contactName: 'Alex Rivera', contactEmail: 'alex@example.test' }, h.owner);
  const other = await h.json('/clients', { name: 'Maple Books LLC' }, h.owner);
  const template = await h.json('/templates', { name: 'Monthly bookkeeping', recurrence: 'monthly', steps: 'Prepare close', requests: 'Merchant statement' }, h.owner);
  const start = (clientId, periodStart) => h.json('/jobs', { clientId, templateId: template.id, periodStart, dueDate: '2027-04-15', dueNote: 'Recorded engagement target', ...people }, h.owner);
  return { prep, reviewer, outside, client, other, template, start };
}

async function complete(h, s, id, { returned = false, question = false } = {}) {
  let detail = await h.json('/jobs/' + id, undefined, s.prep);
  if (question) {
    const sent = await h.json(`/jobs/${id}/reminders`, {}, s.prep);
    const token = new URL(sent.portalUrl).pathname.split('/').at(-1);
    const q = await h.json(`/portal/${token}/messages`, { body: 'Which merchant statement should I upload?' });
    await h.json(`/jobs/${id}/portal/messages`, { body: 'Upload the period-end statement.', replyTo: q.id }, s.prep);
  }
  const files = [];
  for (const r of detail.requests.filter(r => r.organizer_active)) {
    const file = await h.json(`/requests/${r.id}/files`, { name: 'Merchant.txt', mime: 'text/plain', contentBase64: content }, s.prep);
    files.push(file);
    if (returned) {
      await h.json(`/requests/${r.id}/decide`, { decision: 'return', note: 'Period-end merchant statement is missing' }, s.prep);
      await h.json(`/requests/${r.id}/files`, { name: 'Corrected.txt', mime: 'text/plain', contentBase64: content }, s.prep);
    }
    await h.json(`/requests/${r.id}/decide`, { decision: 'accept' }, s.prep);
  }
  for (const step of detail.steps) await h.json(`/jobs/${id}/steps`, { ordinal: step.ordinal, done: true }, s.prep);
  const submit = async () => h.json(`/jobs/${id}/submit`, { revision: (await h.json('/jobs/' + id, undefined, s.prep)).job.revision }, s.prep);
  detail = await submit();
  if (returned) {
    await h.json(`/jobs/${id}/review`, { revision: detail.job.revision, decision: 'return', note: correction }, s.reviewer);
    detail = await submit();
  }
  await h.json(`/jobs/${id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Merchant reconciliation checked' }, s.reviewer);
  return files;
}

test('LEARN-002 / BASE-001: source-linked repeated review learning, selected-client versions, next-period outcomes, rejection, authority, erasure and portable history', async () => {
  const h = await harness(), copies = [];
  try {
    const s = await setup(h);
    const jan = await s.start(s.client.id, '2026-01-01'), feb = await s.start(s.client.id, '2026-02-01');
    const files = await complete(h, s, jan.id, { returned: true, question: true });
    await complete(h, s, feb.id, { returned: true, question: true });
    const historyBefore = await Promise.all([jan.id, feb.id].map(id => h.json('/jobs/' + id, undefined, h.owner)));
    const originalTemplate = (await h.json('/state', undefined, h.owner)).templates.find(t => t.id === s.template.id);
    const key = await h.json('/keys', { label: 'Review learning assistant' }, h.owner), auth = { authorization: 'Bearer ' + key.key };
    const source = { jobIds: [jan.id, feb.id] };
    const evidence = await h.json('/agent/learning/evidence', source, '', 200, auth);
    assert.equal(evidence.patterns.reviewerCorrections.length, 1);
    assert.equal(evidence.patterns.clientQuestions.length, 1);
    assert.equal(evidence.patterns.missingDocuments.length, 1);
    assert.ok(evidence.jobs.every(j => j.metrics.reviewReturns === 1 && j.metrics.questions === 1 && j.metrics.missingDocuments === 1));
    const supportingRefs = evidence.jobs.flatMap(j => [
      ...j.corrections.map(r => ({ kind: 'review_return', id: r.id })),
      ...j.portalQuestions.map(r => ({ kind: 'portal_question', id: r.id })),
      ...j.requests.map(r => ({ kind: 'missing_request', id: r.id })),
    ]);
    const proposal = { ...source, clientIds: [s.client.id], title: 'Ask for reconciliation before preparing the close',
      expectedBenefit: 'Fewer reviewer returns and repeated merchant questions in the next monthly close',
      exceptions: 'A new payment processor still needs practitioner judgment', assumptions: 'Comparable monthly merchant activity; compare the next signed-off period',
      improvement: { steps: ['Collect and reconcile merchant deposits', 'Prepare close'], requests: ['Period-end merchant statement and reconciliation'], organizer }, supportingRefs };
    await h.json('/learning/evidence', source, s.outside, 403);
    await h.json('/learning/evidence', source, s.reviewer, 403);
    await h.json('/learning', proposal, s.prep, 403);
    await h.json('/agent/prepare-learning', { ...proposal, supportingRefs: [{ kind: 'review_return', id: 'invented' }, supportingRefs[0]] }, '', 400, auth);
    const first = await h.json('/agent/prepare-learning', proposal, '', 200, auth);
    await h.json(`/learning/${first.id}/decide`, { decision: 'approve' }, '', 401, auth);
    await h.json(`/learning/${first.id}`, undefined, s.outside, 403);
    await h.json(`/learning/${first.id}/decide`, { decision: 'approve' }, s.reviewer, 403);
    let detail = await h.json(`/learning/${first.id}`, undefined, h.owner);
    assert.equal(detail.status, 'pending');
    assert.deepEqual([detail.proposal.expectedBenefit, detail.proposal.exceptions, detail.proposal.assumptions], [proposal.expectedBenefit, proposal.exceptions, proposal.assumptions]);
    assert.equal(detail.proposal.preparedChannel, 'agent');
    assert.equal(detail.proposal.agentLabel, 'Review learning assistant');
    assert.ok(detail.evidence.jobs.every(j => j.corrections.some(c => c.note === correction)));
    assert.deepEqual((await h.json('/state', undefined, h.owner)).templates.find(t => t.id === s.template.id), originalTemplate, 'preparing changes no template');
    await h.json(`/learning/${first.id}/decide`, { decision: 'approve', reason: 'Apply only to Cedar Lane next periods' }, h.owner);
    await h.json(`/learning/${first.id}/decide`, { decision: 'approve', reason: 'Duplicate' }, h.owner, 409);
    detail = await h.json(`/learning/${first.id}`, undefined, h.owner);
    assert.equal(detail.comparison.clients[0].status, 'pending');
    assert.equal(detail.proposal.decidedBy, 'owner@example.test');
    assert.equal(detail.version.approved_by, 'owner@example.test');
    assert.deepEqual(JSON.parse(detail.version.snapshot.steps), proposal.improvement.steps);
    assert.deepEqual(JSON.parse(detail.version.snapshot.requests), proposal.improvement.requests);
    const march = await h.json(`/jobs/${feb.id}/roll-forward`, { dueDate: '2026-04-15', dueNote: 'Recorded engagement target' }, h.owner);
    const improved = await h.json('/jobs/' + march.id, undefined, s.prep);
    assert.deepEqual(improved.steps.map(t => t.label), proposal.improvement.steps);
    assert.deepEqual(improved.requests.map(r => r.label), proposal.improvement.requests);
    assert.equal((await h.json(`/jobs/${march.id}/organizers`, undefined, h.owner)).organizers[0].definition.questions[0].label, organizer.questions[0].label);
    const untouched = await s.start(s.other.id, '2026-03-01');
    assert.deepEqual((await h.json('/jobs/' + untouched.id, undefined, s.prep)).steps.map(t => t.label), ['Prepare close']);
    assert.equal((await h.json(`/learning/${first.id}`, undefined, h.owner)).comparison.clients[0].status, 'provisional');
    await complete(h, s, march.id);
    detail = await h.json(`/learning/${first.id}`, undefined, h.owner);
    assert.equal(detail.comparison.status, 'complete');
    assert.deepEqual(detail.comparison.clients[0].baseline, { reviewReturns: 1, questions: 1, missingDocuments: 1 });
    assert.deepEqual(detail.comparison.clients[0].outcome, { reviewReturns: 0, questions: 0, missingDocuments: 0 });
    assert.deepEqual(detail.comparison.clients[0].delta, { reviewReturns: -1, questions: -1, missingDocuments: -1 });
    assert.equal(detail.comparison.assumptions, proposal.assumptions);
    const rejected = await h.json('/agent/prepare-learning', { ...proposal, improvement: { steps: ['Rejected replacement'], requests: ['Rejected request'] } }, '', 200, auth);
    await h.json(`/learning/${rejected.id}/decide`, { decision: 'decline', reason: 'Keep the approved reconciliation change' }, h.owner);
    const april = await h.json(`/jobs/${march.id}/roll-forward`, { dueDate: '2026-05-15', dueNote: 'Recorded target' }, h.owner);
    assert.deepEqual((await h.json('/jobs/' + april.id, undefined, s.prep)).steps.map(t => t.label), proposal.improvement.steps);
    for (const [index, id] of [jan.id, feb.id].entries()) {
      const after = await h.json('/jobs/' + id, undefined, h.owner);
      for (const field of ['job', 'steps', 'requests']) assert.deepEqual(after[field], historyBefore[index][field], 'signed-off ' + field + ' stays exact');
    }
    assert.deepEqual((await h.json('/state', undefined, h.owner)).templates.find(t => t.id === s.template.id), originalTemplate, 'the firm template and other clients stay unchanged');
    // Recurrence and bulk scheduling enter the same approved-definition door.
    await h.json('/rules', { clientId: s.client.id, templateId: s.template.id, firstPeriod: '2026-06-01', endPeriod: '2026-06-01', dueDays: 15, dueNote: 'Recorded engagement target', ...people }, h.owner);
    await h.scheduled('2026-06-01T17:00:00Z');
    await h.scheduled('2026-06-01T17:00:00Z');
    const generated = (await h.json('/state', undefined, h.owner)).jobs.filter(j => j.client_id === s.client.id && j.period_start === '2026-06-01');
    assert.equal(generated.length, 1);
    assert.deepEqual((await h.json('/jobs/' + generated[0].id, undefined, h.owner)).steps.map(t => t.label), proposal.improvement.steps);
    const batch = { templateId: s.template.id, periodStart: '2026-07-01', dueDate: '2026-08-15', dueNote: 'Recorded engagement target', ...people, clients: [{ clientId: s.client.id }, { clientId: s.other.id }] };
    const preview = await h.json('/bulk/schedule/preview', batch, h.owner);
    const applied = await h.json('/bulk/schedule', { ...batch, fingerprint: preview.fingerprint }, h.owner);
    for (const row of applied.created) assert.deepEqual((await h.json('/jobs/' + row.jobId, undefined, h.owner)).steps.map(t => t.label), row.clientId === s.client.id ? proposal.improvement.steps : ['Prepare close']);
    const stalePreparation = await h.json('/agent/prepare-learning', { ...proposal, title: 'Stale source erasure case' }, '', 200, auth);
    await h.json(`/keys/${key.id}/revoke`, {}, h.owner);
    await h.json('/agent/learning/evidence', source, '', 401, auth);
    await h.json(`/agent/learning/${first.id}`, undefined, '', 401, auth);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    assert.ok(!archive.includes(key.key));
    const restored = await harness(); copies.push(restored);
    await restored.json('/restore', { archive, confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    assert.deepEqual(await restored.json(`/learning/${first.id}`, undefined, restored.owner), detail);
    assert.equal((await restored.json(`/learning/${rejected.id}`, undefined, restored.owner)).status, 'declined');
    const may = await restored.json('/jobs', { clientId: s.client.id, templateId: s.template.id, periodStart: '2026-05-01', dueDate: '2026-06-15', dueNote: 'Restored work target', ...people }, restored.owner);
    assert.deepEqual((await restored.json('/jobs/' + may.id, undefined, restored.owner)).steps.map(t => t.label), proposal.improvement.steps);
    await h.json(`/files/${files[0].id}/erase`, { confirm: 'Merchant.txt', reason: 'Client requested erasure' }, h.owner);
    await h.json('/files/' + files[0].id, undefined, h.owner, 404);
    await h.json(`/learning/${stalePreparation.id}/decide`, { decision: 'approve', reason: 'Source changed after preparation' }, h.owner, 409);
    const erased = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const stale = await harness(); copies.push(stale);
    await stale.json('/restore', { archive, journal: erased, confirm: 'RESTORE' }, stale.owner, 409);
    const final = await h.json(`/learning/${first.id}`, undefined, h.owner);
    assert.ok(!JSON.stringify(final).includes(content), 'learning retains source refs, never file-byte copies');
    const auditArchive = erased.split('\n').filter(Boolean).map(line => JSON.parse(line));
    const allRows = JSON.stringify(auditArchive);
    assert.ok(allRows.includes('learning.approved') && allRows.includes('learning.declined') && allRows.includes('Review learning assistant'));
    const duplicate = await h.json('/clients', { name: 'Cedar Lane LLC' }, h.owner);
    const compared = await h.json(`/clients/compare?a=${duplicate.id}&b=${s.client.id}`, undefined, h.owner);
    const keep = Object.fromEntries(compared.fields.filter(f => !f.same && f.key !== 'source').map(f => [f.key, 'merged']));
    const contactAuthority = Object.fromEntries(s.client.contacts.map(c => [c.id, 'Same entity; reviewed authority is retained on the surviving client']));
    const merged = await h.json('/clients/merge', { survivor: duplicate.id, merged: s.client.id, keep, contactAuthority }, h.owner);
    const moved = await h.json(`/clients/compare?a=${duplicate.id}&b=${s.client.id}`, undefined, h.owner);
    assert.equal(moved.a.linked.learning, 1);
    assert.equal((await h.json(`/learning/${first.id}`, undefined, h.owner)).comparison.clients[0].clientId, duplicate.id);
    await h.json(`/clients/merges/${merged.id}/undo`, {}, h.owner);
    assert.equal((await h.json(`/learning/${first.id}`, undefined, h.owner)).comparison.clients[0].clientId, s.client.id);

  } finally { await h.close(); for (const copy of copies) await copy.close(); }
});
