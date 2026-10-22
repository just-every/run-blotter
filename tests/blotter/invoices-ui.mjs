import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/** Optional visual proof on the real invoice screen, using only this harness session. */
export async function invoiceJourney(h, fixture, rule) {
  const directory = process.env.BLOTTER_INVOICE_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  // Downloads and the consent below are export/administration doors: this session confirms its second factor first.
  await h.stepUp(h.owner);
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
    await retainer.getByLabel('Per-invoice cap in USD cents', { exact: true }).fill('15000');
    await retainer.getByLabel('Reason recorded in audit', { exact: true }).fill('Client agreement authorizes automatic monthly invoices up to USD 150');
    await retainer.getByRole('button', { name: 'Allow automatic issue and send for this rule revision', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Automatic issue and send allowed for this rule revision' }).waitFor();
    await retainer.getByText('Automatic issue and send is allowed for rule revision', { exact: false }).waitFor();
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

/** BILL-004 screens: the consented reminder schedule, a client statement and the bulk resend preview. */
export async function collectionsJourney(h, fixture) {
  const directory = process.env.BLOTTER_INVOICE_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await h.stepUp(h.owner);
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
    await context.addCookies(h.owner.split('; ').map(cookie => { const at = cookie.indexOf('='); return { name: cookie.slice(0, at), value: cookie.slice(at + 1), url: h.origin }; }));
    const page = await context.newPage(); await page.goto(h.origin + '/app');
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Time & billing', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Collections', exact: true });
    await panel.getByText('Reminders are', { exact: false }).waitFor();
    const capture = async name => { for (const width of [1440, 390]) { await page.setViewportSize({ width, height: 1000 }); await panel.scrollIntoViewIfNeeded(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} ${width} overflows`); await panel.screenshot({ path: `${directory}/${name}-${width}.png` }); } await page.setViewportSize({ width: 1440, height: 1000 }); };
    await capture('collections-schedule');
    const warnings = await h.json('/invoices/reminders', undefined, h.owner);
    if (warnings.warnings.length) await panel.getByRole('alert').filter({ hasText: 'has no Spanish version' }).waitFor();
    await panel.getByText('Client statement', { exact: true }).click();
    await panel.getByLabel('Statement client', { exact: true }).selectOption(fixture.client.id);
    await panel.getByLabel('Statement date', { exact: true }).fill('2026-12-27');
    await panel.getByRole('button', { name: 'Prepare statement', exact: true }).click();
    await panel.getByText('statement as of', { exact: false }).waitFor();
    const [file] = await Promise.all([page.waitForEvent('download'), panel.getByRole('link', { name: 'Download statement CSV', exact: true }).click()]); assert.equal(await file.failure(), null);
    await capture('collections-statement');
    await panel.getByText('Resend invoices', { exact: true }).click();
    await panel.getByRole('checkbox', { name: /Invoice MS-2/ }).check();
    await panel.getByLabel('Reason to resend', { exact: true }).fill('Client asked for a copy');
    await panel.getByRole('button', { name: 'Preview resend', exact: true }).click();
    await panel.getByRole('button', { name: /^Resend 1 invoices$/ }).waitFor();
    await capture('collections-resend-preview');
    await context.close();
  } finally { await browser.close(); }
}

/** BILL-003 screens: a partner-approved write-off on an issued invoice and the receivables report it changes. */
export async function receivablesJourney(h, fixture, invoice) {
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
    const record = panel.locator('article.record').filter({ hasText: invoice.title }).first();
    await record.getByText('Review invoice, sources and history', { exact: true }).click();
    await record.getByText('Write off part of the balance', { exact: true }).click();
    await record.getByLabel('Write-off USD cents', { exact: true }).fill('1000');
    await record.getByLabel('Write-off reason', { exact: true }).fill('Partner approved a small write-off after the client call');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await record.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `write-off ${width} overflows`);
      await record.screenshot({ path: `${directory}/invoice-writeoff-${width}.png` });
    }
    await record.getByRole('button', { name: 'Approve write-off', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Write-off approved' }).waitFor();
    await record.getByText('Approved write-offs', { exact: true }).waitFor();
    const reports = page.getByRole('region', { name: 'Performance reports', exact: true });
    await reports.getByLabel('Period from', { exact: true }).fill('2026-11-01'); await reports.getByLabel('Period to', { exact: true }).fill('2026-11-30');
    await reports.getByLabel('Report client', { exact: true }).selectOption(fixture.client.id); await reports.getByRole('button', { name: 'Run report', exact: true }).click();
    const section = reports.getByRole('region', { name: 'Receivables and profitability', exact: true }); await section.waitFor();
    await section.getByText('Aged receivables', { exact: true }).waitFor();
    await section.getByText('written off USD 76.00', { exact: false }).first().waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await section.scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `receivables ${width} overflows`);
      await section.screenshot({ path: `${directory}/receivables-report-${width}.png` });
    }
    await context.close();
  } finally { await browser.close(); }
}

const signedIn = async (h, browser, width = 1440) => {
  await h.stepUp(h.owner);
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 1000 } });
  await context.addCookies(h.owner.split('; ').map(cookie => { const at = cookie.indexOf('='); return { name: cookie.slice(0, at), value: cookie.slice(at + 1), url: h.origin }; }));
  const page = await context.newPage();
  return { context, page };
};
const capture = async (page, locator, directory, name) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await locator.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} ${width} overflows`);
    await locator.screenshot({ path: `${directory}/${name}-${width}.png` });
  }
};

/** BILL-005 screens: the staff payment-gate panel on a deliverable and the client's locked file on the portal. */
export async function gateJourney(h, fixture, portalUrl) {
  const directory = process.env.BLOTTER_INVOICE_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  try {
    const { context, page } = await signedIn(h, browser);
    await page.goto(`${h.origin}/app?job=${fixture.job.id}`);
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); await page.goto(`${h.origin}/app?job=${fixture.job.id}`); }
    const panel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Deliverables for client approval', exact: true }) });
    await panel.getByText('Locked for the client', { exact: false }).first().waitFor();
    await panel.getByText('Partner controls', { exact: true }).first().click();
    await capture(page, panel, directory, 'payment-gate-staff');
    const client = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } }), portal = await client.newPage();
    await portal.goto(portalUrl);
    const locked = portal.getByText('This file is locked until invoice', { exact: false }).first(); await locked.waitFor();
    assert.equal(await portal.getByRole('link', { name: /Version 1: Final return copy/ }).count(), 0, 'A locked version has no download link');
    await capture(portal, portal.locator('main'), directory, 'payment-gate-client');
    await client.close(); await context.close();
  } finally { await browser.close(); }
}

