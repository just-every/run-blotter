// Native invoice journeys through the built Worker. Only the mail edge is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { harness } from './harness.mjs';
import { invoiceJourney } from './invoices-ui.mjs';
import { ArchiveVerifier, ContentVerifier, makePart } from '../../node_modules/@runeditrun/rer/modules/portability/format.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const acknowledge = 'erasure history unverified: supply your latest erasure journal';
const contact = (name, email, roles = ['primary', 'billing']) => ({ name, email, roles, authorized: true, portal: true, requestConsent: true, emailConsent: true, consentNote: 'Client authorized the recorded entity relationship and invoice notices' });
const fixture = async h => {
  const staff = {};
  for (const role of ['reviewer', 'preparer']) {
    const email = `${role}@example.test`;
    await h.json('/team', { email, name: role, role }, h.owner);
    await h.json('/team/invite', { email }, h.owner); staff[role] = await h.login(email);
  }
  await h.json('/firm/settings', { name: 'Cedar Practice', ein: '123456789', entity: 'LLC', address: '10 Main Street', city: 'Boston', state: 'MA', zip: '02108', fiscalYearEnd: '12-31', services: ['Bookkeeping'], currency: 'USD', timeZone: 'America/New_York', notificationStart: '00:00', notificationEnd: '00:00', calendars: [] }, h.owner);
  const client = await h.json('/clients', { name: 'Cedar Lane LLC', contacts: [contact('Alex Owner', 'alex@example.test'), contact('Terry Tax', 'tax@example.test', ['tax'])] }, h.owner);
  const template = await h.json('/templates', { name: 'Monthly bookkeeping', recurrence: 'monthly', steps: 'Review sources', requests: 'Client evidence', feeCents: 10000, currency: 'USD' }, h.owner);
  const job = await h.json('/jobs', { clientId: client.id, templateId: template.id, periodStart: '2026-11-01', dueDate: '2026-12-15', dueNote: 'Recorded engagement date', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
  const contacts = await h.json(`/clients/${client.id}/contacts`, undefined, h.owner), billing = contacts.find(c => c.email === 'alex@example.test');
  return { ...staff, client, template, job, contacts, billing };
};
const terms = { title: 'November scope and extras', issueDate: '2026-11-02', dueDate: '2026-11-30', terms: 'Payment due on the recorded date', taxCents: 0, taxTreatment: 'No sales tax under the client supplied treatment', taxAuthorization: 'Principal reviewed client tax adviser instruction REF-INV-1' };
const authorize = (h, s, extra = {}) => h.json('/invoice-entitlements', { jobId: s.job.id, kind: 'fixed', reference: 'ENG-2026-11', description: 'Fixed monthly engagement', amountCents: 10000, authorization: 'Client accepted fixed scope ENG-2026-11 before completion', ...extra }, h.owner);
const draft = async (h, input) => {
  const p = await h.json('/invoices/preview', input, h.owner);
  return h.json('/invoices', { ...input, previewHash: p.previewHash }, h.owner);
};
const issue = (h, invoice) => h.json(`/invoices/${invoice.id}/issue`, { revision: invoice.revision, snapshotHash: invoice.snapshotHash, reviewNote: 'Compared entitlement, hourly approvals, supplied tax treatment and client recipient' }, h.owner);
const pdf = async (h, id, actor = h.owner) => Buffer.from(await (await h.request(`/api/blotter/invoices/${id}/pdf`, undefined, actor)).arrayBuffer());

test('BILL-002 / TIME-002 / TIME-004 / CRM-001 / CRM-003: independent scope and approved extras, supplied tax, deposit, numbered immutable PDF, explicit portal delivery and source locks', async () => {
  const h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-1' } });
  try {
    const s = await fixture(h);
    await h.json('/invoices', {}, h.owner, 409);
    await h.json('/invoices', {}, s.reviewer, 403);
    await h.json('/invoices', undefined, s.preparer, 403);
    await h.json('/invoices/authority', { authority: 'qbo', reason: 'Not connected' }, h.owner, 409);
    await h.json('/invoices/authority', { authority: 'blotter', reason: 'Blotter is the sole invoice authority for this practice' }, h.owner);
    const entitlement = await authorize(h, s);
    assert.equal((await h.json(`/jobs/${s.job.id}`, undefined, h.owner)).job.status, 'open', 'Fee entitlement does not require job completion');
    await h.json('/team/rates', { email: 'preparer@example.test', rateCents: 10000, effectiveFrom: '2026-01-01', currency: 'USD' }, h.owner);
    const hourly = await h.json(`/jobs/${s.job.id}/time`, { date: '2026-11-02', minutes: 30, description: 'Authorized hourly extra' }, s.preparer);
    const excluded = await h.json(`/jobs/${s.job.id}/time`, { date: '2026-11-02', minutes: 10, description: 'Internal training', billable: false }, s.preparer);
    const unpaidApproval = { ...terms, jobId: s.job.id, sourceKeys: [`time:${hourly.id}`], contactId: s.billing.id };
    await h.json('/invoices/preview', unpaidApproval, h.owner, 409);
    await h.json('/timesheets/submit', { weekStart: '2026-11-02' }, s.preparer);
    for (const t of [hourly, excluded]) await h.json(`/time/${t.id}/review`, { decision: 'approve' }, s.reviewer);
    const expense = await h.json(`/jobs/${s.job.id}/expenses`, { kind: 'filing_fee', date: '2026-11-02', description: 'Authorized filing disbursement', costCents: 1000, billable: true, markupPercent: 10, receipt: { name: 'receipt.txt', mime: 'text/plain', contentBase64: Buffer.from('Filing receipt').toString('base64') } }, s.preparer);
    await h.json('/invoices/preview', { ...unpaidApproval, sourceKeys: [`exp:${expense.id}`] }, h.owner, 409);
    await h.json(`/expenses/${expense.id}/decide`, { decision: 'approve' }, s.reviewer);
    await h.json('/invoices/preview', { ...unpaidApproval, sourceKeys: [`time:${excluded.id}`] }, h.owner, 409);
    const deposit = await h.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', reference: 'BANK-RECEIPT-2026-11', amountCents: 3000, reason: 'Principal recorded client deposit from supplied bank receipt' }, h.owner);
    const input = { ...terms, jobId: s.job.id, sourceKeys: [entitlement.sourceKey, `time:${hourly.id}`, `exp:${expense.id}`], contactId: s.billing.id, taxCents: 250, taxTreatment: 'Supplied sales tax treatment for authorized scope', credits: [{ creditId: deposit.id, amountCents: 3000 }] };
    const p = await h.json('/invoices/preview', input, h.owner);
    assert.deepEqual([p.snapshot.subtotalCents, p.snapshot.taxCents, p.snapshot.creditCents, p.snapshot.totalCents], [16100, 250, 3000, 13350]);
    assert.equal(p.snapshot.recipient.id, s.billing.id);
    assert.deepEqual(p.snapshot.lines.map(l => l.source_key).sort(), input.sourceKeys.toSorted());
    await h.json('/invoices', { ...input, previewHash: 'stale' }, h.owner, 409);
    const invoice = await h.json('/invoices', { ...input, previewHash: p.previewHash }, h.owner);
    await h.json('/exports', { title: 'Duplicate invoice source', sourceKeys: [`time:${hourly.id}`] }, h.owner, 409);
    await h.json('/invoices', { ...input, previewHash: p.previewHash }, h.owner, 409);
    await h.json(`/invoices/${invoice.id}/issue`, { revision: invoice.revision, snapshotHash: invoice.snapshotHash, reviewNote: 'Review' }, s.reviewer, 403);
    await h.json(`/invoices/${invoice.id}/issue`, { revision: invoice.revision, snapshotHash: 'stale', reviewNote: 'Review' }, h.owner, 409);
    const issued = await issue(h, invoice);
    await h.json(`/invoices/${invoice.id}/issue`, { revision: invoice.revision, snapshotHash: invoice.snapshotHash, reviewNote: 'Duplicate event' }, h.owner, 409);
    const document = await pdf(h, invoice.id), again = await pdf(h, invoice.id);
    assert.deepEqual(document, again); assert.equal(hash(document), issued.sha256);
    assert.equal(document.subarray(0, 5).toString(), '%PDF-');
    const parsed = await PDFDocument.load(document); assert.ok(parsed.getPageCount() >= 1); assert.ok(parsed.getTitle().includes(issued.displayNumber));
    assert.equal((await h.request(`/api/blotter/invoices/${invoice.id}/pdf`, undefined, s.preparer)).status, 403);
    const wrong = s.contacts.find(c => c.email === 'tax@example.test');
    await h.json(`/invoices/${invoice.id}/delivery-preview`, { contactId: wrong.id }, h.owner, 409);
    const deliveryPreview = await h.json(`/invoices/${invoice.id}/delivery-preview`, { contactId: s.billing.id }, h.owner);
    const sent = await h.json(`/invoices/${invoice.id}/send`, { contactId: s.billing.id, previewHash: deliveryPreview.previewHash }, h.owner);
    assert.equal(sent.status, 'accepted');
    const token = new URL(sent.portalUrl).pathname.split('/').at(-1), portal = await h.json('/invoice-portal/' + token);
    assert.deepEqual([portal.number, portal.totalCents, portal.balanceCents], [issued.displayNumber, 13350, 13350]);
    const portalDocument = Buffer.from(await (await h.request(`/api/blotter/invoice-portal/${token}/pdf`)).arrayBuffer()); assert.deepEqual(portalDocument, document);
    const mail = h.mails.find(m => m.subject === deliveryPreview.subject); assert.equal(mail.to[0], 'alex@example.test'); assert.equal(mail.attachments.length, 1); assert.equal(hash(Buffer.from(mail.attachments[0].content, 'base64')), issued.sha256);
    await h.json(`/invoices/${invoice.id}/send`, { contactId: s.billing.id, previewHash: deliveryPreview.previewHash }, h.owner, 409);
    const history = await h.json(`/clients/${s.client.id}/history?kind=billing`, undefined, s.preparer);
    for (const action of ['invoice.issued', 'invoice.sent']) assert.ok(history.history.some(e => e.action === action && e.object_id === invoice.id && e.job_id === s.job.id));
    assert.ok(history.history.find(e => e.action === 'invoice.issued').detail.includes(`time:${hourly.id}`));
    const found=await h.json('/search?q='+issued.displayNumber+'&type=invoice',undefined,s.preparer);
    assert.ok(found.results.some(r=>r.id===invoice.id&&r.open.jobId===s.job.id));
    const survivor=await h.json('/clients',{name:'Cedar Lane consolidated'},h.owner);
    const compare=await h.json(`/clients/compare?a=${survivor.id}&b=${s.client.id}`,undefined,h.owner);
    const keep=Object.fromEntries(compare.fields.filter(f=>!f.same&&f.key!=='source').map(f=>[f.key,'survivor']));
    const merged=await h.json('/clients/merge',{survivor:survivor.id,merged:s.client.id,keep,contactAuthority:Object.fromEntries(s.contacts.map(c=>[c.id,'Same entity; contact authorized for both records']))},h.owner);
    assert.equal((await h.json(`/invoices/${invoice.id}`,undefined,h.owner)).client_id,survivor.id);
    assert.deepEqual(await pdf(h,invoice.id),document);
    await h.json(`/clients/merges/${merged.id}/undo`,{},h.owner);
    assert.equal((await h.json(`/invoices/${invoice.id}`,undefined,h.owner)).client_id,s.client.id);
    const changed = await h.json(`/clients/${s.client.id}/contacts`, { id: s.billing.id, revision: (await h.json(`/clients/${s.client.id}/contacts`,undefined,h.owner)).find(c=>c.id===s.billing.id).revision, email: 'updated@example.test', consentNote: 'Client changed billing address' }, h.owner);
    assert.notEqual(changed.revision, s.billing.revision); await h.json('/invoice-portal/' + token, undefined, '', 404);
    const original = await h.json(`/invoices/${invoice.id}`, undefined, h.owner);
    await h.json(`/invoices/${invoice.id}/void`, { revision: original.revision, reason: 'Client requested a replacement scope' }, h.owner);
    assert.deepEqual(await pdf(h, invoice.id), document, 'A void retains its original numbered PDF');
    assert.equal((await h.json(`/clients/${s.client.id}/history?kind=billing`, undefined, s.preparer)).history.some(e => e.action === 'invoice.voided' && e.object_id === invoice.id), true);
    await h.json('/exports', { title: 'Voiding a numbered document cannot rebill its original time', sourceKeys: [`time:${hourly.id}`] }, h.owner, 409);
  } finally { await h.close(); }
});

test('BILL-002 / BASE-001: monthly events generate one draft per entitlement, preview price and cancellation changes, preserve explicit prorations and portable paused rules', async () => {
  const h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-2' } }); let restored;
  try {
    const s = await fixture(h);
    await h.json('/invoices/authority', { authority: 'blotter', reason: 'Native invoice authority selected' }, h.owner);
    const rule = await h.json('/invoice-retainers', { ...terms, jobId: s.job.id, title: 'Monthly bookkeeping retainer', startMonth: '2026-11', amountCents: 12000, billDay: 1, dueDays: 14, contactId: s.billing.id, authorization: 'Client agreement authorizes a monthly fee and recorded invoice calendar' }, h.owner);
    const first = await h.json(`/invoice-retainers/${rule.id}/generate`, { period: '2026-11' }, h.owner), repeat = await h.json(`/invoice-retainers/${rule.id}/generate`, { period: '2026-11' }, h.owner);
    assert.equal(repeat.id, first.id); assert.equal(repeat.replayed, true); assert.equal(first.snapshot.lines[0].retainer_id, rule.id); assert.equal(first.snapshot.totalCents, 12000);
    const change = { action: 'price', effectiveMonth: '2026-12', amountCents: 13500, taxCents: 0, taxTreatment: terms.taxTreatment, taxAuthorization: terms.taxAuthorization, authorization: 'Client accepted amended December price AMEND-1', reason: 'Expanded monthly scope' };
    const p = await h.json(`/invoice-retainers/${rule.id}/amendment-preview`, change, h.owner);
    assert.deepEqual([p.before.amountCents, p.after.amountCents], [12000, 13500]); assert.equal(p.retainedEntitlements[0].source_key, first.snapshot.lines[0].source_key);
    await h.json(`/invoice-retainers/${rule.id}/amend`, { ...change, previewHash: 'stale' }, h.owner, 409);
    await h.json(`/invoice-retainers/${rule.id}/amend`, { ...change, previewHash: p.previewHash }, h.owner);
    await h.json(`/invoice-retainers/${rule.id}/amendment-preview`, { ...change, effectiveMonth: '2026-11' }, h.owner, 409);
    const next = await h.json(`/invoice-retainers/${rule.id}/generate`, { period: '2026-12' }, h.owner); assert.equal(next.total_cents, 13500);
    assert.equal((await h.json(`/invoices/${first.id}`, undefined, h.owner)).total_cents, 12000);
    await h.scheduled('2026-12-02T15:00:00Z'); await h.scheduled('2026-12-02T16:00:00Z');
    const state = await h.json('/invoices', undefined, h.owner); assert.equal(state.invoices.filter(i => i.retainer_id === rule.id).length, 2); assert.equal(state.entitlements.filter(e => e.retainer_id === rule.id).length, 2);
    const cancellation = { action: 'cancel', effectiveMonth: '2027-01', reason: 'Client ended the engagement at the recorded month boundary' }, cp = await h.json(`/invoice-retainers/${rule.id}/amendment-preview`, cancellation, h.owner);
    await h.json(`/invoice-retainers/${rule.id}/amend`, { ...cancellation, previewHash: cp.previewHash }, h.owner);
    await h.json(`/invoice-retainers/${rule.id}/generate`, { period: '2027-01' }, h.owner, 409);
    const prorated = await authorize(h, s, { kind: 'proration', reference: 'PRORATION-DEC-1', description: 'Explicit ten-day scope adjustment', amountCents: 4500, authorization: 'Principal and client agreed this exact ten-day charge; no automatic proration' });
    assert.equal((await h.json('/invoices', undefined, h.owner)).sources.find(l => l.source_key === prorated.sourceKey).amount_cents, 4500);
    await issue(h, first); const originalPdf = await pdf(h, first.id);
    if (process.env.BLOTTER_INVOICE_EVIDENCE) await invoiceJourney(h, s, rule);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-3' } });
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge }, restored.owner);
    const after = await restored.json('/invoices', undefined, restored.owner), carried = after.retainers.find(r => r.id === rule.id);
    assert.equal(carried.status, 'paused'); assert.equal(carried.principal_id, null); assert.deepEqual(await pdf(restored, first.id), originalPdf);
    await restored.scheduled('2027-01-02T15:00:00Z'); assert.equal((await restored.json('/invoices', undefined, restored.owner)).invoices.length, after.invoices.length);
    assert.equal((await restored.json(`/invoice-retainers/${rule.id}/generate`, { period: '2026-11' }, restored.owner)).id, first.id);
  } finally { await restored?.close(); await h.close(); }
});

