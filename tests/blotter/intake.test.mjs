// CRM-005 intake through the public, embeddable HTTP form and signed-in pipeline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID, randomBytes } from 'node:crypto';
import { harness } from './harness.mjs';
import { onboardingJourney, onboardingAccessJourney } from './onboarding-ui.mjs';
import { createServer } from 'node:http';

test('BASE-001 / CRM-005 public intake / CRM-003 history / DOC-002 custody: embed, consent, answers/uploads, spam checks, private staff read, one-client win and file erasure', async () => {
  const secret = randomBytes(32).toString('hex'), h = await harness({bindings:{SESSION_SECRET:secret}});let restored;
  try {
    const page = await h.request('/intake'), html = await page.text();
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors \*/);
    assert.doesNotMatch(html,/challenges.cloudflare.com/);
    assert.doesNotMatch((await h.request('/')).headers.get('content-security-policy') ?? '', /frame-ancestors \*/);
    const token = html.match(/name="token" value="([^"]+)"/)[1];
    const signed = age => { const v = `${Date.now()-age}.${randomUUID()}`; return `${v}.${createHmac('sha256',secret).update('intake:'+v).digest('hex')}`; };
    function form(t=token, overrides={}) {
      const f=new FormData();
      for(const [k,v] of Object.entries({token:t,name:'Luna Studio LLC',contactName:'Dana Reyes',contactEmail:'dana@luna.example',source:'Website referral',services:'Monthly bookkeeping, 1120-S return',details:'Two owners; moving from spreadsheets.',consent:'yes',...overrides}))f.set(k,v);
      f.append('uploads',new File(['Prior scope document'], 'scope.txt',{type:'text/plain'})); return f;
    }
    const send = (f, extra={}) => h.request('/intake',f,'',extra);
    {const r=await send(form()); assert.equal(r.status,400,'too fast: '+await r.text());}
    assert.equal((await send(form(signed(86_400_001)))).status,400,'expired');
    assert.equal((await send(form(signed(4000)+'x'))).status,400,'tampered');
    assert.equal((await send(form(signed(4000),{website:'spam',name:'Rejected Honeypot'}))).status,400);
    assert.equal((await send(form(signed(4000),{consent:'',name:'Rejected No Consent'}))).status,400);
    assert.equal((await send(form(signed(4000)),{origin:'https://outside.example'})).status,403);
    assert.equal((await h.json('/pipeline',undefined,h.owner)).prospects.length,0,'rejected submissions store no prospect');
    await new Promise(r=>setTimeout(r,3100));
    const accepted=await send(form()); assert.equal(accepted.status,200); assert.match(await accepted.text(),/Your inquiry has been received/);
    assert.equal((await send(form())).status,409,'replay cannot make a second prospect');
    let {prospects}=await h.json('/pipeline',undefined,h.owner), p=prospects[0];
    assert.equal(p.source,'Website referral');assert.deepEqual(p.services,['Monthly bookkeeping','1120-S return']);
    assert.equal(p.owner_email,'owner@example.test');assert.equal(p.answers.details,'Two owners; moving from spreadsheets.');assert.ok(p.answers.consentAt);
    assert.equal(p.files.length,1);assert.equal(p.files[0].name,'scope.txt');assert.equal(p.currency,'USD');
    const forecast=await h.json('/capacity/forecast',{from:'2031-01-06',weeks:1},h.owner);assert.ok(forecast.baseline.pipeline.filter(l=>l.prospectId===p.id).every(l=>l.estimatedAnnualFeeCents===null && l.minutes===null));
    const fileDoor=`/prospects/${p.id}/files/${p.files[0].id}`;
    assert.equal((await h.request('/api/blotter'+fileDoor)).status,401);
    assert.equal(await (await h.request('/api/blotter'+fileDoor,undefined,h.owner)).text(),'Prior scope document');
    const intakeAccess=await h.json(`/documents/${encodeURIComponent('intake:'+p.files[0].id)}/access`,undefined,h.owner);assert.equal(intakeAccess.visibility,'internal');assert.ok(intakeAccess.history.some(e=>e.action==='file.downloaded'));
    await h.json(`/documents/${encodeURIComponent('intake:'+p.files[0].id)}/access`,{revision:null,visibility:'contacts',contactIds:['unrelated-contact']},h.owner,400);
    for(let i=0;i<4;i++){const f=form(signed(4000),{name:'Additional '+i});f.delete('uploads');assert.equal((await send(f)).status,200);}
    assert.equal((await send(form(signed(4000),{name:'Rejected Over Limit'}))).status,429);
    assert.equal((await h.json('/pipeline',undefined,h.owner)).prospects.length,5);
    {const f=form(signed(4000),{name:'Different Connection'});f.delete('uploads');assert.equal((await send(f,{'CF-Connecting-IP':'192.0.2.2'})).status,200);}
    // A private role cannot read an intake or its attachment.
    await h.json('/team',{email:'reviewer@example.test',name:'Riley',role:'reviewer'},h.owner);
    await h.json('/team/invite',{email:'reviewer@example.test'},h.owner);
    await h.json('/team',{email:'preparer@example.test',name:'Pat',role:'preparer'},h.owner);
    await h.json('/team/invite',{email:'preparer@example.test'},h.owner);
    const prep=await h.login('preparer@example.test');await h.json(fileDoor,undefined,prep,403);
    const t=await h.json('/templates',{name:'Onboarding',recurrence:'annual',steps:'Collect records',requests:'Prior return'},h.owner);
    const win={templateId:t.id,preparerEmail:'preparer@example.test',reviewerEmail:'reviewer@example.test',periodStart:'2031-01-01',dueDate:'2031-02-01',dueNote:'Agreed onboarding'};
    const first=await h.json(`/prospects/${p.id}/win`,win,h.owner), again=await h.json(`/prospects/${p.id}/win`,win,h.owner);
    assert.equal(again.clientId,first.clientId);assert.equal(again.jobId,first.jobId);assert.equal(again.repeated,true);
    const converted=(await h.json('/pipeline',undefined,h.owner)).prospects.find(x=>x.id===p.id);
    assert.equal(converted.files[0].id,p.files[0].id,'intake document remains attached after conversion');
    const job = await h.json('/jobs/'+first.jobId,undefined,h.owner);
    assert.deepEqual(job.warnings, [], 'An onboarding job for a new client has no inherited credit hold');
    assert.equal((await h.json(`/documents/${encodeURIComponent('intake:'+p.files[0].id)}/access`,undefined,h.owner)).file.id,converted.files[0].job_file_id);
    const history=await h.json(`/clients/${first.clientId}/history?kind=documents`,undefined,h.owner);assert.ok(history.history.some(e=>e.action==='file.filed_from_intake' && e.job_id===first.jobId && e.actor==='owner@example.test'));
    assert.ok(job.requests.some(r=>r.files.some(f=>f.id===converted.files[0].job_file_id)), 'upload is filed on client onboarding work');
    const backup=await (await h.request('/api/blotter/backup',undefined,h.owner)).text();
    assert.doesNotMatch(backup,/Rejected Honeypot|Rejected No Consent|Rejected Over Limit|192\.0\.2\./);
    await h.json(`/files/${p.files[0].id}/erase`,{confirm:'scope.txt',reason:'Inquiry attachment no longer needed'},h.owner);
    assert.equal((await h.request('/api/blotter'+fileDoor,undefined,h.owner)).status,404);
    const archive=await (await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.doesNotMatch(archive, /UHJpb3Igc2NvcGUgZG9jdW1lbnQ=/);
    restored=await harness();
    await restored.json('/restore',{confirm:'RESTORE',archive:backup,journal:archive},restored.owner,409);
    await restored.json('/restore',{confirm:'RESTORE',acknowledge: 'erasure history unverified: supply your latest erasure journal',archive},restored.owner);
    assert.equal((await restored.request('/api/blotter'+fileDoor,undefined,restored.owner)).status,404);
  } finally { await restored?.close();await h.close(); }
});


