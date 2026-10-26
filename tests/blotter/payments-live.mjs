// Explicitly invoked held-key sandbox journey. Never run as part of ordinary tests or Verify.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {harness} from './harness.mjs';
import {paymentFixture} from './payment-fixture.mjs';
import {paymentJourney} from './payment-ui.mjs';
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
const h=await harness({bindings:{STRIPE_SECRET_KEY:process.env.STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET:'synthetic-blotter-1'},stripeResponse:provider});
let browser;
try{
 const s=await paymentFixture(h,1000);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),page=await context.newPage();
 await page.goto(h.origin+`/invoice/${s.token}`);await page.getByRole('heading',{name:'Pay this invoice',exact:true}).waitFor();
 await page.getByLabel('Payment amount in USD cents',{exact:true}).fill('100');
 assert.equal(await page.getByRole('button',{name:'Continue to Stripe',exact:true}).isEnabled(),false);
 await page.getByLabel('I authorize this payment',{exact:true}).check();await page.getByLabel('Save this payment method for staff collection',{exact:true}).check();
 await page.getByRole('checkbox',{name:/I authorize staff to collect/}).check();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${directory}/payment-portal-consent-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Continue to Stripe',exact:true}).click();
 await page.waitForURL('https://checkout.stripe.com/**',{timeout:60_000});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#email').fill('synthetic-blotter@example.com');
 await page.getByRole('button',{name:/Card|Credit or debit card/i}).click().catch(()=>{});
 await page.locator('#cardNumber').fill('4242424242424242');await page.locator('#cardExpiry').fill('1230');await page.locator('#cardCvc').fill('123');
 const name=page.locator('#billingName');if(await name.count())await name.fill('Synthetic Blotter');
 const zip=page.locator('#billingPostalCode');if(await zip.count())await zip.fill('02108');
 const address=page.locator('#billingAddressLine1');if(await address.count())await address.fill('10 Main Street');
 await page.getByRole('button',{name:/^Pay|^Authorize/}).last().click();
 await page.waitForURL(h.origin+'/**',{timeout:90_000});
 const pending=(await h.json(`/invoices/${s.invoice.id}/payments`,undefined,h.owner)).payments.at(-1);
 const paid=await h.json(`/payments/${pending.id}/reconcile`,{},h.owner);assert.equal(paid.state,'settled');assert.equal(paid.net_cents,100);
 const mandate=(await h.json(`/invoices/${s.invoice.id}/payments`,undefined,h.owner)).mandates.find(m=>m.status==='active');assert.ok(mandate);
 const request={mandateId:mandate.id,requestId:crypto.randomUUID()};
 const collected=await h.json(`/invoices/${s.invoice.id}/quick-collect`,request,h.owner);assert.equal(collected.state,'settled');assert.equal(collected.net_cents,900);
 assert.equal((await h.json(`/invoices/${s.invoice.id}/quick-collect`,request,h.owner)).id,collected.id);
 const refunded=await h.json(`/payments/${collected.id}/refund`,{amountCents:200,reason:'Sandbox partial refund authorized by the synthetic client',requestId:crypto.randomUUID()},h.owner);assert.equal(refunded.refunded_cents,200);
 await h.json(`/invoice-portal/${s.token}/mandates/${mandate.id}/revoke`,{reason:'Sandbox client withdraws saved-method authority'});
 await h.json(`/invoices/${s.invoice.id}/quick-collect`,{mandateId:mandate.id,requestId:crypto.randomUUID()},h.owner,409);
 await page.goto(h.origin+`/invoice/${s.token}`);await page.getByText('Saved payment methods',{exact:true}).click();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${directory}/payment-portal-revoked-${width}.png`,fullPage:true});}
 await context.close();await browser.close();browser=null;
 await paymentJourney(h,s,s.invoice);
 const statement=await h.json(`/clients/${s.client.id}/statement?asOf=2030-01-01`,undefined,h.owner);assert.equal(statement.totals.openCents,201); // UI journey refunds one additional cent.
 const result={result:'PASS',testMode:true,invoiceId:s.invoice.id,payments:[paid.provider_id,collected.provider_id],card:true,savedMandate:true,quickCollect:true,duplicateChargeRefused:true,partialRefund:true,revocation:true,netCents:799,receipts};
 await writeFile(`${directory}/stripe-sandbox.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{
 await browser?.close();await h.close();
 for(const session of objects.sessions)await fetch(`https://api.stripe.com/v1/checkout/sessions/${session}/expire`,{method:'POST',headers:{authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2026-09-30.endive'}});
 for(const customer of objects.customers)await fetch(`https://api.stripe.com/v1/customers/${customer}`,{method:'DELETE',headers:{authorization:`Bearer ${process.env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2026-09-30.endive'}});
}