// A synthetic historical archive is an input fixture, built from the public
// export format. Setup and assertions never mutate the Worker's D1 directly.
async function historicalArchive(source) {
  const records = source.trim().split('\n').map(JSON.parse), manifest = records[0], parts = [], content = new ContentVerifier(manifest), archive = new ArchiveVerifier(manifest);
  for (const part of records.filter(r => r.kind === 'part')) {
    for (const item of part.items) if (item.kind === 'row') {
      if (['b_invoices', 'b_invoice_entitlements', 'b_invoice_credits', 'b_invoice_amendments', 'b_audit'].includes(item.table)) {
        for (const key of Object.keys(item.row)) if ((key.endsWith('_at') || key === 'at') && item.row[key]) item.row[key] = '2015-01-02T12:00:00.000Z';
      }
      if (item.table === 'b_jobs' && item.row.signed_off_at) { item.row.signed_off_at = '2015-01-02T12:00:00.000Z'; item.row.due_date = '2015-01-02'; }
    }
    const changed = await makePart(part.index, part.items); parts.push(changed); archive.add(changed); for (const item of changed.items) content.add(item);
  }
  return [manifest, ...parts, { kind: 'closing', partCount: parts.length, contentHash: content.digest(), archiveHash: archive.digest() }].map(JSON.stringify).join('\n') + '\n';
}

