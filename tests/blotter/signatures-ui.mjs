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
  await panel.getByRole('img',{name:'PDF page 1',exact:true}).waitFor({state:'visible'});
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

/** Inspect the three inherited staff screens while the pending requester is active. */
export async function signatureOwnerJourney(h,f,pending,transfer){
 const evidence=process.env.BLOTTER_SIGNATURE_EVIDENCE;if(!evidence)return;
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  const nav=name=>page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name,exact:true}).click();
  const capture=async(target,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await target.screenshot({path:`${evidence}/${name}-${width}.png`});}await page.setViewportSize({width:1440,height:1000});};
  await nav('Clients & templates');
  const clients=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Clients',exact:true})}),record=clients.locator('ul.list > li').filter({hasText:f.client.name}).first();
  await record.getByText('Client details and contacts',{exact:true}).click();await record.getByText('Client document folders',{exact:true}).click();
  const signatures=record.locator('section.panel').filter({has:page.getByRole('heading',{name:'Document signatures',exact:true})});
  await signatures.getByRole('button',{name:'October management representation',exact:true}).click();await signatures.getByRole('link',{name:'Completion certificate',exact:true}).waitFor();await capture(signatures,'client-signed-folder');
  await nav('Preparations');
  const automation=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Automation',exact:true})});
  await automation.getByText('New automation rule',{exact:true}).click();await automation.getByLabel('Rule name',{exact:true}).fill('Review completed representation');
  await automation.getByRole('checkbox',{name:f.client.name,exact:true}).check();await automation.getByLabel('When',{exact:true}).selectOption('signature_complete');
  await automation.getByLabel('Then',{exact:true}).selectOption('request');await automation.getByLabel('Document request',{exact:true}).fill('Review signed management representation');
  await automation.getByRole('button',{name:'Preview rule',exact:true}).click();await automation.getByRole('heading',{name:'Review Review completed representation',exact:true}).waitFor();await capture(automation,'signature-automation-preview');
  await nav('Team & safety');await page.getByText('Offboard a person',{exact:true}).click();
  await page.getByLabel('Departing person',{exact:true}).selectOption(transfer.email);await page.getByLabel('Successor for their work (jobs they prepare, tasks, notices, discussions, template tasks)',{exact:true}).selectOption(transfer.workSuccessor);
  await page.getByLabel('Successor for their reviews (jobs they review or manage, pending proposals, unsent message batches)',{exact:true}).selectOption(transfer.reviewSuccessor);
  await page.getByRole('button',{name:'Preview transfer',exact:true}).click();
  const offboarding=page.locator('details').filter({has:page.getByText('Offboard a person',{exact:true})});await offboarding.getByText(`Pending signature “${pending.title}”`,{exact:false}).waitFor();await capture(offboarding,'signature-offboarding-preview');
  await context.close();
 }finally{await browser.close()}
}

