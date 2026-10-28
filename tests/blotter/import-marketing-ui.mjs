// MSG-002 / IMPORT-001 / IMPORT-002: use the native Move in screen with the real HTTP Worker.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export async function importMarketingJourney(h, csv) {
  const browser = await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
  try {
    const context = await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
    await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
    const page = await context.newPage(), evidence = process.env.BLOTTER_IMPORT_EVIDENCE;
    if (evidence) await mkdir(evidence,{recursive:true});
    await page.goto(h.origin+'/app');
    if(new URL(page.url()).pathname==='/setup') { await page.getByRole('checkbox').check(); await page.getByRole('button',{name:'Finish setup'}).click(); }
    await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Move in',exact:true}).click();
    await page.getByLabel('CSV contents',{exact:true}).fill(csv);
    await page.getByText('Map CSV columns',{exact:true}).waitFor();
    const selectField = field => page.getByRole('combobox',{name:field,exact:true});
    const marketingFields=['marketing_opt_in','marketing_status','marketing_captured_at','marketing_wording','marketing_wording_version','marketing_language','marketing_evidence'];
    for (const field of marketingFields) { const select=selectField(field); await select.waitFor();assert.equal(await select.inputValue(),'');await select.selectOption(field); }
    await page.getByRole('button',{name:'Preview (dry run)',exact:true}).click();
    const review=page.getByRole('region',{name:'Imported marketing consent'});
    await review.getByRole('heading',{name:'Imported marketing consent'}).waitFor();
    assert.match(await review.innerText(),/consent-ui-grant@example.test/);assert.match(await review.innerText(),/Explicit opt-in/);assert.match(await review.innerText(),/Not granted/);assert.match(await review.innerText(),/Signed newsletter consent record 27/);
    const commit=page.getByRole('button',{name:'Import these clients',exact:true});assert.equal(await commit.isDisabled(),true);
    const attestation=review.getByRole('checkbox');assert.equal(await attestation.isChecked(),false);
    const capture=async(name,locator)=>{
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:1000});await locator.scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} fits ${width}`);
        if(evidence)await locator.screenshot({path:`${evidence}/${name}-${width}.png`});
      }
    };
    await capture('import-consent-preview',review);
    await attestation.check();assert.equal(await commit.isDisabled(),false);
    // Mapping edits invalidate both the exact preview and its unchecked-by-default attestation.
    await selectField('marketing_language').selectOption('');assert.equal(await commit.count(),0,'A mapping edit removes the committable preview');
    await selectField('marketing_language').selectOption('marketing_language');
    await page.getByRole('button',{name:'Preview (dry run)',exact:true}).click();await review.getByRole('heading').waitFor();assert.equal(await attestation.isChecked(),false);
    await attestation.check();await commit.click();
    await page.getByRole('status').filter({hasText:'Import committed.'}).waitFor();
    await page.getByRole('button',{name:'View journal',exact:true}).click();
    const journal=page.locator('details').filter({has:page.getByText('Journal and undo report',{exact:true})});
    await journal.getByText('completed',{exact:false}).waitFor();await capture('import-consent-journal',journal);
    const state=await h.json('/state',undefined,h.owner),client=state.clients.find(c=>c.name==='Consent client ui-grant');assert.ok(client);
    const log=await h.json(`/marketing-consents?clientId=${client.id}`,undefined,h.owner);assert.equal(log.events.length,1);assert.equal(log.events[0].source,'import');assert.equal(log.contacts[0].marketing,true);
  } finally { await browser.close(); }
}
