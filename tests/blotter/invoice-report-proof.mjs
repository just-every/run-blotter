// Shared public-door assertions called by the existing BILL-002 / BILL-006 / BILL-007 journeys.
// This adds no independent test, snapshot or database setup.
import assert from 'node:assert/strict';

function csvRows(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let n = 0; n < text.length; n++) {
    const char = text[n];
    if (char === '"') {
      if (quoted && text[n + 1] === '"') { value += '"'; n++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(value); value = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else if (quoted || char !== '\r') value += char;
  }
  if (value || row.length) rows.push([...row, value]);
  return rows;
}
const textCell = value => {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? "'" + text : text;
};
const ascii = value => value.normalize('NFKD').replace(/[^\x20-\x7e]/g, '?');

export async function assertInvoiceReport(h, f, issuedId) {
  const job = (await h.json(`/jobs/${f.job.id}`, undefined, h.owner)).job;
  const filters = { from: job.period_start, to: job.period_start, client: f.client.id };
  const query = new URLSearchParams(filters), path = '/reports/performance?' + query;
  const report = await h.json(path, undefined, h.owner), data = report.invoiceReporting;
  assert.equal(data.generatedAt, report.generatedAt);
  const state = await h.json('/invoices', undefined, h.owner);
  const selected = new Set(report.jobs.map(j => j.id));
  assert.deepEqual(data.jobIds, [...selected].sort());
  assert.deepEqual(data.invoices.map(i => i.id).sort(), state.invoices.filter(i => selected.has(i.job_id)).map(i => i.id).sort());
  assert.ok(data.invoices.some(i => i.id === issuedId));
  const reviewer = (await h.json(path, undefined, f.reviewer)).invoiceReporting;
  assert.deepEqual(reviewer.totals, data.totals);
  const expectedRows = Object.entries(data.totals).map(([key,value]) => ['native_invoice_total',key,value]), expectedLinks = new Set();
  for (const invoice of data.invoices) {
    const native = await h.json(`/invoices/${invoice.id}`, undefined, h.owner);
    assert.deepEqual([invoice.number,invoice.status,invoice.subtotalCents,invoice.taxCents,invoice.creditCents,invoice.totalCents,invoice.balanceCents,invoice.issueDate,invoice.dueDate,invoice.issuedAt,invoice.voidedAt],
      [native.number,native.status,native.subtotal_cents,native.tax_cents,native.credit_cents,native.total_cents,native.balance_cents,native.issue_date,native.due_date,native.issued_at,native.voided_at]);
    assert.deepEqual(invoice.sources.map(s => [s.sourceKey,s.amountCents]).sort(), native.snapshot.lines.map(s => [s.source_key,s.amount_cents]).sort());
    if (invoice.status !== 'void') assert.equal(invoice.allocatedCreditCents + invoice.writtenOffCents, native.subtotal_cents + native.tax_cents - native.balance_cents);
    assert.equal(invoice.appliedCreditCents, invoice.status === 'issued' ? invoice.allocatedCreditCents : 0);
    assert.equal(invoice.reservedCreditCents, invoice.status === 'draft' ? invoice.allocatedCreditCents : 0);
    for (const allocation of invoice.allocations) expectedRows.push([invoice.id,allocation.creditId,allocation.kind,allocation.reference,allocation.amountCents,allocation.recordedAt,h.origin + allocation.source]);
    for (const source of invoice.sources) {
      assert.ok(selected.has(source.jobId)); assert.equal(source.source, '/app?job=' + source.jobId);
      expectedRows.push([invoice.id,source.sourceKey,source.sourceId,source.entitlementId,source.kind,source.amountCents,source.description,source.jobId,h.origin + source.source]);
      expectedLinks.add(h.origin + source.source);
    }
    assert.equal(invoice.source, '/app?job=' + native.job_id);
    if (native.number !== null) {
      assert.equal(invoice.pdf, `/api/blotter/invoices/${invoice.id}/pdf`);
      assert.equal((await h.request(invoice.pdf, undefined, h.owner)).status, 200);
      expectedLinks.add(h.origin + invoice.pdf);
    }
    expectedLinks.add(h.origin + invoice.source);
    expectedRows.push([invoice.id,invoice.displayNumber,invoice.status,invoice.clientId,invoice.clientName,invoice.jobId,invoice.currency,invoice.subtotalCents,invoice.taxCents,invoice.creditCents,invoice.totalCents,invoice.allocatedCreditCents,invoice.appliedCreditCents,invoice.reservedCreditCents,invoice.balanceCents,invoice.issueDate,invoice.dueDate,invoice.issuedAt,invoice.voidedAt,invoice.retainerId,invoice.period,h.origin + invoice.source,invoice.pdf ? h.origin + invoice.pdf : null]);
  }
  const issued = state.invoices.filter(i => selected.has(i.job_id) && i.status === 'issued');
  const total = field => issued.reduce((n, i) => n + i[field], 0);
  assert.deepEqual([data.totals.issued,data.totals.issuedSubtotalCents,data.totals.issuedTaxCents,data.totals.issuedCreditCents,data.totals.issuedTotalCents,data.totals.receivableCents],
    [issued.length,total('subtotal_cents'),total('tax_cents'),total('credit_cents'),total('total_cents'),total('balance_cents')]);
  const nativeRetainers = state.retainers.filter(r => selected.has(r.job_id));
  assert.deepEqual(data.retainers.map(r => r.id).sort(), nativeRetainers.map(r => r.id).sort());
  for (const retainer of data.retainers) {
    const native = nativeRetainers.find(r => r.id === retainer.id);
    const changes = state.amendments.filter(a => a.retainer_id === retainer.id).sort((a,b) => a.effective_month.localeCompare(b.effective_month));
    const effective = changes.filter(a => a.effective_month <= retainer.asOfMonth).at(-1);
    const terms = JSON.parse(effective ? effective.after_snapshot : native.definition);
    assert.deepEqual([retainer.status,retainer.startMonth,retainer.cancelledFrom,retainer.amountCents,retainer.taxCents], [native.status,native.start_month,native.cancelled_from,terms.amountCents,terms.taxCents]);
    assert.deepEqual(retainer.amendments.map(a => a.id), changes.map(a => a.id));
    assert.deepEqual([...retainer.invoiceIds].sort(), data.invoices.filter(i => i.retainerId === retainer.id).map(i => i.id).sort());
    expectedRows.push([retainer.id,retainer.clientId,retainer.clientName,retainer.jobId,retainer.title,retainer.status,retainer.startMonth,retainer.cancelledFrom,retainer.asOfMonth,retainer.currency,retainer.amountCents,retainer.taxCents,retainer.billDay,retainer.dueDays,retainer.invoiceIds.join(' '),h.origin + retainer.source]);
    expectedLinks.add(h.origin + retainer.source);
  }
  const nativeCredits = state.credits.filter(c => data.clientIds.includes(c.client_id));
  assert.deepEqual(data.credits.map(c => c.id).sort(), nativeCredits.map(c => c.id).sort());
  assert.equal(data.totals.availableCreditCents, nativeCredits.reduce((n,c) => n + c.available_cents, 0));
  for (const credit of data.credits) {
    const native = nativeCredits.find(c => c.id === credit.id);
    assert.deepEqual([credit.kind,credit.reference,credit.amountCents,credit.availableCents], [native.kind,native.reference,native.amount_cents,native.available_cents]);
    assert.equal(credit.appliedCents + credit.reservedCents + credit.availableCents, native.amount_cents);
    assert.equal(credit.unappliedCents, credit.reservedCents + native.available_cents);
    expectedRows.push([credit.id,credit.clientId,credit.clientName,credit.kind,credit.reference,credit.currency,credit.amountCents,credit.reservedCents,credit.appliedCents,credit.unappliedCents,credit.availableCents,credit.recordedAt,credit.recordedBy]);
    for (const source of credit.sources) {
      assert.ok(selected.has(source.jobId)); expectedLinks.add(h.origin + source.source);
      expectedRows.push([credit.id,source.jobId,h.origin + source.source]);
    }
  }
  // Compare native values to both exported representations, including live URLs.
  for (const format of ['csv', 'pdf']) {
    const url = `/api/blotter/reports/performance/${format}?${query}`;
    const response = await h.request(url, undefined, h.owner); assert.equal(response.status, 200);
    const exported = await response.text();
    if (format === 'csv') {
      const rows = csvRows(exported);
      for (const expected of expectedRows) assert.ok(rows.some(row => JSON.stringify(row) === JSON.stringify(expected.map(textCell))), `CSV omitted native record ${expected[0]}`);
    } else {
      // Existing report PDFs use built-in-font text streams, split across pages.
      const text = [...exported.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map(m => m[1].replace(/\\([\\()])/g, '$1')).join('');
      for (const expected of expectedRows) assert.ok(text.includes(ascii(expected.map(v => String(v ?? '')).join(' | '))), `PDF omitted native record ${expected[0]}`);
      for (const source of expectedLinks) assert.ok(exported.includes('/URI (' + source.replace(/[\\()]/g, '\\$&') + ')'), `PDF omitted source link ${source}`);
    }
    assert.equal((await h.request(url, undefined, f.preparer)).status, 403);
  }
  await h.json(path, undefined, f.preparer, 403);
  const preview = await h.json(`/clients/${f.client.id}/erasure/preview`, undefined, h.owner);
  assert.ok(preview.externalCopies.some(c => c.source === 'report-downloads' && c.holder.includes('owner@example.test') && c.count >= 2));
}
