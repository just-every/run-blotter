import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {noticeText} from './ai-fixture.mjs';
import {replyFixture,sha256} from './ai-reply-fixture.mjs';

export async function aiJourney(h,s) {
 const evidence=process.env.BLOTTER_AI_EVIDENCE;
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 try {
  const f=await replyFixture(h,s);
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
   await settings.getByLabel('Document review confidence threshold',{exact:true}).fill('0.95');await settings.getByLabel('Document review confidence threshold',{exact:true}).blur();
   await settings.getByLabel('Maximum requests under this approval',{exact:true}).fill('4');await settings.getByLabel('Maximum requests under this approval',{exact:true}).blur();
   await settings.getByRole('checkbox').check();await page.getByRole('status').filter({hasText:'Saved'}).first().waitFor();
   assert.equal(h.aiCalls.length,before);await capture('ai-settings-enabled',settings);
   await page.goto(h.origin+`/app?job=${s.j.id}`);
   const ai=page.locator('details').filter({has:page.locator(':scope > summary').getByText('AI assistance',{exact:true})});
   await ai.locator(':scope > summary').click();await ai.getByLabel('Source',{exact:true}).waitFor();
   await ai.getByLabel('Source',{exact:true}).selectOption('portal:'+s.j.id);assert.equal(h.aiCalls.length,before);
   const confirmation=ai.getByRole('checkbox',{name:/I confirm that masked text/});await confirmation.check();await ai.getByRole('button',{name:'Process selected source',exact:true}).click();
   const review=ai.getByRole('region',{name:'AI proposals'});await review.getByRole('heading',{name:'Unsaved proposals'}).waitFor();
   await review.getByLabel('Reply draft',{exact:true}).fill('Reviewed by the principal; please confirm the discrepancy.');await capture('ai-summary-unsaved',review);
   await review.getByRole('button',{name:'Save draft',exact:true}).click();await review.getByRole('heading',{name:'Saved draft',exact:true}).waitFor();
   const reply=review.getByRole('group',{name:'Review reply recipients and attachments',exact:true});
   await reply.getByRole('checkbox',{name:new RegExp(f.primary.name)}).check();
   await reply.getByRole('checkbox',{name:new RegExp(f.second.name)}).check();
   await reply.getByRole('checkbox',{name:new RegExp('synthetic-blotter-attachment.txt')}).check();
   assert.equal(await reply.getByRole('button',{name:'Accept reply draft',exact:true}).isEnabled(),false);
   await reply.getByRole('checkbox',{name:/I reviewed this exact wording/}).focus();await page.keyboard.press('Space');
   await reply.getByRole('button',{name:'Accept reply draft',exact:true}).click();await reply.getByText('Accepted',{exact:true}).waitFor();
   assert.ok((await reply.innerText()).includes(sha256('Reviewed by the principal; please confirm the discrepancy.')));
   const recorded=(await h.db.prepare('SELECT * FROM b_ai_reply_reviews ORDER BY rowid DESC LIMIT 1').first());
   assert.deepEqual(JSON.parse(recorded.recipients).map(c=>c.id).sort(),[f.primary.id,f.second.id].sort());
   assert.deepEqual(JSON.parse(recorded.attachments).map(a=>a.id),[f.file.id]);
   await capture('ai-summary-saved',review);
   await confirmation.check();await ai.getByRole('button',{name:'Process selected source',exact:true}).click();await review.getByRole('heading',{name:'Unsaved proposals'}).waitFor();
   await review.getByRole('button',{name:'Save draft',exact:true}).click();await review.getByRole('heading',{name:'Saved draft',exact:true}).waitFor();
   const rejectedReply=review.getByRole('group',{name:'Review reply recipients and attachments',exact:true});
   await rejectedReply.getByRole('button',{name:'Reject reply draft',exact:true}).click();await rejectedReply.getByText('Rejected',{exact:true}).waitFor();await capture('ai-reply-rejected',review);
   await ai.getByLabel('Preparation',{exact:true}).selectOption('document');await ai.getByLabel('Source',{exact:true}).selectOption('document:'+s.file.id);await confirmation.check();
   await ai.getByRole('button',{name:'Process selected source',exact:true}).click();await review.getByRole('heading',{name:'Unsaved proposals'}).waitFor();assert.ok((await review.innerText()).includes('Below threshold: needs manual review.'));await capture('ai-document-proposals',review);
   await review.getByRole('button',{name:'Save draft',exact:true}).click();await review.getByRole('heading',{name:'Saved draft',exact:true}).waitFor();
   await review.getByRole('button',{name:'Accept document validation',exact:true}).locator('..').getByRole('button',{name:'Reject',exact:true}).click();
   await review.getByLabel('Proposed filename for a copy',{exact:true}).fill('Reviewed-notice-'+width+'.txt');await review.getByRole('button',{name:'Accept proposed filename for a copy',exact:true}).click();
   await review.getByLabel('Destination request on this job',{exact:true}).selectOption(s.d.requests[0].id);await review.getByRole('button',{name:'Accept routing and create copy',exact:true}).click();await capture('ai-document-copy',review);
   const copied=page.getByRole('link',{name:'Reviewed-notice-'+width+'.txt',exact:true}).first();await copied.waitFor();
   const copyHref=await copied.getAttribute('href');assert.ok(copyHref);
   const downloaded=await page.request.get(new URL(copyHref,h.origin).href);assert.equal(downloaded.status(),200);assert.equal(await downloaded.text(),noticeText);
   await page.locator(`a[href="/api/blotter/documents/${s.file.id}/file"]`).first().waitFor();await capture('ai-original-and-copy',copied.locator('xpath=ancestor::section[1]'));
   await ai.getByLabel('Preparation',{exact:true}).selectOption('notice');await ai.getByLabel('Source',{exact:true}).selectOption('document:'+s.file.id);await confirmation.check();
   await ai.getByRole('button',{name:'Process selected source',exact:true}).click();await review.getByRole('heading',{name:'Unsaved proposals'}).waitFor();
   assert.ok(await review.getByText('Proposed — verify against the notice',{exact:true}).count()>=2);assert.ok((await review.innerText()).includes('No recorded authorization is on file'));await capture('ai-notice-proposals',review);
   await review.getByRole('button',{name:'Save draft',exact:true}).click();await review.getByRole('heading',{name:'Saved draft',exact:true}).waitFor();
   const firstQuestion=review.locator('p').filter({hasText:'Why does the notice differ from your records?'}).locator('..');
   await firstQuestion.getByRole('button',{name:'Accept client question',exact:true}).click();await firstQuestion.getByText('Accepted',{exact:true}).waitFor();
   const secondQuestion=review.locator('p').filter({hasText:'Can you provide the income statements?'}).locator('..');
   await secondQuestion.getByRole('button',{name:'Reject',exact:true}).click();await secondQuestion.getByText('Rejected',{exact:true}).waitFor();await capture('ai-notice-reviewed',review);
   const search=page.getByRole('button',{name:'Search',exact:true});await search.focus();await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();await capture('ai-search-tooltip',page.locator('body'));
   await search.blur();await page.mouse.move(1,999);await search.hover();await page.waitForTimeout(150);assert.equal(await page.getByRole('tooltip').count(),0);await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
   await page.mouse.move(1,999);const account=page.locator('summary[aria-label]').first();await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor();await capture('ai-account-tooltip',page.locator('body'));await account.blur();
   await page.goto(portal.portalUrl);await page.getByText('Firm disclosure',{exact:true}).click();await page.getByText(/Firm staff may use an AI provider/).waitFor();await capture('ai-portal-disclosure');
   await page.goto(h.origin+'/client');await page.getByText('Firm disclosure',{exact:true}).click();await page.getByText(/Firm staff may use an AI provider/).waitFor();await capture('ai-account-disclosure');
   await page.goto(h.origin+'/client?lang=es');await page.getByText('Información de la firma',{exact:true}).click();await page.getByText(/El personal de la firma puede utilizar/).waitFor();await capture('ai-account-disclosure-spanish');
   assert.equal(h.aiCalls.length,before+4,'The original three preparations and one additional rejected reply are the only provider requests');await context.close();
  }
 } finally {await browser.close();}
}