/** Form 2848 screens: the client waits for the attestation, staff record it, the client signs, the representative signs in session. */
export async function signatureAuthorityJourney(h,f,poa){
 const evidence=process.env.BLOTTER_SIGNATURE_EVIDENCE;if(!evidence)return;
 const d=await h.json(`/jobs/${f.job.id}/signatures`,{...poa,title:'Browser power of attorney'},f.prep),sent=await h.json(`/signatures/${d.id}/send`,{revision:d.revision},f.prep);
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const cookies=cookie=>cookie.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};});
 try{
  const capture=async(page,target,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${width} overflows`);await target.screenshot({path:`${evidence}/${name}-${width}.png`});}await page.setViewportSize({width:1440,height:1000});};
  const signerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),signer=await signerContext.newPage();
  const clientPanel=signer.locator('section.panel').filter({has:signer.getByRole('heading',{name:'Your signature requests',exact:true})});
  await signer.goto(sent.invitations[0].portalUrl);await clientPanel.getByRole('button',{name:'Browser power of attorney',exact:true}).click();
  await clientPanel.getByText('Before you can sign this IRS authorization form',{exact:false}).waitFor();await capture(signer,clientPanel,'signer-2848-awaiting-attestation');
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});await context.addCookies(cookies(f.prep));
  const staff=await context.newPage();await staff.goto(h.origin+'/app?job='+f.job.id);
  const panel=staff.locator('section.panel').filter({has:staff.getByRole('heading',{name:'Document signatures',exact:true})});await panel.waitFor();
  await panel.getByRole('button',{name:'Browser power of attorney',exact:true}).click();
  const form=panel.locator('form').filter({hasText:'Items checked against a secondary document'});
  await form.getByLabel('Verified by',{exact:true}).fill('Pat Harper');await form.getByLabel('Verification date',{exact:true}).fill('2026-10-21');
  for(const item of ['Name','SSN or ITIN','Address','Date of birth'])await form.getByLabel(item,{exact:true}).check();
  await form.getByLabel('Secondary document checked',{exact:true}).fill('Utility bill matching name and address');await capture(staff,panel,'staff-2848-attestation');
  await form.getByRole('button',{name:`Record remote authentication for ${f.client.contacts[0].name}`,exact:true}).click();
  await staff.getByRole('status').getByText('Remote-authentication attestation recorded').waitFor();await panel.getByText('Remote authentication attested',{exact:false}).waitFor();
  await signer.reload();await clientPanel.getByRole('button',{name:'Browser power of attorney',exact:true}).click();
  for(const [label,value] of [['signature 1 (page 1)',f.client.contacts[0].name],['initials 1 (page 1)','MC'],['date 1 (page 1)','2026-10-22'],['text 1 (page 1)','Reviewed']])await clientPanel.getByLabel(label,{exact:true}).fill(value);
  await clientPanel.getByLabel('I consent to electronic records and signatures for this document.',{exact:true}).check();await clientPanel.getByLabel('I am authorized for this client and intend to sign this document.',{exact:true}).check();
  await clientPanel.getByRole('button',{name:'Consent and sign document',exact:true}).click();await signer.getByText('Signature recorded.',{exact:false}).first().waitFor();
  await staff.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();
  const mine=staff.getByRole('region',{name:'Documents for you to sign',exact:true});await mine.getByRole('button',{name:'Browser power of attorney',exact:true}).click();
  await mine.getByLabel('Representative signature (page 1)',{exact:true}).fill('Pat Harper');await mine.getByLabel('Representative date (page 1)',{exact:true}).fill('2026-10-22');
  await mine.getByLabel('I consent to electronic records and signatures for this document.',{exact:true}).check();await mine.getByLabel('I am authorized and intend to sign this document.',{exact:true}).check();
  await capture(staff,mine,'staff-representative-signing');
  await mine.getByRole('button',{name:'Consent and sign as representative',exact:true}).click();await staff.getByRole('status').getByText('Signature recorded').waitFor();
  assert.equal((await h.json(`/signatures/${d.id}`,undefined,f.prep)).status,'completed');
  await staff.goto(h.origin+'/app?job='+f.job.id);await panel.getByRole('button',{name:'Browser power of attorney',exact:true}).click();await panel.getByRole('link',{name:'Completion certificate',exact:true}).waitFor();await capture(staff,panel,'staff-2848-completed');
  await signerContext.close();await context.close();
 }finally{await browser.close();}
}

/** AUTHZ-001 screen: the client's authorizations with their lifecycle and the transcript requests they scoped. */
export async function authorizationJourney(h,f){
 const evidence=process.env.BLOTTER_SIGNATURE_EVIDENCE;if(!evidence)return;
 await h.json(`/clients/${f.client.id}/authorizations`,{kind:'2848',representative:'Pat Harper',representativeEmail:'synthetic-blotter-1@example.test',cafNumber:'0300-12345R',matters:[{form:'1040',from:2026,to:2029}]},h.owner);
 await mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Clients & templates',exact:true}).click();
  const clients=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Clients',exact:true})}),record=clients.locator('ul.list > li').filter({hasText:f.client.name}).first();
  await record.getByText('Client details and contacts',{exact:true}).click();await record.locator('summary',{hasText:'Taxpayer authorizations'}).click();
  const panel=record.getByRole('region',{name:'Taxpayer authorizations',exact:true});await panel.getByText('CAF 0300-12345R',{exact:false}).waitFor();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`authorizations ${width} overflows`);await panel.screenshot({path:`${evidence}/client-authorizations-${width}.png`});}
  const draft=panel.locator('article').filter({hasText:'Form 8821'});
  await draft.getByText('Prepare IRS Form 8821',{exact:true}).click();
  for(const [label,value] of [['Taxpayer legal name',f.client.name],['Taxpayer mailing address','123 Cedar Lane\nDenver CO 80202'],['Taxpayer identification number','111-22-3333'],['Representative mailing address','456 Review Avenue\nDenver CO 80203'],['Representative telephone','303-555-0142']])await draft.getByLabel(label,{exact:true}).fill(value);
  await draft.getByLabel('Taxpayer identification type',{exact:true}).selectOption('ssn');
  await draft.getByLabel('Taxpayer signer',{exact:true}).selectOption(f.client.contacts.find(c=>c.name==='Mia Chen').id);
  await draft.getByLabel('Scope and representative review',{exact:true}).selectOption('yes');
  const capture=async(target,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${width} overflows`);await target.screenshot({path:`${evidence}/${name}-${width}.png`});}};
  await capture(draft,'prepare-irs-form');
  await draft.getByRole('button',{name:'Prepare form and signature draft',exact:true}).click();
  const download=draft.getByRole('link',{name:'Review prepared IRS PDF',exact:true});await download.waitFor();
  const response=await context.request.get(new URL(await download.getAttribute('href'),h.origin).href);assert.equal(response.status(),200);assert.equal(response.headers()['content-type'],'application/pdf');
  await capture(draft,'prepared-irs-form');
  const poa=panel.locator('article').filter({has:page.getByText('Prepare IRS Form 2848',{exact:true})});
  await poa.getByText('Prepare IRS Form 2848',{exact:true}).click();
  for(const [label,value] of [['Taxpayer legal name',f.client.name],['Taxpayer mailing address','123 Cedar Lane\nDenver CO 80202'],['Taxpayer identification number','111-22-3333'],['Representative mailing address','456 Review Avenue\nDenver CO 80203'],['Representative telephone','303-555-0142'],['Licensing jurisdiction or other authority','Colorado'],['License, bar or enrollment number','synthetic-blotter-31']])await poa.getByLabel(label,{exact:true}).fill(value);
  await poa.getByLabel('Taxpayer identification type',{exact:true}).selectOption('ssn');await poa.getByLabel('Taxpayer signer',{exact:true}).selectOption(f.client.contacts.find(c=>c.name==='Mia Chen').id);
  await poa.getByLabel('Representative designation',{exact:true}).selectOption('b');await poa.getByLabel('Scope and representative review',{exact:true}).selectOption('yes');
  await capture(poa,'prepare-2848-form');
  await poa.getByRole('button',{name:'Prepare form and signature draft',exact:true}).click();await poa.getByRole('link',{name:'Review prepared IRS PDF',exact:true}).waitFor();await capture(poa,'prepared-2848-form');
  await poa.getByRole('link',{name:'Open signature draft',exact:true}).click();
  const signatures=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Document signatures',exact:true})});
  await signatures.getByRole('button',{name:`Form 2848 - ${f.client.name}`,exact:true}).last().click();
  await signatures.getByRole('link',{name:'Original PDF',exact:true}).waitFor();await capture(signatures,'prepared-signature-draft');
  // The notice's agency-contact input carries the tax form that the recorded scope must cover.
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();
  await page.getByRole('button',{name:new RegExp('CP2000')}).first().click();
  await page.getByText('Record work',{exact:true}).click();
  const event=page.locator('form').filter({has:page.getByRole('button',{name:'Add to timeline',exact:true})});
  await event.getByLabel('What happened',{exact:true}).selectOption('agency_contact');await event.getByLabel('Tax form for agency contact',{exact:true}).fill('1040');
  await capture(event,'notice-agency-contact-scope');
  await context.close();
 }finally{await browser.close();}
}