/** BILL-005 screens: the credit hold on a client with its partner override, and the firm payment policy. */
export async function holdJourney(h, fixture) {
  const directory = process.env.BLOTTER_INVOICE_EVIDENCE;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  try {
    const { context, page } = await signedIn(h, browser);
    await page.goto(h.origin + '/app');
    if (new URL(page.url()).pathname === '/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Finish setup' }).click(); await page.waitForURL('**/app'); }
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Time & billing', exact: true }).click();
    const panel = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: 'Invoices and retainers', exact: true }) });
    await panel.getByText('Payment policy: gated files and credit hold', { exact: true }).click();
    await panel.getByText('Clients with', { exact: false }).waitFor();
    await capture(page, panel.locator('details').filter({ hasText: 'Payment policy: gated files and credit hold' }).first(), directory, 'payment-policy');
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Clients & templates', exact: true }).click();
    const entry = page.locator('ul.list > li').filter({ hasText: fixture.client.name }).first();
    await entry.getByText('Client details and contacts', { exact: true }).click();
    const hold = entry.getByRole('status', { name: 'Credit hold' }); await hold.waitFor();
    await hold.getByText('Override the credit hold', { exact: true }).click();
    await capture(page, hold, directory, 'credit-hold');
    await page.goto(`${h.origin}/app?job=${fixture.job.id}`);
    const warning = page.getByRole('status').filter({ hasText: 'This client is on credit hold' });
    await warning.waitFor();
    await capture(page, warning, directory, 'credit-hold-job');
    await context.close();
  } finally { await browser.close(); }
}
