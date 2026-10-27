import assert from 'node:assert/strict';
import {chromium, expect} from '@playwright/test';
import {readFile, mkdir} from 'node:fs/promises';
import {harness} from './harness.mjs';

const launch = () => chromium.launch({headless:true, ...(process.env.BLOTTER_CHROMIUM_PATH ? {executablePath:process.env.BLOTTER_CHROMIUM_PATH} : {}), args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
const cookies = (h,cookie) => cookie.split('; ').map(c => {const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};});
async function fixture() {
 const h=await harness();
 await h.json('/team',{email:'mobile@example.test',name:'Mobile preparer',role:'preparer'},h.owner);
 await h.json('/team/invite',{email:'mobile@example.test'},h.owner);
 h.prep=await h.login('mobile@example.test');
 const client=await h.json('/clients',{name:'synthetic-blotter-971',contactName:'Synthetic client',contactEmail:'mobile-client@example.test'},h.owner);
 const template=await h.json('/templates',{name:'Phone close',recurrence:'monthly',steps:'Review statement',requests:'Statement'},h.owner);
 const job=await h.json('/jobs',{clientId:client.id,templateId:template.id,periodStart:'2034-04-01',dueDate:'2034-05-15',dueNote:'Client agreement',preparerEmail:'mobile@example.test',reviewerEmail:'owner@example.test'},h.owner);
 await h.json('/team/rates',{scope:'client',clientId:client.id,rateCents:18000,effectiveFrom:'2000-01-01'},h.owner);
 return {h,job};
}
async function ready(h,context,page) {
 await context.addCookies(cookies(h,h.owner));await page.goto(h.origin+'/app');
 if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
}
const panel = (page,title) => page.locator('section.panel').filter({has:page.getByRole('heading',{name:title,exact:true})}).first();
async function proof(page,name,region) {
 if(process.env.BLOTTER_MOBILE_EVIDENCE){
  await mkdir(process.env.BLOTTER_MOBILE_EVIDENCE,{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await region.scrollIntoViewIfNeeded();await region.screenshot({path:`${process.env.BLOTTER_MOBILE_EVIDENCE}/${name}-${width}.png`});}
 }
 await page.setViewportSize({width:390,height:1000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Phone screen has no horizontal overflow');
}
async function keyboard(locator,value) {
 await locator.focus();await expect(locator).toBeFocused();
 const focus=await locator.evaluate(el=>{const s=getComputedStyle(el);return s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0||s.boxShadow!=='none';});
 assert.equal(focus,true,'Keyboard control has a visible focus indicator');
 if(value!==undefined)await locator.pressSequentially(value);else await locator.press('Enter');
}
async function accessibility(page) {
 await page.addScriptTag({content:await readFile('node_modules/axe-core/axe.min.js','utf8')});
 const failures=await page.evaluate(async()=> (await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>[v.id,v.nodes.map(n=>n.target)]));
 assert.deepEqual(failures,[],'Phone main content meets automated WCAG AA checks');
}
async function tooltips(page) {
 for(const [control,label] of [[page.getByRole('button',{name:'Search',exact:true}),'Search workspace'],[page.locator('summary[aria-label]').first(),'Account menu']]){
  await control.focus();await expect(page.getByRole('tooltip')).toHaveText(label);
  await control.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);
  await control.blur();await control.hover();await expect(page.getByRole('tooltip')).toHaveText(label);await page.mouse.move(0,0);
 }
}

/** Invoked unconditionally by the existing timer flow in push Verify. */
export async function mobileTimeJourney() {
 const {h,job}=await fixture(),browser=await launch();
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:1000}});
  let page=await context.newPage();await ready(h,context,page);await context.clearCookies();await context.addCookies(cookies(h,h.prep));
  const open=async()=>{await page.goto(h.origin+'/app?job='+job.id);await page.getByRole('heading',{name:'synthetic-blotter-971 · Phone close',exact:true}).waitFor();};
  await open();await tooltips(page);
  let time=panel(page,'Time'),start=time.locator('form').filter({has:page.getByRole('button',{name:'Start timer',exact:true})});
  await keyboard(start.getByLabel('What you are working on'),'Phone reconciliation');
  await page.keyboard.press('Tab');await expect(start.getByLabel('Task (optional)')).toBeFocused();
  await start.getByLabel('Task (optional)').selectOption('1');await keyboard(start.getByRole('button',{name:'Start timer',exact:true}));
  await expect(time.getByText(/Timer running since/)).toBeVisible();
  const started=(await h.json('/jobs/'+job.id,undefined,h.prep)).timer;
  await page.close();page=await context.newPage();await open();time=panel(page,'Time');
  await expect(time.getByText(/Phone reconciliation/)).toBeVisible();await keyboard(time.getByRole('button',{name:'Stop timer',exact:true}));
  await expect(page.getByRole('status').filter({hasText:'Timer stopped'})).toBeVisible();
  const manual=time.locator('form').filter({has:page.getByRole('button',{name:'Record time',exact:true})});
  await manual.getByLabel('Date',{exact:true}).fill('2034-04-10');await keyboard(manual.getByLabel('Minutes',{exact:true}),'30');await keyboard(manual.getByLabel('Description',{exact:true}),'Phone manual entry');await manual.getByLabel('Task (optional)').selectOption('1');
  await keyboard(manual.getByRole('button',{name:'Record time',exact:true}));await expect(page.getByRole('status').filter({hasText:'Time recorded'})).toBeVisible();
  let detail=await h.json('/jobs/'+job.id,undefined,h.prep);
  assert.deepEqual(detail.time.map(t=>[t.description,t.minutes,t.rate_cents,t.amount_cents,t.step_ordinal]).sort(),[['Phone manual entry',30,18000,9000,1],['Phone reconciliation',1,18000,300,1]],'Timer and manual entry each sync exactly once with the snapshotted rate and task');
  assert.equal(detail.time.find(t=>t.description==='Phone reconciliation').date,started.started_at.slice(0,10));
  await h.json('/timer/stop',{},h.prep,404);
  await h.json('/team/rates',{scope:'client',clientId:detail.client.id,rateCents:24000,effectiveFrom:'2000-01-01'},h.owner);
  await page.reload();await expect(panel(page,'Time').locator('tbody tr')).toHaveCount(2);
  for(const [description,amount] of [['Phone reconciliation','USD 3.00'],['Phone manual entry','USD 90.00']]){
   const row=panel(page,'Time').locator('tbody tr').filter({hasText:description});
   await expect(row).toHaveCount(1);await expect(row).toContainText('USD 180.00/h');await expect(row).toContainText(amount);
  }
  assert.deepEqual((await h.json('/jobs/'+job.id,undefined,h.prep)).time.map(t=>t.rate_cents),[18000,18000],'Rate changes preserve both snapshots');
  await proof(page,'phone-time',panel(page,'Time'));await accessibility(page);
  // Close a broad fixed period in this isolated practice; no midnight boundary can escape it.
  for(const date of new Set(detail.time.map(t=>t.date))){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));await h.json('/timesheets/submit',{weekStart:d.toISOString().slice(0,10)},h.prep);}
  for(const t of detail.time)await h.json(`/time/${t.id}/review`,{decision:'approve'},h.owner);
  await h.json('/periods/close',{startDate:'2000-01-01',endDate:'2099-12-31',note:'Approved close'},h.owner);
  await page.reload();time=panel(page,'Time');start=time.locator('form').filter({has:page.getByRole('button',{name:'Start timer',exact:true})});
  await start.getByLabel('What you are working on').fill('Locked timer');await start.getByRole('button',{name:'Start timer',exact:true}).click();await time.getByRole('button',{name:'Stop timer',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('closed');
  await expect(time.getByRole('button',{name:'Stop timer',exact:true})).toBeVisible();
  const locked=time.locator('form').filter({has:page.getByRole('button',{name:'Record time',exact:true})});
  await locked.getByLabel('Date',{exact:true}).fill('2034-04-10');await locked.getByLabel('Minutes',{exact:true}).fill('10');await locked.getByLabel('Description',{exact:true}).fill('Locked manual');await locked.getByRole('button',{name:'Record time',exact:true}).click();await expect(page.getByRole('alert')).toContainText('closed');
  assert.equal((await h.json('/jobs/'+job.id,undefined,h.prep)).time.length,2,'Locked writes create no time');
  await proof(page,'phone-time-locked',time);
  // End this exact browser session through the public sign-out door, then attempt its queued write.
  assert.equal((await page.request.post(h.origin+'/auth/signout',{headers:{origin:h.origin},data:{}})).status(),204);
  await context.addCookies(cookies(h,h.prep));
  await time.getByRole('button',{name:'Stop timer',exact:true}).click();await expect(page.getByRole('alert')).toContainText(/Sign in|session/i);
  assert.equal((await h.json('/jobs/'+job.id,undefined,h.owner)).time.length,2,'Revoked browser session cannot sync new time');
  await context.close();
 }finally{await browser.close();await h.close();}
}

