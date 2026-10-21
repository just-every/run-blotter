import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function permissionsJourney(h,clientName,readerCookie,recoveryCode){
 const evidence=process.env.BLOTTER_PERMISSION_EVIDENCE;await mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const cookies=cookie=>cookie.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};});
 try{
  for(const [name,cookie] of [['principal',h.owner],['read-only',readerCookie]]){
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});await context.addCookies(cookies(cookie));const page=await context.newPage();
   await page.goto(h.origin+'/app');if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
   if(name==='principal'){
    await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Team & safety',exact:true}).click();
    const panel=page.getByRole('region',{name:'Client and document permissions'});await panel.getByRole('heading',{name:'Teams',exact:true}).waitFor();
    await panel.getByLabel('Or one unused recovery code').fill(recoveryCode);
    await panel.getByRole('button',{name:'Confirm sensitive access',exact:true}).click();
    await page.getByRole('status').getByText('Sensitive access confirmed for five minutes').waitFor();
    await panel.locator('summary',{hasText:"Add or replace a team's grants"}).click();
    await panel.getByLabel('Team to change').selectOption({label:'Tax team'});
    await panel.getByLabel('Team clients (select all grants)').selectOption({label:clientName});
    await panel.getByRole('button',{name:'Save access team',exact:true}).click();
    await page.getByRole('status').getByText('Team grants saved').waitFor();
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await panel.screenshot({path:`${evidence}/permissions-${width}.png`});}
   }else{
    await page.getByText('Read-only access.',{exact:false}).waitFor();await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();await page.getByText(clientName,{exact:false}).first().waitFor();
    assert.equal(await page.getByRole('alert').count(),0,'Read-only work opens without requests for forbidden global data');
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${evidence}/read-only-${width}.png`,fullPage:true});}
   }
   await context.close();
  }
 }finally{await browser.close();}
}
