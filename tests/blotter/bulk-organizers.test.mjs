import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';

const contact = (name, email, roles) => ({ name, email, roles, authorized: true, portal: true, requestConsent: true, emailConsent: true });
const tokenOf = url => new URL(url).pathname.split('/').at(-1);
const mailToken = mail => mail.text.match(/\/portal\/(up_[0-9a-f]{64})/)?.[1];
const organizerFor = async (h, jobId) => (await h.json(`/jobs/${jobId}/organizers`, undefined, h.owner)).organizers[0];
const archiveRows = (archive, table) => archive.trim().split('\n').map(JSON.parse).filter(p => p.kind === 'part').flatMap(p => p.items)
  .filter(i => i.kind === 'row' && i.table === table).map(i => i.row).sort((a, b) => a.id.localeCompare(b.id));

async function clientWork(h, label, { organizer = true, assign = true } = {}) {
  const client = await h.json('/clients', { name: `${label} LLC`, entityType: 'business', contacts: [
    contact(`${label} Owner`, `${label.toLowerCase()}@example.test`, ['primary']),
    contact(`${label} Bookkeeper`, `${label.toLowerCase()}-books@example.test`, ['bookkeeping']),
  ] }, h.owner);
  const primary = client.contacts.find(c => c.roles.includes('primary'));
  const other = client.contacts.find(c => c.roles.includes('bookkeeping'));
  const questionKey = label.toLowerCase() + '_owner', otherKey = label.toLowerCase() + '_books';
  const definition = { name: `${label} document organizer`, kind: 'bookkeeping', version: 1, questions: [
    { key: questionKey, label: `${label} owner document question`, type: 'text', required: false },
    { key: otherKey, label: `${label} bookkeeper document question`, type: 'text', required: false },
  ] };
  const template = await h.json('/templates', { name: `${label} close`, recurrence: 'monthly', tasks: [{ label: 'Prepare close' }], requests: ['Bank statement'],
    ...(organizer ? { organizer: definition } : {}) }, h.owner);
  const job = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-01-01', dueDate: '2027-04-15', dueNote: 'Recorded firm engagement target',
    preparerEmail: 'owner@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  let invitation;
  if (organizer && assign) {
    const snapshot = await organizerFor(h, job.id);
    invitation = await h.json(`/jobs/${job.id}/organizers/send`, { revision: snapshot.revision, assignments: { [questionKey]: primary.id, [otherKey]: other.id } }, h.owner);
  }
  return { client, primary, other, template, job, questionKey, otherKey, definition, invitation,
    organizer: organizer ? await organizerFor(h, job.id) : null };
}

async function setup(h) {
  await h.json('/team', { email: 'reviewer@example.test', name: 'Rae Reviewer', role: 'reviewer' }, h.owner);
  const a = await clientWork(h, 'Cedar'), b = await clientWork(h, 'River');
  const message = await h.json('/messages/templates', { scope: 'firm', name: 'Assigned organizer kickoff', subject: '{{work_type}} organizer for {{client_name}}',
    body: 'Your {{work_type}} engagement needs your assigned organizer answers.\nHello {{contact_first_name}}, open {{portal_link}}.' }, h.owner);
  const body = { class: 'engagement', templateId: message.id, entityType: 'business', reason: 'Collect assigned engagement organizer answers', attachOrganizer: true };
  return { a, b, message, body };
}

async function preview(h, body, key) {
  return h.json('/bulk-messages/preview', { ...body, idempotencyKey: key }, h.owner);
}
async function schedule(h, batch) {
  return h.json(`/bulk-messages/${batch.batch.id}/schedule`, { fingerprint: batch.batch.fingerprint }, h.owner);
}

