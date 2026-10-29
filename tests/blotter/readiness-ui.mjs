import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// READY-001: the approved question uses the existing client portal, at both widths.
export async function readinessPortalJourney(h, token) {
  const browser = await chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM ? { executablePath: process.env.BLOTTER_CHROMIUM } : {}), args: ['--no-sandbox','--use-mock-keychain','--password-store=basic'] });
  const evidence = process.env.BLOTTER_READINESS_EVIDENCE;
  if (evidence) await mkdir(evidence, { recursive: true });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(h.origin + '/portal/' + token);
    const todo = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Your to-dos', exact: true }) });
    await todo.getByText(/Please provide or clarify.*Bank statement.*Feb 2026/).waitFor();
    const capture = async phase => {
      for (const width of [1440,390]) {
        await page.setViewportSize({ width, height: 1000 });
        await todo.scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Client question stays inside the viewport');
        if (evidence) await todo.screenshot({ path: `${evidence}/client-question-${phase}-${width}.png` });
      }
    };
    await capture('approved');
    await todo.getByLabel('Reply (optional)').fill('The February statement is attached; please review the new account.');
    await todo.getByRole('button', { name: 'Mark done', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'To-do completed' }).waitFor();
    assert.equal(await todo.getByRole('button', { name: 'Mark done', exact: true }).count(), 0);
    await capture('responded');
    await context.close();
  } finally { await browser.close(); }
}
