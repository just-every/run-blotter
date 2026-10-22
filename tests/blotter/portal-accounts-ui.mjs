import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { scan } from './language-ui.mjs';

/**
 * PORTAL-002 browser proof at 1440 and 390: the sign-in page and a signed-in client's entity
 * view pass the WCAG 2.2 AA scan without overflow, and staff see each contact's portal access.
 */
export async function portalAccountJourney(h, { clientCookie, clientId }) {
  const directory = process.env.BLOTTER_PORTAL_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  const capture = async (page, locator, name) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await locator.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} ${width} overflows`);
      await scan(page, `${name} at ${width}`); await locator.screenshot({ path: `${directory}/${name}-${width}.png` });
    }
  };
  try {
    const visitor = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } }), signIn = await visitor.newPage();
    await signIn.goto(`${h.origin}/client`); await signIn.getByRole('button', { name: 'Email me a sign-in link' }).waitFor();
    await capture(signIn, signIn.locator('main'), 'client-sign-in'); await visitor.close();
    const client = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    const [name, value] = clientCookie.split('='); await client.addCookies([{ name, value, url: h.origin, httpOnly: true, secure: true, sameSite: 'Strict' }]);
    const page = await client.newPage(); await page.goto(`${h.origin}/client`);
    await page.getByRole('heading', { name: 'Shared documents' }).waitFor();
    await page.getByRole('combobox', { name: 'Showing' }).selectOption(clientId); await page.getByRole('link', { name: /^Download cedar\.pdf$/ }).waitFor();
    await capture(page, page.locator('main'), 'client-entity'); await client.close();
    const staff = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await h.stepUp(h.owner);
    await staff.addCookies(h.owner.split('; ').map(cookie => { const at = cookie.indexOf('='); return { name: cookie.slice(0, at), value: cookie.slice(at + 1), url: h.origin }; }));
    const app = await staff.newPage(); await app.goto(h.origin + '/app');
    if (new URL(app.url()).pathname === '/setup') { await app.getByRole('checkbox').check(); await app.getByRole('button', { name: 'Finish setup' }).click(); await app.waitForURL('**/app'); }
    await app.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Clients & templates', exact: true }).click();
    const entry = app.locator('ul.list > li').filter({ hasText: 'Cedar Lane LLC' }).first();
    await entry.getByText('Client details and contacts', { exact: true }).click();
    await entry.getByText('Client portal access', { exact: true }).click();
    const panel = entry.locator('details').filter({ has: app.getByText('Client portal access', { exact: true }) }).last();
    await panel.getByRole('button', { name: /^(Send a new invitation|Invite to the client portal)$/ }).first().waitFor();
    for (const width of [1440, 390]) { await app.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded(); assert.equal(await app.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `portal access ${width} overflows`); await panel.screenshot({ path: `${directory}/staff-portal-access-${width}.png` }); }
    await staff.close();
  } finally { await browser.close(); }
}