/** Completes the actual client to-do and staff review in the existing portal flow. */
export async function mobileTaskJourney(h,{token,work,preparer,reviewer,phase}) {
 const browser=await launch();
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:1000}}),page=await context.newPage();await ready(h,context,page);await context.clearCookies();
  if(phase==='complete'){
   await page.goto(h.origin+'/portal/'+token);const todos=panel(page,'Your to-dos');
   await keyboard(todos.getByLabel('Reply (optional)'),'New BSB 062-000');await page.keyboard.press('Tab');await expect(todos.getByRole('button',{name:'Mark done',exact:true})).toBeFocused();await page.keyboard.press('Enter');
   await expect(page.getByRole('status')).toContainText('To-do completed');await expect(todos.getByRole('button',{name:'Mark done',exact:true})).toHaveCount(0);
   await proof(page,'client-task',todos);await accessibility(page);
   await context.addCookies(cookies(h,preparer));await page.goto(h.origin+'/app?job='+work.id);await expect(panel(page,'Client link').getByText(/completed .*New BSB 062-000/)).toBeVisible();await proof(page,'staff-task',panel(page,'Client link'));
  }else{
   await context.addCookies(cookies(h,reviewer));await page.goto(h.origin+'/app?job='+work.id);
   const review=page.locator('.review');await review.getByLabel('Review note').fill('Client response and statement checked');
   await proof(page,'staff-review',panel(page,'Checklist'));await keyboard(review.getByRole('button',{name:'Record decision',exact:true}));
   await expect(page.getByRole('status').filter({hasText:'Job signed off'})).toBeVisible();
   assert.equal((await h.json('/jobs/'+work.id,undefined,reviewer)).job.status,'signed_off');
   await accessibility(page);
   await context.clearCookies();await page.goto(h.origin+'/portal/'+token);await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Mark done',exact:true})).toHaveCount(0);
   assert.equal((await h.request(`/api/blotter/portal/${token}/messages`,{body:'Revoked work'})).status,404,'Closed client link cannot sync new work');
  }
  await context.close();
 }finally{await browser.close();}
}
