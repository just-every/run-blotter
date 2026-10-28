import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { scan } from './language-ui.mjs';
import axe from 'axe-core';
const launch = () => chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM_PATH ? { executablePath: process.env.BLOTTER_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] });
const contextFor = async (browser, h, cookie) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  await context.addCookies(cookie.split('; ').map(part => { const at = part.indexOf('='); return { name: part.slice(0, at), value: part.slice(at + 1), url: h.origin, secure: true, httpOnly: true, sameSite: 'Strict' }; }));
  return context;
};
async function proof(page, panel, name) {
  const directory = process.env.BLOTTER_SMS_EVIDENCE;
  if (directory) {
    await mkdir(directory, { recursive: true });
    for (const width of [1440, 390]) { await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
      if (name === 'sms-staff-history') await panel.screenshot({ path: `${directory}/${name}-${width}.png` });
      else await page.screenshot({ path: `${directory}/${name}-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Consent screen has no overflow');
  assert.deepEqual(await panel.evaluate(root => Array.from(root.querySelectorAll('*')).filter(element => element.getClientRects().length && Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()) && parseFloat(getComputedStyle(element).fontSize) < 13).map(element => element.tagName)), [], 'Consent text is at least 13px');
  assert.equal(await panel.locator('button,a').filter({ hasText: /^\s*$/ }).count(), 0, 'All consent controls have visible labels');
  if (name === 'sms-staff-history') {
    await page.addScriptTag({ content: axe.source });
    const result = await panel.evaluate(element => globalThis.axe.run(element, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } }));
    assert.deepEqual(result.violations.map(v => v.id), [], 'Staff consent evidence meets WCAG AA');
  } else await scan(page, name);
}

/** Loaded by push Verify at 1440; the evidence invocation also records 390 once. */
export async function smsConsentJourney(h, s, cookie, language = 'en') {
  const browser = await launch();
  try {
    const context = await contextFor(browser, h, cookie), page = await context.newPage();
    await page.goto(`${h.origin}/client`);
    const select = page.locator('select[name="entity"]'); await page.locator('#preferences').waitFor();
    if (await select.count() && await select.inputValue() !== s.client.id) await select.selectOption(s.client.id);
    const title = language === 'es' ? 'Configuración de comunicaciones' : 'Communication settings';
    await page.getByText(title, { exact: true }).click();
    const panel = page.locator('section[aria-labelledby="sms-title"]'), checkbox = panel.getByRole('checkbox'), opt = panel.getByRole('button', { name: language === 'es' ? 'Guardar mi consentimiento' : 'Save my opt-in', exact: true });
    await checkbox.waitFor(); assert.equal(await checkbox.isChecked(), false); await expect(opt).toBeDisabled();
    const presented = await h.json(`/client/entities/${s.client.id}/sms-consent`, undefined, cookie);
    await expect(panel.locator('[data-sms-wording]')).toHaveText(presented.wording);
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    await panel.getByRole('button', { name: language === 'es' ? 'Rechazar textos opcionales' : 'Decline optional texts', exact: true }).click();
    await expect(panel.getByRole('status')).toBeVisible();
    let current = await h.json(`/client/entities/${s.client.id}/sms-consent`, undefined, cookie);
    assert.equal(current.history[0].choice, 'decline'); assert.equal(current.optedIn, false);
    const target = await checkbox.elementHandle();
    let reached = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      await page.keyboard.press('Tab');
      if (await target.evaluate(element => document.activeElement === element)) { reached = true; break; }
    }
    assert.equal(reached, true, 'The consent checkbox is reachable by Tab');
    assert.ok(await checkbox.evaluate(element => { const css = getComputedStyle(element); return (css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0) || css.boxShadow !== 'none'; }), 'Keyboard focus is visible');
    await page.keyboard.press('Space'); await expect(opt).toBeEnabled(); await page.keyboard.press('Tab');
    assert.equal(await opt.evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Enter');
    await expect(checkbox).not.toBeChecked();
    current = await h.json(`/client/entities/${s.client.id}/sms-consent`, undefined, cookie);
    assert.equal(current.optedIn, true); assert.equal(current.history[0].wording, presented.wording); assert.equal(current.history[0].language, language);
    await panel.locator('summary').click();
    await expect(panel.locator('[data-sms-event]').first()).toContainText(current.history[0].actor);
    await proof(page, panel, `sms-client-${language}-opted-in`);
    await panel.getByRole('button', { name: language === 'es' ? 'Retirar consentimiento SMS' : 'Withdraw SMS consent', exact: true }).click();
    await expect(panel.locator('[data-sms-event]').first()).toContainText(language === 'es' ? 'Retirado' : 'Withdrawn');
    assert.equal((await h.json(`/client/entities/${s.client.id}/sms-consent`, undefined, cookie)).optedIn, false);
    await context.close();
  } finally { await browser.close(); }
}

export async function smsStaffJourney(h, s) {
  const browser = await launch();
  try {
    const context = await contextFor(browser, h, h.owner), page = await context.newPage();
    await page.goto(`${h.origin}/app`);
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Clients & templates', exact: true }).click();
    const entry = page.locator('li').filter({ has: page.locator('strong').filter({ hasText: s.client.name }) }).first();
    await entry.getByText('Client details and contacts', { exact: true }).click();
    await entry.getByText('SMS consent evidence', { exact: true }).click();
    const panel = entry.locator('details').filter({ has: page.getByText('SMS consent evidence', { exact: true }) }).last();
    await expect(panel.getByText('Opted in', { exact: true }).first()).toBeVisible();
    assert.equal(await panel.locator('button,input,select,textarea').count(), 0, 'Staff evidence has no impersonation control');
    await proof(page, panel, 'sms-staff-history');
    await context.close();
  } finally { await browser.close(); }
}
