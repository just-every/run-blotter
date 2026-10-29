import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import axe from 'axe-core';

/** Always loaded by the native suggestion flow in push Verify, at 1440. */
export async function calendarConsentJourney(h, cookie) {
  const browser = await chromium.launch({ headless: true, ...(process.env.BLOTTER_CHROMIUM_PATH ? { executablePath: process.env.BLOTTER_CHROMIUM_PATH } : {}), args: ['--no-sandbox','--use-mock-keychain','--password-store=basic'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    const cookies = value => value.split('; ').map(part => { const at = part.indexOf('='); return { name: part.slice(0,at), value: part.slice(at+1), url: h.origin }; });
    await context.addCookies(cookies(h.owner)); const page = await context.newPage(); await page.goto(h.origin+'/app');
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button',{ name:'Finish setup' }).click(); await page.waitForURL('**/app'); }
    await context.clearCookies(); await context.addCookies(cookies(cookie));
    const open = async () => { await page.goto(h.origin+'/app'); await page.getByRole('navigation',{ name:'Workspace' }).getByRole('button',{ name:'Jobs',exact:true }).click(); };
    await open();
    const panel = page.locator('section[aria-labelledby="calendar-choice-title"]');
    await expect(panel.getByText('Calendar choice: off',{ exact:true })).toBeVisible();
    await panel.getByText('Calendar choice Settings',{ exact:true }).click();
    const checkbox = panel.getByRole('checkbox'), opt = panel.getByRole('button',{ name:'Save my calendar opt-in',exact:true });
    assert.equal(await checkbox.isChecked(), false); await expect(opt).toBeDisabled();
    const presented = await h.json('/time/calendar-consent',undefined,cookie);
    await expect(panel.locator('[data-calendar-wording]')).toHaveText(presented.wording);
    await panel.getByText('Calendar choice Settings',{ exact:true }).focus(); await page.keyboard.press('Tab'); await expect(checkbox).toBeFocused();
    assert.ok(await checkbox.evaluate(element => { const css=getComputedStyle(element); return (css.outlineStyle !== 'none' && parseFloat(css.outlineWidth)>0) || css.boxShadow !== 'none'; }), 'Keyboard focus is visible');
    await page.keyboard.press('Space'); await page.keyboard.press('Tab'); await expect(opt).toBeFocused(); await page.keyboard.press('Enter');
    await expect(panel.getByText('Calendar choice: on',{ exact:true })).toBeVisible();
    const saved = await h.json('/time/calendar-consent',undefined,cookie);
    assert.equal(saved.optedIn,true); assert.equal(saved.history[0].wording,presented.wording);
    await page.reload(); await page.getByRole('navigation',{ name:'Workspace' }).getByRole('button',{ name:'Jobs',exact:true }).click();
    await expect(panel.getByText('Calendar choice: on',{ exact:true })).toBeVisible();
    await panel.getByText('My calendar choice history',{ exact:true }).click();
    await expect(panel.locator('[data-calendar-event]').first()).toContainText(saved.history[0].actor);
    await panel.getByText('Calendar choice Settings',{ exact:true }).click();
    await expect(checkbox).not.toBeChecked(); await expect(opt).toBeDisabled();
    // Audit the existing icon-only workspace controls visible on this touched screen.
    for (const [control,label] of [[page.getByRole('button',{ name:'Search',exact:true }),'Search workspace'],[page.locator('summary[aria-label]').first(),'Account menu']]) {
      await control.focus(); await expect(page.getByRole('tooltip')).toHaveText(label); await control.press('Escape'); await control.blur();
      await control.hover(); await expect(page.getByRole('tooltip')).toHaveText(label); await page.mouse.move(0,0);
    }
    await page.addScriptTag({ content: axe.source });
    const result = await panel.evaluate(element => globalThis.axe.run(element,{ runOnly:{ type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } }));
    assert.deepEqual(result.violations.map(v=>v.id),[]);
    assert.deepEqual(await panel.evaluate(root => Array.from(root.querySelectorAll('*')).filter(element => element.getClientRects().length && Array.from(element.childNodes).some(node => node.nodeType===Node.TEXT_NODE && node.textContent.trim()) && parseFloat(getComputedStyle(element).fontSize)<13).map(element=>element.tagName)),[],'Consent text is at least 13px');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await panel.locator('button,a').filter({ hasText:/^\s*$/ }).count(),0,'Consent controls all have visible labels');
    if (process.env.BLOTTER_CALENDAR_EVIDENCE) {
      await mkdir(process.env.BLOTTER_CALENDAR_EVIDENCE,{ recursive:true });
      for (const width of [1440,390]) { await page.setViewportSize({ width,height:1000 }); await panel.scrollIntoViewIfNeeded(); await panel.screenshot({ path:`${process.env.BLOTTER_CALENDAR_EVIDENCE}/calendar-choice-${width}.png` }); }
      await page.setViewportSize({ width:1440,height:1000 });
    }
    const withdraw=panel.getByRole('button',{ name:'Withdraw calendar consent',exact:true });
    await withdraw.focus(); await page.keyboard.press('Enter');
    await expect(panel.getByText('Calendar choice: off',{ exact:true })).toBeVisible();
    assert.equal((await h.json('/time/calendar-consent',undefined,cookie)).history[0].choice,'withdraw');
    await page.reload(); await page.getByRole('navigation',{ name:'Workspace' }).getByRole('button',{ name:'Jobs',exact:true }).click();
    await expect(panel.getByText('Calendar choice: off',{ exact:true })).toBeVisible();
    await context.close();
  } finally { await browser.close(); }
}
