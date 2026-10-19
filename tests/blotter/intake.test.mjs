// CRM-005 intake through the public, embeddable HTTP form and signed-in pipeline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { harness } from './harness.mjs';
import { createServer } from 'node:http';

test('CRM-005 public intake / CRM-003 history: embed, consent, answers/uploads, spam checks, private staff read, one-client win and file erasure', async () => {
  const secret = 'test-intake-signing-key-not-a-real-secret', h = await harness({bindings:{SESSION_SECRET:secret}});let restored;
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
    const history=await h.json(`/clients/${first.clientId}/history?kind=documents`,undefined,h.owner);assert.ok(history.history.some(e=>e.action==='file.filed_from_intake' && e.job_id===first.jobId && e.actor==='owner@example.test'));
    assert.ok(job.requests.some(r=>r.files.some(f=>f.id===converted.files[0].job_file_id)), 'upload is filed on client onboarding work');
    const backup=await (await h.request('/api/blotter/backup',undefined,h.owner)).text();
    assert.doesNotMatch(backup,/Rejected Honeypot|Rejected No Consent|Rejected Over Limit|192\.0\.2\./);
    await h.json(`/files/${p.files[0].id}/erase`,{confirm:'scope.txt',reason:'Inquiry attachment no longer needed'},h.owner);
    assert.equal((await h.request('/api/blotter'+fileDoor,undefined,h.owner)).status,404);
    const archive=await (await h.request('/api/blotter/backup',undefined,h.owner)).text();assert.doesNotMatch(archive, /UHJpb3Igc2NvcGUgZG9jdW1lbnQ=/);
    restored=await harness();
    await restored.json('/restore',{confirm:'RESTORE',archive:backup,journal:archive},restored.owner,409);
    await restored.json('/restore',{confirm:'RESTORE',archive},restored.owner);
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
    browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
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
    await frame.getByRole('checkbox').check();await page.waitForTimeout(3100);
    await frame.getByRole('button',{name:'Send inquiry',exact:true}).click();await frame.getByRole('status').waitFor();
    const prospect=(await h.json('/pipeline',undefined,h.owner)).prospects[0];
    assert.equal(prospect.name,'Embedded Studio LLC');assert.equal(prospect.files.length,1);assert.ok(prospect.answers.consentAt);
    await ctx.close();
  } finally { await browser?.close();if(host)await new Promise(r=>host.close(r));await h.close(); }
});
