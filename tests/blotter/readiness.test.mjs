import test from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './harness.mjs';
import { readinessPortalJourney } from './readiness-ui.mjs';
import { createHash } from 'node:crypto';
import { enroll } from './erasure-fixture.mjs';
import { stripeEdge } from './stripe-edge.mjs';

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

test('Principal readiness inspection joins only an explicitly reviewed current native proposal, preserves evidence and fences authority, erasure and restored scope', async () => {
  const edge = stripeEdge(), h = await harness({ stripeResponse: edge.respond }); const copies = [];
  try {
    const address = n => [`synthetic-blotter-${n}`, 'example.test'].join('@');
    const principal = (await h.json('/state', undefined, h.owner)).actor.email;
    const staff = address(301);
    await h.json('/team', { email: staff, name: 'Scope reviewer', role: 'reviewer' }, h.owner);
    await h.json('/team/invite', { email: staff }, h.owner); const reviewer = await h.login(staff);
    const client = await h.json('/clients', { name: 'synthetic-blotter-302', contacts: [303,304].map(n => ({
      name: `Signer ${n}`, email: address(n), roles: ['primary'], authorized: true, signer: true, portal: true,
      requestConsent: true, emailConsent: true, consentNote: 'Explicit synthetic signer authority' })) }, h.owner);
    const template = await h.json('/templates', { name: 'Reviewed monthly scope', recurrence: 'monthly', tasks: [{ label: 'Inspect statement', when: { question: 'cash', equals: ['Yes','No'] } }], requests: 'Statement',
      questions: [{ key: 'cash', label: 'New bank account?', options: ['Yes','No'] }] }, h.owner);
    const otherTemplate = await h.json('/templates', { name: 'Different scope', recurrence: 'annual', steps: 'Review other service', requests: 'Other evidence' }, h.owner);
    const start = (clientId, templateId, periodStart) => h.json('/jobs', { clientId, templateId, periodStart, dueDate: '2027-04-15',
      dueNote: 'Practitioner agreed date', preparerEmail: principal, reviewerEmail: staff }, h.owner);
    const current = await start(client.id, template.id, '2026-02-01');
    const otherJob = await start(client.id, template.id, '2026-03-01');
    const foreignClient = await h.json('/clients', { name: 'synthetic-blotter-305' }, h.owner);
    const foreignJob = await start(foreignClient.id, template.id, '2026-02-01');
    const quote = 'Provide monthly bookkeeping reports for the reviewed engagement.';
    const terms = { title: 'Native reviewed scope', scope: quote, exclusions: 'No audit or tax filing.', currency: 'USD', feeCents: 125000,
      retainerTerms: 'No debit authority.', renewalRules: 'Separate human renewal.', amendmentRules: 'Review each replacement.', contactIds: client.contacts.map(c => c.id) };
    const draft = () => h.json(`/jobs/${current.id}/engagement-proposals`, terms, h.owner);
    const send = r => h.json(`/signatures/${r.id}/send`, { revision: r.revision }, h.owner);
    const token = i => new URL(i.portalUrl).pathname.split('/').at(-1);
    const sign = async (r, invitation, expected = 200) => {
      const t = token(invitation), view = await h.json(`/portal/${t}/signatures/${r.id}`);
      return h.json(`/portal/${t}/signatures/${r.id}/sign`, { revision: view.revision, attempt: view.attempt, consent: true, intent: true,
        consentVersion: view.consentVersion, values: Object.fromEntries(view.fields.map(f => [f.id, view.signerName])) }, '', expected);
    };
    const mapping = (r, t = template) => ({ source: { kind: 'signature', id: r.id }, services: [{ kind: 'bookkeeping', quote, templateId: t.id, ledger: 'qbo' }] });
    const review = async body => {
      const preview = await h.json(`/clients/${client.id}/onboarding/preview`, body, h.owner);
      return h.json(`/clients/${client.id}/onboarding/plans`, { ...body, fingerprint: preview.fingerprint,
        selectedItemIds: preview.items.filter(i => i.type !== 'portal').map(i => i.id), reason: 'Reviewed exact source and removed portal setup; no execution' }, h.owner);
    };
    const door = (j, planId) => `/jobs/${j.id}/readiness/scope${planId ? '?planId=' + encodeURIComponent(planId) : ''}`;
    const read = (j, planId, cookie = h.owner, status = 200, headers = {}) => h.json(door(j, planId), undefined, cookie, status, headers);
    await read(current, null, h.owner, 400);
    let first = await send(await draft());
    await h.json(`/clients/${client.id}/onboarding/preview`, mapping(first), h.owner, 404);
    await read(current, first.id, h.owner, 404);
    await sign(first, first.invitations[0]);
    const original = Buffer.from(await (await h.request(`/api/blotter/signatures/${first.id}/files/original`, undefined, h.owner)).arrayBuffer());
    const partial = await h.json(`/engagement-proposals/${first.id}`, undefined, h.owner);
    let replacement = await h.json(`/engagement-proposals/${first.id}/amend`, { ...terms, revision: partial.revision }, h.owner);
    await h.json(`/clients/${client.id}/onboarding/preview`, mapping(first), h.owner, 404);
    await read(current, first.id, h.owner, 404);
    replacement = await send(replacement);
    await sign(replacement, replacement.invitations[0]);
    await h.json(`/clients/${client.id}/onboarding/preview`, mapping(replacement), h.owner, 404);
    await sign(replacement, replacement.invitations[1]);
    const completed = await h.json(`/engagement-proposals/${replacement.id}`, undefined, h.owner);
    await read(current, replacement.id, h.owner, 404);
    const plan = await review(mapping(replacement));
    await h.json(`/jobs/${current.id}/answers`, { key: 'cash', value: 'Yes' }, h.owner);
    const native = await map(h, current.id, h.owner), question = await prepare(h, current.id, 'request', native.documents[0].id, h.owner);
    await decide(h, current.id, question.id, 'approve', h.owner);
    const before = await map(h, current.id, h.owner);
    const inert = async () => {
      const tables = ['b_onboarding_plans','b_readiness_questions','b_jobs','b_job_answers','b_job_steps','b_requests','b_portal_items',
        'b_signatures','b_signature_signers','b_signature_events','b_engagement_proposals','b_invoices','b_time'];
      return Object.fromEntries(await Promise.all(tables.map(async table => [table, (await h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results])));
    };
    const state = await inert(), mailCount = h.mails.length, providerCount = edge.calls.length;
    const joined = await read(current, plan.id);
    const { signedScope, coverage, ...unchanged } = joined;
    assert.deepEqual(unchanged, Object.fromEntries(Object.entries(before).filter(([key]) => key !== 'coverage')));
    assert.deepEqual(signedScope.source, { id: replacement.id, kind: 'signature', rootId: first.id, version: 2, predecessorId: first.id,
      sourceSha256: completed.source_sha256, sha256: completed.signed_sha256, completedAt: completed.completed_at,
      href: `/api/blotter/signatures/${replacement.id}/files/signed`, label: plan.source.label });
    assert.equal(signedScope.mapping.quote, quote); assert.equal(signedScope.mapping.template.id, template.id);
    assert.equal(signedScope.mapping.planId, plan.id); assert.equal(signedScope.mapping.fingerprint, plan.fingerprint);
    assert.equal(signedScope.mapping.decidedBy, principal); assert.equal(signedScope.mapping.decidedAt, plan.decidedAt);
    assert.equal(signedScope.mapping.reason, plan.reason); assert.match(signedScope.mapping.provenance, /Practitioner-declared/);
    assert.ok(signedScope.mapping.items.some(i => !i.selected)); assert.equal(joined.unresolvedJudgments, 1);
    const signed = Buffer.from(await (await h.request(signedScope.source.href, undefined, h.owner)).arrayBuffer());
    assert.equal(createHash('sha256').update(signed).digest('hex'), signedScope.source.sha256);
    assert.deepEqual(await inert(), state); assert.equal(h.mails.length, mailCount); assert.equal(edge.calls.length, providerCount); assert.equal(h.aiCalls.length, 0);
    // Corrupt only the test source bytes to exercise the existing integrity boundary.
    const stored = await h.db.prepare('SELECT signed_base64 FROM b_signatures WHERE id=?').bind(replacement.id).first();
    await h.db.prepare('UPDATE b_signatures SET signed_base64=? WHERE id=?').bind(Buffer.from('synthetic-blotter-corrupt-source').toString('base64'), replacement.id).run();
    await read(current, plan.id, h.owner, 409);
    await h.db.prepare('UPDATE b_signatures SET signed_base64=? WHERE id=?').bind(stored.signed_base64, replacement.id).run();
    const inspected = (await h.db.prepare("SELECT actor,detail FROM b_audit WHERE action='readiness.scope_inspected' AND object_id=?").bind(current.id).all()).results;
    assert.equal(inspected.length, 1); assert.equal(inspected[0].actor, principal); assert.equal(JSON.parse(inspected[0].detail).planId, plan.id);
    await read(otherJob, plan.id, h.owner, 409); await read(foreignJob, plan.id, h.owner, 404);
    await read(current, plan.id, reviewer, 403); await read(current, plan.id, '', 401);
    const agent = await h.json('/keys', { label: 'synthetic-blotter-306' }, h.owner), auth = { authorization: 'Bearer ' + agent.key };
    await read(current, plan.id, '', 401, auth);
    assert.equal((await h.request('/api/blotter/agent' + door(current, plan.id), undefined, '', auth)).status, 404);
    const agentMap = await h.json(`/agent/jobs/${current.id}/readiness`, undefined, '', 200, auth);
    assert.equal(agentMap.signedScope, undefined); assert.ok(!JSON.stringify(agentMap).includes(quote)); assert.ok(!JSON.stringify(agentMap).includes(replacement.id));
    const detail = await h.json(`/jobs/${current.id}`, undefined, h.owner);
    await h.json(`/requests/${detail.requests[0].id}/files`, { name: 'synthetic-blotter-308.txt', mime: 'text/plain', contentBase64: bytes }, h.owner);
    await h.json(`/requests/${detail.requests[0].id}/decide`, { decision: 'accept' }, h.owner);
    await h.json(`/jobs/${current.id}/steps`, { ordinal: 1, done: true }, h.owner);
    const submitted = await h.json(`/jobs/${current.id}/submit`, {}, h.owner);
    const refused = await h.json(`/jobs/${current.id}/review`, { revision: submitted.job.revision, decision: 'signoff', note: 'Scope cannot resolve the pending judgment' }, reviewer, 409);
    assert.match(refused.error, /readiness|judgment/i);
    assert.equal((await read(current, plan.id)).unresolvedJudgments, 1);
    const wrong = await send(await draft()); for (const invitation of wrong.invitations) await sign(wrong, invitation);
    const mismatched = await review(mapping(wrong, otherTemplate)); await read(current, mismatched.id, h.owner, 409);
    const recorded = await h.json(`/clients/${client.id}/engagements`, { title: 'Practitioner-recorded source', signers: ['Signer 303','Signer 304'],
      signedDate: '2026-01-01', file: { name: 'synthetic-blotter-309.txt', mime: 'text/plain', contentBase64: Buffer.from(quote).toString('base64') } }, h.owner);
    const recordedMapping = await review({ ...mapping(recorded), source: { kind: 'engagement', id: recorded.id } });
    await read(current, recordedMapping.id, h.owner, 409);
    // Enrolled factors apply independently to every new principal session.
    const factor = await enroll(h, h.owner), fresh = await h.login(principal);
    assert.equal((await read(current, plan.id, fresh, 403)).mfa, 'verify');
    await h.json('/mfa/verify', { recoveryCode: factor.recovery[0] }, fresh);
    await read(current, plan.id, fresh);
    const integration = await h.json('/integration-keys', { label: 'synthetic-blotter-307', reason: 'Read-only evidence metadata', clientIds: [client.id], actions: ['work:read'] }, h.owner);
    await read(current, plan.id, '', 401, { authorization: 'Bearer ' + integration.key });
    await h.send('/auth/signout', {}, fresh); await read(current, plan.id, fresh, 401);
    await h.json('/team', { email: staff, name: 'Departed reviewer', role: 'reviewer', active: false }, h.owner);
    await read(current, plan.id, reviewer, 401);
    // A whole-client hold preserves exact signed history but never restores review authority.
    const hold = await h.json(`/clients/${client.id}/retention`, { scope: 'client', kind: 'hold', reason: 'Retain signed review evidence', owner: principal, reviewDate: '2999-01-01' }, h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const restored = await harness(); copies.push(restored);
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge: 'erasure history unverified: supply your latest erasure journal' }, restored.owner);
    assert.equal((await restored.json(`/clients/${client.id}/onboarding/plans/${plan.id}`, undefined, restored.owner)).status, 'held');
    await read(current, plan.id); await restored.json(door(current, plan.id), undefined, restored.owner, 409);
    const restoredProposal = await restored.json(`/engagement-proposals/${replacement.id}`, undefined, restored.owner);
    assert.deepEqual(restoredProposal.versions, completed.versions); assert.deepEqual(restoredProposal.proposal, completed.proposal);
    assert.deepEqual(restoredProposal.events, completed.events);
    assert.deepEqual(Buffer.from(await (await restored.request(signedScope.source.href, undefined, restored.owner)).arrayBuffer()), signed);
    assert.deepEqual(Buffer.from(await (await restored.request(`/api/blotter/signatures/${first.id}/files/original`, undefined, restored.owner)).arrayBuffer()), original);
    const contact = (await h.json(`/clients/${client.id}/contacts`, undefined, h.owner))[0];
    await h.json(`/clients/${client.id}/contacts`, { ...contact, revision: contact.revision, authorized: true, portal: true, active: true,
      requestConsent: true, emailConsent: true, signer: false, consentNote: 'Signer authority withdrawn' }, h.owner);
    await read(current, plan.id, h.owner, 409);
    const lifecycle = async value => h.json(`/clients/${client.id}/lifecycle`, { lifecycle: value, revision: (await h.json(`/clients/${client.id}/detail`, undefined, h.owner)).revision }, h.owner);
    await lifecycle('archived'); await read(current, plan.id, h.owner, 404);
    await lifecycle('active'); await read(current, plan.id, h.owner, 409);
    // Clock fixture only: expiry and all erasure effects still run through the public door.
    await h.db.prepare('UPDATE b_signatures SET completed_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z', replacement.id).run();
    await h.json('/retention/ready/confirm', { kind: 'signature', id: replacement.id, reason: 'Still held' }, h.owner, 409);
    await h.json(`/retention/${hold.id}/release`, { reason: 'Hold ended' }, h.owner);
    const expired = await h.json('/retention/ready/confirm', { kind: 'signature', id: replacement.id, reason: 'Retention ended' }, h.owner);
    assert.ok(expired.effects.some(e => e.table === 'b_signatures'));
    await read(current, plan.id, h.owner, 404);
    assert.equal((await h.request(signedScope.source.href, undefined, h.owner)).status, 404);
    const latest = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    const stale = await harness(); copies.push(stale);
    await stale.json('/restore', { archive, journal: latest, confirm: 'RESTORE' }, stale.owner, 409);
  } finally { await h.close(); for (const copy of copies) await copy.close(); }
});
