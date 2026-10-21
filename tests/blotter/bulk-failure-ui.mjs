import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function bulkFailureJourney(h,cookie){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const evidence=process.env.BLOTTER_BULK_FAILURE_EVIDENCE;if(evidence)await mkdir(evidence,{recursive:true});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  // Synthetic HTTP-fixture sessions only; never a real browser profile.
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await context.clearCookies();await context.addCookies(cookie.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  await page.goto(h.origin+'/app');await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();
  const panel=page.locator('section.panel').filter({has:page.getByRole('heading',{name:/^Notifications ·/})});
  await panel.getByRole('button',{name:'Bulk message delivery failed',exact:true}).waitFor();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(evidence)await panel.screenshot({path:`${evidence}/bulk-failure-notices-${width}.png`});}
  await context.close();
 }finally{await browser.close();}
}
