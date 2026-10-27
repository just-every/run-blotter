import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const launch = () => chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM ? { executablePath: process.env.BLOTTER_CHROMIUM } : {}), args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] });
async function openClient(h, browser, fixture, cookie = h.owner) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  await context.addCookies(cookie.split('; ').map(value => { const at = value.indexOf('='); return { name: value.slice(0, at), value: value.slice(at + 1), url: h.origin }; }));
  const page = await context.newPage();
  await page.goto(h.origin + '/app');
  if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Clients & templates', exact: true }).click();
  const entry = page.locator('ul.list > li').filter({ has: page.getByText(fixture.client.name, { exact: true }) }).first();
  await entry.getByText('Client details and contacts', { exact: true }).click();
  return { context, page, entry, panel: entry.getByRole('region', { name: 'Onboarding scope review', exact: true }) };
}
async function capture(page, panel, name) {
  const directory = process.env.BLOTTER_ONBOARD_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
    if (width === 1440) assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflows at ${width}`);
    await panel.screenshot({ path: `${directory}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function map(panel, fixture, source) {
  await panel.getByText('Map a signed source', { exact: true }).click();
  await panel.getByLabel('Signed scope source', { exact: true }).selectOption(source.kind + ':' + source.id);
  for (const [index, service] of fixture.body.services.entries()) {
    await panel.getByLabel(`Service ${index + 1} exact signed quote`, { exact: true }).fill(service.quote);
    await panel.getByLabel(`Service ${index + 1} work template`, { exact: true }).selectOption(service.templateId);
  }
  await panel.getByRole('button', { name: 'Preview setup items', exact: true }).click();
  await panel.getByRole('article', { name: 'Proposed onboarding plan' }).waitFor();
}

/** Always invoked from the existing signed-scope public-door test, including push Verify. */
export async function onboardingJourney(h, fixture) {
  const browser = await launch();
  try {
    const ui = await openClient(h, browser, fixture), { page, panel, entry } = ui;
    await entry.getByText('Onboarding scope review', { exact: true }).click();
    await map(panel, fixture, fixture.body.source);
    const proposed = panel.getByRole('article', { name: 'Proposed onboarding plan' });
    assert.equal(await proposed.getByRole('checkbox').count(), 13);
    assert.equal(await proposed.getByRole('link', { name: 'Read signed scope', exact: true }).count(), 14);
    assert.deepEqual(await proposed.getByRole('link', { name: 'Read signed scope', exact: true }).evaluateAll(elements => [...new Set(elements.map(element => element.getAttribute('href')))]), [fixture.sourceHref]);
    await proposed.getByText('Signed source fingerprint', { exact: true }).click();
    assert.equal(await proposed.locator('code').innerText(), fixture.sourceDigest);
    for (const service of fixture.body.services) assert.ok((await proposed.innerText()).includes(service.quote));
    await proposed.getByRole('checkbox', { name: 'Invite client to arrange bank connection', exact: true }).uncheck();
    await proposed.getByLabel('Review reason', { exact: true }).fill(fixture.review.reason);
    await capture(page, panel, 'onboarding-preview');
    await proposed.getByRole('button', { name: 'Record selected items', exact: true }).click();
    const retained = panel.getByRole('article', { name: 'Retained onboarding plan' }); await retained.waitFor();
    const records = await h.json(`/clients/${fixture.client.id}/onboarding/plans`, undefined, h.owner);
    assert.equal(records.plans.length, 1);
    const id = records.plans[0].id;
    const current = () => h.json(`/clients/${fixture.client.id}/onboarding/plans/${id}`, undefined, h.owner);
    const reviewed = await current();
    assert.equal(reviewed.items.filter(item => item.selected).length, 12);
    assert.equal(reviewed.items.find(item => item.type === 'bank').selected, false);
    const reload = async () => {
      await page.reload(); await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Clients & templates', exact: true }).click();
      await entry.getByText('Client details and contacts', { exact: true }).click();
      await entry.getByText('Onboarding scope review', { exact: true }).click();
      await panel.getByRole('button', { name: 'Open review ' + id.slice(0, 8), exact: true }).click(); await retained.waitFor();
    };
    await reload();
    assert.match(await retained.innerText(), /Invite client to arrange bank connection · Removed/);
    return {
      plan: reviewed,
      observe: async observation => {
        await retained.getByLabel('Setup item', { exact: true }).selectOption(observation.itemId);
        await retained.getByLabel('Observation state', { exact: true }).selectOption(observation.state);
        await retained.getByLabel('Observed evidence or blocker', { exact: true }).fill(observation.note);
        await retained.getByLabel('Next action and due condition', { exact: true }).fill(observation.nextAction);
        const response = page.waitForResponse(response => response.url().endsWith('/progress') && response.request().method() === 'POST');
        await retained.getByRole('button', { name: 'Record observation', exact: true }).click(); assert.equal((await response).status(), 200);
        await retained.getByText(observation.note, { exact: false }).waitFor();
        return current();
      },
      inspect: async () => {
        await reload();
        await retained.getByText('Earlier observations (1)', { exact: true }).click();
        const text = await retained.innerText();
        assert.ok(text.includes('QBO connection still missing'));
        assert.ok(text.includes('Practitioner observed connection evidence; not provider verified'));
        assert.ok(text.includes('Principal to arrange authorized connection before the first monthly close'));
        assert.ok(text.includes('Recorded by owner@example.test'));
        assert.equal(await retained.getByRole('button', { name: 'Record observation', exact: true }).count(), 1);
        const search = page.getByRole('search').getByRole('button', { name: 'Search', exact: true }); await search.focus();
        await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor();
        await page.getByLabel('Search everything (press /)', { exact: true }).focus();
        await search.hover(); await page.getByRole('tooltip', { name: 'Search workspace', exact: true }).waitFor();
        await page.mouse.move(0, 0);
        await capture(page, panel, 'onboarding-observations');
      },
      unavailable: async source => {
        await map(panel, fixture, source);
        return async () => {
          await panel.getByLabel('Review reason', { exact: true }).fill('Review must refuse the removed source');
          await panel.getByRole('button', { name: 'Record selected items', exact: true }).click();
          await panel.getByRole('alert').filter({ hasText: 'Available signed scope not found' }).waitFor();
          assert.equal(await panel.getByRole('article').count(), 0, 'Failed refresh clears retained scope');
        };
      },
      close: () => browser.close(),
    };
  } catch (error) { await browser.close(); throw error; }
}
export async function onboardingAccessJourney(h, fixture, id, cookie, held = false) {
  const browser = await launch();
  try {
    const { page, entry, panel } = await openClient(h, browser, fixture, cookie);
    if (!held) { assert.equal(await entry.getByText('Onboarding scope review', { exact: true }).count(), 0); return; }
    await entry.getByText('Onboarding scope review', { exact: true }).click();
    await panel.getByRole('button', { name: 'Open review ' + id.slice(0, 8), exact: true }).click();
    await panel.getByText('Restored review is held.', { exact: false }).waitFor();
    assert.equal(await panel.getByRole('button', { name: 'Record observation', exact: true }).count(), 0);
    await panel.getByText('Earlier observations (1)', { exact: true }).click();
    assert.match(await panel.innerText(), /QBO connection still missing/);
    await capture(page, panel, 'onboarding-held');
  } finally { await browser.close(); }
}
