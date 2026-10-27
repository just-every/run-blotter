import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function enterpriseJourney(h){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Team & safety',exact:true}).click();
  const panel=page.getByRole('region',{name:'Enterprise sign-in and provisioning'});await panel.getByRole('heading',{name:'Enterprise sign-in',exact:true}).waitFor();
  await panel.locator('summary',{hasText:'Group roles and access teams'}).click();
  await panel.locator('summary',{hasText:'Bind staff identities'}).click();
  await panel.getByText('preparer@example.com',{exact:true}).waitFor();await panel.getByText('Tax team',{exact:true}).first().waitFor();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Enterprise settings fit the viewport');
   const unlabeled=await panel.locator('button').evaluateAll(buttons=>buttons.filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')).length);assert.equal(unlabeled,0);
   if(process.env.BLOTTER_ENTERPRISE_EVIDENCE){await mkdir(process.env.BLOTTER_ENTERPRISE_EVIDENCE,{recursive:true});await panel.screenshot({path:`${process.env.BLOTTER_ENTERPRISE_EVIDENCE}/enterprise-${width}.png`});}
  }
  const signedOut=await browser.newContext({ignoreHTTPSErrors:true});const signin=await signedOut.newPage();await signin.goto(h.origin+'/signin');await signin.getByRole('button',{name:'Continue with Firm Microsoft Entra'}).waitFor();
  for(const width of [1440,390]){await signin.setViewportSize({width,height:900});assert.equal(await signin.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.BLOTTER_ENTERPRISE_EVIDENCE)await signin.screenshot({path:`${process.env.BLOTTER_ENTERPRISE_EVIDENCE}/enterprise-signin-${width}.png`});}
  await signedOut.close();await context.close();
 }finally{await browser.close();}
}
