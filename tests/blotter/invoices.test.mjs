// Native invoice journeys through the built Worker. Only the mail edge is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pdfText } from './pdf-text.mjs';
import { PDFDocument } from 'pdf-lib';
import { harness } from './harness.mjs';
import { collectionsJourney, invoiceJourney, receivablesJourney } from './invoices-ui.mjs';
import {assertInvoiceReport} from './invoice-report-proof.mjs';
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
    const pendingDeposit=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);
    assert.ok(pendingDeposit.blockers.some(b=>/unapplied deposit/i.test(b)),'A draft reservation does not settle the recorded deposit for erasure');
    await h.json('/exports', { title: 'Duplicate invoice source', sourceKeys: [`time:${hourly.id}`] }, h.owner, 409);
    await h.json('/invoices', { ...input, previewHash: p.previewHash }, h.owner, 409);
    await h.json(`/invoices/${invoice.id}/issue`, { revision: invoice.revision, snapshotHash: invoice.snapshotHash, reviewNote: 'Review' }, s.reviewer, 403);
    await h.json(`/invoices/${invoice.id}/issue`, { revision: invoice.revision, snapshotHash: 'stale', reviewNote: 'Review' }, h.owner, 409);
    const issued = await issue(h, invoice);
    assert.ok(!(await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner)).blockers.some(b=>/unapplied deposit/i.test(b)),'Issuing applies the reserved deposit; any unpaid invoice remains a separate refusal');
    await h.json(`/invoices/${invoice.id}/issue`, { revision: invoice.revision, snapshotHash: invoice.snapshotHash, reviewNote: 'Duplicate event' }, h.owner, 409);
    await assertInvoiceReport(h,s,invoice.id);
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

test('BILL-002 / BASE-001: monthly events generate one draft per entitlement and, without a recorded consent, only drafts; price and cancellation previews, explicit prorations and portable paused rules', async () => {
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
    assert.ok(state.invoices.filter(i => i.retainer_id === rule.id).every(i => i.status === 'draft' && i.auto_revision === null && i.auto_exception === null), 'A rule with no consent never issues or sends');
    assert.equal(h.mails.filter(m => /INV-/.test(m.subject ?? '')).length, 0);
    const cancellation = { action: 'cancel', effectiveMonth: '2027-01', reason: 'Client ended the engagement at the recorded month boundary' }, cp = await h.json(`/invoice-retainers/${rule.id}/amendment-preview`, cancellation, h.owner);
    await h.json(`/invoice-retainers/${rule.id}/amend`, { ...cancellation, previewHash: cp.previewHash }, h.owner);
    await h.json(`/invoice-retainers/${rule.id}/generate`, { period: '2027-01' }, h.owner, 409);
    const prorated = await authorize(h, s, { kind: 'proration', reference: 'PRORATION-DEC-1', description: 'Explicit ten-day scope adjustment', amountCents: 4500, authorization: 'Principal and client agreed this exact ten-day charge; no automatic proration' });
    assert.equal((await h.json('/invoices', undefined, h.owner)).sources.find(l => l.source_key === prorated.sourceKey).amount_cents, 4500);
    await issue(h, first); const originalPdf = await pdf(h, first.id);
    await assertInvoiceReport(h,s,first.id);
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
      if (['b_invoices', 'b_invoice_entitlements', 'b_invoice_credits', 'b_invoice_amendments', 'b_invoice_writeoffs', 'b_audit'].includes(item.table)) {
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
    const e = await authorize(source, s), invoice = await draft(source, { ...terms, title:s.client.name+' November scope', issueDate: '2015-01-02', dueDate: '2015-01-16', jobId: s.job.id, sourceKeys: [e.sourceKey], contactId: s.billing.id });
    const issued = await issue(source, invoice), bytes = await pdf(source, invoice.id);
    const shipped = await source.json(`/jobs/${s.job.id}/deliverables`, { title: 'Final return copy', name: 'Return.pdf', mime: 'application/pdf', contentBase64: Buffer.from('Return').toString('base64'), contactId: s.billing.id }, s.preparer);
    const gate = await source.json(`/jobs/${s.job.id}/payment-gates`, { deliverableId: shipped.deliverableId, invoiceId: invoice.id, reason: `Release ${s.client.name} return on payment` }, source.owner);
    await source.json(`/payment-gates/${gate.id}/override`, { reason: `Partner released the file for ${s.client.name}` }, source.owner);
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
    const deposit = await source.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', reference: 'SUPPLIED-SETTLEMENT-1', amountCents: 7000, reason: 'Principal recorded supplied deposit evidence; no provider settlement inferred' }, source.owner);
    c = await source.json(`/clients/${s.client.id}/detail`, undefined, source.owner); await source.json(`/clients/${s.client.id}/lifecycle`, { revision: c.revision, lifecycle: 'archived' }, source.owner);
    preview = await source.json(`/clients/${s.client.id}/erasure/preview`, undefined, source.owner); assert.ok(preview.blockers.some(b => /deposit|credit|unapplied/i.test(b)));
    c = await source.json(`/clients/${s.client.id}/detail`, undefined, source.owner); await source.json(`/clients/${s.client.id}/lifecycle`, { revision: c.revision, lifecycle: 'active' }, source.owner);
    const allocation = await source.json(`/invoices/${invoice.id}/credits`, { creditId: deposit.id, amountCents: 7000, reason: 'Allocate this recorded deposit to the invoice' }, source.owner); assert.equal(allocation.balanceCents, 3000);
    const writeOffReason = 'Partner approved write-off for ' + s.client.name + ' after a settlement discussion';
    assert.equal((await source.json(`/invoices/${invoice.id}/write-off`, { amountCents: 3000, reason: writeOffReason }, source.owner)).balanceCents, 0);
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
    assert.ok(JSON.stringify(receipt).includes('billing_invoices')); assert.ok(JSON.stringify(receipt).includes('billing_invoice_writeoffs')); assert.ok(JSON.stringify(receipt).includes('b_payment_gates') && JSON.stringify(receipt).includes('b_payment_overrides'), 'Payment gate reasons are redacted by the erasure receipt'); assert.deepEqual(await pdf(h, invoice.id), bytes);
    assert.ok(!JSON.stringify(await h.json('/invoices',undefined,h.owner)).includes(s.client.name),'Normal billing lists exclude retained identity payloads');
    const explicitRetained=await h.json(`/invoices/${invoice.id}`,undefined,h.owner);assert.equal(explicitRetained.snapshot.client.name,s.client.name);
    const retainedHistory=await h.json(`/clients/${s.client.id}/history?kind=billing`,undefined,h.owner);
    assert.ok(retainedHistory.history.some(e=>e.action==='invoice.retained_read'),'Explicit retained-record reads are attributed');
    assert.ok(!JSON.stringify(retainedHistory.history).includes(s.client.name),'Ordinary history removes retained invoice identities');
    assert.equal((await h.json('/search?'+new URLSearchParams({q:s.client.name,type:'invoice'}),undefined,h.owner)).results.length,0);
    assert.ok(!JSON.stringify(await h.json('/reports/performance?'+new URLSearchParams({from:'2026-11-01',to:'2026-11-30',client:s.client.id}),undefined,h.owner)).includes(s.client.name),'Plain reports exclude retained invoice identities');
    await h.json('/team/invite',{email:'reviewer@example.test'},h.owner);
    const retainedReviewer=await h.login('reviewer@example.test');await h.json(`/invoices/${invoice.id}`,undefined,retainedReviewer,403);assert.equal((await h.request(`/api/blotter/invoices/${invoice.id}/pdf`,undefined,retainedReviewer)).status,403);
    assert.ok(!JSON.stringify(await h.json('/retention/ready',undefined,h.owner)).includes(s.client.name),'Expiry queues use opaque retained-record labels');
    const ready = (await h.json('/retention/ready', undefined, h.owner)).ready.find(r => r.kind === 'invoice' && r.id === invoice.id); assert.ok(ready);
    const expiry = await h.json('/retention/ready/confirm', { kind: 'invoice', id: invoice.id, reason: 'Billing retention ended; client requested deletion' }, h.owner); assert.equal(expiry.kind, 'invoice');
    assert.equal((await h.request(`/api/blotter/invoices/${invoice.id}/pdf`, undefined, h.owner)).status, 404);
    const retained = await h.json(`/invoices/${invoice.id}`, undefined, h.owner); assert.deepEqual([retained.number, retained.total_cents, retained.pdf_sha256], [issued.number, 10000, issued.sha256]); assert.equal(retained.snapshot.erased, 1);
    assert.deepEqual(retained.writeOffs.map(w => [w.amount_cents, w.reason, w.approved_by]), [[3000, '[erased]', 'owner@example.test']], 'Expiry erases the write-off reason and keeps its amount and approver');
    const journal = await h.json('/erasure-journal', undefined, h.owner); assert.ok(journal.expiries.some(e => e.kind === 'invoice' && e.record_id === invoice.id));
    const latest = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    target = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-6' } }); await target.json('/restore', { archive: historical, journal: latest, confirm: 'RESTORE' }, target.owner, 409);
  } finally { await target?.close(); await h?.close(); await source.close(); }
});

