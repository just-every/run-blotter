// Provider notifications are hints: balances always come from the current authenticated provider object.
import type { Bindings } from '../auth.server';
import { digest, guard, id, insist, now, rows, stmt, type Data } from './model';
import { stripe, verifyStripe } from './stripe-provider';

const reference = (value: any) => typeof value === 'string' ? value : value?.id;
export async function reconcilePayment(env: Bindings, paymentId: string, event?: Data, actor = 'Stripe signed event') {
  const db = env.DB, payment = await stmt(db, 'SELECT * FROM b_provider_payments WHERE id=?', paymentId).first<Data>();
  insist(payment && !payment.restored, 'Payment is unavailable or restored history; no provider action is replayed', 409);
  insist(await stmt(db, 'SELECT 1 FROM b_invoices WHERE id=? AND erased_at IS NULL', payment.invoice_id).first(), 'Invoice no longer available', 409);
  let providerId = payment.provider_id;
  if (!providerId && payment.session_id) {
    const session = await stripe(env, `checkout/sessions/${payment.session_id}`);
    providerId = reference(session.payment_intent);
    if (!providerId && session.status !== 'expired') return payment;
    if (!providerId) {
      await db.batch([stmt(db, "UPDATE b_provider_payments SET state='failed',failure_code='checkout_expired',updated_at=?,revision=? WHERE id=? AND revision=?", now(), id(), payment.id, payment.revision)]);
      return stmt(db, 'SELECT * FROM b_provider_payments WHERE id=?', payment.id).first<Data>();
    }
  }
  insist(providerId, 'Provider confirmation is not available yet', 409);
  const pi = await stripe(env, `payment_intents/${providerId}?expand[]=latest_charge.balance_transaction&expand[]=payment_method`);
  insist(pi.metadata?.blotter_payment_id === payment.id && pi.amount === payment.amount_cents && pi.currency === 'usd', 'Provider payment does not match this invoice', 409);
  insist(!payment.provider_id || payment.provider_id === pi.id, 'Provider reference changed', 409);
  const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  let disputed = Boolean(charge?.disputed);
  if (disputed) {
    const disputes = await stripe(env, `disputes?charge=${encodeURIComponent(charge.id)}&limit=10`);
    disputed = disputes.data.some((d: Data) => d.status !== 'won' && d.status !== 'warning_closed');
  }
  const refunded = Number(charge?.amount_refunded ?? 0), method = typeof pi.payment_method === 'object' ? pi.payment_method : null;
  const kind = method?.type ?? charge?.payment_method_details?.type ?? payment.kind;
  const state = disputed ? 'disputed' : pi.status === 'succeeded' ? (refunded >= pi.amount_received ? 'refunded' : 'settled')
    : pi.status === 'processing' ? 'pending' : pi.status === 'requires_action' ? 'requires_action' : pi.last_payment_error ? (kind === 'us_bank_account' ? 'returned' : 'failed') : pi.status === 'canceled' ? 'failed' : 'pending';
  const net = state === 'settled' ? Math.max(0, Number(pi.amount_received) - refunded) : 0;
  const fee = Number(charge?.balance_transaction?.fee ?? payment.fee_cents), at = now(), revision = id();
  const [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_provider_payments WHERE id=? AND revision=? AND restored=0)', payment.id, payment.revision);
  const changes: D1PreparedStatement[] = [check,
    stmt(db, 'UPDATE b_provider_payments SET provider_id=?,customer_id=?,state=?,kind=?,refunded_cents=?,fee_cents=?,net_cents=?,failure_code=?,updated_at=?,revision=? WHERE id=?', pi.id, reference(pi.customer) ?? null, state, kind ?? null, refunded, fee, net, pi.last_payment_error?.code ?? null, at, revision, payment.id),
    stmt(db, 'INSERT INTO b_payment_observations(id,payment_id,state,net_cents,fee_cents,observed_at,provider_event_id) VALUES(?,?,?,?,?,?,?)', revision, payment.id, state, net, fee, at, event?.id ?? null),
  ];
  // A saved instrument becomes authority only after successful setup at the client-approved checkout.
  if (payment.mandate_id && state === 'settled' && method && pi.setup_future_usage === 'off_session') changes.push(
    stmt(db, `UPDATE b_payment_mandates SET status='active',method_id=?,customer_id=?,kind=?,last4=? WHERE id=? AND status='pending'
      AND EXISTS(SELECT 1 FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id WHERE c.id=b_payment_mandates.contact_id AND c.revision=b_payment_mandates.contact_revision AND c.active=1 AND c.authorized=1 AND c.portal=1 AND e.erased_at IS NULL AND e.lifecycle='active')`, method.id, reference(pi.customer), method.type, method[method.type]?.last4 ?? null, payment.mandate_id));
  if (event) changes.push(stmt(db, 'INSERT INTO b_payment_events(id,payment_id,payload_digest,event_type,received_at) VALUES(?,?,?,?,?)', event.id, payment.id, event.digest, event.type, at));
  if (state !== payment.state || net !== payment.net_cents || refunded !== payment.refunded_cents) changes.push(
    stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), actor, `payment.${state}`, payment.invoice_id,
      `${pi.id}; USD ${(payment.amount_cents / 100).toFixed(2)}; net USD ${(net / 100).toFixed(2)}; refund USD ${(refunded / 100).toFixed(2)}; fee USD ${(fee / 100).toFixed(2)}${pi.last_payment_error?.code ? '; ' + pi.last_payment_error.code : ''}`, at));
  changes.push(release);
  await db.batch(changes);
  return stmt(db, 'SELECT * FROM b_provider_payments WHERE id=?', payment.id).first<Data>();
}

export async function stripeEvent(env: Bindings, request: Request) {
  const raw = await request.text(); insist(raw.length <= 128_000, 'Event too large', 413);
  await verifyStripe(env, raw, request.headers.get('stripe-signature') ?? undefined);
  let event: Data; try { event = JSON.parse(raw); } catch { insist(false, 'Invalid Stripe event'); }
  insist(typeof event.id === 'string' && typeof event.type === 'string' && event.data?.object, 'Invalid Stripe event');
  const hash = await digest(raw), prior = await stmt(env.DB, 'SELECT payload_digest FROM b_payment_events WHERE id=?', event.id).first<Data>();
  if (prior) { insist(prior.payload_digest === hash, 'Event identifier reused with a different body', 409); return { received: true, replayed: true }; }
  const object = event.data.object;
  let payment = await stmt(env.DB, 'SELECT id FROM b_provider_payments WHERE provider_id=? OR session_id=?', object.payment_intent ?? object.id, object.id).first<Data>();
  if (!payment && object.metadata?.blotter_payment_id) payment = await stmt(env.DB, 'SELECT id FROM b_provider_payments WHERE id=?', object.metadata.blotter_payment_id).first<Data>();
  if (!payment) { await stmt(env.DB, 'INSERT INTO b_payment_events(id,payment_id,payload_digest,event_type,received_at) VALUES(?,NULL,?,?,?)', event.id, hash, event.type, now()).run(); return { received: true, ignored: true }; }
  await reconcilePayment(env, payment.id, { ...event, digest: hash });
  return { received: true, replayed: false };
}
