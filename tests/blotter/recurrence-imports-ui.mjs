import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export async function recurrenceImportJourney(h, ruleId) {
  const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
  try{
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
    await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
    const page=await context.newPage();await page.goto(h.origin+'/app');
    if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
    await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Clients & templates',exact:true}).click();
    const panel=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Recurring work',exact:true})});
    const record=panel.locator('article').filter({hasText:'Cedar Grove Design LLC'}).filter({hasText:'Monthly bookkeeping close'});
    await record.getByRole('button',{name:'Review schedule before activation',exact:true}).click();
    const review=record.locator('section.notice');await review.getByRole('heading',{name:'Schedule activation review'}).waitFor();
    await mkdir(process.env.BLOTTER_RECURRENCE_EVIDENCE,{recursive:true});
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await review.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await panel.screenshot({path:`${process.env.BLOTTER_RECURRENCE_EVIDENCE}/cutover-review-${width}.png`});}
    await review.getByRole('button',{name:'Approve this schedule and resume',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Reviewed rule resumed'}).waitFor();
    assert.equal((await h.json('/rules',undefined,h.owner)).rules.find(r=>r.id===ruleId).status,'active');
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.screenshot({path:`${process.env.BLOTTER_RECURRENCE_EVIDENCE}/cutover-active-${width}.png`});}
    await context.close();
  }finally{await browser.close();}
}
