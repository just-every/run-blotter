import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { paymentTooltips } from './payment-tooltips.mjs';

const capture = async (page, panel, directory, name) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} at ${width} overflows`);
    await panel.screenshot({ path: `${directory}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
};
const statusLabel = value => { const text = value.replaceAll('_', ' '); return text.charAt(0).toUpperCase() + text.slice(1); };
const open = async details => { if (!await details.evaluate(element => element.open)) await details.locator('summary').first().click(); };

/** Uses the real invoice and API state prepared by the calling service flow; no routes or application data are mocked here. */
export async function paymentJourney(h, fixture, invoice) {
  const directory = process.env.BLOTTER_PAYMENT_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await h.stepUp(h.owner);
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await context.addCookies(h.owner.split('; ').map(cookie => { const at = cookie.indexOf('='); return { name: cookie.slice(0, at), value: cookie.slice(at + 1), url: h.origin }; }));
    const page = await context.newPage();
    await page.goto(h.origin + '/app');
    if (new URL(page.url()).pathname === '/setup') {
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Finish setup' }).click();
      await page.waitForURL('**/app');
    }
    await paymentTooltips(page, directory);
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Time & billing', exact: true }).click();
    const invoices = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Invoices and retainers', exact: true }) });
    const record = invoices.locator('article.record').filter({ hasText: `INV-${String(invoice.number).padStart(6, '0')}` }).first();
    await open(record.locator('details').first());
    const panel = record.getByRole('region', { name: 'Invoice payments', exact: true });
    await panel.getByRole('heading', { name: 'Payments', exact: true }).waitFor();
    const current = () => h.json(`/invoices/${invoice.id}/payments`, undefined, h.owner);
    const paymentRecord = id => panel.getByRole('article', { name: `Payment ${id}`, exact: true });
    const assertPayment = async payment => {
      const row = paymentRecord(payment.id);
      await row.locator('.status').filter({ hasText: statusLabel(payment.state) }).waitFor();
      await row.getByText(`Provider reference: ${payment.provider_id || 'Not assigned'}`, { exact: true }).waitFor();
    };
    const initial = await current();
    for (const payment of initial.payments) await assertPayment(payment);
    if (!initial.payments.length) await panel.getByText('No provider payments recorded.', { exact: true }).waitFor();
    const methods = panel.locator('details').filter({ has: page.locator('summary', { hasText: /^Saved payment methods \(/ }) }).first();
    await open(methods);
    for (const mandate of initial.mandates) {
      const row = panel.getByRole('article', { name: `Saved method ${mandate.id}`, exact: true });
      await row.locator('.status').filter({ hasText: statusLabel(mandate.status) }).waitFor();
      await row.getByText(mandate.last4 ? `ending ${mandate.last4}` : 'Payment method awaiting confirmation', { exact: !mandate.last4 }).waitFor();
      assert.equal(await row.getByRole('button', { name: 'Revoke saved method', exact: true }).count(), ['active', 'pending'].includes(mandate.status) ? 1 : 0);
    }
    if (!initial.mandates.length) await methods.getByText('No saved payment methods.', { exact: true }).waitFor();
    if (!initial.configured) {
      await panel.getByRole('status').filter({ hasText: 'Stripe payments are not configured' }).waitFor();
      assert.equal(await panel.getByRole('button', { name: 'Create payment link', exact: true }).count(), 0);
      await capture(page, panel, directory, 'invoice-payments-unconfigured');
      await context.close();
      return;
    }
    const detail = await h.json(`/invoices/${invoice.id}`, undefined, h.owner);
    if (detail.balance_cents > 0) {
      await open(panel.locator('details').filter({ has: page.locator('summary', { hasText: /^Collect payment$/ }) }).first());
      const amountCents = Math.max(1, Math.floor(detail.balance_cents / 2));
      await panel.getByLabel('Payment link amount in USD cents', { exact: true }).fill(String(amountCents));
      await panel.getByRole('button', { name: 'Create payment link', exact: true }).click();
      const created = panel.getByRole('status', { name: 'Created payment link', exact: true });
      await created.waitFor();
      const url = await created.getByLabel('Stripe payment link', { exact: true }).inputValue();
      assert.equal(new URL(url).protocol, 'https:');
      assert.equal(await created.getByRole('link', { name: 'Open Stripe payment link', exact: true }).getAttribute('href'), url);
      const updated = await current();
      const linked = updated.payments.find(payment => !initial.payments.some(before => before.id === payment.id) && payment.amount_cents === amountCents);
      assert.ok(linked, 'Payment link records the selected partial amount');
      await assertPayment(linked);
      await capture(page, panel, directory, 'invoice-payment-link');
      const mandate = initial.mandates.find(method => method.status === 'active' && method.remaining_cents >= detail.balance_cents && updated.availableCents >= detail.balance_cents);
      if (mandate) {
        await panel.getByLabel('Saved payment method', { exact: true }).selectOption(mandate.id);
        await panel.getByRole('button', { name: 'Quick collect', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Collection requested with the saved payment method' }).waitFor();
        const collected = (await current()).payments.find(payment => !updated.payments.some(before => before.id === payment.id));
        assert.ok(collected, 'Quick collect creates a provider payment');
        await assertPayment(collected);
        await capture(page, panel, directory, 'invoice-quick-collect');
      } else if (!initial.mandates.some(method => method.status === 'active')) {
        await panel.getByText('No active saved payment method.', { exact: false }).waitFor();
        assert.equal(await panel.getByRole('button', { name: 'Quick collect', exact: true }).count(), 0);
      } else {
        assert.equal(await panel.getByRole('button', { name: 'Quick collect', exact: true }).isDisabled(), true);
      }
    }
    const payments = (await current()).payments;
    const reconcile = payments.find(payment => ['pending', 'held', 'requires_action'].includes(payment.state));
    if (reconcile) {
      const row = paymentRecord(reconcile.id);
      await open(row.locator('details').first());
      await row.getByRole('button', { name: 'Reconcile payment', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Payment reconciled with Stripe' }).waitFor();
      await assertPayment((await current()).payments.find(payment => payment.id === reconcile.id));
      await capture(page, panel, directory, 'invoice-payment-reconciled');
    }
    const refundable = (await current()).payments.find(payment => payment.state === 'settled' && payment.amount_cents > payment.refunded_cents);
    if (refundable) {
      const row = paymentRecord(refundable.id);
      await open(row.locator('details').first());
      await row.getByLabel('Refund amount in USD cents', { exact: true }).fill('1');
      await row.getByLabel('Refund reason', { exact: true }).fill('Client requested a partial refund');
      await row.getByRole('button', { name: 'Refund payment', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Refund recorded with Stripe' }).waitFor();
      const refunded = (await current()).payments.find(payment => payment.id === refundable.id);
      assert.equal(refunded.refunded_cents, refundable.refunded_cents + 1);
      await assertPayment(refunded);
      await capture(page, panel, directory, 'invoice-payment-refund');
    }
    const mandate = initial.mandates.find(method => method.status === 'active');
    if (mandate) {
      const row = panel.getByRole('article', { name: `Saved method ${mandate.id}`, exact: true });
      await row.getByLabel('Reason to revoke saved method', { exact: true }).fill('Client withdrew saved payment permission');
      await row.getByRole('button', { name: 'Revoke saved method', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Saved payment method revoked' }).waitFor();
      const revoked = (await current()).mandates.find(method => method.id === mandate.id);
      assert.equal(revoked.status, 'revoked');
      await row.locator('.status').filter({ hasText: statusLabel(revoked.status) }).waitFor();
      assert.equal(await row.getByRole('button', { name: 'Revoke saved method', exact: true }).count(), 0);
    }
    await capture(page, panel, directory, 'invoice-payments');
    await context.close();
  } finally { await browser.close(); }
}
