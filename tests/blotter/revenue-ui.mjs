import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {paymentTooltips} from './payment-tooltips.mjs';

// The push journey always exercises this public screen; screenshots are optional output.
export async function revenueJourney(h,s) {
 const directory=process.env.BLOTTER_REVENUE_EVIDENCE;
 if(directory)await mkdir(directory,{recursive:true});
 await h.stepUp(h.owner);
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try {
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(cookie=>{const at=cookie.indexOf('=');return {name:cookie.slice(0,at),value:cookie.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Time & billing',exact:true}).click();
  const panel=page.getByRole('region',{name:'Revenue review',exact:true});
  await panel.getByLabel('Revenue client',{exact:true}).selectOption(s.client.id);
  await panel.getByLabel('Signed scope review',{exact:true}).selectOption(s.plan.id);
  await panel.getByText('Returned ACH: Monthly scope',{exact:true}).waitFor();
  await panel.getByText('Source integrity',{exact:true}).click();
  const drafts=panel.locator('section').filter({has:page.getByRole('heading',{name:'Prepared drafts and decisions',exact:true})});
  assert.equal(await drafts.locator('article').count(),2);
  await drafts.getByText('Approved',{exact:true}).waitFor();await drafts.getByText('Declined',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Reconcile provider',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Provider payment reconciled'}).waitFor();
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Revenue screen overflows at ${width}`);
   if(directory)await panel.screenshot({path:`${directory}/revenue-${width}.png`});
  }
  if(directory)await paymentTooltips(page,directory);
  await context.close();
 }finally{await browser.close();}
}
