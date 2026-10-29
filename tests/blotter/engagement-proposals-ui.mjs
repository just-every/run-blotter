import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

/** Always runs with the proposal's HTTP journey in push Verify. Screens are optional local artifacts. */
export async function engagementJourney(h,f,done,invitations) {
 const browser=await chromium.launch({headless:true,...(process.env.BLOTTER_CHROMIUM?{executablePath:process.env.BLOTTER_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(value=>{const at=value.indexOf('=');return {name:value.slice(0,at),value:value.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL('**/app');}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Clients & templates',exact:true}).click();
  const entry=page.locator('ul.list > li').filter({has:page.getByText(f.client.name,{exact:true})}).first();await entry.getByText('Client details and contacts',{exact:true}).click();await entry.getByText('Engagement proposals',{exact:true}).click();
  const panel=entry.getByRole('region',{name:'Engagement proposals',exact:true});await panel.getByRole('button',{name:done.title,exact:true}).click();
  const current=panel.getByRole('article',{name:'Proposal version'});await current.getByRole('link',{name:'Completion certificate',exact:true}).waitFor();assert.ok((await current.innerText()).includes(done.proposal.terms.scope));assert.equal(await current.getByRole('link',{name:'Signed letter',exact:true}).getAttribute('href'),`/api/blotter/signatures/${done.id}/files/signed`);
  const capture=async(target,name)=>{const dir=process.env.BLOTTER_ENGAGE_EVIDENCE;if(!dir)return;await mkdir(dir,{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await target.screenshot({path:`${dir}/${name}-${width}.png`});}await page.setViewportSize({width:1440,height:1000});};
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await capture(panel,'proposal-completed');
  await current.getByText('Version history',{exact:true}).click();await current.getByRole('button',{name:'Open version 1',exact:true}).click();await current.getByText('This version cannot accept signatures.',{exact:false}).waitFor();assert.ok((await current.innerText()).includes(f.client.contacts[0].name+' · signed'));assert.equal(await current.getByRole('button',{name:'Send proposal for signatures',exact:true}).count(),0);
  await panel.getByText('Prepare a proposal',{exact:true}).click();const form=panel.locator('form').filter({has:page.getByRole('button',{name:'Freeze proposal version',exact:true})});
  await form.getByLabel('Proposal work',{exact:true}).selectOption(f.job.id);
  const values={...f.terms,title:'Quarterly services agreement'};
  for(const [label,key] of [['Proposal title','title'],['Scope','scope'],['Exclusions','exclusions'],['Retainer terms','retainerTerms'],['Renewal rules','renewalRules'],['Amendment rules','amendmentRules'],['Fee in USD cents','feeCents']])await form.getByLabel(label,{exact:true}).fill(String(values[key]));
  for(let n=1;n<=2;n++)await form.getByLabel(`Authorized signer ${n}`,{exact:true}).selectOption(f.client.contacts[n-1].id);
  await form.getByRole('button',{name:'Freeze proposal version',exact:true}).click();await current.getByRole('heading',{name:'Quarterly services agreement - version 1',exact:true}).waitFor();const unsent=(await h.json(`/clients/${f.client.id}/engagement-proposals`,undefined,h.owner)).find(r=>r.title==='Quarterly services agreement - version 1');
  await current.getByRole('button',{name:'Amend this version',exact:true}).click();const amendment=panel.locator('form').filter({has:page.getByRole('button',{name:'Freeze replacement version',exact:true})});
  await amendment.getByLabel('Scope',{exact:true}).fill('Quarterly bookkeeping reports only.');await capture(panel,'proposal-amendment');await amendment.getByRole('button',{name:'Freeze replacement version',exact:true}).click();await current.getByRole('heading',{name:'Quarterly services agreement - version 2',exact:true}).waitFor();assert.ok((await current.innerText()).includes('Quarterly bookkeeping reports only.'));const bearer=new URL(invitations[1].portalUrl).pathname.split('/').at(-1);await h.json(`/portal/${bearer}/signatures/${unsent.id}`,undefined,'',404);assert.equal((await h.request(`/api/blotter/portal/${bearer}/signatures/${unsent.id}/files/original`)).status,404);
  const signerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),signer=await signerContext.newPage();await signer.goto(invitations[1].portalUrl);
  const client=signer.locator('section.panel').filter({has:signer.getByRole('heading',{name:'Your signature requests',exact:true})});assert.equal(await client.getByRole('button',{name:'Quarterly services agreement - version 1',exact:true}).count(),0);await client.getByRole('button',{name:done.title,exact:true}).click();await client.getByRole('link',{name:'Download certificate',exact:true}).waitFor();
  const certificate=await signerContext.request.get(new URL(await client.getByRole('link',{name:'Download certificate',exact:true}).getAttribute('href'),h.origin).href);assert.equal(certificate.status(),200);assert.equal(createHash('sha256').update(await certificate.body()).digest('hex'),done.certificate_sha256);
  const dir=process.env.BLOTTER_ENGAGE_EVIDENCE;if(dir)for(const width of [1440,390]){await signer.setViewportSize({width,height:1000});await client.screenshot({path:`${dir}/proposal-signer-completed-${width}.png`});}
  await signerContext.close();await context.close();
 }finally{await browser.close();}
}
