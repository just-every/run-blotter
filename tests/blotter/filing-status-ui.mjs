import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Invoked unconditionally from the deadline public-door journey in push Verify.
export async function filingStatusJourney(h, fixture) {
  const browser = await chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM ? { executablePath: process.env.BLOTTER_CHROMIUM } : {}), args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await context.addCookies(h.owner.split('; ').map(cookie => { const at = cookie.indexOf('='); return { name: cookie.slice(0, at), value: cookie.slice(at + 1), url: h.origin }; }));
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    await page.goto(h.origin + '/app');
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Jobs', exact: true }).click();
    const row = page.locator('table tbody tr').filter({ has: page.getByText(fixture.client.name, { exact: true }) }).filter({ hasText: '2024' });
    await row.getByRole('button', { name: 'Open', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Practitioner filing source', exact: true });
    await panel.getByText('Record a no-status fallback', { exact: true }).click();
    await panel.getByLabel('Tax stack', { exact: true }).selectOption('Drake');
    await panel.getByLabel('This stack exposes no status for this return', { exact: true }).check();
    await panel.getByLabel('No-status declaration', { exact: true }).fill(fixture.body.noStatusDeclaration);
    await panel.getByLabel('Fallback acknowledgment file', { exact: true }).selectOption(fixture.body.fileId);
    await panel.getByLabel('Fallback submission ID', { exact: true }).fill(fixture.body.submissionId);
    await panel.getByLabel('Fallback accepted on', { exact: true }).fill(fixture.body.acceptedOn);
    const directory = process.env.BLOTTER_FILING_EVIDENCE;
    const capture = async name => {
      if (directory) await mkdir(directory, { recursive: true });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
        if (width === 1440) assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Filing source fits the desktop');
        if (directory) await panel.screenshot({ path: `${directory}/${name}-${width}.png` });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    };
    await capture('practitioner-filing-form');
    await panel.getByRole('button', { name: 'Save practitioner source', exact: true }).click();
    await panel.getByText('accepted · practitioner-recorded', { exact: true }).waitFor();
    assert.match(await panel.innerText(), /Drake/);
    assert.match(await panel.innerText(), /Form 1040 · US · tax year 2024/);
    assert.ok((await panel.innerText()).includes(fixture.body.noStatusDeclaration));
    assert.ok((await panel.innerText()).includes(fixture.body.submissionId));
    assert.equal(await panel.getByRole('link', { name: fixture.file.name, exact: true }).getAttribute('href'), `/api/blotter/files/${fixture.file.id}`);
    assert.match(await panel.innerText(), /Acknowledgment recorded by.+Source mapped by/s);
    const download = await context.request.get(h.origin + `/api/blotter/files/${fixture.file.id}`);
    assert.equal(download.status(), 200); assert.equal((await download.body()).toString(), fixture.bytes);
    await capture('practitioner-filing');
    const search = page.getByRole('button', { name: 'Search', exact: true });
    await search.focus();
    await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor();
    await search.blur(); await page.mouse.move(1, 999); await search.hover(); await page.waitForTimeout(150);
    assert.equal(await page.getByRole('tooltip').count(), 0);
    await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor();
    await context.close();
  } finally { await browser.close(); }
}