test('CRM-005 Turnstile is absent without owner keys and checks the provider only when both keys exist', async () => {
  const h=await harness({bindings:{TURNSTILE_SITE_KEY:'test-site-key',TURNSTILE_SECRET_KEY:'test-provider-secret'}});
  try {
    const page=await h.request('/intake'), html=await page.text();assert.match(html,/challenges.cloudflare.com/);
    const token=html.match(/name="token" value="([^"]+)"/)[1];
    const form=(response)=>{const f=new FormData();for(const [k,v] of Object.entries({token,name:'Challenge inquiry',contactName:'Dana',contactEmail:'dana@example.test',services:'Annual return',consent:'yes','cf-turnstile-response':response}))f.set(k,v);return f;};
    await new Promise(r=>setTimeout(r,3100));
    assert.equal((await h.request('/intake',form('test-rejected-challenge'))).status,400);
    assert.equal((await h.json('/pipeline',undefined,h.owner)).prospects.length,0);
    assert.equal((await h.request('/intake',form('test-accepted-challenge'))).status,200);
    assert.equal((await h.json('/pipeline',undefined,h.owner)).prospects.length,1);
  } finally { await h.close(); }
});

// This uses a real browser: native form navigation changes Origin according to
// the page's referrer policy, which a hand-built HTTP request cannot prove.
test('CRM-005 embedded native browser intake submits with consent and an attachment, then appears in the private pipeline', async () => {
  const { chromium }=await import('@playwright/test');
  const h=await harness();let browser, host;
  try {
    browser=await chromium.launch({headless:true,...(process.env.BLOTTER_CHROMIUM?{executablePath:process.env.BLOTTER_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
    const ctx=await browser.newContext({ignoreHTTPSErrors:true,extraHTTPHeaders:{'CF-Connecting-IP':'192.0.2.71'}});
    host=createServer((_q,r)=>{r.setHeader('content-type','text/html');r.end(`<!doctype html><title>Practice website</title><iframe title="Inquiry" src="${h.origin}/intake" width="600" height="1200"></iframe>`);});
    await new Promise(r=>host.listen(0,'127.0.0.1',r));
    const page=await ctx.newPage();page.on('console',m=>{if(m.type()==='error')console.error('Intake browser:',m.text());});
    await page.goto(`http://127.0.0.1:${host.address().port}/`);
    const frame=page.frameLocator('iframe');
    await frame.getByLabel('Business or individual name').fill('Embedded Studio LLC');
    await frame.getByLabel('Contact name',{exact:true}).fill('Dana Reyes');
    await frame.getByLabel('Contact email',{exact:true}).fill('dana@embedded.example');
    await frame.getByLabel('Requested services (comma separated)').fill('Annual return');
    await frame.getByLabel('Attachments (up to 3 files, 1 MiB each)').setInputFiles({name:'prior-scope.txt',mimeType:'text/plain',buffer:Buffer.from('Previous scope')});
    // The marketing opt-in (MSG-002) is a separate, optional checkbox that starts unticked; only the reply consent is checked here.
    assert.equal(await frame.getByRole('checkbox',{name:/also email me newsletters/}).isChecked(),false);
    await frame.getByRole('checkbox',{name:/Your details go only to this practice/}).check();await page.waitForTimeout(3100);
    await frame.getByRole('button',{name:'Send inquiry',exact:true}).click();await frame.getByRole('status').waitFor();
    const prospect=(await h.json('/pipeline',undefined,h.owner)).prospects[0];
    assert.equal(prospect.name,'Embedded Studio LLC');assert.equal(prospect.files.length,1);assert.ok(prospect.answers.consentAt);assert.equal(prospect.answers.marketing,undefined);
    await ctx.close();
  } finally { await browser?.close();if(host)await new Promise(r=>host.close(r));await h.close(); }
});

test('ONBOARD-001 native signed-scope setup preview: exact source links, no effects, principal authority and unavailable-source refusal', async () => {
  const h = await harness(); let copy, ui;
  try {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const taxQuote = '1120-S annual tax services', booksQuote = 'Monthly bookkeeping with QBO';
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([612,792]);
    page.drawText(taxQuote, {x:40,y:740,font,size:12});
    page.drawText(booksQuote, {x:40,y:710,font,size:12});
    const file = {name:'synthetic-blotter-201.pdf',mime:'application/pdf',contentBase64:Buffer.from(await pdf.save()).toString('base64')};
    const client = await h.json('/clients', {name:'synthetic-blotter-202', contacts:[{name:'synthetic-blotter-203',email:'synthetic-blotter-203@example.test',roles:['primary'],authorized:true,signer:true,portal:true,requestConsent:true,emailConsent:true,consentNote:'Explicit synthetic client authority'}]}, h.owner);
    const tax = await h.json('/templates', {name:taxQuote,recurrence:'annual',steps:'Review tax evidence',requests:'Prior-year return',feeCents:120000}, h.owner);
    const books = await h.json('/templates', {name:booksQuote,recurrence:'monthly',steps:'Review balances',requests:'Opening balances',feeCents:50000}, h.owner);
    const job = await h.json('/jobs', {clientId:client.id,templateId:tax.id,periodStart:'2026-01-01',dueDate:'2027-03-15',dueNote:'Synthetic agreed date',preparerEmail:'owner@example.test',reviewerEmail:'owner@example.test'}, h.owner);
    const contactId = client.contacts[0].id;
    let signature = await h.json(`/jobs/${job.id}/signatures`, {title:'Signed service scope',formKind:'general',mode:'parallel',contactIds:[contactId],file,fields:[{type:'signature',contactId,page:1,x:40,y:100,width:240,height:28,label:'Client signature'}]}, h.owner);
    const body = {source:{kind:'signature',id:signature.id},services:[{kind:'tax',quote:taxQuote,templateId:tax.id,authorization:'8821'},{kind:'bookkeeping',quote:booksQuote,templateId:books.id,ledger:'qbo'}]};
    const preview = (data=body, who=h.owner, status=200) => h.json(`/clients/${client.id}/onboarding/preview`,data,who,status);
    await preview(body,h.owner,404);
    signature = await h.json(`/signatures/${signature.id}/send`,{revision:signature.revision},h.owner);
    const token = new URL(signature.invitations[0].portalUrl).pathname.split('/').at(-1);
    const signing = await h.json(`/portal/${token}/signatures/${signature.id}`);
    await h.json(`/portal/${token}/signatures/${signature.id}/sign`,{revision:signing.revision,attempt:signing.attempt,consent:true,intent:true,consentVersion:signing.consentVersion,values:Object.fromEntries(signing.fields.map(f=>[f.id,signing.signerName]))});
    const before = await h.json('/state',undefined,h.owner), signatureBefore = await h.json(`/signatures/${signature.id}`,undefined,h.owner), mailCount=h.mails.length;
    const result = await preview();
    assert.equal(result.status,'preview');
    assert.equal(result.source.href,`/api/blotter/signatures/${signature.id}/files/signed`);
    assert.equal(result.source.sha256,signatureBefore.signed_sha256);
    assert.match(result.coverage,/Principal-declared/);
    assert.match(result.execution,/cannot approve/);
    assert.equal(result.items.length,13);
    assert.deepEqual(result.services.map(s=>s.template.recurrence),['annual','monthly']);
    assert.deepEqual(result.services.map(s=>s.template.requests),[['Prior-year return'],['Opening balances']]);
    assert.equal(result.items.find(i=>i.type==='ledger').provider,'qbo');
    assert.match(result.items.find(i=>i.type==='ledger').connection,/unavailable/);
    assert.equal(result.items.find(i=>i.type==='authorization').form,'8821');
    assert.ok(result.items.every(i=>i.scope.sourceId===signature.id&&i.scope.sha256===signatureBefore.signed_sha256&&i.scope.href===result.source.href&&i.status==='proposed'));
    assert.deepEqual([...new Set(result.items.map(i=>i.scope.quote))],[taxQuote,booksQuote]);
    assert.equal((await h.request(result.source.href,undefined,h.owner)).status,200);
    assert.equal((await preview()).fingerprint,result.fingerprint);
    assert.equal(h.mails.length,mailCount);
    const after = await h.json('/state',undefined,h.owner);
    for (const key of ['clients','jobs','templates','proposals']) assert.deepEqual(after[key],before[key],key+' unchanged');
    assert.deepEqual(await h.json(`/signatures/${signature.id}`,undefined,h.owner),signatureBefore);
    await preview({...body,services:[{...body.services[0],quote:'Unauthorized payroll service'}]},h.owner,409);
    await preview({...body,services:[body.services[0],body.services[0]]},h.owner,400);
    await preview({...body,services:[{...body.services[1],ledger:'unknown'}]},h.owner,400);
    await preview({...body,services:[{...body.services[0],templateId:'synthetic-blotter-missing'}]},h.owner,404);
    const other = await h.json('/clients',{name:'synthetic-blotter-204'},h.owner);
    await h.json(`/clients/${other.id}/onboarding/preview`,body,h.owner,404);
    assert.deepEqual(await h.json(`/clients/${other.id}/onboarding/plans`,undefined,h.owner),{sources:[],plans:[]});
    const address='synthetic-blotter-205@example.test';
    await h.json('/team',{email:address,name:'Synthetic reviewer',role:'reviewer'},h.owner);
    await h.json('/team/invite',{email:address},h.owner);
    const reviewer=await h.login(address);
    await preview(body,reviewer,403);
    await preview(body,'',401);
    const key=await h.json('/keys',{label:'synthetic-blotter-206'},h.owner);
    await h.json(`/clients/${client.id}/onboarding/preview`,body,'',401,{authorization:'Bearer '+key.key});
    const recorded=await h.json(`/clients/${client.id}/engagements`,{title:'Recorded signed letter',signers:['synthetic-blotter-203'],signedDate:'2026-10-20',file},h.owner);
    const mapped={...body,source:{kind:'engagement',id:recorded.id}};
    assert.match((await preview(mapped)).source.label,/practitioner-recorded, not signed through Blotter/);
    const beforeReviewMail=h.mails.length, beforeReviewState=await h.json('/state',undefined,h.owner);
    const planDoor=`/clients/${client.id}/onboarding/plans`;
    const removed=result.items.find(item=>item.type==='bank').id;
    const review={...body,fingerprint:result.fingerprint,selectedItemIds:result.items.filter(item=>item.id!==removed).map(item=>item.id),reason:'Reviewed the exact signed scope; bank setup handled separately'};
    await h.json(planDoor,{...review,selectedItemIds:[...review.selectedItemIds,'synthetic-blotter-outside']},h.owner,400);
    await h.json(planDoor,{...review,fingerprint:'synthetic-blotter-stale'},h.owner,409);
    await h.json(planDoor,review,reviewer,403);
    const context=await h.json(planDoor,undefined,h.owner);
    assert.deepEqual(context.sources.map(source=>source.id).sort(),[signature.id,recorded.id].sort());
    assert.deepEqual(context.plans,[]);
    await h.json(planDoor,undefined,reviewer,403);
    await h.json(planDoor,undefined,'',401);
    await onboardingAccessJourney(h,{client},'',reviewer);
    ui=await onboardingJourney(h,{client,body,sourceHref:`/api/blotter/signatures/${signature.id}/files/signed`,sourceDigest:signatureBefore.signed_sha256,review});
    let plan=ui.plan;
    assert.equal(plan.decidedBy,'owner@example.test');assert.ok(Number.isFinite(Date.parse(plan.decidedAt)));
    assert.equal(plan.items.filter(item=>item.selected).length,12);
    assert.equal(plan.items.find(item=>item.id===removed).selected,false);
    assert.equal((await h.json(planDoor,review,h.owner)).id,plan.id,'Repeated review creates one retained record');
    await h.json(planDoor,{...review,selectedItemIds:result.items.map(item=>item.id)},h.owner,409);
    assert.match(plan.execution,/No invitation/);
    const progressDoor=planDoor+'/'+plan.id+'/progress';
    const observation={revision:plan.revision,itemId:result.items.find(item=>item.type==='ledger').id,state:'blocked',ownerEmail:'owner@example.test',note:'QBO connection still missing',nextAction:'Principal to arrange authorized connection before the first monthly close'};
    await h.json(progressDoor,{...observation,itemId:removed},h.owner,409);
    await h.json(progressDoor,{...observation,ownerEmail:address},h.owner,403);
    plan=await ui.observe(observation);
    const blocked=plan.items.find(item=>item.type==='ledger').progress;
    assert.equal(blocked.ownerEmail,'owner@example.test');
    assert.equal(blocked.recordedBy,'owner@example.test');assert.ok(Number.isFinite(Date.parse(blocked.recordedAt)));
    assert.match(blocked.note,/QBO connection/);
    assert.match(blocked.verification,/no provider connection/);
    assert.match(blocked.chaseDraft,/connect QBO/);
    await h.json(progressDoor,observation,h.owner,409);
    plan=await ui.observe({...observation,state:'received',note:'Practitioner observed connection evidence; not provider verified',nextAction:'Principal to review before setup proceeds'});
    await ui.inspect();
    const received=plan.items.find(item=>item.type==='ledger').progress;
    assert.equal(received.recordedBy,'owner@example.test');assert.ok(Number.isFinite(Date.parse(received.recordedAt)));
    assert.deepEqual(received.history,[Object.fromEntries(Object.entries(blocked).filter(([key])=>key!=='history'))]);
    assert.equal(received.chaseDraft,null);
    assert.match(received.verification,/no provider connection/);
    assert.equal(plan.items.find(item=>item.id===removed).progress,null);
    assert.equal((await h.json(planDoor+'/'+plan.id,undefined,h.owner)).revision,plan.revision);
    await h.json(planDoor+'/'+plan.id,undefined,reviewer,403);
    assert.equal(h.mails.length,beforeReviewMail,'Setup review and observations never send mail');
    const hold=await h.json(`/clients/${client.id}/retention`,{scope:'client',kind:'hold',reason:'Retain signed onboarding review',owner:'owner@example.test',reviewDate:'2999-01-01'},h.owner);
    const archive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
    const audit=archive.trim().split('\n').map(line=>JSON.parse(line)).flatMap(part=>part.items??[]).filter(item=>item.table==='b_audit').map(item=>item.row);
    const decisions=audit.filter(row=>row.action==='onboarding.reviewed'&&JSON.parse(row.detail).planId===plan.id);
    assert.equal(decisions.length,1);assert.equal(decisions[0].actor,'owner@example.test');assert.equal(decisions[0].object_id,client.id);assert.ok(Number.isFinite(Date.parse(decisions[0].at)));
    assert.equal(audit.filter(row=>row.action==='onboarding.progress_recorded'&&JSON.parse(row.detail).planId===plan.id).length,2);
    const unchanged=await h.json('/state',undefined,h.owner);for(const key of ['clients','jobs','templates','proposals'])assert.deepEqual(unchanged[key],beforeReviewState[key]);
    assert.deepEqual(await h.json(`/signatures/${signature.id}`,undefined,h.owner),signatureBefore);
    assert.ok(archive.includes('onboarding.previewed')&&archive.includes('onboarding.reviewed')&&archive.includes('onboarding.progress_recorded'));
    copy=await harness();
    await copy.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},copy.owner);
    assert.equal((await copy.json(`/clients/${client.id}/onboarding/preview`,body,copy.owner)).fingerprint,result.fingerprint);
    const restored=await copy.json(planDoor+'/'+plan.id,undefined,copy.owner);
    assert.equal(restored.status,'held');
    await onboardingAccessJourney(copy,{client},plan.id,copy.owner,true);
    assert.ok((await copy.json(`/clients/${client.id}/retention`,undefined,copy.owner)).marks.some(mark=>mark.kind==='hold'&&!mark.released_at));
    assert.deepEqual(restored.items,plan.items);
    await copy.json(progressDoor,{...observation,revision:restored.revision},copy.owner,409);
    await copy.json(planDoor,review,copy.owner,409);
    await h.json(`/retention/${hold.id}/release`,{reason:'Restore proof complete; allow source erasure'},h.owner);
    const refused=await ui.unavailable(mapped.source);
    await h.json(`/files/${recorded.id}/erase`,{confirm:file.name,reason:'Synthetic source removal'},h.owner);
    await preview(mapped,h.owner,404);
    await refused();
    await h.json(`/clients/${client.id}/lifecycle`,{lifecycle:'archived',revision:(await h.json(`/clients/${client.id}/detail`,undefined,h.owner)).revision},h.owner);
    await preview(body,h.owner,404);
    await h.json(planDoor,undefined,h.owner,404);
    const erasable=await h.json('/clients',{name:'synthetic-blotter-207'},h.owner);
    const letter=await h.json(`/clients/${erasable.id}/engagements`,{title:'Recorded signed scope',signers:['synthetic-blotter-208'],signedDate:'2026-10-20',file},h.owner);
    const eraseBody={...body,source:{kind:'engagement',id:letter.id}};
    const erasePreview=await h.json(`/clients/${erasable.id}/onboarding/preview`,eraseBody,h.owner);
    const erasePlan=await h.json(`/clients/${erasable.id}/onboarding/plans`,{...eraseBody,fingerprint:erasePreview.fingerprint,selectedItemIds:erasePreview.items.map(item=>item.id),reason:'Reviewed before synthetic erasure'},h.owner);
    await h.json(`/clients/${erasable.id}/lifecycle`,{lifecycle:'archived',revision:(await h.json(`/clients/${erasable.id}/detail`,undefined,h.owner)).revision},h.owner);
    const deletion=await h.json(`/clients/${erasable.id}/erasure/preview`,undefined,h.owner);
    assert.deepEqual(deletion.blockers,[]);
    assert.ok(deletion.erase.some(step=>step.table==='b_onboarding_plans'&&step.count===1));
    const receipt=await h.json(`/clients/${erasable.id}/erasure`,{planHash:deletion.planHash,confirm:'synthetic-blotter-207',reason:'Synthetic onboarding erasure proof'},h.owner);
    assert.ok(receipt.steps.some(step=>step.table==='b_onboarding_plans'&&step.count===1));
    await h.json(`/clients/${erasable.id}/onboarding/plans/${erasePlan.id}`,undefined,h.owner,404);
    const erasedArchive=await(await h.request('/api/blotter/backup',undefined,h.owner)).text();
    assert.ok(!erasedArchive.includes('Reviewed before synthetic erasure'));
  } finally {await ui?.close();await h.close();if(copy)await copy.close();}
});
