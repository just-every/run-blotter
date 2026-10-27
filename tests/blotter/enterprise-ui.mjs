import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function enterpriseJourney(h,phase='mapped'){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Team & safety',exact:true}).click();
  const panel=page.getByRole('region',{name:'Enterprise sign-in and provisioning'});await panel.getByRole('heading',{name:'Enterprise sign-in',exact:true}).waitFor();
  if(phase==='mapped'){
   await panel.locator('summary',{hasText:'Group roles and access teams'}).click();
   await panel.locator('summary',{hasText:'Bind staff identities'}).click();
   await panel.getByText('preparer@example.com',{exact:true}).waitFor();await panel.getByText('Tax team',{exact:true}).first().waitFor();
   await panel.getByLabel('Microsoft Entra group ID',{exact:true}).fill('synthetic-blotter-tax');
   await panel.getByLabel('Work role',{exact:true}).selectOption('reviewer');
   await panel.getByLabel('Access team (optional)',{exact:true}).selectOption({label:'Tax team'});
   const form=panel.getByRole('button',{name:'Map group',exact:true}).locator('..');
   await form.getByLabel('Reason recorded in audit',{exact:true}).fill('Reviewed tax team mapping');
   await panel.getByRole('button',{name:'Map group',exact:true}).click();await page.getByRole('status').getByText('Group mapping recorded').waitFor();
  }else{
   const erase=phase==='erased',label=erase?'Erase enterprise identity data':'Disconnect enterprise sign-in';
   await panel.locator('summary',{hasText:label}).click();
   const form=panel.getByRole('button',{name:label,exact:true}).locator('..');
   await form.getByLabel('Reason recorded in audit',{exact:true}).fill('Owner recovery and cleanup');
   if(erase)await form.locator('input[name="confirm"]').fill('ERASE ENTERPRISE');
   const response=page.waitForResponse(r=>r.url().endsWith(erase?'/enterprise/erase':'/enterprise/disconnect')&&r.request().method()==='POST');
   await form.getByRole('button',{name:label,exact:true}).click();assert.equal((await response).status(),200);await page.getByRole('status').getByText(erase?'Enterprise identity data erased; managed staff access revoked':'Enterprise sign-in disconnected',{exact:true}).waitFor();
   await panel.getByText('Server credentials are configured. Enterprise sign-in is not active.',{exact:true}).waitFor();
  }
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Enterprise settings fit the viewport');
   const unlabeled=await page.locator('button').evaluateAll(buttons=>buttons.filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')).length);assert.equal(unlabeled,0);
   if(process.env.BLOTTER_ENTERPRISE_EVIDENCE){await mkdir(process.env.BLOTTER_ENTERPRISE_EVIDENCE,{recursive:true});await panel.screenshot({path:`${process.env.BLOTTER_ENTERPRISE_EVIDENCE}/enterprise-${phase}-${width}.png`});}
  }
  const signedOut=await browser.newContext({ignoreHTTPSErrors:true});const signin=await signedOut.newPage();await signin.goto(h.origin+'/signin');if(phase==='mapped')await signin.getByRole('button',{name:'Continue with Firm Microsoft Entra'}).waitFor();else assert.equal(await signin.getByRole('button',{name:'Continue with Firm Microsoft Entra'}).count(),0);
  for(const width of [1440,390]){await signin.setViewportSize({width,height:900});assert.equal(await signin.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.BLOTTER_ENTERPRISE_EVIDENCE)await signin.screenshot({path:`${process.env.BLOTTER_ENTERPRISE_EVIDENCE}/enterprise-signin-${phase}-${width}.png`});}
  await signedOut.close();await context.close();
 }finally{await browser.close();}
}