test('MSG-002 / PORTAL-004 / BASE-001 bulk organizer invitations preserve contact-specific questions, send one mail once, retain history and restore exact invitations without links or queued replay', async () => {
  const h = await harness(); let restored;
  try {
    const { a, b, body } = await setup(h), clients = [a, b];
    const batch = await preview(h, body, 'organizers-success');
    assert.equal(batch.recipients.length, 2);
    for (const c of clients) {
      const recipient = batch.recipients.find(r => r.client_id === c.client.id);
      assert.equal(recipient.contact_id, c.primary.id);
      assert.equal(recipient.organizer_id, c.organizer.id);
      assert.equal(recipient.organizer_revision, c.organizer.revision);
    }
    assert.ok(batch.samples.every(s => !/up_[0-9a-f]{64}/.test(s.body)), 'A preview never issues an organizer capability');
    await schedule(h, batch);
    const before = h.mails.length;
    const sent = await h.json(`/bulk-messages/${batch.batch.id}/run`, {}, h.owner);
    const mails = h.mails.slice(before);
    assert.equal(mails.length, 2, 'Each organizer uses the existing bulk email, with no additional invitation email');
    assert.equal(sent.counts.accepted, 2);
    const tokens = [];
    for (const c of clients) {
      const mail = mails.find(m => m.to.includes(c.primary.email)), token = mailToken(mail);
      assert.ok(token); tokens.push(token);
      const recipient = sent.recipients.find(r => r.client_id === c.client.id);
      const own = (await h.json(`/portal/${token}/organizers`)).organizers;
      assert.deepEqual(own.map(o => o.id), [c.organizer.id]);
      assert.deepEqual(own[0].questions.map(q => q.key), [c.questionKey], 'The selected contact sees only questions already assigned to it');
      const otherClient = clients.find(x => x !== c);
      await h.json(`/portal/${token}/organizers/${encodeURIComponent(otherClient.organizer.id)}`, undefined, undefined, 404);
      await h.json(`/portal/${token}/organizers/${encodeURIComponent(c.organizer.id)}`, { revision: own[0].revision, answers: { [c.otherKey]: { value: 'Unauthorized answer', confirmed: true } } }, undefined, 403);
      const current = await organizerFor(h, c.job.id);
      assert.equal(current.revision, c.organizer.revision, 'Inviting a contact does not invalidate another recipient of the same organizer');
      assert.deepEqual(current.answers, c.organizer.answers, 'A bulk attachment never assigns or reassigns organizer questions');
      const added = current.deliveries.filter(d => !c.organizer.deliveries.some(old => old.id === d.id));
      assert.equal(added.length, 1);
      assert.equal(added[0].contact_id, c.primary.id);
      assert.equal(added[0].to_email, c.primary.email);
      assert.equal(added[0].subject, mail.subject);
      assert.equal(added[0].message, mail.text.replaceAll(`${h.origin}/portal/${token}`, `${h.origin}/portal/…`));
      assert.equal(added[0].delivery, recipient.delivery);
      assert.ok(!JSON.stringify(current.deliveries).includes(token));
      const history = (await h.json(`/clients/${c.client.id}/history`, undefined, h.owner)).history;
      assert.ok(history.some(e => e.action === 'bulk.sent' && e.actor === 'owner@example.test' && e.object_id === c.job.id));
      assert.ok(history.some(e => e.action === 'organizer.invitation_issued' && e.actor === 'owner@example.test' && e.detail.includes(c.organizer.id)));
    }
    assert.notEqual(tokens[0], tokens[1]);
    assert.ok((await schedule(h, batch)).resubmitted);
    await h.json(`/bulk-messages/${batch.batch.id}/run`, {}, h.owner);
    await h.scheduled(Date.now() + 60_000);
    assert.equal(h.mails.length - before, 2, 'Manual and scheduled replay send neither the batch nor the organizer invitation again');
    for (const c of clients) assert.equal((await organizerFor(h, c.job.id)).deliveries.length, c.organizer.deliveries.length + 1);

    const queued = await preview(h, body, 'organizers-restore-queued');
    await schedule(h, queued);
    const agent = await h.json('/keys', { label: 'Organizer source installation only' }, h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const initialTokens = clients.flatMap(c => c.invitation.recipients.map(r => tokenOf(r.portalUrl)));
    assert.ok([...tokens, ...initialTokens].every(t => !archive.includes(t)), 'Neither initial nor bulk organizer capability tokens travel in an archive');
    assert.ok(!archive.includes(agent.key));
    assert.ok(archiveRows(archive, 'b_organizer_deliveries').length > 0);
    restored = await harness();
    await restored.json('/restore', { archive, confirm: 'RESTORE' }, restored.owner);
    for (const c of clients) assert.deepEqual((await organizerFor(restored, c.job.id)).deliveries, (await organizerFor(h, c.job.id)).deliveries);
    const exported = await (await restored.request('/api/blotter/backup', undefined, restored.owner)).text();
    assert.deepEqual(archiveRows(exported, 'b_organizer_deliveries'), archiveRows(archive, 'b_organizer_deliveries'));
    for (const token of tokens) await restored.json(`/portal/${token}`, undefined, undefined, 404);
    await restored.json('/agent/context', undefined, '', 401, { authorization: 'Bearer ' + agent.key });
    const held = await restored.json(`/bulk-messages/${queued.batch.id}`, undefined, restored.owner);
    assert.equal(held.batch.status, 'paused');
    assert.equal(held.batch.restore_review, 1);
    assert.ok(held.recipients.every(r => r.status === 'held'));
    await restored.json(`/bulk-messages/${queued.batch.id}/schedule`, { fingerprint: queued.batch.fingerprint }, restored.owner, 409);
    const restoredMailCount = restored.mails.length;
    await restored.json(`/bulk-messages/${queued.batch.id}/run`, {}, restored.owner);
    await restored.scheduled(Date.now() + 120_000);
    assert.equal(restored.mails.length, restoredMailCount);
    for (const c of clients) assert.deepEqual((await organizerFor(restored, c.job.id)).deliveries, (await organizerFor(h, c.job.id)).deliveries);
  } finally { await restored?.close(); await h.close(); }
});

test('MSG-002 / PORTAL-004 / BASE-001 organizer batches refuse missing authority and unavailable snapshots, freeze preview revisions and hold changed or consent-revoked recipients without mail or new invitations', async () => {
  const h = await harness(); let target;
  try {
    const { a, b, body } = await setup(h);
    const missing = await clientWork(h, 'Missing', { organizer: false });
    const unassigned = await clientWork(h, 'Unassigned', { assign: false });
    const erased = await clientWork(h, 'Erased');
    const erasureBatch = await preview(h, body, 'organizer-erased-after-preview');
    assert.equal(erasureBatch.recipients.find(r => r.client_id === erased.client.id).organizer_id, erased.organizer.id);
    await schedule(h, erasureBatch);
    const oldArchive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    await h.json(`/organizers/${erased.organizer.id}/erase`, { revision: erased.organizer.revision, confirm: erased.definition.name, reason: 'Client requested removal of organizer answers' }, h.owner);
    const closed = await clientWork(h, 'Closed');
    let detail = await h.json(`/jobs/${closed.job.id}`, undefined, h.owner);
    for (const request of detail.requests) {
      await h.json(`/requests/${request.id}/files`, { name: 'Statement.txt', mime: 'text/plain', contentBase64: Buffer.from('Source statement for the closed engagement').toString('base64') }, h.owner);
      await h.json(`/requests/${request.id}/decide`, { decision: 'accept' }, h.owner);
    }
    for (const step of detail.steps) await h.json(`/jobs/${closed.job.id}/steps`, { ordinal: step.ordinal, done: true }, h.owner);
    detail = await h.json(`/jobs/${closed.job.id}`, undefined, h.owner);
    await h.json(`/jobs/${closed.job.id}/submit`, { revision: detail.job.revision }, h.owner);

    const noLink = await h.json('/messages/templates', { scope: 'firm', name: 'No organizer link', subject: '{{work_type}} update', body: 'Your {{work_type}} engagement update.' }, h.owner);
    await h.json('/bulk-messages/preview', { ...body, templateId: noLink.id, idempotencyKey: 'organizer-no-link' }, h.owner, 409);
    const marketing = await h.json('/messages/templates', { scope: 'firm', name: 'Organizer marketing refused', class: 'marketing', subject: 'News from {{firm_name}}', body: 'Hello {{contact_first_name}}, practice news.' }, h.owner);
    await h.json('/bulk-messages/preview', { ...body, class: 'marketing', topic: 'tax', templateId: marketing.id, idempotencyKey: 'organizer-marketing' }, h.owner, 409);
    await h.json('/team', { email: 'prep@example.test', name: 'Pat Preparer', role: 'preparer' }, h.owner);
    await h.json('/team/invite', { email: 'prep@example.test' }, h.owner);
    const prep = await h.login('prep@example.test');
    await h.json('/bulk-messages/preview', { ...body, idempotencyKey: 'organizer-preparer' }, prep, 403);
    const key = await h.json('/keys', { label: 'Organizer proposal only' }, h.owner);
    await h.json('/bulk-messages/preview', { ...body, idempotencyKey: 'organizer-agent' }, '', 401, { authorization: 'Bearer ' + key.key });
    await h.json('/bulk-messages/preview', { ...body, idempotencyKey: 'organizer-origin' }, h.owner, 403, { origin: 'https://other.example.test' });

    const batch = await preview(h, body, 'organizer-held');
    assert.deepEqual(batch.recipients.map(r => r.client_id).sort(), [a.client.id, b.client.id].sort());
    const exclusions = new Map(batch.exclusions.map(e => [e.client_id, e.reason]));
    assert.match(exclusions.get(missing.client.id), /organizer/i);
    assert.match(exclusions.get(unassigned.client.id), /assign|question/i);
    assert.match(exclusions.get(erased.client.id), /eras|organizer/i);
    assert.match(exclusions.get(closed.client.id), /clos|open|organizer/i);
    assert.ok(Object.values((await organizerFor(h, unassigned.job.id)).answers).every(answer => answer.contactId === null), 'Excluding an unassigned organizer never grants its questions to the selected contact');
    await schedule(h, batch);
    await h.json(`/bulk-messages/${batch.batch.id}/run`, {}, prep, 403);

    const oldToken = tokenOf(a.invitation.recipients.find(r => r.contactId === a.primary.id).portalUrl);
    const form = (await h.json(`/portal/${oldToken}/organizers`)).organizers[0];
    await h.json(`/portal/${oldToken}/organizers/${encodeURIComponent(form.id)}`, { revision: form.revision, answers: { [a.questionKey]: { value: 'New client-supplied information after preview', confirmed: true } } });
    const current = await organizerFor(h, a.job.id);
    assert.notEqual(current.revision, a.organizer.revision);
    const refreshed = await preview(h, body, 'organizer-refreshed');
    assert.equal(refreshed.recipients.find(r => r.client_id === a.client.id).organizer_revision, current.revision);
    assert.notEqual(refreshed.batch.fingerprint, batch.batch.fingerprint, 'The approval fingerprint includes each frozen organizer revision');
    const primary = (await h.json(`/clients/${b.client.id}/contacts`, undefined, h.owner)).find(c => c.id === b.primary.id);
    await h.json(`/clients/${b.client.id}/contacts`, { id: primary.id, revision: primary.revision, requestConsent: false }, h.owner);
    const baseline = h.mails.length;
    let result = await h.json(`/bulk-messages/${batch.batch.id}/run`, {}, h.owner);
    assert.equal(h.mails.length, baseline);
    assert.equal(result.counts.held, 2);
    assert.match(result.recipients.find(r => r.client_id === a.client.id).held_reason, /organizer|revision|changed/i);
    assert.match(result.recipients.find(r => r.client_id === b.client.id).held_reason, /authoriz|consent|request/i);
    assert.equal(result.recipients.find(r => r.client_id === a.client.id).organizer_revision, a.organizer.revision, 'A held recipient retains the reviewed snapshot identity');
    const erasureResult = await h.json(`/bulk-messages/${erasureBatch.batch.id}/run`, {}, h.owner);
    const erasedRecipient = erasureResult.recipients.find(r => r.client_id === erased.client.id);
    assert.equal(erasedRecipient.status, 'held');
    assert.match(erasedRecipient.held_reason, /eras|organizer/i);
    assert.equal((await organizerFor(h, erased.job.id)).deliveries.length, erased.organizer.deliveries.length);
    await h.json(`/bulk-messages/${batch.batch.id}/run`, {}, h.owner);
    await h.scheduled(Date.now() + 60_000);
    assert.equal(h.mails.length, baseline);
    for (const c of [a, b]) {
      assert.equal((await organizerFor(h, c.job.id)).deliveries.length, c.organizer.deliveries.length, 'A held recipient creates no organizer invitation');
      const history = (await h.json(`/clients/${c.client.id}/history`, undefined, h.owner)).history;
      assert.ok(history.some(e => e.action === 'bulk.held' && e.actor === 'owner@example.test' && e.object_id === c.job.id));
    }
    result = await h.json(`/bulk-messages/${batch.batch.id}`, undefined, h.owner);
    assert.ok(result.recipients.every(r => r.status === 'held'));
    const journal = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    target = await harness();
    await target.json('/restore', { archive: oldArchive, journal, confirm: 'RESTORE' }, target.owner, 409);
    assert.equal((await target.json('/state', undefined, target.owner)).jobs.length, 0, 'A newer organizer erasure fences the complete stale archive before restoring any work');
  } finally { await target?.close(); await h.close(); }
});
