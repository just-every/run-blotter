import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export async function workBulkJourney(h, { clients, template, group }) {
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  const evidence = process.env.BLOTTER_WORK_BULK_EVIDENCE;
  if (evidence) await mkdir(evidence, { recursive: true });
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
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Clients & templates', exact: true }).click();
    const segments = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Segments', exact: true }) });
    const bulk = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Schedule work in bulk', exact: true }) });
    const inclusion = client => bulk.getByLabel(`${client.name} in this batch`, { exact: true });
    const capture = async phase => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await bulk.scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (evidence) await bulk.screenshot({ path: `${evidence}/${phase}-${width}.png` });
      }
    };
    for (const client of clients) assert.equal(await inclusion(client).inputValue(), '');
    const filterGroup = async () => {
      await segments.getByLabel('Group', { exact: true }).selectOption(group.id);
      await segments.getByRole('button', { name: 'Filter clients', exact: true }).click();
      for (const client of clients) await page.waitForFunction(({ name }) => document.querySelector(`select[aria-label="${name} in this batch"]`)?.value === 'include', { name: client.name });
    };
    await filterGroup();
    await capture('group-preselected');
    await bulk.getByLabel('Template', { exact: true }).selectOption(template.id);
    await bulk.getByLabel('Period starts', { exact: true }).fill('2026-04-01');
    await bulk.getByLabel('Due date (recorded, not computed)', { exact: true }).fill('2026-07-15');
    await bulk.getByLabel('Where the due date comes from', { exact: true }).fill('Firm quarterly close schedule');
    await bulk.getByLabel('Default preparer', { exact: true }).selectOption('owner@example.test');
    await bulk.getByLabel('Default reviewer', { exact: true }).selectOption('reviewer@example.test');
    await inclusion(clients[1]).selectOption('exclude');
    await bulk.getByRole('button', { name: 'Preview', exact: true }).click();
    await bulk.getByRole('button', { name: 'Commit this plan', exact: true }).waitFor();
    await capture('reviewed-plan');
    // Clearing a segment with the same client IDs resets inclusion and removes its old approval.
    await segments.getByRole('button', { name: 'Clear', exact: true }).click();
    for (const client of clients) assert.equal(await inclusion(client).inputValue(), '');
    assert.equal(await bulk.getByRole('button', { name: 'Commit this plan', exact: true }).count(), 0);
    await filterGroup();
    await bulk.getByLabel('Template', { exact: true }).selectOption(template.id);
    await bulk.getByLabel('Period starts', { exact: true }).fill('2026-04-01');
    await bulk.getByLabel('Due date (recorded, not computed)', { exact: true }).fill('2026-07-15');
    await bulk.getByLabel('Where the due date comes from', { exact: true }).fill('Firm quarterly close schedule');
    await bulk.getByLabel('Default preparer', { exact: true }).selectOption('owner@example.test');
    await bulk.getByLabel('Default reviewer', { exact: true }).selectOption('reviewer@example.test');
    await inclusion(clients[1]).selectOption('exclude');
    await bulk.getByRole('button', { name: 'Preview', exact: true }).click();
    await bulk.getByRole('button', { name: 'Commit this plan', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Bulk change committed' }).waitFor();
    const jobs = (await h.json('/state', undefined, h.owner)).jobs.filter(j => j.template_id === template.id && j.period_start === '2026-04-01');
    assert.deepEqual(jobs.map(j => j.client_id), [clients[0].id]);
    await capture('committed');
    await context.close();
  } finally { await browser.close(); }
}
