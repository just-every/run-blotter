import assert from 'node:assert/strict';

/** Real hosted card entry, shared by the initial and balance-clearing client payments. */
export async function sandboxCard(page) {
  await page.waitForURL('https://checkout.stripe.com/**', { timeout: 60_000 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#email').fill('synthetic-blotter@example.com');
  const card = page.getByRole('button', { name: /Card|Credit or debit card/i });
  if (await card.first().isVisible()) await card.first().click();
  await page.locator('#cardNumber').fill('4242424242424242');
  await page.locator('#cardExpiry').fill('1230');
  await page.locator('#cardCvc').fill('123');
  const name = page.locator('#billingName');
  if (await name.count()) await name.fill('Synthetic Blotter');
  const country = page.locator('#billingCountry');
  if (await country.count()) await country.selectOption('US');
  for (const [selector, value] of [['#billingAddressLine1', '10 Main Street'], ['#billingLocality', 'Boston'], ['#billingPostalCode', '02108']]) {
    const field = page.locator(selector);
    if (await field.isVisible()) await field.fill(value);
  }
  const state = page.locator('#billingAdministrativeArea');
  if (await state.isVisible()) await state.selectOption('MA');
  const link = page.getByRole('checkbox', { name: /Save my information with Link/ });
  if (await link.count()) await link.uncheck();
  await page.getByRole('button', { name: /^Pay|^Authorize/ }).last().click();
}

/** A real gated firm deliverable and an independent client-supplied record. */
export async function sandboxGate(h, s, title = 'Final return copy') {
  const final = await h.json(`/jobs/${s.job.id}/deliverables`, { title, name: 'return.txt', mime: 'text/plain', contentBase64: Buffer.from(title).toString('base64'), contactId: s.billing.id }, h.owner);
  const token = new URL(final.portalUrl).pathname.split('/').at(-1);
  const request = (await h.json(`/jobs/${s.job.id}`, undefined, h.owner)).requests[0];
  const upload = await h.json(`/portal/${token}/requests/${request.id}`, { name: 'Client statement.txt', mime: 'text/plain', contentBase64: Buffer.from('Client supplied record').toString('base64') });
  const access = await h.json(`/documents/${encodeURIComponent(upload.id)}/access`, undefined, h.owner);
  await h.json(`/documents/${encodeURIComponent(upload.id)}/access`, { revision: access.revision, visibility: 'contacts', contactIds: [s.billing.id] }, h.owner);
  await h.json(`/jobs/${s.job.id}/payment-gates`, { deliverableId: final.deliverableId, invoiceId: s.invoice.id, reason: 'The final firm work product requires payment' }, h.owner);
  return {
    url: final.portalUrl,
    async assert(status) {
      const response = await h.request(`/api/blotter/portal/${token}/deliverables/${final.id}/file`);
      assert.equal(response.status, status, 'The actual file door follows the observed payment state');
      if (status === 200) assert.equal(await response.text(), title);
      const own = await h.request(`/api/blotter/portal/${token}/files/${encodeURIComponent(upload.id)}`);
      assert.equal(own.status, 200); assert.equal(await own.text(), 'Client supplied record');
      const listing = await h.json(`/portal/${token}/deliverables`);
      assert.equal(Boolean(listing.find(d => d.id === final.deliverableId).locked), status === 402);
    },
  };
}

export async function sandboxInvoice(h, s, reference, amountCents = 100) {
  const entitlement = await h.json('/invoice-entitlements', { jobId: s.job.id, kind: 'milestone', reference, description: reference, amountCents, authorization: 'Synthetic client expressly authorized this sandbox invoice' }, h.owner);
  const input = { title: reference, issueDate: '2026-11-02', jobId: s.job.id, sourceKeys: [entitlement.sourceKey], contactId: s.billing.id, dueDate: '2026-12-15', terms: 'Due on the recorded date', taxCents: 0, taxTreatment: 'No sales tax under supplied treatment', taxAuthorization: 'Principal reviewed client instruction' };
  const preview = await h.json('/invoices/preview', input, h.owner);
  const draft = await h.json('/invoices', { ...input, previewHash: preview.previewHash }, h.owner);
  await h.json(`/invoices/${draft.id}/issue`, { revision: draft.revision, snapshotHash: draft.snapshotHash, reviewNote: 'Principal checked this low-value sandbox invoice' }, h.owner);
  const invoice = await h.json(`/invoices/${draft.id}`, undefined, h.owner);
  const delivery = await h.json(`/invoices/${invoice.id}/delivery-preview`, { contactId: s.billing.id }, h.owner);
  const sent = await h.json(`/invoices/${invoice.id}/send`, { contactId: s.billing.id, previewHash: delivery.previewHash }, h.owner);
  return { ...s, invoice, token: new URL(sent.portalUrl).pathname.split('/').at(-1) };
}
