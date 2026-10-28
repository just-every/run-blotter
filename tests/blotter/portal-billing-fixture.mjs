import assert from 'node:assert/strict';
import { totp } from './erasure-fixture.mjs';

/** A synthetic contact uses the real invitation and completed-factor doors. */
export async function billingSession(h, s) {
  await h.json(`/clients/${s.client.id}/contacts/${s.billing.id}/portal-invite`, {}, h.owner);
  const mail = h.mails.findLast(m => m.to.includes(s.billing.email) && m.text.includes('/client?invite='));
  const token = mail.text.match(/invite=(pi_[0-9a-f]{64})/)[1];
  const response = await h.request('/api/blotter/client/accept', { token });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0], path = `/client/entities/${s.client.id}/billing`;
  await h.json(path, undefined, cookie, 403);
  const factor = await h.json('/client/factor/start', {}, cookie);
  await h.json('/client/factor/confirm', { code: totp(factor.secret, -1) }, cookie);
  return cookie;
}

/** Every billing read preserves financial sources and never calls a provider. */
export async function readBilling(h, s, cookie, edge) {
  const tables = ['b_invoices', 'b_provider_payments', 'b_payment_observations', 'b_payment_mandates', 'b_invoice_credit_uses', 'b_invoice_writeoffs'];
  const snapshot = async () => Promise.all(tables.map(async table => (await h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results));
  const before = await snapshot(), calls = edge?.calls.length;
  const result = await h.json(`/client/entities/${s.client.id}/billing`, undefined, cookie);
  const embedded = (await h.json(`/client/entities/${s.client.id}`, undefined, cookie)).billing;
  const { asOf, ...current } = result, { asOf: entityAt, ...entityBilling } = embedded;
  assert.deepEqual(current, entityBilling);
  assert.ok(Number.isFinite(Date.parse(asOf)) && Number.isFinite(Date.parse(entityAt)));
  assert.deepEqual(await snapshot(), before, 'Reading billing does not change money or mandates');
  assert.equal(edge?.calls.length, calls, 'Reading billing never reconciles with a provider');
  for (const row of before[1]) for (const key of ['provider_id', 'session_id', 'customer_id', 'request_key', 'failure_code']) {
    if (row[key]) assert.ok(!JSON.stringify(result).includes(row[key]), `Private payment field ${key} stays private`);
  }
  const audits = (await h.db.prepare("SELECT actor,object_id,detail FROM b_audit WHERE action='portal.billing_read' ORDER BY rowid DESC LIMIT 2").all()).results;
  assert.equal(audits.length, 2);
  assert.ok(audits.every(a => a.actor === `client portal (${s.billing.email})` && a.object_id === s.client.id && a.detail.includes(s.billing.id)));
  return result;
}

/** Another recipient's fully paid invoice must not leak into this contact's history. */
export async function privatePaidInvoice(h, s) {
  const contact = await h.json(`/clients/${s.client.id}/contacts`, { name: 'Separate billing recipient', email: ['synthetic-blotter-503', 'example.test'].join('@'), roles: ['billing'], active: true, authorized: true, portal: true, requestConsent: true, emailConsent: true }, h.owner);
  const source = await h.json('/invoice-entitlements', { jobId: s.job.id, kind: 'milestone', reference: 'synthetic-blotter-504', description: 'Private separate fee', amountCents: 333, authorization: 'Separate recipient authorized this scope' }, h.owner);
  const input = { title: 'Separate recipient fee', issueDate: '2026-11-02', dueDate: '2026-12-15', jobId: s.job.id, sourceKeys: [source.sourceKey], contactId: contact.id, terms: 'Due on the recorded date', taxCents: 0, taxTreatment: 'No sales tax under supplied treatment', taxAuthorization: 'Principal checked treatment' };
  const draft = await h.json('/invoices', { ...input, previewHash: (await h.json('/invoices/preview', input, h.owner)).previewHash }, h.owner);
  await h.json(`/invoices/${draft.id}/issue`, { revision: draft.revision, snapshotHash: draft.snapshotHash, reviewNote: 'Checked private recipient' }, h.owner);
  const link = await h.json(`/invoices/${draft.id}/payment-link`, { amountCents: 333 }, h.owner);
  const payment = await h.json(`/payments/${link.paymentId}/reconcile`, {}, h.owner);
  return { invoiceId: draft.id, paymentId: payment.id };
}

/** Finish the source work through public doors so the native erasure engine can run. */
export async function closeBillingWork(h, s) {
  const team = (await h.db.prepare('SELECT email,role FROM b_members WHERE active=1').all()).results;
  const members = {};
  for (const role of ['preparer', 'reviewer']) {
    const member = team.find(m => m.role === role);
    await h.json('/team/invite', { email: member.email }, h.owner);
    members[role] = await h.login(member.email);
  }
  let work = await h.json(`/jobs/${s.job.id}`, undefined, members.preparer);
  for (const request of work.requests) {
    await h.json(`/requests/${request.id}/files`, { name: 'close.txt', mime: 'text/plain', contentBase64: Buffer.from('Reviewed billing source').toString('base64') }, members.preparer);
    await h.json(`/requests/${request.id}/decide`, { decision: 'accept', note: 'Source reviewed' }, members.reviewer);
  }
  work = await h.json(`/jobs/${s.job.id}`, undefined, members.preparer);
  for (const step of work.steps) work = await h.json(`/jobs/${s.job.id}/steps`, { ordinal: step.ordinal, done: true, revision: work.job.revision }, members.preparer);
  work = await h.json(`/jobs/${s.job.id}/submit`, { revision: work.job.revision }, members.preparer);
  await h.json(`/jobs/${s.job.id}/review`, { revision: work.job.revision, decision: 'signoff', note: 'Sources and work checked' }, members.reviewer);
}
