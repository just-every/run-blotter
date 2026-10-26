// Explicitly invoked held-key sandbox journey. Never run as part of ordinary tests or Verify.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {paymentFixture} from './payment-fixture.mjs';
import {paymentJourney} from './payment-ui.mjs';
import {sandboxCard,sandboxGate} from './payment-sandbox.mjs';
assert.ok(process.env.STRIPE_SECRET_KEY,'Inject the held Stripe test key');
assert.ok(process.env.STRIPE_SECRET_KEY.startsWith('sk_test_'),'This journey accepts only a test key');
const directory=process.env.BLOTTER_PAYMENT_EVIDENCE;
assert.ok(directory,'Set the external screenshot directory');await mkdir(directory,{recursive:true});
const objects={customers:new Set(),sessions:new Set(),intents:new Set()},receipts=[];
let calls=0;
const provider=async request=>{
 assert.ok(++calls<=100,'Bounded sandbox journey');
 const response=await fetch(request.url,{method:request.method,headers:request.headers,...(request.method==='POST'?{body:await request.text()}:{}),signal:AbortSignal.timeout(30_000)});
 const data=await response.clone().json();
 receipts.push({requestId:response.headers.get('request-id'),status:response.status,object:data.id??null,livemode:data.livemode??null});
 if(data.id?.startsWith('cus_'))objects.customers.add(data.id);
 if(data.id?.startsWith('cs_'))objects.sessions.add(data.id);
 if(data.id?.startsWith('pi_'))objects.intents.add(data.id);
 if(!response.ok)console.log(JSON.stringify({providerStatus:response.status,code:data.error?.code,param:data.error?.param,message:data.error?.message}));
 return response;
};
const buildEnv={...process.env};delete buildEnv.STRIPE_SECRET_KEY;
const build=spawnSync('pnpm',['exec','rer','build'],{env:buildEnv,stdio:'inherit'});assert.equal(build.status,0,'Build the exact committed checkout before the sandbox journey');
const h=await harness({bindings:{STRIPE_SECRET_KEY:process.env.STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET:'synthetic-blotter-1'},stripeResponse:provider});
let browser,lastPage;
try{
 const s=await paymentFixture(h,1000),gate=await sandboxGate(h,s);await gate.assert(402);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),page=await context.newPage();lastPage=page;
 await page.goto(h.origin+`/invoice/${s.token}`);await page.getByRole('heading',{name:'Pay this invoice',exact:true}).waitFor();
 await page.getByLabel('Payment amount in USD cents',{exact:true}).fill('100');
 assert.equal(await page.getByRole('button',{name:'Continue to Stripe',exact:true}).isEnabled(),false);
 await page.getByLabel('I authorize this payment',{exact:true}).check();await page.getByLabel('Save this payment method for staff collection',{exact:true}).check();
 await page.getByRole('checkbox',{name:/I authorize staff to collect/}).check();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${directory}/payment-portal-consent-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Continue to Stripe',exact:true}).click();
 await sandboxCard(page);
 await page.screenshot({path:`${directory}/stripe-submitted.png`,fullPage:true});
 await page.waitForURL(h.origin+'/**',{timeout:45_000});
 const pending=(await h.json(`/invoices/${s.invoice.id}/payments`,undefined,h.owner)).payments.at(-1);
 const paid=await h.json(`/payments/${pending.id}/reconcile`,{},h.owner);assert.equal(paid.state,'settled');assert.equal(paid.net_cents,100);await gate.assert(402);
 const mandate=(await h.json(`/invoices/${s.invoice.id}/payments`,undefined,h.owner)).mandates.find(m=>m.status==='active');assert.ok(mandate);
 const request={mandateId:mandate.id,requestId:crypto.randomUUID()};
 const collected=await h.json(`/invoices/${s.invoice.id}/quick-collect`,request,h.owner);assert.equal(collected.state,'settled');assert.equal(collected.net_cents,900);await gate.assert(200);
 assert.equal((await h.json(`/invoices/${s.invoice.id}/quick-collect`,request,h.owner)).id,collected.id);
 const refunded=await h.json(`/payments/${collected.id}/refund`,{amountCents:200,reason:'Sandbox partial refund authorized by the synthetic client',requestId:crypto.randomUUID()},h.owner);assert.equal(refunded.refunded_cents,200);await gate.assert(402);
 await h.json(`/invoice-portal/${s.token}/mandates/${mandate.id}/revoke`,{reason:'Sandbox client withdraws saved-method authority'});
 await h.json(`/invoices/${s.invoice.id}/quick-collect`,{mandateId:mandate.id,requestId:crypto.randomUUID()},h.owner,409);
 await page.goto(h.origin+`/invoice/${s.token}`);await page.getByText('Saved payment methods',{exact:true}).click();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${directory}/payment-portal-revoked-${width}.png`,fullPage:true});}
 await context.close();await browser.close();browser=null;
 await paymentJourney(h,s,s.invoice);
 const statement=await h.json(`/clients/${s.client.id}/statement?asOf=2030-01-01`,undefined,h.owner);assert.equal(statement.totals.openCents,201); // UI journey refunds one additional cent.
 // Close the unpaid link created by the staff-screen journey before paying the whole remaining balance.
 for(const sessionId of [...objects.sessions]){
  const headers={authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2026-09-30.endive'};
  const session=await (await provider(new Request(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`,{headers}))).json();
  if(session.status==='open'){
   const expired=await provider(new Request(`https://api.stripe.com/v1/checkout/sessions/${sessionId}/expire`,{method:'POST',headers}));assert.equal(expired.ok,true);
   const abandoned=await h.json(`/payments/${session.metadata.blotter_payment_id}/reconcile`,{},h.owner);assert.equal(abandoned.state,'failed');
  }
 }
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const finalContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),finalPage=await finalContext.newPage();lastPage=finalPage;
 await finalPage.goto(h.origin+`/invoice/${s.token}`);
 await finalPage.getByLabel('I authorize this payment',{exact:true}).check();
 await finalPage.getByRole('button',{name:'Continue to Stripe',exact:true}).click();
 await sandboxCard(finalPage);await finalPage.waitForURL(h.origin+'/**',{timeout:45_000});
 const remaining=(await h.json(`/invoices/${s.invoice.id}/payments`,undefined,h.owner)).payments.find(p=>p.amount_cents===201);
 assert.ok(remaining);const cleared=await h.json(`/payments/${remaining.id}/reconcile`,{},h.owner);assert.equal(cleared.state,'settled');await gate.assert(200);
 await finalPage.goto(gate.url);
 for(const width of [1440,390]){await finalPage.setViewportSize({width,height:1000});assert.equal(await finalPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await finalPage.screenshot({path:`${directory}/card-unlocked-${width}.png`,fullPage:true});}
 await finalContext.close();await browser.close();browser=null;
 const result={result:'PASS',testMode:true,invoiceId:s.invoice.id,payments:[paid.provider_id,collected.provider_id],card:true,savedMandate:true,quickCollect:true,duplicateChargeRefused:true,partialRefund:true,revocation:true,clientCardUnlock:true,netCents:1000,receipts};
 await writeFile(`${directory}/stripe-sandbox.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await lastPage?.screenshot({path:`${directory}/sandbox-failure.png`,fullPage:true}).catch(()=>{});throw error;}finally{
 await browser?.close();await h.close();
 for(const session of objects.sessions)await fetch(`https://api.stripe.com/v1/checkout/sessions/${session}/expire`,{method:'POST',headers:{authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2026-09-30.endive'}});
 for(const customer of objects.customers)await fetch(`https://api.stripe.com/v1/customers/${customer}`,{method:'DELETE',headers:{authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2026-09-30.endive'}});
}
