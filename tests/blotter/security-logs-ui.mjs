import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';

// HTTP-created source events and the actual browser download are exercised by push Verify.
export async function securityLogsJourney(h,s,range,ids) {
 const directory=process.env.BLOTTER_SECURITY_EVIDENCE;if(directory)await mkdir(directory,{recursive:true});
 await h.stepUp(h.owner);
 const browser=await chromium.launch({headless:true,...(process.env.BLOTTER_CHROMIUM?{executablePath:process.env.BLOTTER_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 try {
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(cookie=>{const at=cookie.indexOf('=');return {name:cookie.slice(0,at),value:cookie.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Team & safety',exact:true}).click();
  await page.getByText('Export access log',{exact:true}).click();
  const panel=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Export access log$/})});
  await panel.getByLabel('Start date (UTC)',{exact:true}).fill('2026-03-08');await panel.getByLabel('End date (UTC, inclusive)',{exact:true}).fill('2026-03-08');
  assert.match(await panel.innerText(),/bearer does not verify a person/);assert.match(await panel.innerText(),/before 00:00 UTC after the last date/);
  const downloaded=page.waitForEvent('download');await panel.getByRole('button',{name:'Download access log (CSV)',exact:true}).click();
  const download=await downloaded;assert.equal(download.suggestedFilename(),'access-log-2026-03-08-through-2026-03-08-UTC.csv');
  const content=await readFile(await download.path(),'utf8');assert.equal(content.trimEnd().split('\r\n').length,5);
  for(const id of ids)assert.ok(content.includes(id));assert.ok(!content.includes(s.file.name));
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();
   if(width===1440)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Security screen fits the viewport');
   if(directory)await panel.screenshot({path:`${directory}/access-log-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:1000});
  const search=page.getByRole('button',{name:'Search',exact:true});await search.focus();await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
  await search.blur();await page.mouse.move(1,999);await search.hover();await page.waitForTimeout(150);assert.equal(await page.getByRole('tooltip').count(),0);await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();await page.mouse.move(1,999);
  await page.locator('summary[aria-label]').first().focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor();
  await context.close();
 }finally{await browser.close();}
}
