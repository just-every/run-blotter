// AUTOMATE-001: the real built app, with network/provider edges supplied by the HTTP harness.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

export async function automationAppJourney(h,s,interrupt) {
 const job=await s.start();
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const evidence=process.env.BLOTTER_AUTOMATION_EVIDENCE;
 try {
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return {name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();
  await page.goto(h.origin+'/app');
  if(new URL(page.url()).pathname==='/setup') {await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();}
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Preparations',exact:true}).click();
  await page.getByRole('heading',{name:'Automation',exact:true}).waitFor();
  const panel=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Automation',exact:true})});
  await panel.getByText('New automation rule',{exact:true}).click();
  await panel.getByLabel('Rule name',{exact:true}).fill('Review completed 1040 work');
  await panel.getByRole('checkbox',{name:'Cedar Lane LLC',exact:true}).check();
  await panel.getByLabel('Lifetime attempt budget',{exact:true}).fill('5');
  await panel.getByRole('button',{name:'Preview rule',exact:true}).click();
  await panel.getByRole('heading',{name:'Review Review completed 1040 work',exact:true}).waitFor();
  assert.match(await panel.innerText(),/Cedar Lane LLC/);
  assert.equal((await s.state()).rules.length,0,'Preview has no live rule/effect');
  const shot=async name=>{if(evidence)await mkdir(evidence,{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});if(evidence)await page.screenshot({path:`${evidence}/${name}-${width}.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No page-level overflow');}await page.setViewportSize({width:1440,height:1000});};
  await shot('preview');
  await panel.getByRole('button',{name:'Save draft',exact:true}).click();
  let rule=panel.locator('article.record').filter({has:page.getByText('Review completed 1040 work',{exact:true})});
  await rule.getByRole('button',{name:'Approve and activate rule',exact:true}).click();
  await rule.getByRole('button',{name:'Pause rule',exact:true}).waitFor();
  assert.equal((await s.state()).rules[0].status,'active');
  // Prepare the real source evidence, then complete the task using the job screen.
  const req=(await s.detail(job.id)).requests[0];
  await h.json(`/requests/${req.id}/files`,{name:'W2.txt',mime:'text/plain',contentBase64:Buffer.from('W2 for Alex Rivera').toString('base64')},s.prep);
  await h.json(`/requests/${req.id}/decide`,{decision:'accept'},s.prep);
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();
  await page.getByRole('button',{name:/^Open/}).first().click();
  await page.getByRole('checkbox',{name:/Prepare return/}).check();
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Preparations',exact:true}).click();
  await panel.getByRole('button',{name:'Evaluate active rules now',exact:true}).click();
  await panel.getByText('Native effect committed',{exact:false}).waitFor();
  assert.equal((await s.detail(job.id)).job.status,'review');
  await rule.getByRole('button',{name:'Pause rule',exact:true}).click();
  await rule.getByRole('button',{name:'Approve and resume rule',exact:true}).waitFor();
  const reviewed=await s.detail(job.id);await h.json(`/jobs/${job.id}/review`,{revision:reviewed.job.revision,decision:'return',note:'Await the signed authorization'},s.reviewer);
  // Enable the exact Waiting-document example entirely through the app.
  const details=panel.locator('details').filter({has:page.getByText('New automation rule',{exact:true})});
  if(!await details.evaluate(e=>e.open))await panel.getByText('New automation rule',{exact:true}).click();
  await panel.getByLabel('Rule name',{exact:true}).fill('Request documents on Waiting');
  await panel.getByRole('checkbox',{name:'Cedar Lane LLC',exact:true}).check();
  await panel.getByLabel('When',{exact:true}).selectOption('status');
  await panel.getByLabel('Trigger stage',{exact:true}).selectOption('waiting');
  await panel.getByLabel('Trigger sub-status (optional)',{exact:true}).selectOption(s.docs.id);
  await panel.getByLabel('Then',{exact:true}).selectOption('reminder');
  await panel.getByLabel('Message template',{exact:true}).selectOption(s.message.id);
  await panel.getByRole('button',{name:'Preview rule',exact:true}).click();
  await panel.getByRole('heading',{name:'Review Request documents on Waiting',exact:true}).waitFor();
  // There must be an outstanding request for this template's reminder.
  // Add it through a native approved rule, then re-preview so the exact recipient/rendering is visible.
  await s.rule({kind:'due',at:'2026-01-01T00:00:00Z'},{kind:'request',label:'Signed authorization'});await s.run();
  await panel.getByRole('button',{name:'Preview rule',exact:true}).click();
  await panel.getByText('To: alex@example.test',{exact:true}).waitFor();
  await shot('message-preview');
  await panel.getByRole('button',{name:'Save draft',exact:true}).click();
  rule=panel.locator('article.record').filter({has:page.getByText('Request documents on Waiting',{exact:true})});
  await rule.getByRole('button',{name:'Approve and activate rule',exact:true}).click();
  await rule.getByRole('button',{name:'Pause rule',exact:true}).waitFor();
  // A board card uses the same native status transition, rather than a synthetic event.
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();await page.getByRole('button',{name:'Show board',exact:true}).click();
  const move=page.getByRole('combobox',{name:'Move Cedar Lane LLC 1040 preparation',exact:true});
  const signed=await s.rule({kind:'status',stage:'waiting',subStatusId:s.sub.id},{kind:'request',label:'Signed 8879 from board'});
  await move.selectOption('waiting|'+s.sub.id);
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Preparations',exact:true}).click();
  await panel.getByRole('button',{name:'Evaluate active rules now',exact:true}).click();
  await panel.getByRole('button',{name:'Evaluate active rules now',exact:true}).click();
  assert.equal((await s.detail(job.id)).requests.filter(r=>r.label==='Signed 8879 from board').length,1,'1040 board entry fires its 8879 rule exactly once');
  assert.equal((await s.state()).attempts.filter(a=>a.rule_id===signed.id).length,1);
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Jobs',exact:true}).click();await page.getByRole('button',{name:'Show board',exact:true}).click();
  await move.selectOption('waiting|'+s.docs.id);
  interrupt();
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Preparations',exact:true}).click();
  await panel.getByRole('button',{name:'Evaluate active rules now',exact:true}).click();
  await panel.getByText('Reconcile uncertain delivery',{exact:true}).waitFor();
  const sent=h.mails.length;await panel.getByRole('button',{name:'Evaluate active rules now',exact:true}).click();assert.equal(h.mails.length,sent);
  assert.ok((await s.state()).attempts.some(a=>a.status==='held'));
  await panel.getByText('Reconcile uncertain delivery',{exact:true}).click();
  await shot('outcomes-held');
  await panel.getByLabel('Verified provider outcome',{exact:true}).selectOption('accepted');
  await panel.getByLabel('Evidence and reason',{exact:true}).fill('Provider dashboard confirms this exact attempt was accepted');
  await panel.getByRole('button',{name:'Record reconciliation',exact:true}).click();
  await panel.getByText('Human reconciliation: accepted; Provider dashboard confirms this exact attempt was accepted',{exact:false}).waitFor();
  await shot('outcomes-reconciled');
  assert.equal(h.mails.length,sent);
  const dependency=await s.rule({kind:'due',at:'2030-01-01T00:00:00Z'},{kind:'assign',role:'manager',email:'reviewer@example.test'});
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Team & safety',exact:true}).click();
  await page.getByText('Offboard a person',{exact:true}).click();
  await page.getByLabel('Departing person',{exact:true}).selectOption('reviewer@example.test');
  await page.getByLabel('Successor for their work (jobs they prepare, tasks, notices, discussions, template tasks)',{exact:true}).selectOption('other@example.test');
  await page.getByLabel('Successor for their reviews (jobs they review or manage, pending proposals, unsent message batches)',{exact:true}).selectOption('owner@example.test');
  await page.getByRole('button',{name:'Preview transfer',exact:true}).click();
  await page.getByText('Its approval is not transferred',{exact:false}).waitFor();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.getByText('Offboard a person',{exact:true}).scrollIntoViewIfNeeded();if(evidence)await page.screenshot({path:`${evidence}/offboarding-${width}.png`});if(evidence)await page.getByRole('heading',{name:'Transfer from reviewer@example.test',exact:true}).locator('..').screenshot({path:`${evidence}/offboarding-plan-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.getByRole('button',{name:'Transfer and deactivate',exact:true}).click();
  await h.scheduled('2030-01-01T00:00:00Z');
  assert.ok((await s.state()).attempts.some(a=>a.rule_id===dependency.id&&a.status==='failed'&&/authority changed/.test(a.outcome)));
  await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'Preparations',exact:true}).click();
  await panel.getByText('Assignee authority changed',{exact:false}).waitFor();
  await shot('offboarding-refused');
  await context.close();
 } finally {await browser.close();}
}
