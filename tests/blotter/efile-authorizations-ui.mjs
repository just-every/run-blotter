import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Runs in the native HTTP journey on push Verify. Assertions use desktop width;
// both release widths are captured from the same changed screens.
export async function efileJourney(h, s) {
  const browser=await chromium.launch({headless:true,...(process.env.BLOTTER_CHROMIUM?{executablePath:process.env.BLOTTER_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
  try {
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
    await context.addCookies(h.owner.split('; ').map(cookie=>{const at=cookie.indexOf('=');return {name:cookie.slice(0,at),value:cookie.slice(at+1),url:h.origin};}));
    const page=await context.newPage();page.setDefaultTimeout(20000);
    await page.goto(h.origin+'/app');
    if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
    await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();
    const row=page.locator('table tbody tr').filter({has:page.getByText(s.client.name,{exact:true})}).filter({hasText:'2024'});
    await row.getByRole('button',{name:'Open',exact:true}).click();
    const panel=page.getByRole('region',{name:'Unsigned e-file authorization',exact:true});
    await panel.getByText('Review unsigned 8879 intake',{exact:true}).click();
    await panel.getByLabel('Final unsigned original',{exact:true}).selectOption(s.job.file.id);
    await panel.getByLabel('First required spouse',{exact:true}).selectOption(s.client.contacts[0].id);
    await panel.getByLabel('Second required spouse',{exact:true}).selectOption(s.client.contacts[1].id);
    await panel.getByLabel('I reviewed this exact final PDF as unsigned Form 8879',{exact:true}).check();
    await panel.getByLabel('I reviewed both contacts as the required spouses for this client and tax year',{exact:true}).check();
    const capture=async name=>{
      const dir=process.env.BLOTTER_EFILE_EVIDENCE;if(dir)await mkdir(dir,{recursive:true});
      for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();if(width===1440)assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(dir)await panel.screenshot({path:`${dir}/${name}-${width}.png`});}
      await page.setViewportSize({width:1440,height:1000});
    };
    await capture('review-unsigned-intake');
    await panel.getByRole('button',{name:'Record unsigned Form 8879',exact:true}).click();
    const link=panel.getByRole('link',{name:'Download unsigned original',exact:true});await link.waitFor();
    for(const contact of s.client.contacts)await panel.getByText(contact.name,{exact:true}).waitFor();
    assert.match(await panel.innerText(),/Signature: unavailable\. KBA: unavailable/);
    assert.match(await panel.innerText(),/Tax-software provenance and signer identity are not verified/);
    const downloaded=await context.request.get(h.origin+await link.getAttribute('href'));
    assert.equal(downloaded.status(),200);assert.deepEqual(await downloaded.body(),s.bytes);
    const move=page.getByLabel(`Move ${s.job.title}`,{exact:true});
    const response=page.waitForResponse(r=>r.url().endsWith(`/jobs/${s.job.id}/status`)&&r.request().method()==='POST');
    await move.selectOption('in_progress|'+s.protectedStatus.id);assert.equal((await response).status(),409);
    await capture('unsigned-intake-blocked');
    const search=page.getByRole('button',{name:'Search',exact:true});await search.focus();await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
    await search.blur();await page.mouse.move(1,999);await search.hover();await page.waitForTimeout(150);assert.equal(await page.getByRole('tooltip').count(),0);await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
    await context.close();
  } finally {await browser.close();}
}
