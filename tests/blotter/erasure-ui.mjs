// ERASURE-002 retention screens at 1440 and 390: the client's holds and preview, the firm's periods
// and Ready to erase list, and the receipt with the audited retained-records door.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export async function retentionJourney(h, phase, clientName) {
  const browser = await chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM ? { executablePath: process.env.BLOTTER_CHROMIUM } : {}), args: ['--use-mock-keychain', '--password-store=basic', ...(process.env.BLOTTER_CHROMIUM ? ['--no-sandbox'] : [])] });
  const evidence = process.env.BLOTTER_ERASURE_EVIDENCE;
  if (evidence) await mkdir(evidence, { recursive: true });
  const cookies = h.owner.split('; ').map(c => { const at = c.indexOf('='); return { name: c.slice(0, at), value: c.slice(at + 1), url: h.origin }; });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await context.addCookies(cookies);
    const page = await context.newPage();
    page.on('pageerror', e => console.log('PAGE ERROR', e.message));
    await page.goto(h.origin + '/app');
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
    const tab = name => page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name, exact: true }).click();
    const capture = async (panel, name) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await panel.scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} stays inside the ${width}px viewport`);
        if (evidence) await panel.screenshot({ path: `${evidence}/${name}-${width}.png` });
      }
    };
    await tab('Clients & templates');
    const client = page.locator('li').filter({ has: page.locator('strong', { hasText: clientName }) }).filter({ has: page.getByText('Client details and contacts') }).first();
    const unfold = async text => { const summary = client.locator('summary', { hasText: text }).first(); if (!await summary.evaluate(e => e.parentElement.open)) await summary.click(); };
    await unfold('Client details and contacts');
    await unfold('Retention, holds and erasure');
    if (phase === 'before') {
      const holds = client.getByRole('region', { name: 'Holds and retention' });
      await holds.getByText('Hold · owner reviewer@example.test').first().waitFor();
      await capture(holds, 'holds');
      const engagements = client.getByRole('region', { name: 'Signed engagements' });
      await engagements.getByText(/practitioner-recorded, not signed through Blotter/).first().waitFor();
      await capture(engagements, 'engagements');
      await client.getByRole('button', { name: 'Preview erasure', exact: true }).click();
      const preview = client.getByRole('region', { name: 'Erase this client' });
      await preview.getByText('Will be kept, with owner').waitFor();
      await preview.getByText(/signed work/).first().waitFor();
      await capture(preview, 'preview');
      await tab('Team & safety');
      const firm = page.getByRole('region', { name: 'Retention', exact: true });
      await firm.getByRole('heading', { name: 'Retention periods' }).waitFor();
      await capture(firm, 'retention-page');
    } else {
      const receipt = client.getByRole('region', { name: 'Erasure receipt' });
      await receipt.getByText('Copies outside Blotter (never erased by Blotter)').waitFor();
      await receipt.getByLabel('Reason for reading retained records').fill('Responding to an IRS inquiry');
      await receipt.getByRole('button', { name: 'Read retained records', exact: true }).click();
      await receipt.getByText(/taxpayer ID/).waitFor();
      await capture(receipt, 'receipt');
    }
    await context.close();
  } catch (e) { if (evidence) for (const page of browser.contexts().flatMap(c => c.pages())) { await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true }); console.log((await page.locator('[role=alert],[role=status]').allInnerTexts()).join(' | ')); } throw e; } finally { await browser.close(); }
}
