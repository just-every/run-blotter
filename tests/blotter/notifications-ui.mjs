import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function notificationAppJourney(h,s,job){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const evidence=process.env.BLOTTER_NOTIFICATION_EVIDENCE;
 if(evidence)await mkdir(evidence,{recursive:true});
 const cookies=(cookie)=>cookie.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});await context.addCookies(cookies(h.owner));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await context.clearCookies();await context.addCookies(cookies(s.prep));await page.goto(h.origin+'/app');
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();
  const panel=page.locator('section.panel').filter({has:page.getByRole('heading',{name:/^Notifications ·/})});
  await panel.getByRole('button',{name:'Work assigned to you',exact:true}).first().waitFor();
  const capture=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(evidence)await panel.screenshot({path:`${evidence}/${name}-${width}.png`});}};
  await capture('center');
  await panel.getByRole('button',{name:'Mark read',exact:true}).first().click();await panel.getByRole('status').filter({hasText:'Marked read'}).waitFor();
  await panel.getByLabel('Show notifications').selectOption('read');assert.ok(await panel.getByRole('button',{name:'Mark unread',exact:true}).count());
  await panel.getByRole('button',{name:'Mark unread',exact:true}).first().click();await panel.getByText('No read notifications.',{exact:true}).waitFor();await panel.getByLabel('Show notifications').selectOption('all');
  await panel.getByText('Notification settings',{exact:true}).click();
  await panel.getByLabel('IANA time zone').fill('America/Chicago');await panel.getByLabel('Daily digest time').fill('07:00');await panel.getByLabel('Due-soon lead time (days)').fill('3');
  await panel.getByRole('button',{name:'Save notification settings',exact:true}).click();await panel.getByRole('status').filter({hasText:'Notification settings saved'}).waitFor();
  assert.equal((await h.json('/notifications/settings',undefined,s.prep)).personal.timeZone,'America/Chicago');
  assert.ok(await panel.getByLabel('Mention (mandatory)',{exact:true}).isDisabled());
  await capture('personal-settings');
  await panel.getByText('Notification settings',{exact:true}).click();await panel.getByRole('button',{name:'Work assigned to you',exact:true}).first().click();
  await page.getByRole('heading',{name:'Cedar Lane LLC · Monthly close',exact:true}).waitFor();
  await context.clearCookies();await context.addCookies(cookies(h.owner));await page.goto(h.origin+'/app');await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();
  await panel.getByText('Firm notification defaults',{exact:true}).click();await panel.getByRole('button',{name:'Save firm notification defaults',exact:true}).waitFor();await capture('firm-defaults');
  await context.close();
 }finally{await browser.close();}
}
