// Explicit held-key sandbox journey. Ordinary verification never invokes this file.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { harness } from './harness.mjs';
import { paymentFixture } from './payment-fixture.mjs';
import { sandboxGate, sandboxInvoice } from './payment-sandbox.mjs';
import { sandboxBank, sandboxBankScreens, sandboxBankDiagnostics } from './payment-sandbox-bank.mjs';

assert.ok(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'Inject the held Stripe test key');
const directory = process.env.BLOTTER_PAYMENT_EVIDENCE;
assert.ok(directory, 'Set the external payment evidence directory');
await mkdir(directory, { recursive: true });
const version = '2026-09-30.endive', started = Math.floor(Date.now() / 1000);
const objects = { customers: new Set(), sessions: new Set(), intents: new Set() };
const receipts = [], transactions = [], cleanup = [];
let calls = 0, phase = 'build', browser, h, lastPage, failed = false;

const provider = async request => {
  assert.ok(++calls <= 180, 'Bounded Stripe sandbox requests');
  const response = await fetch(request.url, { method: request.method, headers: request.headers,
    ...(request.method === 'POST' ? { body: await request.text() } : {}), signal: AbortSignal.timeout(30_000) });
  const object = await response.clone().json();
  assert.notEqual(object.livemode, true, 'Only Stripe test objects are accepted');
  receipts.push({ requestId: response.headers.get('request-id'), status: response.status, object: object.id ?? null, livemode: object.livemode ?? null });
  if (object.id?.startsWith('cus_')) objects.customers.add(object.id);
  if (object.id?.startsWith('cs_')) objects.sessions.add(object.id);
  if (object.id?.startsWith('pi_')) objects.intents.add(object.id);
  return response;
};
const stripe = async (path, body, method = body === undefined ? 'GET' : 'POST') => {
  const response = await provider(new Request(`https://api.stripe.com/v1/${path}`, { method,
    headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Stripe-Version': version,
      ...(body === undefined ? {} : { 'content-type': 'application/x-www-form-urlencoded' }) },
    ...(body === undefined ? {} : { body: new URLSearchParams(body) }) }));
  const data = await response.json();
  assert.ok(response.ok, `Stripe ${method} refused with status ${response.status} and code ${data.error?.code ?? data.error?.type ?? 'unknown'}`);
  return data;
};
const policy = achUnlock => h.json('/payment-policy', { achUnlock, holdThresholdCents: null, reason: `Principal selected ${achUnlock} ACH release for the synthetic payment journey` }, h.owner);
const reconcile = payment => h.json(`/payments/${payment.id}/reconcile`, {}, h.owner);
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function evidence(payment, expected) {
  const pi = await stripe(`payment_intents/${payment.provider_id}?expand[]=latest_charge.balance_transaction`);
  assert.equal(pi.livemode, false); assert.equal(payment.state, expected);
  assert.equal(pi.status, { pending: 'processing', settled: 'succeeded', returned: 'requires_payment_method' }[expected]);
  const charge = pi.latest_charge;
  if (expected === 'returned') assert.ok([pi.last_payment_error?.code, pi.last_payment_error?.decline_code, charge?.failure_code].includes('insufficient_funds'), 'Stripe reports the insufficient-funds bank return');
  const eventType = { pending: 'payment_intent.processing', settled: 'payment_intent.succeeded', returned: 'payment_intent.payment_failed' }[expected];
  let events = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const list = await stripe(`events?created[gte]=${started}&limit=100`);
    events = list.data.filter(event => event.data.object.id === pi.id || event.data.object.payment_intent === pi.id || event.data.object.id === charge?.id);
    if (events.some(event => event.type === eventType)) break;
    await pause(1000);
  }
  assert.ok(events.some(event => event.type === eventType), `Stripe retained the actual ${eventType} event`);
  for (const event of events) assert.equal(event.livemode, false);
  return { paymentId: payment.id, intentId: pi.id, chargeId: charge?.id ?? null, state: payment.state, providerState: pi.status,
    livemode: false, amountCents: pi.amount, receivedCents: pi.amount_received, netCents: payment.net_cents,
    feeCents: charge?.balance_transaction?.fee ?? payment.fee_cents, failureCode: pi.last_payment_error?.code ?? null,
    declineCode: pi.last_payment_error?.decline_code ?? null, chargeFailureCode: charge?.failure_code ?? null,
    events: events.map(event => ({ id: event.id, type: event.type, livemode: event.livemode, requestId: event.request?.id ?? null })) };
}

async function checkout(page, fixture, account) {
  await page.goto(`${h.origin}/invoice/${fixture.token}`);
  await page.getByRole('heading', { name: 'Pay this invoice', exact: true }).waitFor();
  await page.getByLabel('Payment amount in USD cents', { exact: true }).fill('100');
  assert.equal(await page.getByRole('button', { name: 'Continue to Stripe', exact: true }).isEnabled(), false);
  await page.getByLabel('I authorize this payment', { exact: true }).check();
  const before = (await h.json(`/invoices/${fixture.invoice.id}/payments`, undefined, h.owner)).payments.map(payment => payment.id);
  await page.getByRole('button', { name: 'Continue to Stripe', exact: true }).click();
  await page.waitForURL('https://checkout.stripe.com/**', { timeout: 60_000 });
  const created = (await h.json(`/invoices/${fixture.invoice.id}/payments`, undefined, h.owner)).payments.filter(payment => !before.includes(payment.id));
  assert.equal(created.length, 1, 'The client payment door created exactly one accounting payment');
  const payment = created[0]; assert.equal(payment.amount_cents, 100);
  await sandboxBank(page, account, h.origin);
  let current = await reconcile(payment);
  if (current.state === 'requires_action') {
    const pi = await stripe(`payment_intents/${current.provider_id}`);
    assert.equal(pi.next_action?.type, 'verify_with_microdeposits');
    await stripe(`payment_intents/${pi.id}/verify_microdeposits`, pi.next_action.verify_with_microdeposits.microdeposit_type === 'descriptor_code'
      ? { descriptor_code: 'SM11AA' } : { 'amounts[0]': '32', 'amounts[1]': '45' });
    current = await reconcile(payment);
  }
  return current;
}