test('BILL-002 / ACCESS-002: a financial-authority holder bills and sends by email alone; a consented rule revision auto-issues and sends within its cap once per month, otherwise leaves a draft with a named exception, and a restore returns it without consent', async () => {
  const h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-7' } }); let restored;
  try {
    const s = await fixture(h);
    const pat = await h.json(`/clients/${s.client.id}/contacts`, { name: 'Pat Paper', email: 'pat@example.test', roles: ['billing'], authorized: true, portal: false, requestConsent: false, emailConsent: true, consentNote: 'Client asked for invoices by email only' }, h.owner);
    await h.json('/invoices/authority', { authority: 'blotter', reason: 'Native invoice authority selected' }, h.owner);
    await h.json('/invoices/authority', { authority: 'blotter', reason: 'A holder cannot choose the authority' }, s.reviewer, 403);
    // The grant makes the reviewer a billing partner: prepare, issue and send, to a contact with no portal.
    await h.json('/access/delegations', { email: 'reviewer@example.test', permissions: ['financial_authority'], reason: 'Billing partner' }, h.owner);
    const fee = await authorize(h, s); const input = { ...terms, jobId: s.job.id, sourceKeys: [fee.sourceKey], contactId: pat.id };
    const preview = await h.json('/invoices/preview', input, s.reviewer), partnerDraft = await h.json('/invoices', { ...input, previewHash: preview.previewHash }, s.reviewer);
    await h.json('/invoices/preview', input, s.preparer, 403);
    const issued = await h.json(`/invoices/${partnerDraft.id}/issue`, { revision: partnerDraft.revision, snapshotHash: partnerDraft.snapshotHash, reviewNote: 'Reviewed by the billing partner' }, s.reviewer);
    const delivery = await h.json(`/invoices/${partnerDraft.id}/delivery-preview`, { contactId: pat.id }, s.reviewer);
    const emailed = await h.json(`/invoices/${partnerDraft.id}/send`, { contactId: pat.id, previewHash: delivery.previewHash }, s.reviewer);
    assert.equal(emailed.status, 'accepted'); assert.equal(emailed.portalUrl, null);
    const patMail = h.mails.find(m => m.to[0] === 'pat@example.test');
    assert.equal(patMail.attachments.length, 1); assert.equal(hash(Buffer.from(patMail.attachments[0].content, 'base64')), issued.sha256); assert.ok(!/invoice portal|\/invoice\//i.test(patMail.text ?? patMail.html));
    // Automatic issue and send: one holder consents to one rule revision, with a cap, a recipient and a reason.
    const rule = await h.json('/invoice-retainers', { ...terms, jobId: s.job.id, title: 'Monthly bookkeeping retainer', startMonth: '2026-11', amountCents: 12000, billDay: 28, dueDays: 14, contactId: s.billing.id, authorization: 'Client agreement authorizes a monthly fee and recorded invoice calendar' }, h.owner);
    const rev = (await h.json('/invoices', undefined, h.owner)).retainers.find(r => r.id === rule.id).revision;
    const consent = { revision: rev, capCents: 15000, contactId: s.billing.id, reason: 'Client agreement authorizes automatic monthly invoices up to USD 150' };
    await h.json(`/invoice-retainers/${rule.id}/auto-consent`, consent, s.preparer, 403);
    await h.json(`/invoice-retainers/${rule.id}/auto-consent`, { ...consent, contactId: s.contacts.find(c => c.email === 'tax@example.test').id }, s.reviewer, 409);
    await h.json(`/invoice-retainers/${rule.id}/auto-consent`, consent, s.reviewer);
    const mailsBefore = h.mails.length, periods = () => h.json('/invoices', undefined, h.owner).then(x => x.invoices.filter(i => i.retainer_id === rule.id));
    await h.scheduled('2026-11-28T15:00:00Z');
    let [november] = await periods(); assert.equal(november.status, 'issued'); assert.equal(november.auto_revision, 1); assert.equal(november.auto_exception, null);
    const doc = await pdf(h, november.id); assert.equal(doc.subarray(0, 5).toString(), '%PDF-', doc.toString().slice(0, 200));
    assert.match(await pdfText(doc), /This invoice was auto-issued under rule revision 1/);
    await h.scheduled('2026-11-28T16:00:00Z'); await h.restart(); await h.scheduled('2026-11-28T17:00:00Z');
    assert.equal((await periods()).length, 1); assert.equal(h.mails.length, mailsBefore + 1, 'A restart does not issue or send the period twice');
    await h.scheduled('2026-12-28T15:00:00Z'); await h.scheduled('2026-12-28T16:00:00Z');
    const issuedPeriods = await periods(); assert.deepEqual(issuedPeriods.map(i => [i.period, i.status]).sort(), [['2026-11', 'issued'], ['2026-12', 'issued']]); assert.equal(h.mails.length, mailsBefore + 2);
    assert.equal(h.mails.at(-1).to[0], 'alex@example.test');
    // A price change is a new rule revision: the consent no longer covers it, so the run leaves a draft.
    const change = { action: 'price', effectiveMonth: '2027-01', amountCents: 20000, taxCents: 0, taxTreatment: terms.taxTreatment, taxAuthorization: terms.taxAuthorization, authorization: 'Client accepted the January price AMEND-2', reason: 'Expanded scope' };
    const ap = await h.json(`/invoice-retainers/${rule.id}/amendment-preview`, change, h.owner); await h.json(`/invoice-retainers/${rule.id}/amend`, { ...change, previewHash: ap.previewHash }, h.owner);
    await h.scheduled('2027-01-28T15:00:00Z');
    const january = (await periods()).find(i => i.period === '2027-01'); assert.equal(january.status, 'draft'); assert.match(january.auto_exception, /rule changed after the consent/);
    // The holder consents again to the new revision with a cap below the price: over the cap is a draft plus a named exception.
    const revised = (await h.json('/invoices', undefined, h.owner)).retainers.find(r => r.id === rule.id);
    await h.json(`/invoice-retainers/${rule.id}/auto-consent`, { ...consent, revision: revised.revision, capCents: 15000 }, s.reviewer);
    await h.scheduled('2027-02-28T15:00:00Z');
    const february = (await periods()).find(i => i.period === '2027-02'); assert.equal(february.status, 'draft'); assert.match(february.auto_exception, /exceeds the consented cap USD 150\.00/);
    // A demoted consenter: the next period is a draft too, naming the lost authority.
    await h.json('/access/delegations', { email: 'reviewer@example.test', permissions: [], reason: 'Duties moved' }, h.owner);
    await h.json(`/invoice-retainers/${rule.id}/auto-consent`, { ...consent, revision: revised.revision }, s.reviewer, 403);
    await h.scheduled('2027-03-28T15:00:00Z');
    const march = (await periods()).find(i => i.period === '2027-03'); assert.equal(march.status, 'draft'); assert.match(march.auto_exception, /no longer holds financial authority/);
    assert.equal(h.mails.length, mailsBefore + 2, 'No run past the exceptions sent anything');
    // A restore brings the rule back paused and without consent.
    await h.stepUp(h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-8' } });
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge }, restored.owner);
    const carried = (await restored.json('/invoices', undefined, restored.owner)).retainers.find(r => r.id === rule.id);
    assert.equal(carried.status, 'paused'); assert.equal(carried.autoConsent, null);
    const quiet = restored.mails.length; await restored.scheduled('2027-04-28T15:00:00Z'); assert.equal(restored.mails.length, quiet, 'A restored rule neither generates nor sends');
  } finally { await restored?.close(); await h.close(); }
});

