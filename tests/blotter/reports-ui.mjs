import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function reportAppJourney(h,s){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Time & billing',exact:true}).click();
  const panel=page.getByRole('region',{name:'Performance reports'});await panel.getByLabel('Report client',{exact:true}).selectOption(s.client.id);
  await panel.getByLabel('Period from',{exact:true}).fill('2026-01-01');await panel.getByLabel('Period to',{exact:true}).fill('2026-03-31');
  await panel.getByLabel('Report service / work type',{exact:true}).selectOption(s.type.id);await panel.getByLabel('Report team member',{exact:true}).selectOption('prep@example.test');await panel.getByRole('button',{name:'Run report',exact:true}).click();
  await panel.getByText('2 jobs · 1 completed · 1 overdue · 1 blocked · 1 review returns',{exact:true}).waitFor();
  await panel.getByLabel('Report view name',{exact:true}).fill('Partner tax-season report');await panel.getByRole('button',{name:'Save report view',exact:true}).click();
  await panel.getByText('Schedule an internal report',{exact:true}).click();await panel.getByLabel('Report partner',{exact:true}).selectOption('reviewer@example.test');
  await panel.getByRole('button',{name:'Schedule report',exact:true}).click();await panel.getByRole('button',{name:'Pause report',exact:true}).waitFor();
  const evidence=process.env.BLOTTER_REPORT_EVIDENCE;if(evidence)await mkdir(evidence,{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(evidence)await page.screenshot({path:`${evidence}/reports-${width}.png`,fullPage:true});}
  await panel.getByRole('button',{name:'Pause report',exact:true}).click();
  const downloads=await Promise.all([page.waitForEvent('download'),panel.getByRole('link',{name:'Download report CSV',exact:true}).click()]);assert.match(downloads[0].suggestedFilename(),/\.csv$/);
  await panel.locator('summary').filter({hasText:'Cedar Lane LLC'}).first().click();await panel.getByRole('button',{name:'Open source job',exact:true}).first().click();
  await page.getByRole('heading',{name:'Cedar Lane LLC · 1040 preparation',exact:true}).waitFor();await context.close();
 }finally{await browser.close();}
}
