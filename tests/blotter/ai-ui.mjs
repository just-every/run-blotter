import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {noticeText} from './ai-fixture.mjs';

export async function aiJourney(h,s) {
 const evidence=process.env.BLOTTER_AI_EVIDENCE;
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try {
  await h.json(`/jobs/${s.j.id}/portal/messages`,{body:noticeText},s.prep);
  await h.json(`/requests/${s.d.requests[0].id}/decide`,{decision:'return',note:'Please provide the requested-period original.'},s.prep);
  const portal=await h.json(`/jobs/${s.j.id}/reminders`,{message:'Synthetic fixture access to the client portal'},s.prep);
  for(const width of [1440,390]) {
   await s.enable(false);
   const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
   await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
   const page=await context.newPage();await page.goto(h.origin+'/app');
   if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();}
   const capture=async(name,element=page.locator('main'))=>{
    await element.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name);
    if(evidence){await mkdir(evidence,{recursive:true});await element.screenshot({path:`${evidence}/${name}-${width}.png`});}
   };
   const before=h.aiCalls.length;
   await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Team & safety',exact:true}).click();
   const settings=page.locator('section').filter({has:page.getByRole('heading',{name:'AI assistance',exact:true})});
   await settings.getByText('Enable source review assistance',{exact:true}).click();
   assert.equal(await settings.getByRole('checkbox').isChecked(),false);await capture('ai-settings-off',settings);
   const ref=settings.getByLabel('Recorded attestation reference',{exact:true});
   await ref.fill('synthetic-blotter-5: fictional provider no-training and no-retention attestation');await ref.blur();
   await settings.getByRole('checkbox').check();await page.getByRole('status').filter({hasText:'Saved'}).first().waitFor();
   assert.equal(h.aiCalls.length,before);await capture('ai-settings-enabled',settings);
   await page.goto(h.origin+`/app?job=${s.j.id}`);
   const ai=page.locator('details').filter({has:page.locator(':scope > summary').getByText('AI assistance',{exact:true})});
   await ai.locator(':scope > summary').click();await ai.getByLabel('Source',{exact:true}).waitFor();
   await ai.getByLabel('Source',{exact:true}).selectOption('portal:'+s.j.id);assert.equal(h.aiCalls.length,before);
   const confirmation=ai.getByRole('checkbox');await confirmation.check();await ai.getByRole('button',{name:'Process selected source',exact:true}).click();
   const review=ai.getByRole('region',{name:'AI proposals'});await review.getByRole('heading',{name:'Unsaved proposals'}).waitFor();
   await review.getByLabel('Reply draft',{exact:true}).fill('Reviewed by the principal; please confirm the discrepancy.');await capture('ai-summary-unsaved',review);
   await review.getByRole('button',{name:'Save draft',exact:true}).click();await review.getByRole('heading',{name:'Saved draft',exact:true}).waitFor();
   await review.getByRole('button',{name:'Accept reply draft',exact:true}).click();await capture('ai-summary-saved',review);
   await ai.getByLabel('Preparation',{exact:true}).selectOption('document');await ai.getByLabel('Source',{exact:true}).selectOption('document:'+s.file.id);await confirmation.check();
   await ai.getByRole('button',{name:'Process selected source',exact:true}).click();await review.getByRole('heading',{name:'Unsaved proposals'}).waitFor();await capture('ai-document-proposals',review);
   await review.getByRole('button',{name:'Save draft',exact:true}).click();await review.getByRole('heading',{name:'Saved draft',exact:true}).waitFor();
   await review.getByRole('button',{name:'Accept document validation',exact:true}).locator('..').getByRole('button',{name:'Reject',exact:true}).click();
   await review.getByLabel('Proposed filename for a copy',{exact:true}).fill('Reviewed-notice-'+width+'.txt');await review.getByRole('button',{name:'Accept proposed filename for a copy',exact:true}).click();
   await review.getByLabel('Destination request on this job',{exact:true}).selectOption(s.d.requests[0].id);await review.getByRole('button',{name:'Accept routing and create copy',exact:true}).click();await capture('ai-document-copy',review);
   const copied=page.getByRole('link',{name:'Reviewed-notice-'+width+'.txt',exact:true});await copied.waitFor();
   const copyHref=await copied.getAttribute('href');assert.ok(copyHref);
   const downloaded=await page.request.get(new URL(copyHref,h.origin).href);assert.equal(downloaded.status(),200);assert.equal(await downloaded.text(),noticeText);
   await page.locator(`a[href="/api/blotter/files/${s.file.id}"]`).waitFor();await capture('ai-original-and-copy',copied.locator('xpath=ancestor::section[1]'));
   await ai.getByLabel('Preparation',{exact:true}).selectOption('notice');await ai.getByLabel('Source',{exact:true}).selectOption('document:'+s.file.id);await confirmation.check();
   await ai.getByRole('button',{name:'Process selected source',exact:true}).click();await review.getByRole('heading',{name:'Unsaved proposals'}).waitFor();
   assert.ok(await review.getByText('Proposed — verify against the notice',{exact:true}).count()>=2);assert.ok((await review.innerText()).includes('No recorded authorization is on file'));await capture('ai-notice-proposals',review);
   await review.getByRole('button',{name:'Save draft',exact:true}).click();await review.getByRole('heading',{name:'Saved draft',exact:true}).waitFor();
   await review.getByRole('button',{name:'Accept client question',exact:true}).first().click();
   await review.getByRole('button',{name:'Accept client question',exact:true}).locator('..').getByRole('button',{name:'Reject',exact:true}).click();await capture('ai-notice-reviewed',review);
   const search=page.getByRole('button',{name:'Search',exact:true});await search.focus();await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();await capture('ai-search-tooltip',page.locator('body'));
   await search.blur();await page.mouse.move(1,999);await search.hover();await page.waitForTimeout(150);assert.equal(await page.getByRole('tooltip').count(),0);await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
   await page.mouse.move(1,999);const account=page.locator('summary[aria-label]').first();await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor();await capture('ai-account-tooltip',page.locator('body'));await account.blur();
   await page.goto(portal.portalUrl);await page.getByText('Firm disclosure',{exact:true}).click();await page.getByText(/Firm staff may use an AI provider/).waitFor();await capture('ai-portal-disclosure');
   await page.goto(h.origin+'/client');await page.getByText('Firm disclosure',{exact:true}).click();await page.getByText(/Firm staff may use an AI provider/).waitFor();await capture('ai-account-disclosure');
   await page.goto(h.origin+'/client?lang=es');await page.getByText('Información de la firma',{exact:true}).click();await page.getByText(/El personal de la firma puede utilizar/).waitFor();await capture('ai-account-disclosure-spanish');
   assert.equal(h.aiCalls.length,before+3);await context.close();
  }
 } finally {await browser.close();}
}
