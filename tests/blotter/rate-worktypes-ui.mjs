import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function rateWorkTypeJourney(h,workType,client){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const evidence=process.env.BLOTTER_RATE_EVIDENCE;if(evidence)await mkdir(evidence,{recursive:true});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Team & safety',exact:true}).click();
  const panel=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'People and rates',exact:true})});
  await panel.getByText('Set an hourly rate',{exact:true}).click();
  await panel.getByLabel('Applies to',{exact:true}).selectOption('client_service');
  await panel.getByLabel('Work type (service rates)',{exact:true}).selectOption(workType.id);
  await panel.getByLabel('Client (client rates)',{exact:true}).selectOption(client.id);
  await panel.getByLabel('Hourly rate in cents (15000 = 150.00)',{exact:true}).fill('36000');
  await panel.getByLabel('Effective from',{exact:true}).fill('2026-12-01');
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(evidence)await panel.screenshot({path:`${evidence}/rate-form-${width}.png`});
  }
  await panel.getByRole('button',{name:'Set rate',exact:true}).click();await page.getByRole('status').filter({hasText:'Rate saved'}).waitFor();
  const saved=(await h.json('/team',undefined,h.owner)).rates.find(r=>r.work_type_id===workType.id&&r.rate_cents===36000);
  assert.equal(saved.client_id,client.id);
  const row=panel.getByRole('row').filter({hasText:workType.name}).filter({hasText:'360.00'});await row.waitFor();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});if(evidence)await panel.screenshot({path:`${evidence}/rate-saved-${width}.png`});}
  await context.close();
 }finally{await browser.close();}
}
