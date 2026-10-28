import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const launch = () => chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM_PATH ? { executablePath: process.env.BLOTTER_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] });
const cookies = (h, cookie) => cookie.split('; ').map(value => { const at = value.indexOf('='); return { name: value.slice(0, at), value: value.slice(at + 1), url: h.origin }; });
async function ready(h, context, page) {
  await context.addCookies(cookies(h, h.owner)); await page.goto(h.origin + '/app');
  if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
}
async function capture(page, panel, name, assertionWidth) {
  const directory = process.env.BLOTTER_RESOLUTION_EVIDENCE;
  if (directory) {
    await mkdir(directory, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
      await panel.screenshot({ path: `${directory}/${name}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: assertionWidth, height: 1000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} fits its viewport`);
}

/** Creation and review always execute in push Verify; only image saving is optional. */
export async function resolutionStaffJourney(h, s, phase) {
  const browser = await launch();
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } }), page = await context.newPage();
    await ready(h, context, page); await page.goto(h.origin + '/app?job=' + s.job.id);
    const panel = page.getByRole('region', { name: 'Resolution case', exact: true });
    await panel.getByRole('heading', { name: 'Resolution case · 433-A collection', exact: true }).waitFor();
    if (phase === 'create') {
      assert.ok((await panel.innerText()).includes('Business income and expenses'));
      await capture(page, panel, 'resolution-review-questions', 1440);
      await panel.getByRole('checkbox').check();
      const response = page.waitForResponse(r => r.url().endsWith('/resolution-case') && r.request().method() === 'POST');
      await panel.getByRole('button', { name: 'Create resolution case', exact: true }).click();
      assert.equal((await response).status(), 200);
      await panel.getByText('No confirmed submission yet.', { exact: false }).waitFor();
    } else {
      await expect(panel).toContainText('3 of 3 required current answers submitted and confirmed');
      await expect(panel).toContainText('Corrected monthly business profit 2400');
      const file = panel.getByRole('link', { name: 'synthetic-blotter-433.txt', exact: true });
      assert.equal(await file.count(), 1);
      const original = await page.request.get(h.origin + await file.getAttribute('href'));
      assert.equal(await original.text(), 'synthetic-blotter-433 original supporting bytes');
      const organizer = page.getByRole('region', { name: s.organizer.definition.name, exact: true });
      const originalSubmission = organizer.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Submission 1 · Alex Owner', exact: true }) });
      await expect(originalSubmission).toContainText('Monthly business profit 2200');
      await originalSubmission.getByLabel('Review findings', { exact: true }).fill('Practitioner checked the original supporting information');
      await originalSubmission.getByRole('button', { name: 'Record review', exact: true }).click();
      await expect(originalSubmission).toContainText('Practitioner checked the original supporting information');
      await expect(organizer).toContainText('previously: Monthly business profit 2200');
      await capture(page, panel, 'resolution-submitted-case', 1440);
      await capture(page, organizer, 'resolution-history-review', 1440);
    }
    await expect(panel).toContainText('Transcript context unavailable');
    assert.equal(await panel.getByRole('button', { name: /recommend|agency|file return/i }).count(), 0);
  } finally { await browser.close(); }
}

/** Actual phone save, reload, conditional evidence upload, submission and correction. */
export async function resolutionPhoneJourney(h, s, token) {
  const browser = await launch();
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 1000 } }), page = await context.newPage();
    await ready(h, context, page); await context.clearCookies(); await page.goto(h.origin + '/portal/' + token);
    const organizer = page.getByRole('region', { name: s.organizer.definition.name, exact: true });
    const field = label => organizer.locator('.field').filter({ has: page.getByLabel(label, { exact: false }) });
    const ownership = field('Self-employed during this period?');
    assert.equal(await organizer.getByLabel('Business income and expenses', { exact: false }).count(), 0);
    await ownership.getByRole('combobox').selectOption('Yes'); await ownership.getByRole('checkbox').check();
    await organizer.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(/saved/i);
    await page.reload();
    await expect(ownership.getByRole('combobox')).toHaveValue('Yes');
    const business = field('Business income and expenses');
    await business.getByRole('textbox').fill('Monthly business profit 2200'); await business.getByRole('checkbox').check();
    await organizer.getByRole('button', { name: 'Save draft', exact: true }).click();
    await business.locator('input[type=file]').setInputFiles({ name: 'synthetic-blotter-433.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic-blotter-433 original supporting bytes') });
    await expect(page.getByRole('status')).toContainText(/uploaded/i);
    await capture(page, organizer, 'resolution-phone-resumed', 390);
    await organizer.getByRole('button', { name: 'Submit answers', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(/submitted/i);
    await business.getByRole('textbox').fill('Corrected monthly business profit 2400'); await business.getByRole('checkbox').check();
    await organizer.getByRole('button', { name: 'Submit answers', exact: true }).click();
    await expect(organizer.getByText('Your submitted versions', { exact: true })).toBeVisible();
    await organizer.getByText('Your submitted versions', { exact: true }).click();
    await expect(organizer).toContainText('Monthly business profit 2200');
    await expect(organizer).toContainText('Corrected monthly business profit 2400');
    await capture(page, organizer, 'resolution-phone-correction', 390);
  } finally { await browser.close(); }
}
