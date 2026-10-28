import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { scan } from './language-ui.mjs';

const labels = {
  en: { creating: 'Being created', pending: 'Pending', requires_action: 'Action needed', held: 'On hold', settled: 'Settled', refunded: 'Refunded', returned: 'Returned', disputed: 'Disputed', failed: 'Failed', partial: 'Partially refunded', historical: 'Restored historical record.', observed: 'Last observed', unobserved: 'No provider observation time recorded.', provenance: 'recorded observations from the payment provider', noOpen: 'No open invoices.', noInvoices: 'No issued invoices to show.', noPayments: 'No provider payments recorded.' },
  es: { creating: 'En creación', pending: 'Pendiente', requires_action: 'Se requiere una acción', held: 'En espera', settled: 'Liquidado', refunded: 'Reembolsado', returned: 'Devuelto', disputed: 'En disputa', failed: 'Fallido', partial: 'Reembolsado parcialmente', historical: 'Registro histórico restaurado.', observed: 'Última observación:', unobserved: 'No se registró la hora de observación del proveedor.', provenance: 'observaciones registradas del proveedor de pagos', noOpen: 'No hay facturas pendientes.', noInvoices: 'No hay facturas emitidas para mostrar.', noPayments: 'No hay pagos del proveedor registrados.' },
};
const amount = (cents, language) => new Intl.NumberFormat(language === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'code' }).format(cents / 100);

async function focusDownload(page, link) {
  const target = await link.elementHandle();
  for (let n = 0; n < 150; n++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate(element => document.activeElement === element)) {
      assert.ok(await target.evaluate(element => { const css = getComputedStyle(element); return (css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0) || css.boxShadow !== 'none'; }), 'Invoice download has visible keyboard focus');
      const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
      assert.equal(await download.failure(), null, 'The keyboard downloads the issued invoice PDF');
      return;
    }
  }
  assert.fail('Invoice download must be reachable with the keyboard');
}

