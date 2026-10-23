import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function serviceAgentsJourney(h,s,key,job){
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
  await capture(agents,'agents');
  await costs.getByText('Approve a budget or increase',{exact:true}).click();await costs.getByLabel('Lifetime budget (USD cents)',{exact:true}).fill('0');await costs.getByLabel('Per-action threshold (USD cents)',{exact:true}).fill('0');await costs.getByLabel('Budget approval reason',{exact:true}).fill('Hold optional plans until reviewed');await costs.getByRole('button',{name:'Approve budget',exact:true}).click();
  const detail=await s.detail(job.id);await h.json(`/requests/${detail.requests[0].id}/files`,{name:'synthetic-blotter-6.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-6').toString('base64')},s.prep);
  await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();await costs.getByText('Blocked',{exact:true}).waitFor();await agents.getByText('Blocked',{exact:true}).waitFor();
  await capture(costs,'budget-blocked');await capture(agents,'plan-blocked');
  await costs.getByLabel('Lifetime budget (USD cents)',{exact:true}).fill('100');await costs.getByLabel('Per-action threshold (USD cents)',{exact:true}).fill('25');await costs.getByLabel('Budget approval reason',{exact:true}).fill('Approve one bounded native plan');await costs.getByRole('button',{name:'Approve budget',exact:true}).click();
  await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();await costs.getByText('Reserved',{exact:true}).waitFor();await agents.getByText('Pending',{exact:true}).waitFor();
  await costs.getByLabel('Confirmed USD cents',{exact:true}).fill('0');await costs.getByLabel('Provider receipt or native cost evidence',{exact:true}).fill('Native plan: no provider charge');await costs.getByRole('button',{name:'Reconcile cost',exact:true}).click();await costs.getByText('Confirmed',{exact:true}).waitFor();
  await capture(costs,'cost-reconciled');await capture(agents,'plan-prepared');
  await agents.getByRole('button',{name:'Revoke agent',exact:true}).click();
  await agents.getByText('Revoked',{exact:true}).waitFor();assert.equal((await h.json('/agent-rules',undefined,h.owner)).rules[0].status,'revoked');
  await agents.getByLabel('Agent name',{exact:true}).fill('External metadata agent');await agents.getByLabel('Planner',{exact:true}).selectOption('external');
  await agents.getByLabel('Agent provider',{exact:true}).fill('synthetic-blotter-200');await agents.getByLabel('Model or runtime',{exact:true}).fill('Owner runtime');await agents.getByLabel('Provider data use and training',{exact:true}).fill('No training under owner contract');await agents.getByLabel('Provider retention and account owner',{exact:true}).fill('Owner account; zero retention');
  await capture(agents,'external-grant');await agents.getByRole('button',{name:'Approve agent grant',exact:true}).click();await agents.getByText('External metadata agent',{exact:true}).waitFor();
  await capture(agents,'external-policy');
  await h.json(`/requests/${detail.requests[0].id}/files`,{name:'synthetic-blotter-203.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-203').toString('base64')},s.prep);
  await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();
  const headers={authorization:'Bearer '+key.key},queued=await h.json('/agent/plans',undefined,'',200,headers);assert.equal(queued.plans.length,1);
  const drafted=await h.json('/agent/plans/'+queued.plans[0].id,{message:'Please upload the year-end statement; the amount is still unconfirmed.'},'',200,headers);
  await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();
  const preview=page.locator('article').filter({hasText:'Please upload the year-end statement; the amount is still unconfirmed.'});await preview.getByRole('button',{name:'Approve',exact:true}).waitFor();assert.match(await preview.innerText(),/Source event: file:/);
  await capture(preview,'external-draft-review');
  const before=h.mails.length;await preview.getByText('Decline',{exact:true}).first().click();await preview.getByLabel('Reason',{exact:true}).fill('Do not send this wording');await preview.getByRole('button',{name:'Decline',exact:true}).click();await preview.getByText('Declined',{exact:true}).waitFor();assert.equal(h.mails.length,before);assert.equal((await h.json('/agent-rules',undefined,h.owner)).runs.find(r=>r.proposal_id===drafted.id).decision,'declined');
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
