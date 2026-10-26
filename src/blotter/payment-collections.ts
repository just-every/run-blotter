import { runtimeBindings, type Bindings } from '../auth.server';
import { atomic, audit, canReadBilling, guard, id, insist, integer, job, now, rows, stmt, text, type Actor, type Data } from './model';
import { billed, invoiceBalanceSql, invoiceHuman } from './invoices-sources';
import { invoicePortalContext } from './invoices-delivery';
import { stripe } from './stripe-provider';
import { reconcilePayment } from './payment-events';

async function invoiceFor(db: D1Database, actor: Actor, invoiceId: string, write = true) {
  if (write) invoiceHuman(actor); else insist(canReadBilling(actor), 'Your role cannot read payments', 403);
  const invoice = await stmt(db, `SELECT i.*,${invoiceBalanceSql('i')} balance_cents FROM b_invoices i JOIN b_clients c ON c.id=i.client_id WHERE i.id=? AND i.status='issued' AND i.erased_at IS NULL AND c.erased_at IS NULL AND c.lifecycle='active' AND c.merged_into IS NULL`, invoiceId).first<Data>();
  insist(invoice, 'Issued invoice not found', 404); await job(db, actor, invoice.job_id); return invoice;
}
export async function invoicePayments(env: Bindings, actor: Actor, invoiceId: string) {
  const invoice=await invoiceFor(env.DB, actor, invoiceId, false);
  const reserved=await stmt(env.DB,"SELECT COALESCE(sum(amount_cents),0) cents FROM b_provider_payments WHERE invoice_id=? AND state IN ('creating','pending','requires_action','held')",invoiceId).first<Data>();
  return { availableCents:Math.max(0,invoice.balance_cents-Number(reserved!.cents)),configured: Boolean(env.STRIPE_SECRET_KEY), payments: await rows(env.DB, 'SELECT id,state,kind,amount_cents,refunded_cents,fee_cents,net_cents,provider_id,created_at,failure_code FROM b_provider_payments WHERE invoice_id=? ORDER BY created_at', invoiceId),
    mandates: await rows(env.DB, `SELECT m.id,m.status,m.kind,m.last4,m.max_cents,m.authorized_at,max(0,m.max_cents-COALESCE((SELECT sum(p.amount_cents) FROM b_provider_payments p WHERE p.mandate_id=m.id AND p.state NOT IN ('failed','returned')),0)) remaining_cents FROM b_payment_mandates m WHERE m.invoice_id=? ORDER BY m.authorized_at`, invoiceId) };
}
const reservedSql = `COALESCE((SELECT sum(p.amount_cents) FROM b_provider_payments p WHERE p.invoice_id=i.id AND p.state IN ('creating','pending','requires_action','held')),0)`;
async function reserve(env: Bindings, invoice: Data, amount: number, requestKey: string, who: string, actor?: Actor, mandate?: Data, portal?: Data) {
  const db = env.DB, prior = await stmt(db, 'SELECT * FROM b_provider_payments WHERE request_key=?', requestKey).first<Data>();
  if (prior) { insist(prior.invoice_id === invoice.id && prior.amount_cents === amount && prior.created_by === who, 'Collection request changed', 409); return prior; }
  const paymentId = id(), at = now(), [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_invoices i JOIN b_clients c ON c.id=i.client_id WHERE i.id=? AND i.status='issued' AND i.erased_at IS NULL AND c.erased_at IS NULL AND c.lifecycle='active' AND ${invoiceBalanceSql('i')}-${reservedSql}>=?)`, invoice.id, amount);
  const changes = [check, stmt(db, `INSERT INTO b_provider_payments(id,invoice_id,client_id,amount_cents,request_key,revision,created_by,created_at,updated_at,mandate_id) VALUES(?,?,?,?,?,?,?,?,?,?)`, paymentId, invoice.id, invoice.client_id, amount, requestKey, id(), who, at, at, mandate?.id ?? null), release,
    stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), who, 'payment.authorized', invoice.id, `${paymentId}; explicit collection USD ${(amount / 100).toFixed(2)}`, at)];
  if(portal){
    const [valid,done]=guard(db,`EXISTS(SELECT 1 FROM b_invoice_deliveries d JOIN b_client_contacts c ON c.id=d.contact_id WHERE d.id=? AND d.revoked_at IS NULL AND d.expires_at>? AND c.revision=d.contact_revision AND c.active=1 AND c.authorized=1 AND c.portal=1 AND c.email_consent=1 AND EXISTS(SELECT 1 FROM json_each(c.roles) WHERE value='billing'))`,portal.id,now());changes.unshift(valid);changes.push(done);
  }
  if (mandate) {
    const [valid, done] = guard(db, `EXISTS(SELECT 1 FROM b_payment_mandates m JOIN b_client_contacts c ON c.id=m.contact_id WHERE m.id=? AND m.invoice_id=? AND m.status='active' AND c.revision=m.contact_revision AND c.active=1 AND c.authorized=1 AND c.portal=1 AND EXISTS(SELECT 1 FROM json_each(c.roles) WHERE value='billing') AND m.max_cents>=?+COALESCE((SELECT sum(p.amount_cents) FROM b_provider_payments p WHERE p.mandate_id=m.id AND p.state NOT IN ('failed','returned')),0))`, mandate.id, invoice.id, amount);
    changes.unshift(valid); changes.push(done);
  }
  if (actor) await atomic(db, actor, billed(db, actor, changes)); else await db.batch(changes);
  return (await stmt(db, 'SELECT * FROM b_provider_payments WHERE id=?', paymentId).first<Data>())!;
}
export async function paymentLink(env: Bindings, actor: Actor, invoiceId: string, body: Data) {
  insist(env.STRIPE_SECRET_KEY,'Stripe is not configured',409);
  const invoice = await invoiceFor(env.DB, actor, invoiceId);
  const amount = integer(body.amountCents ?? invoice.balance_cents, 'Payment in USD cents', 50, invoice.balance_cents);
  const payment = await reserve(env, invoice, amount, id(), actor.email, actor);
  const origin = runtimeBindings(env).AUTH_ORIGIN;
  return checkout(env, invoice, payment, `${origin}/app`, false);
}
async function checkout(env: Bindings, invoice: Data, payment: Data, returnUrl: string, save: boolean, customer?: string) {
  const session = await stripe(env, 'checkout/sessions', {
    mode: 'payment', success_url: returnUrl, cancel_url: returnUrl,
    'adaptive_pricing[enabled]':'false','wallet_options[link][display]':'never',
    'allowed_payment_method_types[0]': 'card', 'allowed_payment_method_types[1]': 'us_bank_account',
    'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(payment.amount_cents),
    'line_items[0][price_data][product_data][name]': `Invoice ${invoice.number}`, 'line_items[0][quantity]': '1',
    'metadata[blotter_payment_id]': payment.id, 'payment_intent_data[metadata][blotter_payment_id]': payment.id,
    ...(customer ? { customer } : {}), ...(save ? { 'payment_intent_data[setup_future_usage]': 'off_session' } : {}),
  }, `blotter-checkout-${payment.id}`);
  await stmt(env.DB, 'UPDATE b_provider_payments SET session_id=?,customer_id=?,updated_at=? WHERE id=?', session.id, customer ?? null, now(), payment.id).run();
  return { url: session.url, paymentId: payment.id };
}
export async function portalPayment(env: Bindings, token: string, body: Data) {
  insist(env.STRIPE_SECRET_KEY,'Stripe is not configured',409);
  const { delivery, invoice } = await invoicePortalContext(env.DB, token);
  insist(body.confirm === true, 'Explicit authorization is required');
  const current = await stmt(env.DB, `SELECT ${invoiceBalanceSql('i')} balance FROM b_invoices i WHERE i.id=?`, invoice.id).first<Data>();
  const amount = integer(body.amountCents, 'Payment in USD cents', 50, current!.balance), who = `Invoice billing link for ${delivery.contact_id} (identity not verified)`;
  const requestKey = `portal:${invoice.id}:${text(body.requestId, 'Request identifier', 100)}`;
  const prior = await stmt(env.DB,'SELECT * FROM b_provider_payments WHERE request_key=?',requestKey).first<Data>();
  if(prior){insist(prior.amount_cents===amount && Boolean(prior.mandate_id)===(body.saveMethod===true),'Payment authorization changed',409);return checkout(env,invoice,prior,`${runtimeBindings(env).AUTH_ORIGIN}/invoice/${token}`,Boolean(prior.mandate_id),prior.customer_id??undefined);}
  let mandate: Data | undefined, customer: string | undefined;
  if (body.saveMethod === true) {
    insist(body.authorizeSaved === true, 'Authorize the saved method separately');
    const mid = id(), at = now();
    const c = await stripe(env, 'customers', { 'metadata[blotter_client_id]': invoice.client_id }, `blotter-customer-${invoice.client_id}`); customer = c.id;
    const authorization = `I authorize this saved method for staff-initiated collections of invoice ${invoice.number}, up to USD ${(current!.balance / 100).toFixed(2)} in total. No scheduled or other invoice charges. I can revoke this authorization.`;
    await stmt(env.DB, `INSERT INTO b_payment_mandates(id,invoice_id,client_id,contact_id,contact_revision,customer_id,max_cents,authorization,authorized_by,authorized_at) VALUES(?,?,?,?,?,?,?,?,?,?)`, mid, invoice.id, invoice.client_id, delivery.contact_id, delivery.contact_revision, customer, current!.balance, authorization, who, at).run();
    mandate = { id: mid };
  }
  await invoicePortalContext(env.DB,token);
  const payment = await reserve(env, invoice, amount, requestKey, who, undefined, undefined, delivery);
  if (mandate) await stmt(env.DB, 'UPDATE b_provider_payments SET mandate_id=? WHERE id=? AND mandate_id IS NULL', mandate.id, payment.id).run();
  return checkout(env, invoice, payment, `${runtimeBindings(env).AUTH_ORIGIN}/invoice/${token}`, body.saveMethod === true, customer);
}
export async function quickCollect(env: Bindings, actor: Actor, invoiceId: string, body: Data) {
  const invoice = await invoiceFor(env.DB, actor, invoiceId), mandate = await stmt(env.DB, "SELECT * FROM b_payment_mandates WHERE id=? AND invoice_id=? AND status='active'", body.mandateId ?? '', invoiceId).first<Data>();
  insist(mandate, 'PAY-001 requires an active client-authorized saved method for this invoice', 409);
  const requestKey=`collect:${invoiceId}:${text(body.requestId,'Request identifier',100)}`;
  const prior=await stmt(env.DB,'SELECT * FROM b_provider_payments WHERE request_key=?',requestKey).first<Data>();
  if(prior){insist(prior.mandate_id===mandate.id && prior.created_by===actor.email && (body.amountCents===undefined || Number(body.amountCents)===prior.amount_cents),'Collection request changed',409);return reconcilePayment(env,prior.id,undefined,actor.email);}
  insist(invoice.collection_hold!=='disputed' && !await stmt(env.DB,"SELECT 1 FROM b_provider_payments WHERE invoice_id=? AND state='disputed'",invoiceId).first(),'Resolve the invoice dispute before collection',409);
  const amount = integer(body.amountCents ?? invoice.balance_cents, 'Collection in USD cents', 50, invoice.balance_cents);
  const payment = await reserve(env, invoice, amount, requestKey, actor.email, actor, mandate);
  if (payment.provider_id) return reconcilePayment(env, payment.id, undefined, actor.email);
  insist(await stmt(env.DB, "SELECT 1 FROM b_payment_mandates WHERE id=? AND status='active'", mandate.id).first(), 'Authorization revoked', 409);
  try {
    const pi = await stripe(env, 'payment_intents', { amount: String(amount), currency: 'usd', customer: mandate.customer_id, payment_method: mandate.method_id, confirm: 'true', off_session: 'true', 'allowed_payment_method_types[0]': mandate.kind,
      'metadata[blotter_payment_id]': payment.id }, `blotter-collect-${payment.id}`);
    await stmt(env.DB, 'UPDATE b_provider_payments SET provider_id=? WHERE id=?', pi.id, payment.id).run();
  } catch (error: any) {
    if (error.detail?.paymentIntent) await stmt(env.DB, 'UPDATE b_provider_payments SET provider_id=? WHERE id=?', error.detail.paymentIntent, payment.id).run();
    else { await stmt(env.DB, "UPDATE b_provider_payments SET state='held',failure_code='provider_outcome_unresolved' WHERE id=?", payment.id).run(); throw error; }
  }
  return reconcilePayment(env, payment.id, undefined, actor.email);
}
export async function actOnPayment(env: Bindings, actor: Actor, paymentId: string, body: Data, refund = false) {
  const payment = await stmt(env.DB, 'SELECT * FROM b_provider_payments WHERE id=?', paymentId).first<Data>(); insist(payment, 'Payment not found', 404);
  await invoiceFor(env.DB, actor, payment.invoice_id);
  if (refund) {
    insist(payment.state === 'settled' && !payment.restored, 'Only a confirmed payment can be refunded', 409);
    const amount = integer(body.amountCents, 'Refund in USD cents', 1, payment.net_cents), reason = text(body.reason, 'Refund reason', 1000);
    const requestId = text(body.requestId, 'Refund request identifier', 100);
    await atomic(env.DB, actor, billed(env.DB, actor, [audit(env.DB, actor, 'payment.refund_authorized', payment.invoice_id, `${payment.provider_id}; ${amount} USD cents; ${reason}`)]));
    await stripe(env, 'refunds', { payment_intent: payment.provider_id, amount: String(amount) }, `blotter-refund-${payment.id}-${requestId}`);
  }
  return reconcilePayment(env, payment.id, undefined, actor.email);
}
export async function revokeMandate(env: Bindings, actor: Actor, mandateId: string, body: Data) {
  const mandate = await stmt(env.DB, 'SELECT * FROM b_payment_mandates WHERE id=?', mandateId).first<Data>(); insist(mandate, 'Authorization not found', 404);
  await invoiceFor(env.DB, actor, mandate.invoice_id);
  const reason = text(body.reason, 'Revocation reason', 1000);
  await atomic(env.DB, actor, billed(env.DB, actor, [stmt(env.DB, "UPDATE b_payment_mandates SET status='revoked',revoked_at=? WHERE id=?", now(), mandate.id), audit(env.DB, actor, 'payment.mandate_revoked', mandate.invoice_id, `${mandate.id}; ${reason}`)]));
  if (mandate.method_id) await stripe(env, `payment_methods/${mandate.method_id}/detach`, {}, `blotter-revoke-${mandate.id}`);
  return { id: mandate.id, status: 'revoked' };
}

export async function portalRevokeMandate(env:Bindings,token:string,mandateId:string,body:Data){
 const {delivery,invoice}=await invoicePortalContext(env.DB,token);
 const mandate=await stmt(env.DB,'SELECT * FROM b_payment_mandates WHERE id=? AND invoice_id=? AND contact_id=?',mandateId,invoice.id,delivery.contact_id).first<Data>();insist(mandate,'Authorization not found',404);
 const reason=text(body.reason,'Revocation reason',1000),at=now();
 await env.DB.batch([stmt(env.DB,"UPDATE b_payment_mandates SET status='revoked',revoked_at=? WHERE id=?",at,mandate.id),stmt(env.DB,'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)',id(),`Invoice billing link for ${delivery.contact_id} (identity not verified)`,'payment.mandate_revoked',invoice.id,`${mandate.id}; ${reason}`,at)]);
 if(mandate.method_id)await stripe(env,`payment_methods/${mandate.method_id}/detach`,{},`blotter-revoke-${mandate.id}`);
 return {id:mandate.id,status:'revoked'};
}