/** Runs against the built Worker on every invocation; the environment flag saves evidence only. */
export async function portalBillingJourney(h, { cookie, clientId, language = 'en', expectedOpenCents, expectedPaymentStates = [], historical = false, empty = false, expectedInvoiceIds }) {
  const directory = process.env.BLOTTER_PORTAL_BILLING_EVIDENCE, text = labels[language];
  if (directory) await mkdir(directory, { recursive: true });
  assert.equal(typeof expectedOpenCents, 'number', 'The calling flow supplies its independently expected open balance');
  const billing = await h.json(`/client/entities/${clientId}/billing`, undefined, cookie);
  assert.equal(billing.totals.openCents, expectedOpenCents, 'Public statement matches the expected balance');
  if (expectedInvoiceIds) assert.deepEqual(billing.invoices.map(invoice => invoice.id).sort(), [...expectedInvoiceIds].sort(), 'Only independently expected invoices are readable');
  for (const state of expectedPaymentStates) assert.ok(billing.payments.some(payment => payment.state === state), `Expected recorded payment state ${state}`);
  if (historical) assert.ok(billing.payments.some(payment => payment.historical), 'The fixture contains restored history');
  if (empty) assert.deepEqual([billing.invoices.length, billing.payments.length, billing.totals.openCents], [0, 0, 0]);
  const browser = await chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM_PATH ? { executablePath: process.env.BLOTTER_CHROMIUM_PATH } : {}), args: ['--use-mock-keychain', '--password-store=basic', '--no-sandbox'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await context.addCookies(cookie.split('; ').map(part => { const at = part.indexOf('='); return { name: part.slice(0, at), value: part.slice(at + 1), url: h.origin, httpOnly: true, secure: true, sameSite: 'Strict' }; }));
    const page = await context.newPage();
    await page.goto(`${h.origin}/client`);
    const switcher = page.locator('select[name="entity"]');
    await page.locator('#billing').waitFor();
    if (await switcher.count() && await switcher.inputValue() !== clientId) {
      await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === `/api/blotter/client/entities/${clientId}` && response.ok()),
        switcher.selectOption(clientId),
      ]);
    }
    const panel = page.getByRole('region', { name: language === 'es' ? 'Facturación' : 'Billing', exact: true });
    await panel.waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    const statement = panel.locator('section[aria-labelledby="billing-statement"]'), open = panel.locator('section[aria-labelledby="billing-open"]'), invoices = panel.locator('section[aria-labelledby="billing-invoices"]'), payments = panel.locator('section[aria-labelledby="billing-payments"]');
    for (const [index, cents] of [billing.totals.invoicedCents, billing.totals.creditsAppliedCents, billing.totals.writtenOffCents, billing.totals.paidCents, expectedOpenCents].entries()) await expect(statement.locator('dd').nth(index)).toHaveText(amount(cents, language));
    assert.deepEqual(await open.locator('[data-invoice-id]').evaluateAll(nodes => nodes.map(node => node.dataset.invoiceId)), billing.invoices.filter(invoice => invoice.balanceCents > 0).map(invoice => invoice.id), 'Open invoices contain exactly the positive balances');
    assert.deepEqual(await invoices.locator('[data-invoice-id]').evaluateAll(nodes => nodes.map(node => node.dataset.invoiceId)), billing.invoices.map(invoice => invoice.id), 'Invoice history retains paid invoices');
    for (const invoice of billing.invoices) {
      const row = invoices.locator('[data-invoice-id]').filter({ has: page.locator(`a[href$="/bills/${encodeURIComponent(invoice.id)}/pdf"]`) });
      await row.getByText(invoice.title, { exact: false }).waitFor();
      for (const [index, cents] of [invoice.totalCents, invoice.creditsAppliedCents, invoice.writtenOffCents, invoice.paidCents, invoice.balanceCents].entries()) await expect(row.locator('dd').nth(index)).toHaveText(amount(cents, language));
      assert.equal(await row.getByRole('link').getAttribute('href'), `/api/blotter/client/entities/${clientId}/bills/${encodeURIComponent(invoice.id)}/pdf`);
    }
    await payments.getByText(text.provenance, { exact: false }).waitFor();
    assert.equal(await payments.locator('[data-payment-id]').count(), billing.payments.length);
    for (const payment of billing.payments) {
      const row = payments.locator(`[data-payment-id="${payment.id}"]`);
      assert.equal(await row.locator('.status').innerText(), payment.state === 'settled' && payment.refundedCents > 0 ? text.partial : text[payment.state]);
      for (const [index, cents] of [payment.amountCents, payment.refundedCents, payment.netCents].entries()) assert.equal(await row.locator('dd').nth(index).innerText(), amount(cents, language));
      await row.getByText(payment.lastObservedAt ? text.observed : text.unobserved, { exact: false }).waitFor();
      if (payment.historical) await row.getByText(text.historical, { exact: false }).waitFor();
    }
    if (!billing.invoices.some(invoice => invoice.balanceCents > 0)) await open.getByText(text.noOpen, { exact: true }).waitFor();
    if (empty) { await invoices.getByText(text.noInvoices, { exact: true }).waitFor(); await payments.getByText(text.noPayments, { exact: true }).waitFor(); }
    assert.equal(await panel.locator('button,input,select,textarea').count(), 0, 'Billing exposes no payment controls');
    assert.equal(await panel.getByRole('link').filter({ hasText: /^\s*$/ }).count(), 0, 'Every download uses a text label; there are no icon-only controls needing tooltips');
    if (billing.invoices.length) await focusDownload(page, invoices.getByRole('link').first());
    const checks = {};
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Client billing at ${width} has no horizontal overflow`);
      const smallText = await panel.evaluate(root => Array.from(root.querySelectorAll('*')).filter(element => Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()) && element.getClientRects().length && parseFloat(getComputedStyle(element).fontSize) < 13).map(element => element.tagName));
      assert.deepEqual(smallText, [], `Client billing text at ${width} is at least 13px`);
      checks[width] = await scan(page, `Client billing ${language} at ${width}`);
      if (directory) await page.screenshot({ path: `${directory}/portal-billing-${language}-${historical ? 'historical' : empty ? 'empty' : 'current'}-${width}.png`, fullPage: true });
    }
    if (directory) await writeFile(`${directory}/portal-billing-${language}-${historical ? 'historical' : empty ? 'empty' : 'current'}-accessibility.json`, JSON.stringify({ checks, violations: 0, keyboardDownload: billing.invoices.length > 0 }, null, 2));
    await context.close();
    return checks;
  } finally { await browser.close(); }
}