test('BILL-002 / ERASURE-002 / BASE-001: unpaid balances and unapplied deposits refuse erasure; retained invoice holds, preview, receipt, expiry and newer-journal restore fence', async () => {
  const source = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-4' } }); let h, target;
  try {
    const s = await fixture(source);
    await source.json('/invoices/authority', { authority: 'blotter', reason: 'Native invoice authority' }, source.owner);
    const e = await authorize(source, s), invoice = await draft(source, { ...terms, issueDate: '2015-01-02', dueDate: '2015-01-16', jobId: s.job.id, sourceKeys: [e.sourceKey], contactId: s.billing.id });
    const issued = await issue(source, invoice), bytes = await pdf(source, invoice.id);
    let detail = await source.json(`/jobs/${s.job.id}`, undefined, s.preparer);
    for (const request of detail.requests) {
      await source.json(`/requests/${request.id}/files`, { name: 'close.txt', mime: 'text/plain', contentBase64: Buffer.from('Verified close evidence').toString('base64') }, s.preparer);
      await source.json(`/requests/${request.id}/decide`, { decision: 'accept' }, s.preparer);
    }
    for (const step of detail.steps) await source.json(`/jobs/${s.job.id}/steps`, { ordinal: step.ordinal, done: true }, s.preparer);
    detail = await source.json(`/jobs/${s.job.id}/submit`, { revision: (await source.json(`/jobs/${s.job.id}`, undefined, s.preparer)).job.revision }, s.preparer);
    await source.json(`/jobs/${s.job.id}/review`, { revision: detail.job.revision, decision: 'signoff', note: 'Sources reviewed and work complete' }, s.reviewer);
    const client = await source.json(`/clients/${s.client.id}/detail`, undefined, source.owner);
    await source.json(`/clients/${s.client.id}/lifecycle`, { revision: client.revision, lifecycle: 'archived' }, source.owner);
    let preview = await source.json(`/clients/${s.client.id}/erasure/preview`, undefined, source.owner);
    assert.equal(preview.eligible, false); assert.ok(preview.blockers.some(b => /invoice|balance/i.test(b)));
    await source.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: s.client.name, reason: 'Client request' }, source.owner, 409);
    // Reactivate only to record/apply the client-supplied settlement credit.
    let c = await source.json(`/clients/${s.client.id}/detail`, undefined, source.owner); await source.json(`/clients/${s.client.id}/lifecycle`, { revision: c.revision, lifecycle: 'active' }, source.owner);
    const deposit = await source.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', reference: 'SUPPLIED-SETTLEMENT-1', amountCents: 10000, reason: 'Principal recorded supplied deposit evidence; no provider settlement inferred' }, source.owner);
    c = await source.json(`/clients/${s.client.id}/detail`, undefined, source.owner); await source.json(`/clients/${s.client.id}/lifecycle`, { revision: c.revision, lifecycle: 'archived' }, source.owner);
    preview = await source.json(`/clients/${s.client.id}/erasure/preview`, undefined, source.owner); assert.ok(preview.blockers.some(b => /deposit|credit|unapplied/i.test(b)));
    c = await source.json(`/clients/${s.client.id}/detail`, undefined, source.owner); await source.json(`/clients/${s.client.id}/lifecycle`, { revision: c.revision, lifecycle: 'active' }, source.owner);
    const allocation = await source.json(`/invoices/${invoice.id}/credits`, { creditId: deposit.id, amountCents: 10000, reason: 'Allocate this recorded deposit to the invoice' }, source.owner); assert.equal(allocation.balanceCents, 0);
    assert.deepEqual(await pdf(source, invoice.id), bytes);
    c = await source.json(`/clients/${s.client.id}/detail`, undefined, source.owner); await source.json(`/clients/${s.client.id}/lifecycle`, { revision: c.revision, lifecycle: 'archived' }, source.owner);
    const original = await (await source.request('/api/blotter/backup', undefined, source.owner)).text(), historical = await historicalArchive(original);
    h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-5' } }); await h.json('/restore', { archive: historical, confirm: 'RESTORE', acknowledge }, h.owner);
    assert.deepEqual(await pdf(h, invoice.id), bytes);
    const hold = await h.json(`/clients/${s.client.id}/retention`, { scope: 'class', class: 'billing', kind: 'hold', owner: 'owner@example.test', reviewDate: '2999-01-01', reason: 'Invoice under retained-record review' }, h.owner);
    assert.ok((await h.json('/retention/ready', undefined, h.owner)).held.some(r => r.kind === 'invoice' && r.id === invoice.id));
    await h.json('/retention/ready/confirm', { kind: 'invoice', id: invoice.id, reason: 'Period passed' }, h.owner, 409);
    await h.json(`/retention/${hold.id}/release`, { reason: 'Review complete' }, h.owner);
    preview = await h.json(`/clients/${s.client.id}/erasure/preview`, undefined, h.owner);
    assert.equal(preview.eligible, true); assert.ok(preview.records.some(r => r.kind === 'invoice' && r.clock === '2015-01-02'));
    assert.ok(preview.classes.find(c => c.class === 'billing').retained > 0);
    const receipt = await h.json(`/clients/${s.client.id}/erasure`, { planHash: preview.planHash, confirm: s.client.name, reason: 'Client requested deletion with billing evidence retained' }, h.owner);
    assert.ok(JSON.stringify(receipt).includes('billing_invoices')); assert.deepEqual(await pdf(h, invoice.id), bytes);
    const ready = (await h.json('/retention/ready', undefined, h.owner)).ready.find(r => r.kind === 'invoice' && r.id === invoice.id); assert.ok(ready);
    const expiry = await h.json('/retention/ready/confirm', { kind: 'invoice', id: invoice.id, reason: 'Billing retention ended; client requested deletion' }, h.owner); assert.equal(expiry.kind, 'invoice');
    assert.equal((await h.request(`/api/blotter/invoices/${invoice.id}/pdf`, undefined, h.owner)).status, 404);
    const retained = await h.json(`/invoices/${invoice.id}`, undefined, h.owner); assert.deepEqual([retained.number, retained.total_cents, retained.pdf_sha256], [issued.number, 10000, issued.sha256]); assert.equal(retained.snapshot.erased, 1);
    const journal = await h.json('/erasure-journal', undefined, h.owner); assert.ok(journal.expiries.some(e => e.kind === 'invoice' && e.record_id === invoice.id));
    const latest = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    target = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-6' } }); await target.json('/restore', { archive: historical, journal: latest, confirm: 'RESTORE' }, target.owner, 409);
  } finally { await target?.close(); await h?.close(); await source.close(); }
});
