import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function serviceAgentsJourney(h,s,key,job,width){
 const evidence=process.env.BLOTTER_SERVICE_EVIDENCE;
 const browser=await chromium.launch({headless:true,...(process.env.BLOTTER_CHROMIUM?{executablePath:process.env.BLOTTER_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}});
  await context.addCookies(h.owner.split('; ').map(c=>{const at=c.indexOf('=');return{name:c.slice(0,at),value:c.slice(at+1),url:h.origin};}));
  const page=await context.newPage();await page.goto(h.origin+'/app');if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();}
  const navigation=page.getByRole('navigation',{name:'Workspace'});
  const sponsor=(await h.json('/state',undefined,h.owner)).actor,auth={authorization:'Bearer '+key.key};
  const native=await h.json('/agent/prepare-reminder',{jobId:job.id},'',200,auth),mailBefore=h.mails.length;
  assert.equal(h.mails.length,mailBefore);
  await h.json(`/proposals/${native.id}/decide`,{decision:'approve'},h.owner);assert.equal(h.mails.length,mailBefore+1);

  const capture=async(panel,name)=>{for(const size of [width]){await page.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(evidence){await mkdir(evidence,{recursive:true});await panel.screenshot({path:`${evidence}/${name}-${width}.png`,mask:[page.getByRole('textbox',{name:'Agent key',exact:true})]});}}};
  await navigation.getByRole('button',{name:'Team & safety',exact:true}).click();
  const keys=page.locator('section').filter({has:page.getByRole('heading',{name:'Agent keys',exact:true})});
  await keys.getByRole('button',{name:'Create agent key',exact:true}).click();
  const created=keys.getByRole('textbox',{name:'Agent key',exact:true});await created.waitFor();
  const shown=await created.inputValue();assert.ok(shown.length>20);await capture(keys,'key-created');
  await navigation.getByRole('button',{name:'Preparations',exact:true}).click();
  await navigation.getByRole('button',{name:'Team & safety',exact:true}).click();
  await keys.getByRole('button',{name:'Create agent key',exact:true}).waitFor();assert.equal(await keys.getByRole('textbox',{name:'Agent key',exact:true}).count(),0);assert.ok(!(await page.content()).includes(shown));await capture(keys,'key-not-redisplayed');
  await page.reload();await navigation.getByRole('button',{name:'Team & safety',exact:true}).click();await keys.getByRole('button',{name:'Create agent key',exact:true}).waitFor();assert.ok(!(await page.content()).includes(shown));
  await navigation.getByRole('button',{name:'Preparations',exact:true}).click();
  const costs=page.getByRole('region',{name:'Service costs'}),agents=page.getByRole('region',{name:'Scheduled agents'});
  await costs.getByText('Estimate seasonal usage',{exact:true}).click();
  await costs.getByRole('button',{name:'Estimate costs',exact:true}).click();await costs.getByRole('heading',{name:'Seasonal estimate'}).waitFor();
  assert.match(await costs.innerText(),/Incomplete: supply all prices/);
  await capture(costs,'costs');await costs.getByText('Estimate seasonal usage',{exact:true}).click();
  await agents.getByText('Enable a supervised agent',{exact:true}).click();
  await agents.getByLabel('Agent name',{exact:true}).fill('Browser file agent');await agents.getByLabel('Supervisor’s agent key').selectOption(key.id);await agents.getByLabel('One client',{exact:true}).selectOption(s.client.id);
  await agents.getByRole('button',{name:'Approve agent grant',exact:true}).click();await agents.getByText('Browser file agent',{exact:true}).waitFor();
  assert.equal((await h.json('/agent-rules',undefined,h.owner)).rules.length,1);
  await capture(agents,'agents');
  await costs.getByText('Approve a budget or increase',{exact:true}).click();await costs.getByLabel('Lifetime budget (USD cents)',{exact:true}).fill('0');await costs.getByLabel('Per-action threshold (USD cents)',{exact:true}).fill('0');await costs.getByLabel('Budget approval reason',{exact:true}).fill('Hold optional plans until reviewed');await costs.getByRole('button',{name:'Approve budget',exact:true}).click();
  const detail=await s.detail(job.id);await h.json(`/requests/${detail.requests[0].id}/files`,{name:'synthetic-blotter-6.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-6').toString('base64')},s.prep);
  await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();await costs.getByText('Blocked',{exact:true}).waitFor();await agents.getByText('Blocked',{exact:true}).waitFor();
  await capture(costs,'budget-blocked');await capture(agents,'plan-blocked');
  await costs.getByLabel('Lifetime budget (USD cents)',{exact:true}).fill('100');await costs.getByLabel('Per-action threshold (USD cents)',{exact:true}).fill('25');await costs.getByLabel('Budget approval reason',{exact:true}).fill('Approve one bounded native plan');await costs.getByRole('button',{name:'Approve budget',exact:true}).click();
  await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();await costs.getByText('Reserved',{exact:true}).waitFor();await agents.getByText('Pending',{exact:true}).waitFor();
  await costs.getByLabel('Confirmed USD cents',{exact:true}).fill('0');await costs.getByLabel('Provider receipt or native cost evidence',{exact:true}).fill('Native plan: no provider charge');await costs.getByRole('button',{name:'Reconcile cost',exact:true}).click();await costs.getByText('Confirmed',{exact:true}).waitFor();
  const nativeRun=(await h.json('/agent-rules',undefined,h.owner)).runs[0];
  for(const value of [nativeRun.event_key,nativeRun.proposal_id,'Plan awaits human decision; no external effect','estimated USD 0.25'])assert.ok((await agents.innerText()).replace(/\s/g,' ').includes(value),value);
  for(const value of ['Estimated USD 0.25','Confirmed USD 0.00','Native plan: no provider charge','Reserved so far: USD 0.25'])assert.ok((await costs.innerText()).replace(/\s/g,' ').includes(value),value);
  await capture(costs,'cost-reconciled');await capture(agents,'plan-prepared');
  await agents.getByRole('button',{name:'Revoke agent',exact:true}).click();
  await agents.getByText('Revoked',{exact:true}).waitFor();assert.equal((await h.json('/agent-rules',undefined,h.owner)).rules[0].status,'revoked');
  await agents.getByLabel('Agent name',{exact:true}).fill('External metadata agent');await agents.getByLabel('Planner',{exact:true}).selectOption('external');
  await agents.getByLabel('Agent provider',{exact:true}).fill('synthetic-blotter-200');await agents.getByLabel('Model or runtime',{exact:true}).fill('Owner runtime');await agents.getByLabel('Provider data use and training',{exact:true}).fill('No training under owner contract');await agents.getByLabel('Provider retention and account owner',{exact:true}).fill('Owner account; zero retention');
  await capture(agents,'external-grant');await agents.getByRole('button',{name:'Approve agent grant',exact:true}).click();await agents.getByText('External metadata agent',{exact:true}).waitFor();
  const policy=agents.locator('article').filter({hasText:'External metadata agent'});
  const assertPolicy=async panel=>{const text=await panel.innerText();for(const value of ['synthetic-blotter-200','Owner runtime','No training under owner contract','Owner account; zero retention','not provider verification'])assert.ok(text.includes(value),value);};
  for(const size of [width]){await page.setViewportSize({width,height:1000});await assertPolicy(policy);}
  assert.ok(!(await agents.innerText()).includes(key.key));await capture(agents,'external-policy');
  await h.json(`/requests/${detail.requests[0].id}/files`,{name:'synthetic-blotter-203.txt',mime:'text/plain',contentBase64:Buffer.from('synthetic-blotter-203').toString('base64')},s.prep);
  await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();
  const headers={authorization:'Bearer '+key.key},queued=await h.json('/agent/plans',undefined,'',200,headers);assert.equal(queued.plans.length,1);
  const drafted=await h.json('/agent/plans/'+queued.plans[0].id,{message:'Please upload the year-end statement; the amount is still unconfirmed.'},'',200,headers);
  await agents.getByRole('button',{name:'Evaluate agent events',exact:true}).click();
  const preview=page.locator('article').filter({hasText:'Please upload the year-end statement; the amount is still unconfirmed.'});await preview.getByRole('button',{name:'Approve',exact:true}).waitFor();assert.match(await preview.innerText(),/Source event: file:/);
  for(const size of [width]){await page.setViewportSize({width,height:1000});await assertPolicy(preview);}
  assert.ok((await preview.innerText()).includes(`Source event: ${queued.plans[0].source}`));assert.ok((await preview.innerText()).includes('Please upload the year-end statement; the amount is still unconfirmed.'));
  const externalRun=(await h.json('/agent-rules',undefined,h.owner)).runs.find(r=>r.proposal_id===drafted.id);for(const value of [drafted.id,externalRun.event_key,'External agent preparation awaits human decision; no effect','estimated USD 0.25'])assert.ok((await agents.innerText()).replace(/\s/g,' ').includes(value),value);
  await capture(preview,'external-draft-review');
  const before=h.mails.length;await preview.getByText('Decline',{exact:true}).first().click();await preview.getByLabel('Reason',{exact:true}).fill('Do not send this wording');await preview.getByRole('button',{name:'Decline',exact:true}).click();await preview.getByText('Declined',{exact:true}).waitFor();assert.equal(h.mails.length,before);assert.equal((await h.json('/agent-rules',undefined,h.owner)).runs.find(r=>r.proposal_id===drafted.id).decision,'declined');
  assert.ok((await preview.innerText()).includes('Do not send this wording'));await capture(preview,'external-declined');
  // A named schedule uses its own name, even when it shares a differently named key.
  const scheduled=await h.json('/agent-rules',{name:'Browser scheduled planner',keyId:key.id,clientId:s.client.id,trigger:'schedule',startsAt:'2188-01-01T00:00:00Z',everyHours:24,tool:'reminder',budget:1},h.owner);
  const beforeSchedule=h.mails.length;await h.scheduled('2188-01-01T00:00:00Z');await h.scheduled('2188-01-01T00:00:00Z');
  const scheduleState=await h.json('/agent-rules',undefined,h.owner),scheduleRuns=scheduleState.runs.filter(run=>run.rule_id===scheduled.id);
  assert.equal(scheduleRuns.length,1);assert.equal(scheduleState.rules.find(rule=>rule.id===scheduled.id).used,1);assert.equal(h.mails.length,beforeSchedule);
  const activityBefore=(await h.json('/team',undefined,h.owner)).audit;
  const nativeAct=activityBefore.find(row=>row.action==='proposal.prepared'&&row.object_id===native.id),scheduleAct=activityBefore.find(row=>row.action==='agent.plan_prepared'&&row.object_id===scheduleRuns[0].id);
  assert.equal(nativeAct.actor,`Browser agent for ${sponsor.name} <${sponsor.email}>`);assert.equal(JSON.parse(nativeAct.detail).keyId,key.id);
  assert.equal(scheduleAct.actor,`Browser scheduled planner for ${sponsor.name} <${sponsor.email}>`);
  assert.equal(JSON.parse(scheduleAct.detail).ruleId,scheduled.id);assert.equal(JSON.parse(scheduleAct.detail).keyId,key.id);assert.equal(JSON.parse(scheduleAct.detail).proposalId,scheduleRuns[0].proposal_id);
  const humanAct=activityBefore.find(row=>row.action==='reminder.sent'&&row.object_id===job.id);assert.equal(humanAct.actor,sponsor.email);
  await h.json(`/keys/${key.id}/revoke`,{},h.owner);await h.json('/agent/prepare-reminder',{jobId:job.id},'',401,auth);
  const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
  const portable=archive.trim().split('\n').map(line=>JSON.parse(line)).flatMap(part=>part.items??[]).filter(item=>item.table==='b_audit').map(item=>item.row);
  for(const row of [nativeAct,scheduleAct,humanAct])assert.deepEqual(portable.find(copy=>copy.id===row.id),row);
  assert.ok(!archive.includes(key.key));assert.equal(h.mails.length,beforeSchedule);
  await navigation.getByRole('button',{name:'Team & safety',exact:true}).click();
  const activity=page.locator('section').filter({has:page.getByRole('heading',{name:'Audit log',exact:true})});
  for(const row of [nativeAct,scheduleAct,humanAct]){
   const entry=activity.getByRole('listitem').filter({hasText:row.detail}).filter({hasText:row.action});await entry.waitFor();
   assert.ok((await entry.innerText()).includes(row.actor));
  }
  await capture(activity,'native-agent-activity');
  console.log(`PROBE BASE-AGENT-008 6: Team activity at ${width} and backup -> exact key and named schedule attribution, distinct human approval, stable identifiers after revocation`);
  // Every icon-only control visible on this screen, at both release widths.
  for(const size of [width]){
   await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));
   const search=page.getByRole('button',{name:'Search',exact:true});await search.focus();await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
   await search.blur();await page.mouse.move(1,999);await search.hover();await page.waitForTimeout(150);assert.equal(await page.getByRole('tooltip').count(),0);await page.getByRole('tooltip',{name:'Search workspace',exact:true}).waitFor();
   if(evidence)await page.screenshot({path:`${evidence}/tooltip-search-${width}.png`});
   await page.mouse.move(1,999);const account=page.locator('summary[aria-label]').first();await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor();
   if(evidence)await page.screenshot({path:`${evidence}/tooltip-account-${width}.png`});await account.blur();
  }
  await context.close();
 }finally{await browser.close();}
}