test('BILL-003 / BASE-001: WIP, aging, realization and profitability reconcile to approved sources and recorded receipts; a partner-approved write-off changes the period report and statement while the issued invoice stays byte-identical', async () => {
  const h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-11' } }); let restored;
  const day = n => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const monthAt = n => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
  try {
    const s = await fixture(h);
    await h.json('/invoices/authority', { authority: 'blotter', reason: 'Native invoice authority selected' }, h.owner);
    await h.json('/team/rates', { email: 'preparer@example.test', rateCents: 10000, effectiveFrom: '2026-01-01', currency: 'USD' }, h.owner);
    const hourly = await h.json(`/jobs/${s.job.id}/time`, { date: '2026-11-02', minutes: 60, description: 'Hourly bookkeeping' }, s.preparer);
    const spare = await h.json(`/jobs/${s.job.id}/time`, { date: '2026-11-03', minutes: 30, description: 'Approved work not yet invoiced' }, s.preparer);
    await h.json('/timesheets/submit', { weekStart: '2026-11-02' }, s.preparer);
    for (const t of [hourly, spare]) await h.json(`/time/${t.id}/review`, { decision: 'approve' }, s.reviewer);
    const adjustment = await h.json(`/time/${hourly.id}/adjust`, { minutes: -15, reason: 'Write down a slow reconciliation' }, h.owner);
    const expense = await h.json(`/jobs/${s.job.id}/expenses`, { kind: 'filing_fee', date: '2026-11-02', description: 'Filing disbursement', costCents: 1000, billable: true, markupPercent: 10, receipt: { name: 'receipt.txt', mime: 'text/plain', contentBase64: Buffer.from('Filing receipt').toString('base64') } }, s.preparer);
    await h.json(`/expenses/${expense.id}/decide`, { decision: 'approve' }, s.reviewer);
    const fixed = await authorize(h, s, { amountCents: 20000 });
    const a = await draft(h, { ...terms, title: 'Fixed fee, hours and filing', issueDate: day(-60), dueDate: day(-45), jobId: s.job.id, sourceKeys: [fixed.sourceKey, `time:${hourly.id}`, `adj:${adjustment.id}`, `exp:${expense.id}`], contactId: s.billing.id });
    await issue(h, a);
    const rule = await h.json('/invoice-retainers', { ...terms, jobId: s.job.id, title: 'Monthly bookkeeping retainer', startMonth: monthAt(-2), amountCents: 12000, billDay: 1, dueDays: 14, contactId: s.billing.id, authorization: 'Client agreement authorizes a monthly fee' }, h.owner);
    const earned = await h.json(`/invoice-retainers/${rule.id}/generate`, { period: monthAt(-2) }, h.owner), deferred = await h.json(`/invoice-retainers/${rule.id}/generate`, { period: monthAt(2) }, h.owner);
    await issue(h, earned); await issue(h, deferred);
    // A partial payment (a recorded bank receipt) and a credit memo discharge part of the first invoice.
    const receipt = await h.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', reference: 'BANK-RECEIPT-B3-1', amountCents: 10000, reason: 'Client paid part by bank transfer; receipt supplied' }, h.owner);
    const memo = await h.json('/invoice-credits', { clientId: s.client.id, kind: 'credit', reference: 'CREDIT-MEMO-B3-1', amountCents: 2000, reason: 'Goodwill credit agreed with the client' }, h.owner);
    await h.json(`/invoices/${a.id}/credits`, { creditId: receipt.id, amountCents: 10000, reason: 'Apply the recorded bank receipt' }, h.owner);
    await h.json(`/invoices/${a.id}/credits`, { creditId: memo.id, amountCents: 2000, reason: 'Apply the credit memo' }, h.owner);

    const path = '/reports/performance?' + new URLSearchParams({ from: '2026-11-01', to: '2026-11-30', client: s.client.id });
    const before = await h.json(path, undefined, h.owner), r = before.invoiceReporting.receivables;
    // Billed 28,600 + two 12,000 retainer months; recorded excludes the 2,500 write-down; settled is the receipt plus the credit.
    assert.deepEqual([r.totals.recordedCents, r.totals.writeDownCents, r.totals.writeUpCents, r.totals.billedCents, r.totals.collectedCents, r.totals.creditedCents, r.totals.writtenOffCents, r.totals.outstandingCents, r.totals.expenseCostCents],
      [55100, 2500, 0, 52600, 10000, 2000, 0, 40600, 1000]);
    assert.deepEqual([r.totals.billedRealizationBps, r.totals.settledBps], [9546, 2281]);
    assert.deepEqual([r.retainers.earnedCents, r.retainers.deferredCents], [12000, 12000]);
    assert.deepEqual([r.retainers.earnedInvoiceIds, r.retainers.deferredInvoiceIds], [[earned.id], [deferred.id]]);
    const client = r.clients.find(c => c.id === s.client.id), service = r.services[0], job = r.jobs.find(j => j.id === s.job.id);
    assert.deepEqual([client.outstandingCents, client.wipCents, client.netMarginBeforeStaffCostCents], [40600, 5000, 51600]);
    assert.deepEqual([service.billedCents, job.billedCents], [52600, 52600]);
    // Staff cost needs a principal-recorded hourly cost rate; invoiced time with none is counted, never guessed.
    assert.deepEqual([r.totals.staffCostCents, r.totals.unratedStaffMinutes, r.totals.profitCents], [0, 75, 51600]);
    const cost = { email: 'preparer@example.test', costCents: 4000, effectiveFrom: '2026-01-01', reason: 'Salary and overhead divided by billable hours' };
    for (const who of [s.reviewer, s.preparer]) await h.json('/team/costs', cost, who, 403);
    await h.json('/team/costs', { ...cost, costCents: -1 }, h.owner, 400);
    await h.json('/team/costs', cost, h.owner);
    const costed = (await h.json(path, undefined, h.owner)).invoiceReporting.receivables.totals;
    assert.deepEqual([costed.staffCostCents, costed.unratedStaffMinutes, costed.profitCents], [3000, 0, 48600]);
    assert.deepEqual([(await h.json('/team/costs', undefined, h.owner)).length, (await h.json(path, undefined, s.reviewer)).invoiceReporting.receivables.totals.staffCostCents], [1, null]);
    await h.json('/team/costs', undefined, s.reviewer, 403);
    // Totals reconcile to the approved sources, to the invoices' own balances and to the client statement.
    const wip = (await h.json('/billing', undefined, h.owner)).unbilled.filter(l => l.job_id === s.job.id);
    assert.deepEqual(wip.map(l => [l.source_key, l.amount_cents]), [[`time:${spare.id}`, 5000]]);
    const lines = (await h.json(`/invoices/${a.id}`, undefined, h.owner)).snapshot.lines;
    assert.deepEqual(lines.map(l => [l.kind, l.amount_cents]).sort(), [['adjustment', -2500], ['expense', 1100], ['fixed', 20000], ['time', 10000]].sort());
    const balances = (await h.json('/invoices', undefined, h.owner)).invoices.filter(i => i.client_id === s.client.id && i.status === 'issued');
    assert.equal(balances.reduce((n, i) => n + i.balance_cents, 0), 40600); assert.equal(before.invoiceReporting.totals.receivableCents, 40600);
    assert.equal(r.aging.reduce((n, b) => n + b.cents, 0), 40600); assert.deepEqual(r.aging.find(b => b.bucket === '31-60 days').invoiceIds, [a.id]);
    const statement = await h.json(`/clients/${s.client.id}/statement`, undefined, h.owner);
    // The statement lists invoices dated on or before its date, so the retainer month billed ahead is on a later one.
    assert.equal(statement.totals.openCents, 40600 - 12000); assert.deepEqual(statement.credits.map(c => [c.reference, c.appliedCents]), [['BANK-RECEIPT-B3-1', 10000], ['CREDIT-MEMO-B3-1', 2000]]); assert.deepEqual(statement.payments, []);
    await h.json(path, undefined, s.preparer, 403);

    // The principal approves a write-off; nobody else can, and it cannot exceed the open balance.
    const document = await pdf(h, a.id), original = await h.json(`/invoices/${a.id}`, undefined, h.owner), reason = 'Partner approved: the client disputed the reconciliation hours and collection is not pursued';
    for (const who of [s.preparer, s.reviewer]) await h.json(`/invoices/${a.id}/write-off`, { amountCents: 6600, reason }, who, 403);
    await h.json(`/invoices/${a.id}/write-off`, { amountCents: 16601, reason }, h.owner, 409);
    await h.json(`/invoices/${a.id}/write-off`, { amountCents: 0, reason }, h.owner, 400);
    await h.json(`/invoices/${a.id}/write-off`, { amountCents: 6600, reason: '' }, h.owner, 400);
    await h.json('/invoices/absent/write-off', { amountCents: 100, reason }, h.owner, 404);
    const off = await h.json(`/invoices/${a.id}/write-off`, { amountCents: 6600, reason }, h.owner); assert.equal(off.balanceCents, 10000);
    await h.json(`/invoices/${a.id}/write-off`, { amountCents: 10001, reason }, h.owner, 409);
    await h.json(`/invoices/${a.id}/credits`, { creditId: (await h.json('/invoice-credits', { clientId: s.client.id, kind: 'credit', reference: 'CREDIT-MEMO-B3-2', amountCents: 20000, reason: 'Second credit memo' }, h.owner)).id, amountCents: 10001, reason: 'Over-apply' }, h.owner, 400);
    // The issued invoice, its PDF and its totals are never rewritten; only the balance moves.
    const changed = await h.json(`/invoices/${a.id}`, undefined, h.owner);
    assert.deepEqual([changed.total_cents, changed.subtotal_cents, changed.snapshotHash, changed.pdf_sha256, changed.balance_cents, changed.written_off_cents], [original.total_cents, original.subtotal_cents, original.snapshotHash, original.pdf_sha256, 10000, 6600]);
    assert.deepEqual(await pdf(h, a.id), document);
    assert.deepEqual(changed.writeOffs.map(w => [w.amount_cents, w.reason, w.approved_by]), [[6600, reason, 'owner@example.test']]);
    // The period report, the statement and the history show the change; an earlier statement date does not.
    const after = await h.json(path, undefined, h.owner), ra = after.invoiceReporting.receivables;
    assert.deepEqual([ra.totals.writtenOffCents, ra.totals.outstandingCents, ra.totals.billedCents, ra.totals.netMarginBeforeStaffCostCents, ra.totals.collectedCents], [6600, 34000, 52600, 45000, 10000]); assert.equal(ra.totals.profitCents, 42000);
    assert.equal(after.invoiceReporting.totals.receivableCents, 34000); assert.equal(ra.aging.find(b => b.bucket === '31-60 days').cents, 10000);
    assert.deepEqual(after.invoiceReporting.invoices.map(i => [i.id, i.subtotalCents, i.totalCents]), before.invoiceReporting.invoices.map(i => [i.id, i.subtotalCents, i.totalCents]));
    assert.equal(after.invoiceReporting.invoices.find(i => i.id === a.id).writtenOffCents, 6600);
    assert.equal((await h.json(`/clients/${s.client.id}/statement`, undefined, h.owner)).totals.openCents, 34000 - 12000);
    const yesterday = await h.json(`/clients/${s.client.id}/statement?asOf=${day(-1)}`, undefined, h.owner);
    // Before today's receipts, credit memo and write-off were recorded, the same invoices show their full balances.
    assert.equal(yesterday.totals.openCents, 28600 + 12000); assert.equal(yesterday.invoices.find(i => i.id === a.id).writtenOffCents, 0);
    const csv = await (await h.request(`/api/blotter/clients/${s.client.id}/statement/csv`, undefined, h.owner)).text();
    assert.match(csv, /"Invoice","INV-\d+","Fixed fee, hours and filing","[^"]+","[^"]+","31-60 days","286.00","120.00","66.00","100.00"/);
    const history = await h.json(`/clients/${s.client.id}/history?kind=billing`, undefined, h.owner);
    assert.ok(history.history.some(e => e.action === 'invoice.written_off' && e.object_id === a.id && e.detail.includes(reason)));
    const exported = await (await h.request('/api/blotter/reports/performance/csv?' + new URLSearchParams({ from: '2026-11-01', to: '2026-11-30', client: s.client.id }), undefined, h.owner)).text();
    assert.ok(exported.includes('"aging_bucket"') && exported.includes(off.id) && exported.includes('Partner approved: the client disputed'));
    // A restore carries the write-off and the balance it produced.
    await h.stepUp(h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-12' } });
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge }, restored.owner);
    const back = await restored.json(`/invoices/${a.id}`, undefined, restored.owner);
    assert.deepEqual([back.balance_cents, back.written_off_cents, back.writeOffs[0].reason], [10000, 6600, reason]);
    const carried = (await restored.json(path, undefined, restored.owner)).invoiceReporting.receivables.totals;
    assert.deepEqual([carried.writtenOffCents, carried.staffCostCents, carried.profitCents], [6600, 3000, 42000]);
    await receivablesJourney(h, s, { title: 'Fixed fee, hours and filing' });
    // A financial-authority holder approves a write-off in their own name; revoking the grant ends that authority at once.
    await h.json('/access/delegations', { email: 'reviewer@example.test', permissions: ['financial_authority'], reason: 'Billing partner' }, h.owner);
    await h.json(`/invoices/${earned.id}/write-off`, { amountCents: 100, reason: 'Billing partner rounding write-off' }, s.reviewer);
    assert.equal((await h.json(`/invoices/${earned.id}`, undefined, h.owner)).writeOffs[0].approved_by, 'reviewer@example.test');
    assert.ok((await h.json(`/clients/${s.client.id}/history?kind=billing`, undefined, h.owner)).history.some(e => e.action === 'invoice.written_off' && e.object_id === earned.id && e.actor === 'reviewer@example.test'));
    await h.json('/access/delegations', { email: 'reviewer@example.test', permissions: [], reason: 'Duties moved' }, h.owner);
    await h.json(`/invoices/${earned.id}/write-off`, { amountCents: 100, reason: 'After the grant was revoked' }, s.reviewer, 403);
  } finally { await restored?.close(); await h.close(); }
});

