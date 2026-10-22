import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/** Optional visual proof on the real invoice screen, using only this harness session. */
export async function invoiceJourney(h, fixture, rule) {
  const directory = process.env.BLOTTER_INVOICE_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await context.addCookies(h.owner.split('; ').map(cookie => { const at = cookie.indexOf('='); return { name: cookie.slice(0, at), value: cookie.slice(at + 1), url: h.origin }; }));
    const page = await context.newPage(); await page.goto(h.origin + '/app');
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Time & billing', exact: true }).click();
    const panel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Invoices and retainers', exact: true }) });
    await panel.getByLabel('Invoice work item', { exact: true }).selectOption(fixture.job.id);
    await panel.getByText('Record a deposit or credit', { exact: true }).click();
    await panel.getByLabel('External receipt or credit reference', { exact: true }).fill('UI-DEPOSIT-RECEIPT');
    await panel.getByLabel('USD cents', { exact: true }).fill('500');
    await panel.getByLabel('Authority and reason', { exact: true }).fill('Principal inspected the client supplied deposit receipt');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await panel.screenshot({ path: `${directory}/invoice-deposit-${width}.png` });
    }
    await panel.getByRole('button', { name: 'Record deposit or credit', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Deposit or credit recorded' }).waitFor();
    assert.ok((await h.json('/invoices', undefined, h.owner)).credits.some(c => c.reference === 'UI-DEPOSIT-RECEIPT' && c.amount_cents === 500));
    const retainer = panel.locator('article.record').filter({ has: page.getByText(rule.definition ? 'Monthly bookkeeping retainer' : rule.title, { exact: false }) }).filter({ has: page.getByText('Generate or amend this retainer', { exact: true }) });
    // The page shows both recorded monthly invoices and the retainer's retained amendment history.
    await retainer.getByText('Generate or amend this retainer', { exact: true }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await retainer.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await panel.screenshot({ path: `${directory}/invoice-retainer-${width}.png` });
    }
    const invoices = panel.locator('article.record').filter({ has: page.getByText('Review invoice, sources and history', { exact: true }) });
    assert.ok(await invoices.count() >= 2);
    await invoices.first().getByText('Review invoice, sources and history', { exact: true }).click();
    await invoices.first().getByText('Subtotal', { exact: false }).waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await invoices.first().scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await panel.screenshot({ path: `${directory}/invoice-document-${width}.png` });
    }
    const issued=(await h.json('/invoices',undefined,h.owner)).invoices.find(i=>i.status==='issued');
    const issuedRecord=invoices.filter({hasText:'INV-'+String(issued.number).padStart(6,'0')});
    const summary=issuedRecord.getByText('Review invoice, sources and history',{exact:true});
    if(!await summary.evaluate(e=>e.parentElement.open))await summary.click();
    await issuedRecord.getByRole('button',{name:'Preview invoice delivery',exact:true}).click();
    await issuedRecord.getByRole('button',{name:'Deliver PDF and portal invoice',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Invoice delivery recorded'}).waitFor();
    const invitation=h.mails.toReversed().find(m=>m.text?.includes('/invoice/iv_'));
    const portalUrl=invitation.text.match(/https:\/\/[^\s]+\/invoice\/iv_[0-9a-f]{64}/)[0];
    const client=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),portal=await client.newPage();
    await portal.goto(portalUrl);await portal.getByRole('link',{name:'Download invoice PDF',exact:true}).waitFor();
    for(const width of [1440,390]){await portal.setViewportSize({width,height:1000});assert.equal(await portal.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await portal.screenshot({path:`${directory}/invoice-portal-${width}.png`,fullPage:true});}
    await page.getByLabel('Search everything (press /)',{exact:true}).fill('INV-'+String(issued.number).padStart(6,'0'));
    await page.getByRole('search').getByRole('button',{name:'Search',exact:true}).click();
    const search=page.locator('section.search-results');await search.getByLabel('Type',{exact:true}).selectOption('invoice');
    const pdfLink=search.getByRole('link',{name:'Open invoice PDF',exact:true});await pdfLink.waitFor();
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await search.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await search.screenshot({path:`${directory}/invoice-search-${width}.png`});}
    const [download]=await Promise.all([page.waitForEvent('download'),pdfLink.click()]);assert.equal(await download.failure(),null);
    await search.getByRole('button',{name:'Close',exact:true}).click();
    const reports=page.getByRole('region',{name:'Performance reports',exact:true});
    await reports.getByLabel('Period from',{exact:true}).fill('2026-11-01');await reports.getByLabel('Period to',{exact:true}).fill('2026-11-30');
    await reports.getByLabel('Report client',{exact:true}).selectOption(fixture.client.id);await reports.getByRole('button',{name:'Run report',exact:true}).click();
    const native=reports.getByRole('region',{name:'Native invoice reporting',exact:true});await native.waitFor();
    const numbered=native.locator('details').filter({hasText:'INV-'+String(issued.number).padStart(6,'0')}).first();await numbered.locator('summary').first().click();
    await native.locator('details').filter({hasText:'Monthly bookkeeping retainer'}).last().locator('summary').first().click();
    await native.locator('details').filter({hasText:'UI-DEPOSIT-RECEIPT'}).last().locator('summary').first().click();
    const [sourcePdf]=await Promise.all([page.waitForEvent('download'),numbered.getByRole('link',{name:'Download invoice PDF',exact:true}).click()]);assert.equal(await sourcePdf.failure(),null);
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await native.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await native.screenshot({path:`${directory}/invoice-report-${width}.png`});}
    for(const format of ['CSV','PDF']){const [file]=await Promise.all([page.waitForEvent('download'),reports.getByRole('link',{name:'Download report '+format,exact:true}).click()]);assert.equal(await file.failure(),null);}
    await client.close();await context.close();
  } finally { await browser.close(); }
}
