import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

/** Optional real-browser proof against the same built Worker and synthetic sessions. */
export async function signatureAppJourney(h,f){
 const evidence=process.env.BLOTTER_SIGNATURE_EVIDENCE;if(!evidence)return;
 await mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const cookies=cookie=>cookie.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});await context.addCookies(cookies(h.owner));
  const staff=await context.newPage();await staff.goto(h.origin+'/app?job='+f.job.id);
  if(new URL(staff.url()).pathname==='/setup'){await staff.getByRole('checkbox').check();await staff.getByRole('button',{name:'Finish setup'}).click();await staff.waitForURL('**/app');await staff.goto(h.origin+'/app?job='+f.job.id);}
  const panel=staff.locator('section.panel').filter({has:staff.getByRole('heading',{name:'Document signatures',exact:true})});await panel.waitFor();
  const capture=async(page,target,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${width} overflows`);await target.screenshot({path:`${evidence}/${name}-${width}.png`});}await page.setViewportSize({width:1440,height:1000});};
  await panel.getByText('Prepare a signature request',{exact:true}).click();
  await panel.getByLabel('PDF to sign',{exact:true}).setInputFiles({name:'October-representation.pdf',mimeType:'application/pdf',buffer:f.bytes});
  for(const c of f.client.contacts.slice(0,2))await panel.getByLabel(`${c.name} <${c.email}>`,{exact:true}).check();
  for(let i=0;i<2;i++){await panel.getByLabel('Field signer',{exact:true}).selectOption(f.client.contacts[i].id);await panel.getByLabel('Field label',{exact:true}).fill(`Signature ${i+1}`);await panel.getByLabel('Top (points)',{exact:true}).fill(String(500+i*50));await panel.getByRole('button',{name:'Place field on PDF',exact:true}).click();}
  await panel.getByLabel('Document title',{exact:true}).fill('October management representation');await capture(staff,panel,'staff-field-placement');
  await panel.getByRole('button',{name:'Save signature draft',exact:true}).click();await panel.getByRole('button',{name:'Send signature request',exact:true}).waitFor();
  const original=panel.getByRole('link',{name:'Original PDF',exact:true});const requestId=(await original.getAttribute('href')).split('/').at(-3);
  await panel.getByRole('button',{name:'Send signature request',exact:true}).click();await panel.getByText('Signer invitations issued',{exact:false}).waitFor();
  const invitation=contact=>{const mail=h.mails.toReversed().find(m=>m.to.includes(contact.email)&&m.subject==='Document signature request'&&m.text.includes('October management representation'));assert.ok(mail);return mail.text.match(/https:\/\/[^\s]+\/portal\/up_[0-9a-f]{64}/)[0];};
  const signerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),signer=await signerContext.newPage();
  const clientPanel=signer.locator('section.panel').filter({has:signer.getByRole('heading',{name:'Your signature requests',exact:true})});
  const select=async contact=>{await signer.goto(invitation(contact));await clientPanel.getByRole('button',{name:'October management representation',exact:true}).click();};
  await select(f.client.contacts[0]);await clientPanel.getByLabel('Reason for declining',{exact:true}).fill('Please confirm the authorization');await clientPanel.getByRole('button',{name:'Decline electronic signing',exact:true}).click();await clientPanel.getByText('declined',{exact:false}).first().waitFor();await capture(signer,clientPanel,'signer-decline');
  await panel.getByRole('button',{name:'October management representation',exact:true}).click();await panel.getByRole('button',{name:'Resend as a fresh signing attempt',exact:true}).click();await panel.getByText('Fresh attempt; previous signatures and decline remain in timeline',{exact:false}).waitFor();
  for(let i=0;i<2;i++){await select(f.client.contacts[i]);await clientPanel.getByLabel(`Signature ${i+1} (page 1)`,{exact:true}).fill(f.client.contacts[i].name);await clientPanel.getByLabel('I consent to electronic records and signatures for this document.',{exact:true}).check();await clientPanel.getByLabel('I am authorized for this client and intend to sign this document.',{exact:true}).check();await capture(signer,clientPanel,`signer-${i+1}-consent`);await clientPanel.getByRole('button',{name:'Consent and sign document',exact:true}).click();if(i===0)await signer.getByRole('status').filter({hasText:'Signature recorded.'}).waitFor();}
  await clientPanel.getByRole('link',{name:'Download certificate',exact:true}).waitFor();await capture(signer,clientPanel,'signer-completed-certificate');
  const response=await signerContext.request.get(new URL(await clientPanel.getByRole('link',{name:'Download certificate',exact:true}).getAttribute('href'),h.origin).href);assert.equal(response.status(),200);assert.equal(response.headers()['content-type'],'application/pdf');
  await panel.getByRole('button',{name:'October management representation',exact:true}).click();await panel.getByRole('link',{name:'Completion certificate',exact:true}).waitFor();await capture(staff,panel,'staff-completed-timeline');
  assert.equal((await h.json(`/signatures/${requestId}`,undefined,h.owner)).status,'completed');
  await signerContext.close();await context.close();
 }finally{await browser.close();}
}