test('BILL-005 / ERASURE-002 / BASE-001: a gated final copy stays locked until its invoice is paid (a card receipt at once, ACH by the firm policy), the client\'s own records stay open, partner overrides are recorded and an overdue client shows the credit hold', async () => {
  const h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-13' } }); let restored;
  const day = n => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10), b64 = x => Buffer.from(x).toString('base64');
  try {
    const s = await fixture(h);
    await h.json('/invoices/authority', { authority: 'blotter', reason: 'Native invoice authority selected' }, h.owner);
    const owe = async (reference, amountCents, dueDate) => {
      const e = await h.json('/invoice-entitlements', { jobId: s.job.id, kind: 'milestone', reference, description: `Milestone ${reference}`, amountCents, authorization: `Client accepted ${reference}` }, h.owner);
      const d = await draft(h, { ...terms, title: `Invoice ${reference}`, issueDate: day(-60), dueDate, jobId: s.job.id, sourceKeys: [e.sourceKey], contactId: s.billing.id });
      await issue(h, d); return d;
    };
    const a = await owe('GATE-A', 30000, day(-40)), b = await owe('GATE-B', 10000, day(-30)), c = await owe('GATE-C', 40000, day(-20));
    const ship = async (title, contentBase64 = b64(title)) => h.json(`/jobs/${s.job.id}/deliverables`, { title, name: `${title}.pdf`, mime: 'application/pdf', contentBase64, contactId: s.billing.id }, s.preparer);
    const final = await ship('Final return copy'), second = await ship('Second final copy'), third = await ship('Third final copy');
    const token = new URL(third.portalUrl).pathname.split('/').at(-1), portal = path => h.request(`/api/blotter/portal/${token}${path}`);
    const file = async v => portal(`/deliverables/${v.id}/file`), listed = async () => (await (await portal('/deliverables')).json());
    // The client's own upload, shared back with them, is never gated.
    const request = (await h.json(`/jobs/${s.job.id}`, undefined, h.owner)).requests[0];
    await h.json(`/portal/${token}/requests/${request.id}`, { name: 'W-2.txt', mime: 'text/plain', contentBase64: b64('Client supplied record') });
    const own = (await h.json(`/jobs/${s.job.id}/documents`, undefined, h.owner)).find(f => f.name === 'W-2.txt');
    const ownAccess = await h.json(`/documents/${encodeURIComponent(own.id ?? own.file_key)}/access`, undefined, h.owner);
    await h.json(`/documents/${encodeURIComponent(own.id ?? own.file_key)}/access`, { revision: ownAccess.revision, visibility: 'contacts', contactIds: [s.billing.id] }, h.owner);
    const ownCopy = async () => (await portal(`/files/${encodeURIComponent(own.id ?? own.file_key)}`)).text();
    assert.equal(await (await file(final)).text(), 'Final return copy', 'Before a gate the client can open the file');
    // Only the principal or a financial-authority holder gates, and only the firm's own deliverables.
    const gate = { deliverableId: final.deliverableId, invoiceId: a.id, reason: 'Final return is released on payment of the engagement invoice' };
    for (const who of [s.preparer, s.reviewer]) await h.json(`/jobs/${s.job.id}/payment-gates`, gate, who, 403);
    await h.json(`/jobs/${s.job.id}/payment-gates`, { ...gate, deliverableId: own.id ?? own.file_key }, h.owner, 404);
    await h.json(`/jobs/${s.job.id}/payment-gates`, { ...gate, invoiceId: 'absent' }, h.owner, 409);
    await h.json(`/jobs/${s.job.id}/payment-gates`, { ...gate, reason: '' }, h.owner, 400);
    const made = await h.json(`/jobs/${s.job.id}/payment-gates`, gate, h.owner);
    await h.json(`/jobs/${s.job.id}/payment-gates`, gate, h.owner, 409);
    assert.deepEqual([made.locked, made.remainingCents, made.invoiceNumber], [true, 30000, `INV-${String((await h.json(`/invoices/${a.id}`, undefined, h.owner)).number).padStart(6, '0')}`]);
    // Locked: the listing says so, the file door and a bearer share both refuse, and the client's own record stays open.
    const lockedList = (await listed())[0]; assert.deepEqual([lockedList.locked.invoiceNumber, lockedList.locked.remainingCents], [made.invoiceNumber, 30000]);
    const refused = await file(final); assert.equal(refused.status, 402); assert.match((await refused.json()).error, /locked until invoice INV-\d+ is paid/);
    const versionRef = encodeURIComponent('deliverable:' + final.id), access = await h.json(`/documents/${versionRef}/access`, undefined, h.owner), share = await h.json(`/documents/${versionRef}/shares`, { revision: access.revision, contactId: s.billing.id, days: 1 }, h.owner);
    assert.equal((await h.request('/api/blotter/shared-files/' + share.token)).status, 402);
    assert.equal(await ownCopy(), 'Client supplied record');
    assert.equal((await h.request(`/api/blotter/deliverables/versions/${final.id}/file`, undefined, h.owner)).status, 200, 'Staff always read their own work');
    assert.equal((await h.json(`/jobs/${s.job.id}`, undefined, h.owner)).deliverables.find(d => d.id === final.deliverableId).paymentGate.locked, true);
    // A card receipt for part of the invoice does not release it; a pending ACH deposit does not release it while settlement is required.
    const card = await h.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', method: 'card', reference: 'CARD-CONFIRM-1', amountCents: 10000, reason: 'Card payment confirmed' }, h.owner);
    await h.json(`/invoices/${a.id}/credits`, { creditId: card.id, amountCents: 10000, reason: 'Apply the card receipt' }, h.owner);
    assert.equal((await file(final)).status, 402);
    await h.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', method: 'card', settlement: 'pending', reference: 'BAD', amountCents: 100, reason: 'A card is never pending' }, h.owner, 400);
    const ach = await h.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', method: 'ach', settlement: 'pending', reference: 'ACH-PENDING-1', amountCents: 20000, reason: 'ACH initiated; bank has not settled' }, h.owner);
    await h.json(`/invoices/${a.id}/credits`, { creditId: ach.id, amountCents: 20000, reason: 'Apply the pending ACH deposit' }, h.owner);
    let state = (await h.json(`/jobs/${s.job.id}`, undefined, h.owner)).deliverables.find(d => d.id === final.deliverableId).paymentGate;
    assert.deepEqual([state.locked, state.remainingCents, state.pendingCents, state.achUnlock], [true, 20000, 20000, 'settled']);
    assert.match((await (await file(final)).json()).error, /pending ACH payment is not yet settled/);
    // The firm policy is the principal's alone; a pending ACH payment then releases the file.
    const policy = { achUnlock: 'pending', holdThresholdCents: null, reason: 'The firm accepts pending ACH for returns' };
    for (const who of [s.preparer, s.reviewer]) await h.json('/payment-policy', policy, who, 403);
    await h.json('/payment-policy', undefined, s.preparer, 403);
    await h.json('/payment-policy', { ...policy, achUnlock: 'maybe' }, h.owner, 400);
    await h.json('/payment-policy', policy, h.owner);
    assert.equal(await (await file(final)).text(), 'Final return copy'); assert.equal((await listed())[0].locked, null);
    await h.json('/payment-policy', { ...policy, achUnlock: 'settled', reason: 'Wait for settlement again' }, h.owner);
    assert.equal((await file(final)).status, 402);
    await h.json(`/invoice-credits/${card.id}/settle`, { evidence: 'Not pending' }, h.owner, 404);
    await h.json(`/invoice-credits/${ach.id}/settle`, { evidence: 'Bank settled the transfer' }, s.preparer, 403);
    await h.json(`/invoice-credits/${ach.id}/settle`, { evidence: 'Bank settled the transfer' }, h.owner);
    assert.equal(await (await file(final)).text(), 'Final return copy', 'The settled ACH payment pays the invoice and releases the file');
    assert.equal(await ownCopy(), 'Client supplied record');
    // A card receipt that covers the whole invoice releases a second file at once.
    await h.json(`/jobs/${s.job.id}/payment-gates`, { deliverableId: second.deliverableId, invoiceId: b.id, reason: 'Second copy is released on payment' }, h.owner);
    assert.equal((await file(second)).status, 402);
    const paid = await h.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', method: 'card', reference: 'CARD-CONFIRM-2', amountCents: 10000, reason: 'Card payment confirmed' }, h.owner);
    await h.json(`/invoices/${b.id}/credits`, { creditId: paid.id, amountCents: 10000, reason: 'Apply the card receipt' }, h.owner);
    assert.equal(await (await file(second)).text(), 'Second final copy');
    // A partner override is recorded with its reason and can be taken back; a write-off alone does not release a gate.
    const third_gate = await h.json(`/jobs/${s.job.id}/payment-gates`, { deliverableId: third.deliverableId, invoiceId: c.id, reason: 'Third copy is released on payment' }, h.owner);
    await h.json(`/invoices/${c.id}/write-off`, { amountCents: 1000, reason: 'Small write-off' }, h.owner);
    assert.equal((await file(third)).status, 402);
    for (const who of [s.preparer, s.reviewer]) await h.json(`/payment-gates/${third_gate.id}/override`, { reason: 'Partner approved release' }, who, 403);
    await h.json(`/payment-gates/${third_gate.id}/override`, { reason: '' }, h.owner, 400);
    await h.json('/access/delegations', { email: 'reviewer@example.test', permissions: ['financial_authority'], reason: 'Billing partner' }, h.owner);
    const overridden = await h.json(`/payment-gates/${third_gate.id}/override`, { reason: 'Partner approved release: payment arrangement agreed by phone' }, s.reviewer);
    assert.deepEqual([overridden.locked, overridden.releasedBy, overridden.override.approved_by, overridden.override.reason], [false, 'override', 'reviewer@example.test', 'Partner approved release: payment arrangement agreed by phone']);
    await h.json(`/payment-gates/${third_gate.id}/override`, { reason: 'Again' }, h.owner, 409);
    assert.equal(await (await file(third)).text(), 'Third final copy');
    assert.ok((await h.json(`/clients/${s.client.id}/history?kind=billing`, undefined, h.owner)).history.some(e => e.action === 'payment.gate_overridden' && e.actor === 'reviewer@example.test' && e.detail.includes('payment arrangement')));
    await h.json(`/payment-gates/${third_gate.id}/override`, { reason: 'Arrangement fell through', revoke: true }, h.owner);
    assert.equal((await file(third)).status, 402);
    await h.json('/access/delegations', { email: 'reviewer@example.test', permissions: [], reason: 'Duties moved' }, h.owner);
    await h.json(`/payment-gates/${third_gate.id}/override`, { reason: 'After the grant was revoked' }, s.reviewer, 403);

    // Credit hold: staff see it on the client, new work warns, and a partner can override it with a reason.
    assert.equal((await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner)).creditHold.configured, false);
    const hold = { achUnlock: 'settled', holdThresholdCents: 25000, holdGraceDays: 0, reason: 'Clients owing USD 250 past due go on hold' };
    await h.json('/payment-policy', hold, h.owner);
    const owner = (await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner)).creditHold, staff = (await h.json(`/clients/${s.client.id}/detail`, undefined, s.preparer)).creditHold;
    assert.deepEqual([owner.onHold, owner.overdueCents, owner.thresholdCents], [true, 39000, 25000]);
    assert.deepEqual([staff.onHold, staff.overdueCents, staff.thresholdCents], [true, null, null], 'Staff who cannot read billing see the hold, not the amounts');
    const newJob = { clientId: s.client.id, templateId: s.template.id, periodStart: '2026-12-01', dueDate: '2027-01-15', dueNote: 'Recorded engagement date', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' };
    const warned = await h.json('/jobs', newJob, h.owner); assert.equal(warned.warnings[0].kind, 'credit_hold'); assert.match(warned.warnings[0].message, /USD 390\.00 is overdue/);
    const plan = await h.json('/bulk/schedule/preview', { templateId: s.template.id, periodStart: '2027-01-01', dueDate: '2027-02-15', dueNote: 'Recorded date', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test', clients: [{ clientId: s.client.id }] }, h.owner);
    assert.equal(plan.lines[0].warnings[0].kind, 'credit_hold');
    const clean = await h.json('/clients', { name: 'Paid Up LLC', contacts: [contact('Pat Paid', 'pat-paid@example.test')] }, h.owner);
    assert.deepEqual((await h.json('/jobs', { ...newJob, clientId: clean.id }, h.owner)).warnings, []);
    await h.json(`/clients/${s.client.id}/credit-hold/override`, { reason: 'Partner approved new work' }, s.preparer, 403);
    await h.json(`/clients/${s.client.id}/credit-hold/override`, { reason: '' }, h.owner, 400);
    await h.json(`/clients/${clean.id}/credit-hold/override`, { reason: 'Not on hold' }, h.owner, 409);
    const released = await h.json(`/clients/${s.client.id}/credit-hold/override`, { reason: 'Partner approved new work while the client pays on a plan' }, h.owner);
    assert.deepEqual([released.onHold, released.overridden, released.override.reason], [false, true, 'Partner approved new work while the client pays on a plan']);
    assert.deepEqual((await h.json('/jobs', { ...newJob, periodStart: '2027-01-01', dueDate: '2027-02-15' }, h.owner)).warnings, []);
    assert.ok((await h.json(`/clients/${s.client.id}/history?kind=billing`, undefined, h.owner)).history.some(e => e.action === 'payment.hold_overridden' && e.detail.includes('pays on a plan')));
    await h.json(`/clients/${s.client.id}/credit-hold/override`, { reason: 'Plan lapsed', revoke: true }, h.owner);
    assert.equal((await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner)).creditHold.onHold, true);
    // Paying the overdue invoices down below the threshold ends the hold.
    const settle = await h.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', method: 'card', reference: 'CARD-CONFIRM-3', amountCents: 20000, reason: 'Card payment confirmed' }, h.owner);
    await h.json(`/invoices/${c.id}/credits`, { creditId: settle.id, amountCents: 20000, reason: 'Apply the card receipt' }, h.owner);
    assert.equal((await h.json(`/clients/${s.client.id}/detail`, undefined, h.owner)).creditHold.onHold, false);
    // A restore carries the gates, the overrides, the policy and each receipt's method and settlement.
    await h.json('/payment-policy', { ...hold, holdThresholdCents: 25000 }, h.owner);
    await h.stepUp(h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-14' } });
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge }, restored.owner);
    const back = (await restored.json(`/jobs/${s.job.id}`, undefined, restored.owner)).deliverables;
    assert.deepEqual(back.map(d => [d.title, d.paymentGate.locked, d.paymentGate.releasedBy]).sort(), [['Final return copy', false, 'payment'], ['Second final copy', false, 'payment'], ['Third final copy', true, null]]);
    assert.deepEqual((await restored.json('/payment-policy', undefined, restored.owner)).holdThresholdCents, 25000);
    assert.deepEqual((await restored.json('/invoices', undefined, restored.owner)).credits.filter(x => x.id === ach.id).map(x => [x.method, x.settlement]), [['ach', 'settled']]);
  } finally { await restored?.close(); await h.close(); }
});

