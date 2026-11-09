import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { http, cookies } from './http.mjs';
import { activityFixtures, catalogueFixtures } from './owner.mjs';

// One native sanity journey, invoked by Verify under both complete policies.
export async function agentActivityJourney({request,origin,cookie,email,phase,outputs,mail}) {
 const api=http(request,origin,cookie), fixture=activityFixtures.get(origin);
 assert.ok(fixture,'The real signed owner supplies native session fixtures');
 const job=outputs.context.jobs.find(item=>item.status==='open');
 assert.ok(job,'Use populated native work, not a fabricated audit record');
 const padding=await api('/api/blotter/keys',{label:`synthetic-blotter-1: ${phase} context reader`});
 const hostile=`<img src=x onerror="globalThis.activityInjected=1"> ${phase}`;
 const target=await api('/api/blotter/keys',{label:hostile});
 const call=async(key,name,args={})=>{
  const response=await request(origin+'/mcp',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':name,traceparent:'synthetic-blotter-1-'+ 'long-recorded-trace-'.repeat(24)},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}})});
  assert.equal(response.status,200,'Real native MCP call reaches the shared audit');
  const body=await response.json();assert.equal(body.error,undefined);return body.result;
 };
 // Raw windows contain 200 rows. Place a new distinguishable agent beyond a
 // complete window of other real MCP reads, without touching the database.
 for(let i=0;i<201;i++){
  const result=await call(padding.key,'blotter.context.read');
  assert.ok(result.structuredContent.jobs.length,'Padding is actual admitted work context');
 }
 await call(target.key,'blotter.context.read');
 const sensitive=await call(target.key,'blotter.readiness.read',{jobId:job.id});
 const targetId='blotter-key:'+target.id,paddingId='blotter-key:'+padding.id;
 const first=await api('/agents/api/audit?after=0&agent='+encodeURIComponent(targetId));
 assert.deepEqual(first.rows,[],'A real filtered raw window has no matches');
 assert.ok(Number(first.cursor)>0,'The empty filtered window advances');
 const allRows=async(filter={})=>{
  const result=[],pages=[];let after='0';
  for(;;){
   const query=new URLSearchParams({...filter,after}),page=await api('/agents/api/audit?'+query);
   pages.push(page);result.push(...page.rows);
   if(page.cursor===null||BigInt(page.cursor)===BigInt(after))return {rows:result,pages};
   assert.ok(BigInt(page.cursor)>BigInt(after));after=page.cursor;
  }
 };
 const targetInitial=await allRows({agent:targetId});
 assert.ok(targetInitial.rows.some(row=>row.classes.some(item=>item.class==='standard')));
 assert.ok(targetInitial.rows.some(row=>row.classes.some(item=>item.class==='sensitive')));
 if(phase==='held')assert.ok(sensitive._meta['com.runeditrun/approval'].id,'Sensitive real activity is pending approval');
 else assert.ok(sensitive.structuredContent.documents.length,'Autonomous sensitive read returns actual evidence context');

 // Revocation is setup, before the read-only screen snapshot. Historical
 // attribution must remain even though the next MCP call loses authority.
 await api('/agents/api/agents/'+encodeURIComponent(targetId)+'/revoke',{});
 await api('/api/blotter/keys/'+target.id+'/revoke',{});
 const revoked=await request(origin+'/mcp',{method:'POST',headers:{Authorization:`Bearer ${target.key}`,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
 assert.equal(revoked.status,401);await revoked.body?.cancel();
 assert.equal((await api('/agents/api/agents')).agents.find(agent=>agent.id===targetId).revoked,true);

 // A second genuine owner session can be lost during export without ending
 // the conformance driver's own signed session. Nothing is transplanted.
 const login=await request(origin+'/auth/magic-link',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email})});
 assert.equal(login.status,202);await login.body?.cancel();
 const messages=mail.read({limit:20});
 const token=messages.at(-1).text.match(/\/auth\/confirm\?token=([^\s"&<]+)/)?.[1];
 assert.ok(token,'The disposable owner mailbox receives its real login proof');
 const confirmed=await request(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token})});
 assert.equal(confirmed.status,303);const fresh=cookies(confirmed);await confirmed.body?.cancel();
 const freshApi=http(request,origin,fresh);
 await freshApi('/api/blotter/mfa/verify',{recoveryCode:fixture.recoveryCodes.shift()});
 const setup=await request(origin+'/setup',{method:'POST',redirect:'manual',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 assert.equal(setup.status,303);await setup.body?.cancel();
 const snapshot=async()=>({state:await api('/api/blotter/state'),team:await api('/api/blotter/team'),policy:await api('/agents/api/state'),access:await api('/api/blotter/access'),rules:await api('/api/blotter/agent-rules'),costs:await api('/api/blotter/costs'),holds:await api('/api/blotter/retention/holds'),mail:mail.read({limit:20})});
 const before=await snapshot();
 const browser=await chromium.launch({headless:true,...(process.env.BLOTTER_CHROMIUM?{executablePath:process.env.BLOTTER_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 const traffic=[],pageErrors=[],downloads=[];let interrupt=false,exportPages=0;
 const setSession=async(context,value)=>{
  await context.clearCookies();
  if(value)await context.addCookies(value.split('; ').map(part=>({name:part.slice(0,part.indexOf('=')),value:part.slice(part.indexOf('=')+1),url:origin})));
 };
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await setSession(context,fresh);
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==origin){await route.abort();return;}
   traffic.push({path:url.pathname,query:url.search,method:req.method()});
   if(interrupt&&url.pathname==='/agents/api/audit'&&++exportPages===2){
    const lost=await request(origin+'/auth/signout',{method:'POST',headers:{Cookie:fresh,Origin:origin,'Content-Type':'application/json'},body:'{}'});
    assert.equal(lost.status,204);await lost.body?.cancel();
   }
   const response=await request(req.url(),{method:req.method(),headers:await req.allHeaders(),...(req.postDataBuffer()?{body:req.postDataBuffer()}:{})});
   const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length'];
   await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage();page.on('pageerror',()=>pageErrors.push('Activity browser error'));page.on('download',item=>downloads.push(item));
  await page.goto(origin+'/app');
  await page.getByRole('button',{name:'Team & safety',exact:true}).click();
  const link=page.getByRole('link',{name:'Inspect shared agent activity'});await link.focus();await page.keyboard.press('Enter');
  await page.waitForURL(origin+'/agent-activity');
  const ready=()=>page.getByRole('button',{name:'Download matching JSON',exact:true}).waitFor({state:'visible'}).then(()=>page.waitForFunction(()=>!document.querySelector('.activity-filters button:last-child').disabled));
  await ready();traffic.length=0;
  const rendered=async expected=>{
   await ready();
   const actual=await page.locator('[data-audit-fields]').allTextContents();
   assert.deepEqual(actual.map(value=>JSON.parse(value)),expected,'Every rendered audit field and row equals the authorized API');
   assert.deepEqual(await page.locator('[data-audit-id]').evaluateAll(els=>els.map(el=>el.dataset.auditId)),expected.map(row=>row.id),'Rendered membership is exact and ordered');
  };
  const select=async(agent,cls)=>{
   if(await page.getByLabel('Agent',{exact:true}).inputValue()!==agent){await page.getByLabel('Agent',{exact:true}).selectOption(agent);await ready();}
   if(await page.getByLabel('Class',{exact:true}).inputValue()!==cls){await page.getByLabel('Class',{exact:true}).selectOption(cls);await ready();}
  };
  const download=async expected=>{
   const completed=page.waitForEvent('download');await page.getByRole('button',{name:'Download matching JSON',exact:true}).click();
   const file=await completed;assert.equal(file.suggestedFilename(),'agent-activity.json');
   const data=await readFile(await file.path(),'utf8');
   assert.deepEqual(JSON.parse(data),expected,'Downloaded JSON preserves every authorized field and exact matching membership');
   for(const secret of [...catalogueFixtures.get(origin).secrets,padding.key,target.key,fresh,token])assert.ok(!data.includes(secret),'The export excludes session and agent credentials');
   for(const row of JSON.parse(data))for(const field of ['evidence','saved','result','aliases','replay_aliases'])assert.equal(Object.hasOwn(row,field),false,'No private capture or replay alias is exported');
   await file.delete();await ready();
  };
  await rendered((await allRows()).rows);
  for(const [agent,cls] of [[targetId,''],['','sensitive'],[paddingId,'standard'],[targetId,'sensitive']]){
   await select(agent,cls);
   const expected=(await allRows({...agent?{agent}:{},...cls?{class:cls}:{}})).rows;
   assert.ok(expected.length>0,'Compare populated filters, not an empty happy path');
   await rendered(expected);await download(expected);
  }
  assert.ok(traffic.filter(item=>item.path==='/agents/api/audit'&&item.query.includes(encodeURIComponent(targetId))).length>=3,'The native browser crosses empty filtered raw windows');

  // Attribution is looked up by the authorized API, not frozen by the page.
  // Mark a real review while the already-loaded screen has older attribution.
  if(phase==='held'){
   const review=(await allRows({agent:paddingId})).rows.find(row=>row.review)?.review;
   assert.ok(review);
   await api('/agents/api/reviews/'+review.id+'/reviewed',{});
   const current=(await allRows({agent:paddingId,class:'standard'})).rows;
   assert.ok(current.some(row=>row.review?.by),'The public review door supplies current person attribution');
   await select(paddingId,'standard');await download(current);await rendered(current);
   assert.ok((await allRows({agent:targetId})).rows.some(row=>row.approval),'Pending real calls retain approval identifiers after agent revocation');
   const approved=(await allRows()).rows.find(row=>row.approval?.by.length);
   assert.ok(approved,'Earlier held native steps completed real signed-person approvals');
   await select('','');await download((await allRows()).rows);
  }
  await select(targetId,'standard');
  const expected=(await allRows({agent:targetId,class:'standard'})).rows;
  await rendered(expected);
  assert.equal(await page.getByRole('heading',{name:expected[0].label,exact:true}).innerText(),expected[0].label,'Hostile labels are literal text and retain historical names');
  assert.equal(await page.evaluate(()=>globalThis.activityInjected),undefined,'Hostile labels never execute');
  assert.ok((await page.getByLabel('Agent',{exact:true}).textContent()).includes(hostile+' for Synthetic Base 1 (revoked)'));
  const summary=page.locator('[data-audit-id]').first().locator('summary');
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await summary.locator('..').getAttribute('open'),'','Keyboard expands complete audit fields');
  await page.keyboard.press('Tab');assert.equal(await page.locator('[data-audit-fields]').first().evaluate(el=>el===document.activeElement),true,'Keyboard reaches long audit details');
  assert.ok((await page.locator('[data-audit-fields]').first().textContent()).length>1000,'Inspect a populated long row');
  await page.getByLabel('Class',{exact:true}).focus();await page.keyboard.press('Home');await page.keyboard.press('Enter');await ready();
  await page.getByLabel('Class',{exact:true}).focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await ready();
  assert.equal(await page.getByLabel('Class',{exact:true}).inputValue(),'standard','Keyboard selects the class filter');
  await rendered(expected);
  const directory=process.env.BLOTTER_AGENT_ACTIVITY_EVIDENCE;
  if(directory)await mkdir(directory,{recursive:true});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
   const serious=await page.evaluate(async()=> (await axe.run(document.querySelector('main'))).violations.filter(item=>['serious','critical'].includes(item.impact)).map(item=>({id:item.id,impact:item.impact})));
   assert.deepEqual(serious,[],'No serious or critical accessibility findings on the activity screen');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Long labels and audit fields fit the viewport');
   assert.ok(await page.locator('[data-audit-fields]').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=13));
   assert.equal(await page.locator('button:not(:disabled)').evaluateAll(els=>els.some(el=>!el.textContent.trim())),false,'All new controls have visible text');
   if(directory&&phase==='autonomous')await page.screenshot({path:`${directory}/agent-activity-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  await select(targetId,'money');await rendered([]);
  await page.getByText('No matching actions. Try another agent or class.',{exact:true}).waitFor();await download([]);
  if(directory&&phase==='autonomous')for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${directory}/agent-activity-empty-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});
  assert.deepEqual(await page.evaluate(async()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),databases:typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(item=>item.name):[]})),{local:[],session:[],databases:[]},'No audit cache is persisted by the view');
  assert.deepEqual(pageErrors,[]);
  assert.ok(traffic.every(item=>item.method==='GET'&&(!item.path.startsWith('/api/')&&!item.path.startsWith('/agents/api/')&&item.path!=='/mcp'||['/agents/api/agents','/agents/api/audit'].includes(item.path))),'Activity controls consume only the existing signed-person reads');
  assert.deepEqual(await snapshot(),before,'View and export leave preparations, policy, grants, costs, provider mail, work and custody hold records unchanged');

  // Real session loss between raw pages must not produce a partial JSON file.
  await select('','');const count=downloads.length;interrupt=true;
  await page.getByRole('button',{name:'Download matching JSON',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'No file was downloaded.'}).waitFor();interrupt=false;
  assert.ok(exportPages>=2,'The export attempted an authorized continuation');
  assert.equal(downloads.length,count,'Authority loss never downloads incomplete data');
  assert.equal(await page.locator('[data-audit-id]').count(),0,'Authority loss clears rendered private rows');

  const refused=async(headers,status)=>{
   for(const path of ['/agents/api/agents','/agents/api/audit?after=200']){
    const response=await request(origin+path,{headers});assert.equal(response.status,status,'Every person read rechecks current admission');await response.body?.cancel();
   }
  };
  await refused({},401);await refused({Cookie:fresh},401);
  await refused({Authorization:'Bearer '+padding.key,Cookie:cookie},403);
  await refused({Cookie:fixture.reviewer.cookie},403);
  for(const [session,authorization] of [['',''],[cookie,'Bearer '+padding.key],[fixture.reviewer.cookie,'']]){
   await setSession(context,session);await context.setExtraHTTPHeaders(authorization?{Authorization:authorization}:{});
   await page.reload();await page.getByRole('alert').waitFor();
   assert.equal(await page.locator('[data-audit-id]').count(),0);
   assert.equal(await page.getByRole('button',{name:'Download matching JSON',exact:true}).isDisabled(),true,'Denied callers cannot export');
  }
  if(phase==='held'){
   await api('/api/blotter/team',{email:fixture.reviewer.email,name:'Riley Reviewer',role:'reviewer',active:false});
   await refused({Cookie:fixture.reviewer.cookie},401);
   await page.reload();await page.getByRole('alert').waitFor();assert.equal(await page.locator('[data-audit-id]').count(),0);
   await api('/api/blotter/team',{email:fixture.reviewer.email,name:'Riley Reviewer',role:'reviewer',active:true});
  }
  await context.close();
 }finally{await browser.close();}
 // Neither exporting nor refused access can clear the native custody fence.
 const signedJob=outputs.context.jobs.find(item=>item.status==='signed_off');
 const detail=await api('/api/blotter/jobs/'+signedJob.id),file=detail.requests[0].files[0];
 const held=await request(origin+`/api/blotter/files/${file.id}/erase`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({confirm:file.name,reason:'Activity reads preserve retained-agent custody'})});
 assert.equal(held.status,409);await held.body?.cancel();
 assert.equal((await api('/api/blotter/jobs/'+signedJob.id)).requests[0].files[0].sha256,file.sha256);
 await api('/api/blotter/keys/'+padding.id+'/revoke',{});
 console.log(`Agent activity: ${phase}; exact rendered and exported fields, raw empty-window traversal, revoked labels, denied and interrupted sessions, keyboard and axe at 1440 and 390`);
}
