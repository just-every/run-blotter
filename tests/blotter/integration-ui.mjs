import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

export async function integrationTaskJourney(h,jobId,label) {
 const evidence=process.env.BLOTTER_INTEGRATION_EVIDENCE;
 if(!evidence)return;
 await mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.BLOTTER_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(cookie=>{const at=cookie.indexOf('=');return{name:cookie.slice(0,at),value:cookie.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await page.goto(h.origin+'/app?job='+jobId);
  await page.getByText(label,{exact:true}).first().waitFor();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.getByText(label,{exact:true}).first().scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Integration-created tasks fit the existing job screen');
   await page.screenshot({path:`${evidence}/integration-tasks-${width}.png`,fullPage:true});
  }
  await context.close();
 }finally{await browser.close();}
}
