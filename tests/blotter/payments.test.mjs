import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {harness} from './harness.mjs';
import {paymentFixture} from './payment-fixture.mjs';
import {stripeEdge} from './stripe-edge.mjs';
import {paymentJourney} from './payment-ui.mjs';
import {billingSession,readBilling,privatePaidInvoice,closeBillingWork} from './portal-billing-fixture.mjs';
import {portalBillingJourney} from './portal-billing-ui.mjs';
const secret='synthetic-blotter-1';
const preferences={timeZone:'UTC',quietStart:'00:00',quietEnd:'00:00',digestTime:'07:00',digestEnabled:false,leadDays:1,emailKinds:[]};
const paymentAlerts=async(h,actor)=> (await h.json('/notifications',undefined,actor)).filter(n=>n.kind.startsWith('payment_'));
function safeSummaries(alerts,s,privateValues=[]){
 assert.ok(alerts.length);
 for(const alert of alerts)for(const value of [s.client.name,s.billing.email,s.invoice.id,...privateValues])assert.ok(!alert.summary.includes(value));
}
const start=async()=>{const edge=stripeEdge(),h=await harness({bindings:{STRIPE_SECRET_KEY:'synthetic-blotter-2',STRIPE_WEBHOOK_SECRET:secret},stripeResponse:edge.respond});try{return {h,edge,s:await paymentFixture(h)};}catch(error){await h.close();throw error;}};
async function authorize(h,s,amount=100){
 const link=await h.json(`/invoice-portal/${s.token}/pay`,{amountCents:amount,confirm:true,saveMethod:true,authorizeSaved:true,requestId:randomUUID()});
 const paid=await h.json(`/payments/${link.paymentId}/reconcile`,{},h.owner);
 const state=await h.json(`/invoices/${s.invoice.id}/payments`,undefined,h.owner);return {paid,mandate:state.mandates.find(m=>m.status==='active')};
}
async function notify(h,event,extra={}){const raw=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000),sig=createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex');return h.request('/api/blotter/stripe/events',event,'',{'stripe-signature':`t=${timestamp},v1=${sig}`,...extra});}
test('Authorized saved-card collection reconciles partial payment and refund into balances, statements and attributed client history',async()=>{
 const {h,s,edge}=await start();try{
  await h.json('/team/invite',{email:'preparer@example.test'},h.owner);const preparer=await h.login('preparer@example.test');
  await h.json('/team/invite',{email:'reviewer@example.test'},h.owner);const reviewer=await h.login('reviewer@example.test');
  const reminder=await h.json(`/jobs/${s.job.id}/reminders`,{contactId:s.billing.id},preparer);
  const requestMail=h.mails.findLast(m=>m.to.includes(s.billing.email)&&m.text.includes(reminder.portalUrl));
  assert.ok(requestMail);assert.match(reminder.delivery,/accepted/);
  const uploadToken=requestMail.text.match(/\/portal\/(up_[0-9a-f]{64})/)[1];
  const portal=await h.json(`/portal/${uploadToken}`),documentRequest=portal.requests[0];
  const uploaded=await h.json(`/portal/${uploadToken}/requests/${documentRequest.id}`,{name:'Source statement.txt',mime:'text/plain',contentBase64:Buffer.from('Client supplied source statement').toString('base64')});
  await h.json(`/requests/${documentRequest.id}/decide`,{decision:'accept',note:'Source checked against the engagement'},reviewer);
  let work=await h.json(`/jobs/${s.job.id}`,undefined,preparer);
  for(const step of work.steps)work=await h.json(`/jobs/${s.job.id}/steps`,{ordinal:step.ordinal,done:true,revision:work.job.revision},preparer);
  work=await h.json(`/jobs/${s.job.id}/submit`,{revision:work.job.revision},preparer);
  await h.json(`/jobs/${s.job.id}/review`,{revision:work.job.revision,decision:'signoff',note:'Reviewed the accepted client source and completed work'},reviewer);
  await h.json('/notifications/defaults',{emailKinds:['payment_settled','payment_refunded'],mandatoryKinds:[]},h.owner);
  const beforePayments=h.mails.length;
  await h.json(`/invoices/${s.invoice.id}/quick-collect`,{},preparer,403);
  await h.json(`/invoices/${s.invoice.id}/payments`,undefined,preparer,403);
  await h.json(`/invoices/${s.invoice.id}/quick-collect`,{},h.owner,409);
  await h.json(`/invoice-portal/${s.token}/pay`,{amountCents:100,confirm:false},undefined,400);
  const {paid,mandate}=await authorize(h,s);assert.equal(paid.net_cents,100);assert.equal(mandate.kind,'card');
  let alerts=await paymentAlerts(h,h.owner);assert.equal(alerts.filter(n=>n.kind==='payment_settled').length,1);
  assert.equal(h.mails.length,beforePayments,'Firm suggestions leave payment events in app until a person opts in');
  assert.equal((await paymentAlerts(h,preparer)).length,0);
  await h.json(`/notifications/${alerts[0].id}/read`,{read:true},preparer,404);
  await h.json(`/notifications/${alerts[0].id}/read`,{read:true},h.owner);
  assert.ok((await paymentAlerts(h,h.owner)).find(n=>n.id===alerts[0].id).read_at);
  const request={mandateId:mandate.id,requestId:randomUUID()};
  const collected=await h.json(`/invoices/${s.invoice.id}/quick-collect`,request,h.owner);assert.equal(collected.net_cents,900);
  assert.equal((await h.json(`/invoices/${s.invoice.id}/quick-collect`,request,h.owner)).id,collected.id);
  assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,0);
  await h.json(`/payments/${collected.id}/refund`,{amountCents:200,reason:'Client requested a partial refund',requestId:randomUUID()},h.owner);
  assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,200);
  const statement=await h.json(`/clients/${s.client.id}/statement?asOf=2030-01-01`,undefined,h.owner);assert.equal(statement.totals.openCents,200);assert.equal(statement.payments.reduce((n,p)=>n+p.net_cents,0),800);
  const history=await h.json(`/clients/${s.client.id}/history?kind=billing`,undefined,h.owner);assert.ok(history.history.some(e=>e.action==='payment.settled'&&e.detail.includes(collected.provider_id)&&e.actor=== 'owner@example.test'&&e.at&&e.job_id===s.job.id));
  const engagement=await h.json(`/clients/${s.client.id}/history`,undefined,h.owner);
  assert.equal(engagement.client.id,s.client.id);
  let previous=0;
  for(const [action,source,actor] of [['reminder.sent',s.job.id,'preparer@example.test'],['file.uploaded',uploaded.id,'client upload link'],['request.accepted',documentRequest.id,'reviewer@example.test'],['job.submitted',s.job.id,'preparer@example.test'],['job.signed_off',s.job.id,'reviewer@example.test'],['payment.settled',s.invoice.id,'owner@example.test']]){
   const event=engagement.history.filter(e=>e.action===action&&e.object_id===source&&e.actor===actor).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];
   assert.ok(event,action);assert.equal(event.job_id,s.job.id);assert.ok(Number.isFinite(Date.parse(event.at)));assert.ok(Date.parse(event.at)>=previous);previous=Date.parse(event.at);
  }
  alerts=await paymentAlerts(h,h.owner);assert.equal(alerts.filter(n=>n.kind==='payment_settled').length,2);assert.equal(alerts.filter(n=>n.kind==='payment_refunded').length,1);
  safeSummaries(alerts,s,[paid.provider_id,collected.provider_id,'Client supplied source statement']);
  await h.json('/access/people',{email:'reviewer@example.test',readOnly:false,clientIds:[]},h.owner);
  await h.json(`/clients/${s.client.id}/history`,undefined,reviewer,404);
  const privateBill=await privatePaidInvoice(h,s);
  const cookie=await billingSession(h,s),billing=await readBilling(h,s,cookie,edge);
  assert.ok(!JSON.stringify(billing).includes(privateBill.invoiceId)&&!JSON.stringify(billing).includes(privateBill.paymentId));
  assert.deepEqual(billing.invoices.map(i=>[i.id,i.currency,i.totalCents,i.balanceCents]),[[s.invoice.id,'USD',1000,200]]);
  assert.deepEqual(billing.totals,{invoicedCents:1000,creditsAppliedCents:0,writtenOffCents:0,paidCents:800,openCents:200});
  assert.deepEqual(billing.payments.map(p=>[p.id,p.amountCents,p.refundedCents,p.netCents,p.state]).sort(),[[paid.id,100,0,100,'settled'],[collected.id,900,200,700,'settled']].sort());
  assert.ok(billing.payments.every(p=>p.lastObservedAt&&!p.historical));
  await portalBillingJourney(h,{cookie,clientId:s.client.id,expectedOpenCents:200,expectedPaymentStates:['settled'],expectedInvoiceIds:[s.invoice.id]});
  await paymentJourney(h,s,{...s.invoice,balance_cents:200});
 }finally{await h.close();}
});
test('Signed duplicate and out-of-order notifications cannot undo refunds; invalid signatures cannot change money',async()=>{
 const {h,s,edge}=await start();try{
  const cookie=await billingSession(h,s);
  const {paid}=await authorize(h,s,500),event={id:'synthetic-blotter-100',type:'payment_intent.succeeded',data:{object:{id:paid.provider_id}}};
  assert.equal((await notify(h,event,{'stripe-signature':'invalid'})).status,401);
  assert.equal((await notify(h,event)).status,200);assert.equal((await (await notify(h,event)).json()).replayed,true);
  assert.equal((await paymentAlerts(h,h.owner)).filter(n=>n.kind==='payment_settled').length,1);
  await h.json('/team/invite',{email:'reviewer@example.test'},h.owner);const reviewer=await h.login('reviewer@example.test');
  await h.json(`/clients/${s.client.id}/unresolved/owner`,{kind:'invoice',id:s.invoice.id,owner:'reviewer@example.test'},h.owner);
  // Keep the HTTP mutation quiet too; the Cron assertions use fixed instants.
  const timeZone=new Date().getUTCHours()<12?'UTC':'Etc/GMT+12';
  await h.json('/notifications/settings',{...preferences,timeZone,quietEnd:'23:59',emailKinds:['payment_refunded']},reviewer);
  const beforeRefund=h.mails.length;
  await h.json(`/payments/${paid.id}/refund`,{amountCents:200,reason:'Partial refund',requestId:randomUUID()},h.owner);
  await h.scheduled('2026-11-01T15:00:00Z');
  assert.equal(h.mails.length,beforeRefund,'Payment email waits through personal quiet hours');
  const refunded=(await paymentAlerts(h,reviewer)).filter(n=>n.kind==='payment_refunded');assert.equal(refunded.length,1);
  await h.json('/access/people',{email:'reviewer@example.test',readOnly:false,clientIds:[]},h.owner);
  assert.equal((await paymentAlerts(h,reviewer)).length,0);
  await h.json(`/notifications/${refunded[0].id}/read`,{read:true},reviewer,404);
  await h.json(`/invoices/${s.invoice.id}/payments`,undefined,reviewer,404);
  const release=timeZone==='UTC'?'2026-11-01T23:59:30Z':'2026-11-02T11:59:30Z';
  await h.scheduled(release);assert.equal(h.mails.length,beforeRefund,'Delivery rechecks the recipient client grant');
  await h.json('/access/people',{email:'reviewer@example.test',readOnly:false,clientIds:[s.client.id]},h.owner);
  await h.scheduled(release);await h.scheduled(release);await h.restart();await h.scheduled(release);
  const paymentMails=h.mails.slice(beforeRefund);assert.equal(paymentMails.length,1);assert.deepEqual(paymentMails[0].to,['reviewer@example.test']);assert.ok(paymentMails[0].text.includes('/app?job='+s.job.id));
  for(const value of [s.client.name,s.billing.email,paid.provider_id])assert.ok(!JSON.stringify(paymentMails).includes(value));
  safeSummaries(refunded,s,[paid.provider_id]);
  assert.equal((await notify(h,{...event,id:'synthetic-blotter-101',created:1})).status,200);
  assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,700);
  assert.equal((await paymentAlerts(h,reviewer)).filter(n=>n.kind==='payment_refunded').length,1);
  assert.equal((await notify(h,{...event,type:'payment_intent.processing'})).status,409);
  assert.equal(edge.intents.get(paid.provider_id).latest_charge.amount_refunded,200);
  const partial=await readBilling(h,s,cookie,edge);assert.equal(partial.totals.openCents,700);assert.equal(partial.payments[0].refundedCents,200);
  edge.intents.get(paid.provider_id).latest_charge.disputed=true;
  assert.equal((await notify(h,{...event,id:'synthetic-blotter-102',type:'charge.dispute.created'})).status,200);
  assert.equal((await h.json(`/invoices/${s.invoice.id}`,undefined,h.owner)).balance_cents,1000,'A disputed payment no longer discharges the invoice');
  const disputed=await readBilling(h,s,cookie,edge);assert.deepEqual([disputed.payments[0].state,disputed.payments[0].netCents,disputed.totals.openCents],['disputed',0,1000]);
  await portalBillingJourney(h,{cookie,clientId:s.client.id,expectedOpenCents:1000,expectedPaymentStates:['disputed']});
  edge.intents.get(paid.provider_id).latest_charge.disputed=false;
  await h.json(`/payments/${paid.id}/reconcile`,{},h.owner);
  await h.json(`/payments/${paid.id}/refund`,{amountCents:300,reason:'Complete requested refund',requestId:randomUUID()},h.owner);
  const refundedView=await readBilling(h,s,cookie,edge);assert.deepEqual([refundedView.payments[0].state,refundedView.payments[0].refundedCents,refundedView.payments[0].netCents],['refunded',500,0]);
  await portalBillingJourney(h,{cookie,clientId:s.client.id,expectedOpenCents:1000,expectedPaymentStates:['refunded']});
 }finally{await h.close();}
});
test('Failed card and returned ACH create owned follow-up, pending acceptance is unsettled, and revoked mandates never debit again',async()=>{
 const {h,s,edge}=await start();try{
  const cookie=await billingSession(h,s);
  const {paid,mandate}=await authorize(h,s,1000),pi=edge.intents.get(paid.provider_id);
  const final=await h.json(`/jobs/${s.job.id}/deliverables`,{title:'Final return',name:'return.txt',mime:'text/plain',contentBase64:Buffer.from('Final work product').toString('base64'),contactId:s.billing.id},h.owner);
  await h.json(`/jobs/${s.job.id}/payment-gates`,{deliverableId:final.deliverableId,invoiceId:s.invoice.id,reason:'Payment releases the final work product'},h.owner);
  const portalToken=new URL(final.portalUrl).pathname.split('/').at(-1),file=()=>h.request(`/api/blotter/portal/${portalToken}/deliverables/${final.id}/file`);
  assert.equal((await file()).status,200);
  pi.status='processing';pi.payment_method.type='us_bank_account';pi.payment_method.us_bank_account={last4:'6789'};
  const pending=await h.json(`/payments/${paid.id}/reconcile`,{},h.owner);assert.equal(pending.state,'pending');assert.equal(pending.net_cents,0);assert.equal((await file()).status,402);
  const pendingView=await readBilling(h,s,cookie,edge);assert.deepEqual([pendingView.payments[0].state,pendingView.payments[0].netCents,pendingView.totals.openCents],['pending',0,1000]);
  await portalBillingJourney(h,{cookie,clientId:s.client.id,expectedOpenCents:1000,expectedPaymentStates:['pending']});
  await h.json('/payment-policy',{achUnlock:'pending',holdThresholdCents:null,reason:'Principal permits pending ACH release'},h.owner);assert.equal((await file()).status,200);
  pi.status='requires_payment_method';pi.last_payment_error={code:'debit_not_authorized'};
  const returned=await h.json(`/payments/${paid.id}/reconcile`,{},h.owner);assert.equal(returned.state,'returned');assert.equal((await file()).status,402,'A returned ACH relocks the final file');
  await h.json(`/payments/${paid.id}/reconcile`,{},h.owner);
  assert.equal((await paymentAlerts(h,h.owner)).filter(n=>n.kind==='payment_returned').length,1);
  const history=await h.json(`/clients/${s.client.id}/history?kind=billing`,undefined,h.owner);assert.ok(history.unresolved.some(i=>i.kind==='invoice'&&i.owner&&/returned/.test(i.nextAction)&&i.due));
  await h.json(`/invoice-portal/${s.token}/mandates/${mandate.id}/revoke`,{reason:'Client withdrew authorization'});
  const before=edge.calls.length;await h.json(`/invoices/${s.invoice.id}/quick-collect`,{mandateId:mandate.id,requestId:randomUUID()},h.owner,409);assert.equal(edge.calls.length,before);
  const second=await h.json(`/invoices/${s.invoice.id}/payment-link`,{amountCents:100},h.owner),failedPi=[...edge.intents.values()].at(-1);failedPi.status='requires_payment_method';failedPi.last_payment_error={code:'card_declined'};
  assert.equal((await h.json(`/payments/${second.paymentId}/reconcile`,{},h.owner)).state,'failed');
  await h.json(`/payments/${second.paymentId}/reconcile`,{},h.owner);
  const alerts=await paymentAlerts(h,h.owner);assert.equal(alerts.filter(n=>n.kind==='payment_failed').length,1);assert.equal(alerts.filter(n=>n.kind==='payment_returned').length,1);
  safeSummaries(alerts,s,[paid.provider_id,failedPi.id,'card_declined','debit_not_authorized','6789']);
  const failedView=await readBilling(h,s,cookie,edge);assert.deepEqual(failedView.payments.map(p=>p.state).sort(),['failed','returned']);assert.equal(failedView.totals.openCents,1000);
  await portalBillingJourney(h,{cookie,clientId:s.client.id,expectedOpenCents:1000,expectedPaymentStates:['returned','failed']});
 }finally{await h.close();}
});
test('Payment archives retain accounting and restore without charging authority; erasure lists Stripe copies and honors holds',async()=>{
 const {h,s,edge}=await start();let restored,fenced;try{
  const cookie=await billingSession(h,s);
  const {paid}=await authorize(h,s,1000);
  const original=await readBilling(h,s,cookie,edge);
  const archive=await (await h.request('/api/blotter/backup',undefined,h.owner)).text();
  restored=await harness({bindings:{STRIPE_SECRET_KEY:'synthetic-blotter-2'},stripeResponse:()=>{throw new Error('Restore must not contact Stripe');}});
  await restored.json('/restore',{archive,confirm:'RESTORE',acknowledge:'erasure history unverified: supply your latest erasure journal'},restored.owner);
  await restored.json(`/client/entities/${s.client.id}/billing`,undefined,cookie,401);
  const restoredCookie=await billingSession(restored,s),historical=await readBilling(restored,s,restoredCookie);
  assert.deepEqual(historical.totals,original.totals);assert.equal(historical.payments.length,1);assert.equal(historical.payments[0].historical,true);assert.equal(historical.payments[0].lastObservedAt,original.payments[0].lastObservedAt);
  await portalBillingJourney(restored,{cookie:restoredCookie,clientId:s.client.id,expectedOpenCents:0,expectedPaymentStates:['settled'],historical:true});
  const state=await restored.json(`/invoices/${s.invoice.id}/payments`,undefined,restored.owner);assert.equal(state.payments[0].net_cents,1000);assert.equal(state.mandates[0].status,'held');
  await restored.json(`/invoices/${s.invoice.id}/quick-collect`,{mandateId:state.mandates[0].id,requestId:randomUUID()},restored.owner,409);
  const hold=await h.json(`/clients/${s.client.id}/retention`,{scope:'class',class:'billing',kind:'hold',owner:'owner@example.test',reviewDate:'2999-01-01',reason:'Payment dispute review'},h.owner);
  const preview=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.ok(JSON.stringify(preview).includes('Stripe'));assert.ok(preview.classes.find(c=>c.class==='billing').retained>0);
  await h.json(`/retention/${hold.id}/release`,{reason:'Review completed'},h.owner);
  await restored.json(`/payments/${paid.id}/reconcile`,{},restored.owner,409);
  await closeBillingWork(h,s);
  const client=await h.json(`/clients/${s.client.id}/detail`,undefined,h.owner);
  await h.json(`/clients/${s.client.id}/lifecycle`,{revision:client.revision,lifecycle:'archived'},h.owner);
  await h.json(`/client/entities/${s.client.id}/billing`,undefined,cookie,404);
  const erasure=await h.json(`/clients/${s.client.id}/erasure/preview`,undefined,h.owner);assert.equal(erasure.eligible,true,JSON.stringify(erasure.blockers));
  const receipt=await h.json(`/clients/${s.client.id}/erasure`,{planHash:erasure.planHash,confirm:s.client.name,reason:'Client requested erasure with billing history retained'},h.owner);
  assert.ok(JSON.stringify(receipt).includes('billing_provider_payments'));
  await h.json(`/client/entities/${s.client.id}/billing`,undefined,cookie,401);
  assert.equal((await h.request(`/api/blotter/client/entities/${s.client.id}/bills/${s.invoice.id}/pdf`,undefined,cookie)).status,401);
  await h.json(`/clients/${s.client.id}/contacts/${s.billing.id}/portal-invite`,{},h.owner,409);
  const latest=await (await h.request('/api/blotter/backup',undefined,h.owner)).text();
  fenced=await harness();await fenced.json('/restore',{archive,journal:latest,confirm:'RESTORE'},fenced.owner,409);
  await fenced.json(`/client/entities/${s.client.id}/billing`,undefined,cookie,401);
 }finally{await fenced?.close();await restored?.close();await h.close();}
});
