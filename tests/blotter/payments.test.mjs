import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {harness} from './harness.mjs';
import {paymentFixture} from './payment-fixture.mjs';
import {stripeEdge} from './stripe-edge.mjs';
import {paymentJourney} from './payment-ui.mjs';
const secret='synthetic-blotter-1';
const start=async()=>{const edge=stripeEdge(),h=await harness({bindings:{STRIPE_SECRET_KEY:'synthetic-blotter-2',STRIPE_WEBHOOK_SECRET:secret},stripeResponse:edge.respond});try{return {h,edge,s:await paymentFixture(h)};}catch(error){await h.close();throw error;}};
async function authorize(h,s,amount=100){
 const link=await h.json(`/invoice-portal/${s.token}/pay`,{amountCents:amount,confirm:true,saveMethod:true,authorizeSaved:true,requestId:randomUUID()});
 const paid=await h.json(`/payments/${link.paymentId}/reconcile`,{},h.owner);
 const state=await h.json(`/invoices/${s.invoice.id}/payments`,undefined,h.owner);return {paid,mandate:state.mandates.find(m=>m.status==='active')};
}
async function notify(h,event,extra={}){const raw=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000),sig=createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex');return h.request('/api/blotter/stripe/events',event,'',{'stripe-signature':`t=${timestamp},v1=${sig}`,...extra});}
test('Authorized saved-card collection reconciles partial payment and refund into balances, statements and attributed client history',async()=>{
 const {h,s}=await start();try{
  await h.json('/team/invite',{email:'preparer@example.test'},h.owner);const preparer=await h.login('preparer@example.test');
  await h.json(`/invoices/${s.invoice.id}/quick-collect`,{},preparer,403);
  await h.json(`/invoices/${s.invoice.id}/payments`,undefined,preparer,403);
  await h.json(`/invoices/${s.invoice.id}/quick-collect`,{},h.owner,409);
  await h.json(`/invoice-portal/${s.token}/pay`,{amountCents:100,confirm:false},undefined,400);
  const {paid,mandate}=await authorize(h,s);assert.equal(paid.net_cents,100);assert.equal(mandate.kind,'card');
  const request={mandateId:mandate.id,requestId:randomUUID()};
  const collected=await h.json(`/invoices/${s.invoice.id}/quick-collect`,request,h.owner);assert.equal(collected.net_cents,900);
  assert.equal((await h.json(`/invoices/${s.invoice.id}/quick-collect`,request,h.owner)).id,collected.id);
  assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,0);
  await h.json(`/payments/${collected.id}/refund`,{amountCents:200,reason:'Client requested a partial refund',requestId:randomUUID()},h.owner);
  assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,200);
  const statement=await h.json(`/clients/${s.client.id}/statement?asOf=2030-01-01`,undefined,h.owner);assert.equal(statement.totals.openCents,200);assert.equal(statement.payments.reduce((n,p)=>n+p.net_cents,0),800);
  const history=await h.json(`/clients/${s.client.id}/history?kind=billing`,undefined,h.owner);assert.ok(history.history.some(e=>e.action==='payment.settled'&&e.detail.includes(collected.provider_id)&&e.actor=== 'owner@example.test'&&e.at&&e.job_id===s.job.id));
  await paymentJourney(h,s,{...s.invoice,balance_cents:200});
 }finally{await h.close();}
});
test('Signed duplicate and out-of-order notifications cannot undo refunds; invalid signatures cannot change money',async()=>{
 const {h,s,edge}=await start();try{
  const {paid}=await authorize(h,s,500),event={id:'synthetic-blotter-100',type:'payment_intent.succeeded',data:{object:{id:paid.provider_id}}};
  assert.equal((await notify(h,event,{'stripe-signature':'invalid'})).status,401);
  assert.equal((await notify(h,event)).status,200);assert.equal((await (await notify(h,event)).json()).replayed,true);
  await h.json(`/payments/${paid.id}/refund`,{amountCents:200,reason:'Partial refund',requestId:randomUUID()},h.owner);
  assert.equal((await notify(h,{...event,id:'synthetic-blotter-101',created:1})).status,200);
  assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,700);
  assert.equal((await notify(h,{...event,type:'payment_intent.processing'})).status,409);
  assert.equal(edge.intents.get(paid.provider_id).latest_charge.amount_refunded,200);
  edge.intents.get(paid.provider_id).latest_charge.disputed=true;
  assert.equal((await notify(h,{...event,id:'synthetic-blotter-102',type:'charge.dispute.created'})).status,200);
  assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,1000,'A disputed payment no longer discharges the invoice');
 }finally{await h.close();}
});
test('Failed card and returned ACH create owned follow-up, pending acceptance is unsettled, and revoked mandates never debit again',async()=>{
 const {h,s,edge}=await start();try{
  const {paid,mandate}=await authorize(h,s,1000),pi=edge.intents.get(paid.provider_id);
  const final=await h.json(`/jobs/${s.job.id}/deliverables`,{title:'Final return',name:'return.txt',mime:'text/plain',contentBase64:Buffer.from('Final work product').toString('base64'),contactId:s.billing.id},h.owner);
  await h.json(`/jobs/${s.job.id}/payment-gates`,{deliverableId:final.deliverableId,invoiceId:s.invoice.id,reason:'Payment releases the final work product'},h.owner);
  const portalToken=new URL(final.portalUrl).pathname.split('/').at(-1),file=()=>h.request(`/api/blotter/portal/${portalToken}/deliverables/${final.id}/file`);
  assert.equal((await file()).status,200);
  pi.status='processing';pi.payment_method.type='us_bank_account';pi.payment_method.us_bank_account={last4:'6789'};
  const pending=await h.json(`/payments/${paid.id}/reconcile`,{},h.owner);assert.equal(pending.state,'pending');assert.equal(pending.net_cents,0);assert.equal((await file()).status,402);
  await h.json('/payment-policy',{achUnlock:'pending',holdThresholdCents:null,reason:'Principal permits pending ACH release'},h.owner);assert.equal((await file()).status,200);
  pi.status='requires_payment_method';pi.last_payment_error={code:'debit_not_authorized'};
  const returned=await h.json(`/payments/${paid.id}/reconcile`,{},h.owner);assert.equal(returned.state,'returned');assert.equal((await file()).status,402,'A returned ACH relocks the final file');
  const history=await h.json(`/clients/${s.client.id}/history?kind=billing`,undefined,h.owner);assert.ok(history.unresolved.some(i=>i.kind==='invoice'&&i.owner&&/returned/.test(i.nextAction)&&i.due));
  await h.json(`/invoice-portal/${s.token}/mandates/${mandate.id}/revoke`,{reason:'Client withdrew authorization'});
  const before=edge.calls.length;await h.json(`/invoices/${s.invoice.id}/quick-collect`,{mandateId:mandate.id,requestId:randomUUID()},h.owner,409);assert.equal(edge.calls.length,before);
  const second=await h.json(`/invoices/${s.invoice.id}/payment-link`,{amountCents:100},h.owner),failedPi=[...edge.intents.values()].at(-1);failedPi.status='requires_payment_method';failedPi.last_payment_error={code:'card_declined'};
  assert.equal((await h.json(`/payments/${second.paymentId}/reconcile`,{},h.owner)).state,'failed');
 }finally{await h.close();}
});
test('Payment archives retain accounting and restore without charging authority; erasure lists Stripe copies and honors holds',async()=>{
 const {h,s}=await start();let restored;try{
  const {paid}=await authorize(h,s,1000),archive=await (await h.request('/api/blotter/backup',undefined,h.owner)).text();
  restored=await harness({bindings:{STRIPE_SECRET_KEY:'synthetic-blotter-2'},stripeResponse:()=>{throw new Error('Restore must not contact Stripe');}});
  await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
  const state=await restored.json(`/invoices/${s.invoice.id}/payments`,undefined,restored.owner);assert.equal(state.payments[0].net_cents,1000);assert.equal(state.mandates[0].status,'held');
  await restored.json(`/invoices/${s.invoice.id}/quick-collect`,{mandateId:state.mandates[0].id,requestId:randomUUID()},restored.owner,409);
  const hold=await h.json(`/clients/${s.client.id}/retention`,{scope:'class',class:'billing',kind:'hold',owner:'owner@example.test',reviewDate:'2999-01-01',reason:'Payment dispute review'},h.owner);
  const preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.ok(JSON.stringify(preview).includes('Stripe'));assert.ok(preview.classes.find(c=>c.class==='billing').retained>0);
  await h.json(`/retention/${hold.id}/release`,{reason:'Review completed'},h.owner);
  await restored.json(`/payments/${paid.id}/reconcile`,{},restored.owner,409);
 }finally{await restored?.close();await h.close();}
});