test('BILL-004 / MSG-002 / CRM-003: consented reminders run on schedule only for unpaid, undisputed, deliverable invoices; clients opt out; two invoices resend in bulk; the statement reconciles to open balances; quick collect refuses without PAY-001; a restore pauses the schedule', async () => {
  const h = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-9' } }); let restored;
  try {
    const s = await fixture(h);
    await h.json('/invoices/authority', { authority: 'blotter', reason: 'Native invoice authority selected' }, h.owner);
    const other = await h.json('/clients', { name: 'Harbor Studio LLC', contacts: [contact('Robin Harbor', 'robin@example.test')] }, h.owner);
    const otherJob = await h.json('/jobs', { clientId: other.id, templateId: s.template.id, periodStart: '2026-11-01', dueDate: '2026-12-15', dueNote: 'Recorded engagement date', preparerEmail: 'preparer@example.test', reviewerEmail: 'reviewer@example.test' }, h.owner);
    let robin = (await h.json(`/clients/${other.id}/contacts`, undefined, h.owner)).find(c => c.email === 'robin@example.test');
    const issueOne = async (job, contactId, reference, dueDate, amountCents) => {
      const e = await h.json('/invoice-entitlements', { jobId: job.id, kind: 'milestone', reference, description: `Milestone ${reference}`, amountCents, authorization: `Client accepted ${reference}` }, h.owner);
      const d = await draft(h, { ...terms, title: `Invoice ${reference}`, issueDate: '2026-11-20', dueDate, jobId: job.id, sourceKeys: [e.sourceKey], contactId });
      await issue(h, d); return d;
    };
    const a = await issueOne(s.job, s.billing.id, 'MS-1', '2026-12-01', 10000), b = await issueOne(s.job, s.billing.id, 'MS-2', '2026-12-10', 20000);
    const c = await issueOne(s.job, s.billing.id, 'MS-3', '2026-12-20', 30000), d = await issueOne(otherJob, robin.id, 'MS-4', '2026-12-01', 5000);
    const template = await h.json('/messages/templates', { name: 'Invoice reminder', scope: 'firm', subject: 'Reminder: {{invoice_amount}} due {{invoice_due_date}}', body: 'Hello {{contact_first_name}}, {{client_name}} owes {{invoice_amount}} by {{invoice_due_date}}. {{firm_name}}' }, h.owner);
    const newsletter = await h.json('/messages/templates', { name: 'Newsletter', scope: 'firm', class: 'marketing', subject: 'News', body: 'Hello {{contact_first_name}}' }, h.owner);
    const schedule = { offsets: [7, -3, 0], templateId: template.id, reason: 'Engagement letters authorize overdue reminders' };
    await h.json('/invoices/reminders', { ...schedule, templateId: newsletter.id }, h.owner, 409);
    await h.json('/invoices/reminders', schedule, s.preparer, 403);
    assert.deepEqual((await h.json('/invoices/reminders', schedule, h.owner)).policy.offsets, [-3, 0, 7]);
    await h.json(`/clients/${other.id}/invoice-reminders`, { mode: 'off', reason: 'Client pays by standing order' }, h.owner);
    const sent = () => h.mails.filter(m => /^Reminder:/.test(m.subject)).map(m => [m.to[0], m.subject]);
    await h.scheduled('2026-11-28T15:00:00Z');
    assert.deepEqual(sent(), [['alex@example.test', 'Reminder: USD 100.00 due 2026-12-01']]);
    assert.equal(h.mails.find(m => /^Reminder:/.test(m.subject)).attachments.length, 1, 'The reminder carries the numbered PDF');
    // The first invoice is paid (a recorded receipt settles it) and the third is disputed between steps.
    const receipt = await h.json('/invoice-credits', { clientId: s.client.id, kind: 'deposit', reference: 'BANK-RECEIPT-A', amountCents: 10000, reason: 'Client paid by bank transfer; receipt supplied' }, h.owner);
    await h.json(`/invoices/${a.id}/credits`, { creditId: receipt.id, amountCents: 10000, reason: 'Apply the recorded bank receipt' }, h.owner);
    await h.json(`/invoices/${c.id}/collection`, { hold: 'disputed', note: 'Client disputes the milestone scope' }, h.owner);
    await h.scheduled('2026-12-01T15:00:00Z');
    assert.equal(sent().length, 1, 'A paid invoice is not reminded');
    // The opted-out client returns to the firm schedule, but its billing contact withdrew email consent: held, never sent.
    await h.json(`/clients/${other.id}/invoice-reminders`, { mode: 'firm', reason: 'Standing order ended' }, h.owner);
    robin = (await h.json(`/clients/${other.id}/contacts`, undefined, h.owner)).find(x => x.id === robin.id);
    await h.json(`/clients/${other.id}/contacts`, { id: robin.id, revision: robin.revision, emailConsent: false, consentNote: 'Client withdrew email consent' }, h.owner);
    await h.scheduled('2026-12-08T15:00:00Z'); await h.scheduled('2026-12-10T15:00:00Z'); await h.scheduled('2026-12-10T16:00:00Z');
    await h.restart(); await h.scheduled('2026-12-10T17:00:00Z'); await h.scheduled('2026-12-27T15:00:00Z');
    assert.deepEqual(sent(), [['alex@example.test', 'Reminder: USD 100.00 due 2026-12-01'], ...Array(3).fill(['alex@example.test', 'Reminder: USD 200.00 due 2026-12-10'])]);
    const steps = async invoice => (await h.json(`/invoices/${invoice.id}`, undefined, h.owner)).reminders.map(r => [r.step, r.scheduled_on, r.status]);
    assert.deepEqual(await steps(b), [[-3, '2026-12-07', 'accepted'], [0, '2026-12-10', 'accepted'], [7, '2026-12-17', 'accepted']]);
    assert.deepEqual(await steps(a), [[-3, '2026-11-28', 'accepted']]); assert.deepEqual(await steps(c), []);
    assert.deepEqual(await steps(d), [[-3, '2026-11-28', 'skipped'], [0, '2026-12-01', 'skipped'], [7, '2026-12-08', 'held']]);
    assert.match((await h.json(`/invoices/${d.id}`, undefined, h.owner)).reminders[2].delivery, /email consent withdrawn/);
    const history = await h.json(`/clients/${s.client.id}/history?kind=billing`, undefined, h.owner);
    assert.equal(history.history.filter(e => e.action === 'invoice.reminder_sent' && e.object_id === b.id).length, 3, 'Every reminder is in the client history');
    // Bulk resend two invoices from one reviewed preview.
    const before = h.mails.length, resend = { invoiceIds: [b.id, c.id], reason: 'Client asked for copies of the open invoices' };
    const preview = await h.json('/invoices/resend-preview', resend, h.owner);
    await h.json('/invoices/resend', { ...resend, previewHash: 'stale' }, h.owner, 409);
    const resent = await h.json('/invoices/resend', { ...resend, previewHash: preview.previewHash }, h.owner);
    assert.deepEqual(resent.results.map(r => r.status), ['accepted', 'accepted']); assert.equal(h.mails.length, before + 2);
    // The statement lists open invoices with aging and recorded credits, and reconciles to open balances.
    const statement = await h.json(`/clients/${s.client.id}/statement?asOf=2026-12-27`, undefined, h.owner);
    const open = (await h.json('/invoices', undefined, h.owner)).invoices.filter(i => i.client_id === s.client.id && i.status === 'issued').reduce((n, i) => n + i.balance_cents, 0);
    assert.equal(statement.totals.openCents, open); assert.equal(open, 50000);
    assert.deepEqual(statement.invoices.map(i => [i.balanceCents, i.aging, i.hold]), [[20000, '1-30 days', null], [30000, '1-30 days', 'disputed']]);
    assert.deepEqual(statement.credits.map(x => [x.reference, x.appliedCents, x.availableCents]), [['BANK-RECEIPT-A', 10000, 0]]); assert.deepEqual(statement.payments, []);
    const csv = await (await h.request(`/api/blotter/clients/${s.client.id}/statement/csv?asOf=2026-12-27`, undefined, h.owner)).text();
    assert.match(csv, /"Total","","Cedar Lane LLC statement as of 2026-12-27","","","","","","","500.00"/);
    assert.match((await h.json(`/invoices/${b.id}/quick-collect`, {}, h.owner, 409)).error, /PAY-001/);
    await collectionsJourney(h, s);
    // A restore brings the schedule back paused and without its consent.
    await h.stepUp(h.owner);
    const archive = await (await h.request('/api/blotter/backup', undefined, h.owner)).text();
    restored = await harness({ bindings: { MAIL_API_KEY: 'synthetic-blotter-10' } });
    await restored.json('/restore', { archive, confirm: 'RESTORE', acknowledge }, restored.owner);
    const carried = (await restored.json('/invoices/reminders', undefined, restored.owner)).policy;
    assert.equal(carried.status, 'paused'); assert.equal(carried.consenter_id, null);
    const quiet = restored.mails.length; await restored.scheduled('2027-01-05T15:00:00Z'); assert.equal(restored.mails.length, quiet);
  } finally { await restored?.close(); await h.close(); }
});
