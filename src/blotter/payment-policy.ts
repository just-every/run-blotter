// BILL-025 firm payment policy and credit hold. The principal alone sets the policy: whether a
// pending ACH payment releases a gated file (default: settlement required) and the overdue-balance
// threshold that puts a client on credit hold (default: none). A hold never blocks work: it warns
// staff, and a partner (principal or financial-authority holder) can override it with a reason.
import { firmSettings, localClock } from './firm';
import { invoiceBalanceSql, invoiceHuman, billed } from './invoices-sources';
import { atomic, audit, canReadBilling, human, id, insist, integer, need, now, rows, stmt, text, type Actor, type Data } from './model';
import { canAccessClient } from './permissions';

export async function paymentPolicy(db: D1Database) {
  const p = await stmt(db, 'SELECT * FROM b_payment_policy WHERE id=1').first<Data>();
  return { achUnlock: (p?.ach_unlock ?? 'settled') as 'pending' | 'settled', holdThresholdCents: (p?.hold_threshold_cents ?? null) as number | null, holdGraceDays: Number(p?.hold_grace_days ?? 0),
    reason: p?.reason ?? null, setBy: p?.set_by ?? null, setAt: p?.set_at ?? null };
}
/** Staff who may read billing read the policy; others see only the warnings it produces. */
export async function readPaymentPolicy(db: D1Database, actor: Actor) {
  insist(canReadBilling(actor), 'Your role cannot perform this action', 403);
  return paymentPolicy(db);
}
export async function setPaymentPolicy(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  insist(body.achUnlock === 'pending' || body.achUnlock === 'settled', 'Choose whether a pending ACH payment or only a settled one releases a gated file');
  const threshold = body.holdThresholdCents === null || body.holdThresholdCents === undefined || body.holdThresholdCents === '' ? null : integer(body.holdThresholdCents, 'Credit hold threshold in USD cents', 1, 1_000_000_000);
  const grace = body.holdGraceDays === undefined ? 0 : integer(body.holdGraceDays, 'Credit hold grace days', 0, 365), reason = text(body.reason, 'Reason for this payment policy', 1000);
  await atomic(db, actor, [stmt(db, `INSERT INTO b_payment_policy(id,ach_unlock,hold_threshold_cents,hold_grace_days,reason,set_by,set_at) VALUES(1,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET ach_unlock=excluded.ach_unlock,hold_threshold_cents=excluded.hold_threshold_cents,hold_grace_days=excluded.hold_grace_days,reason=excluded.reason,set_by=excluded.set_by,set_at=excluded.set_at`,
    body.achUnlock, threshold, grace, reason, actor.email, now()),
    audit(db, actor, 'payment.policy_set', 'payment-policy', `ACH ${body.achUnlock === 'pending' ? 'pending releases' : 'settlement required'}; credit hold ${threshold === null ? 'off' : `at ${threshold} USD cents overdue after ${grace} days`}; ${reason}`)]);
  return paymentPolicy(db);
}

/** Overdue open balance of issued invoices past their due date plus the grace period, as of the firm's calendar day. */
export async function overdueBalance(db: D1Database, clientId: string, graceDays: number) {
  const today = localClock(await firmSettings(db), new Date()).localDate, cutoff = new Date(Date.parse(today + 'T00:00:00Z') - graceDays * 86_400_000).toISOString().slice(0, 10);
  const open = await rows(db, `SELECT i.id,i.number,i.due_date,${invoiceBalanceSql('i')} balance_cents FROM b_invoices i WHERE i.client_id=? AND i.status='issued' AND i.erased_at IS NULL AND i.due_date<? AND ${invoiceBalanceSql('i')}>0 ORDER BY i.due_date,i.id`, clientId, cutoff);
  return { overdueCents: open.reduce((n, i) => n + Number(i.balance_cents), 0), invoiceIds: open.map(i => i.id as string) };
}

/** The credit hold on a client: staff always see that it exists; the amounts only if they may read billing. */
export async function creditHold(db: D1Database, actor: Actor, clientId: string) {
  const policy = await paymentPolicy(db);
  if (policy.holdThresholdCents === null) return { configured: false, onHold: false, overridden: false, override: null, overdueCents: null, thresholdCents: null };
  const { overdueCents } = await overdueBalance(db, clientId, policy.holdGraceDays), past = overdueCents >= policy.holdThresholdCents;
  const override = past ? await stmt(db, "SELECT id,reason,approved_by,approved_at FROM b_payment_overrides WHERE kind='hold' AND client_id=? AND revoked_at IS NULL ORDER BY approved_at DESC LIMIT 1", clientId).first<Data>() : null;
  const seen = canReadBilling(actor);
  return { configured: true, onHold: past && !override, overridden: Boolean(past && override), override: past && override && seen ? override : null,
    overdueCents: seen ? overdueCents : null, thresholdCents: seen ? policy.holdThresholdCents : null };
}
/** The warning attached to a door that creates new work for a client on hold. */
export async function creditHoldWarnings(db: D1Database, actor: Actor, clientId: string) {
  const hold = await creditHold(db, actor, clientId);
  return hold.onHold ? [{ kind: 'credit_hold', message: `This client is on credit hold${hold.overdueCents === null ? '' : `: USD ${(hold.overdueCents / 100).toFixed(2)} is overdue`}. New work may proceed; a partner can override the hold with a reason.` }] : [];
}

/** A partner overrides or restores a client's credit hold; every change is audited with its reason. */
export async function overrideCreditHold(db: D1Database, actor: Actor, clientId: string, body: Data) {
  invoiceHuman(actor);
  insist(await stmt(db, 'SELECT 1 FROM b_clients WHERE id=? AND erased_at IS NULL AND merged_into IS NULL', clientId).first() && await canAccessClient(db, actor.email, clientId), 'Client not found', 404);
  const reason = text(body.reason, 'Reason', 1000), live = await stmt(db, "SELECT id FROM b_payment_overrides WHERE kind='hold' AND client_id=? AND revoked_at IS NULL", clientId).first<Data>(), at = now();
  if (body.revoke === true) {
    insist(live, 'This client has no credit-hold override', 409);
    await atomic(db, actor, billed(db, actor, [stmt(db, "UPDATE b_payment_overrides SET revoked_by=?,revoked_at=?,revoke_reason=? WHERE id=? AND revoked_at IS NULL", actor.email, at, reason, live.id),
      audit(db, actor, 'payment.hold_restored', clientId, reason)]));
  } else {
    insist(!live, 'This client already has a credit-hold override', 409);
    insist((await creditHold(db, actor, clientId)).onHold, 'This client is not on credit hold', 409);
    const overrideId = id();
    await atomic(db, actor, billed(db, actor, [stmt(db, "INSERT INTO b_payment_overrides(id,kind,gate_id,client_id,reason,approved_by,approved_at) VALUES(?,'hold',NULL,?,?,?,?)", overrideId, clientId, reason, actor.email, at),
      audit(db, actor, 'payment.hold_overridden', clientId, reason)]));
  }
  return creditHold(db, actor, clientId);
}
