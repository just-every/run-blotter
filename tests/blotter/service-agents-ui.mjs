import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function serviceAgentsJourney(h,s,key){
 const evidence=process.env.BLOTTER_SERVICE_EVIDENCE;
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Preparations',exact:true}).click();
  const costs=page.getByRole('region',{name:'Service costs'}),agents=page.getByRole('region',{name:'Scheduled agents'});
  await costs.getByText('Estimate seasonal usage',{exact:true}).click();
  await costs.getByRole('button',{name:'Estimate costs',exact:true}).click();await costs.getByRole('heading',{name:'Seasonal estimate'}).waitFor();
  assert.match(await costs.innerText(),/Incomplete: supply all prices/);
  const capture=async(panel,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(evidence){await mkdir(evidence,{recursive:true});await panel.screenshot({path:`${evidence}/${name}-${width}.png`});}}};
  await capture(costs,'costs');await costs.getByText('Estimate seasonal usage',{exact:true}).click();
  await agents.getByText('Enable a supervised agent',{exact:true}).click();
  await agents.getByLabel('Agent name',{exact:true}).fill('Browser file agent');await agents.getByLabel('Supervisor’s agent key').selectOption(key.id);await agents.getByLabel('One client',{exact:true}).selectOption(s.client.id);
  await agents.getByRole('button',{name:'Approve agent grant',exact:true}).click();await agents.getByText('Browser file agent',{exact:true}).waitFor();
  assert.equal((await h.json('/agent-rules',undefined,h.owner)).rules.length,1);
  await capture(agents,'agents');await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();await agents.getByRole('button',{name:'Revoke agent',exact:true}).click();
  await agents.getByText('Revoked',{exact:true}).waitFor();assert.equal((await h.json('/agent-rules',undefined,h.owner)).rules[0].status,'revoked');
  // Every icon-only control visible on this screen, at both release widths.
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));
   const search=page.getByRole('button',{name:'Search',exact:true});await search.focus();await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
   await search.blur();await page.mouse.move(1,999);await search.hover();await page.waitForTimeout(150);assert.equal(await page.getByRole('tooltip').count(),0);await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
   if(evidence)await page.screenshot({path:`${evidence}/tooltip-search-${width}.png`});
   await page.mouse.move(1,999);const account=page.locator('summary[aria-label]').first();await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor();
   if(evidence)await page.screenshot({path:`${evidence}/tooltip-account-${width}.png`});await account.blur();
  }
  await context.close();
 }finally{await browser.close();}
}
