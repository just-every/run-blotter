import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

export async function rescueContextJourney(h, clients, week) {
  const directory = process.env.BLOTTER_RESCUE_EVIDENCE;
  if (directory) await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM ? { executablePath: process.env.BLOTTER_CHROMIUM } : {}), args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await context.addCookies(h.owner.split('; ').map(value => { const n = value.indexOf('='); return { name: value.slice(0, n), value: value.slice(n + 1), url: h.origin }; }));
    const page = await context.newPage();
    await page.goto(h.origin + '/app');
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Capacity', exact: true }).click();
    const panel = page.locator('.rescue-context');
    await panel.getByRole('heading', { name: 'Deadline-risk context' }).waitFor();
    assert.equal(await panel.getByRole('article').count(), 0, 'No implicit client selection');
    await panel.getByLabel('Risk week starting Monday').fill(week);
    for (const client of clients) await panel.getByRole('checkbox', { name: client.name, exact: true }).check();
    await panel.getByRole('button', { name: 'Inspect selected week' }).focus(); await page.keyboard.press('Enter');
    await panel.getByRole('heading', { name: /Assigned people and weekly capacity facts/ }).waitFor();
    assert.equal(await panel.locator('article').count(), 2);
    const content = await panel.innerText();
    for (const term of ['Working date', 'Statutory date', 'Internal target', 'Extension', 'missing document', 'Waiting for task 1', 'Insufficient estimates', 'recorded leave', 'not a source-complete feasible rescue plan', 'Unavailable: authorized LEDGER-001']) assert.ok(content.includes(term), term);
    assert.equal(await panel.getByRole('link', { name: /Obligation / }).count(), 2);
    assert.equal(await panel.getByRole('link', { name: /version 2026/ }).count(), 2);
    await panel.locator('details').first().getByText('Requests and task dependencies', { exact: true }).click();
    await panel.getByRole('link', { name: /Prerequisite job:/ }).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok(await panel.locator('p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 13));
    const search = page.getByRole('button', { name: 'Search', exact: true });
    await search.focus(); await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor();
    await search.blur(); await page.mouse.move(1, 999); await search.hover(); await page.waitForTimeout(150); assert.equal(await page.getByRole('tooltip').count(), 0);
    await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor(); await page.mouse.move(1, 999);
    await page.locator('summary[aria-label]').first().focus(); await page.getByRole('tooltip', { name: 'Account menu', exact: true }).waitFor();
    await page.mouse.move(1, 999); await page.locator('summary[aria-label]').first().blur();
    // Assertions run at desktop width. Candidate proof captures the same changed screen at both widths.
    for (const width of directory ? [1440, 390] : []) {
      await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
      await panel.screenshot({ path: `${directory}/deadline-risk-${width}.png` });
    }
    await context.close();
  } finally { await browser.close(); }
}
