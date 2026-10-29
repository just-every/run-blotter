import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// The functional journey always runs at desktop width in Verify; phone captures are local proof.
export async function mailConsentJourney(h, cookie, beforeWithdraw) {
  const directory = process.env.BLOTTER_MAIL_EVIDENCE;
  if (directory) await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM ? { executablePath: process.env.BLOTTER_CHROMIUM } : {}), args: ['--no-sandbox','--use-mock-keychain','--password-store=basic'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await context.addCookies(cookie.split('; ').map(value => { const at = value.indexOf('='); return { name: value.slice(0, at), value: value.slice(at + 1), url: h.origin }; }));
    const page = await context.newPage();
    const open = async () => {
      await page.goto(h.origin + '/app');
      if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
      await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Jobs', exact: true }).click();
      const summary = page.getByText('Mail suggestion settings', { exact: true });
      await summary.focus(); await page.keyboard.press('Enter');
      return page.locator('.mail-consent-settings');
    };
    let panel = await open();
    await panel.getByRole('status').filter({ hasText: 'Off' }).waitFor();
    const presented = await panel.locator(':scope > p').first().innerText();
    const allow = panel.getByRole('button', { name: 'Allow mail time suggestions', exact: true });
    await allow.focus(); await page.keyboard.press('Enter');
    await panel.getByRole('button', { name: 'Withdraw mail consent', exact: true }).waitFor();
    const saved = await h.json('/time/mail-consent', undefined, cookie);
    assert.equal(saved.optedIn, true); assert.equal(saved.history[0].wording, presented);
    panel = await open();
    await panel.getByRole('status').filter({ hasText: 'On' }).waitFor();
    for (const width of directory ? [1440, 390] : [1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await panel.scrollIntoViewIfNeeded();
      if (width === 1440) {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.ok((await panel.locator('p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))) >= 13);
      }
      if (directory) await page.screenshot({ path: `${directory}/mail-choice-on-${width}.png`, fullPage: true });
    }
    if (beforeWithdraw) await beforeWithdraw();
    await page.setViewportSize({ width: directory ? 390 : 1440, height: 1000 });
    await panel.getByRole('button', { name: 'Withdraw mail consent', exact: true }).focus(); await page.keyboard.press('Enter');
    await panel.getByRole('button', { name: 'Allow mail time suggestions', exact: true }).waitFor();
    panel = await open(); await panel.getByRole('status').filter({ hasText: 'Off' }).waitFor();
    assert.equal((await h.json('/time/mail-consent', undefined, cookie)).optedIn, false);
    const search = page.getByRole('button', { name: 'Search', exact: true });
    await search.focus(); await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor();
    await search.blur(); await page.mouse.move(1, 999); await search.hover(); await page.waitForTimeout(150); assert.equal(await page.getByRole('tooltip').count(), 0);
    await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor(); await page.mouse.move(1, 999);
    await page.locator('summary[aria-label]').first().focus(); await page.getByRole('tooltip', { name: 'Account menu', exact: true }).waitFor();
    for (const width of directory ? [1440, 390] : []) {
      await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${directory}/mail-choice-off-${width}.png`, fullPage: true });
    }
    await context.close();
  } finally { await browser.close(); }
}