try {
  const buildEnv = { ...process.env }; delete buildEnv.STRIPE_SECRET_KEY;
  const build = spawnSync('pnpm', ['exec', 'rer', 'build'], { env: buildEnv, stdio: 'inherit' });
  assert.equal(build.status, 0, 'Build the pinned checkout before the ACH sandbox journey');
  h = await harness({ bindings: { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY }, stripeResponse: provider });
  assert.equal((await h.json('/payment-policy', undefined, h.owner)).achUnlock, 'settled', 'The default policy requires settled ACH');
  const initial = await paymentFixture(h, 100);
  browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); lastPage = page;
  for (const [index, scenario] of [
    { state: 'pending', account: '000000000009' }, { state: 'settled', account: '000123456789' }, { state: 'returned', account: '000222222227' },
  ].entries()) {
    phase = scenario.state;
    if (index > 0) await policy('settled');
    const fixture = index === 0 ? initial : await sandboxInvoice(h, initial, `ACH ${scenario.state}`, 100);
    const gate = await sandboxGate(h, fixture, `ACH ${scenario.state} final work product`);
    await gate.assert(402);
    let current = await checkout(page, fixture, scenario.account), pendingAccepted = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (current.state === 'pending' && !pendingAccepted) {
        await gate.assert(402);
        await policy('pending'); await gate.assert(200); pendingAccepted = true;
        if (scenario.state !== 'returned') { await policy('settled'); await gate.assert(402); }
      }
      if (current.state === scenario.state) break;
      await pause(1000); current = await reconcile(current);
    }
    assert.equal(current.state, scenario.state, `Observed terminal ACH scenario ${scenario.state}`);
    assert.equal(current.kind, 'us_bank_account');
    assert.equal(current.net_cents, scenario.state === 'settled' ? 100 : 0);
    await gate.assert(scenario.state === 'settled' ? 200 : 402);
    const result = await evidence(current, scenario.state);
    transactions.push({ ...result, pendingAcceptedBeforeOutcome: pendingAccepted });
    await sandboxBankScreens(page, h, fixture, gate, directory, scenario.state);
    await policy('settled'); await gate.assert(scenario.state === 'settled' ? 200 : 402);
  }
  await context.close();
} catch (error) {
  failed = true;
  const message = String(error.message).replaceAll(process.env.STRIPE_SECRET_KEY, '[redacted]')
    .replace(/\b(?:sk|rk|pk)_test_[A-Za-z0-9_]+|\bpi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/https?:\/\/[^\s"']+/g, '[URL omitted]').slice(0, 2000);
  await lastPage?.screenshot({ path: `${directory}/ach-failure.png`, fullPage: true }).catch(() => {});
  const controls = lastPage ? await sandboxBankDiagnostics(lastPage) : [];
  await writeFile(`${directory}/stripe-ach-failure.json`, JSON.stringify({ phase, name: error.name, message, controls }, null, 2));
  throw new Error(`ACH sandbox failed during ${phase}: ${message}`);
} finally {
  await browser?.close();
  for (const intent of objects.intents) {
    try {
      const pi = await stripe(`payment_intents/${intent}`);
      if (['processing', 'requires_action', 'requires_payment_method', 'requires_confirmation'].includes(pi.status)) {
        const canceled = await stripe(`payment_intents/${intent}/cancel`, { cancellation_reason: 'requested_by_customer' });
        cleanup.push({ object: intent, action: 'cancel', state: canceled.status });
      } else cleanup.push({ object: intent, action: 'retain', state: pi.status });
    } catch { cleanup.push({ object: intent, action: 'retain', state: 'cancellation_refused' }); }
  }
  for (const session of objects.sessions) {
    try {
      const current = await stripe(`checkout/sessions/${session}`);
      if (current.status === 'open') { await stripe(`checkout/sessions/${session}/expire`, {}); cleanup.push({ object: session, action: 'expire', state: 'expired' }); }
      else cleanup.push({ object: session, action: 'retain', state: current.status });
    } catch { cleanup.push({ object: session, action: 'retain', state: 'cleanup_refused' }); }
  }
  for (const customer of objects.customers) {
    try { await stripe(`customers/${customer}`, undefined, 'DELETE'); cleanup.push({ object: customer, action: 'delete', state: 'deleted' }); }
    catch { cleanup.push({ object: customer, action: 'retain', state: 'cleanup_refused' }); }
  }
  await h?.close();
  const result = { result: failed ? 'FAIL' : 'PASS', testMode: true, phase, transactions, receipts, cleanup };
  await writeFile(`${directory}/stripe-ach-sandbox.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ result: result.result, testMode: true, transactions: transactions.length, providerRequests: calls }));
}
