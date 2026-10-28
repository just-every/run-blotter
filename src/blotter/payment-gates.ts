// BILL-025 payment gates: the firm's own work product (a deliverable) is withheld from the client
// portal until the invoice it names is paid. Only deliverables can be gated: a record the client
// supplied is never withheld (Circular 230 §10.28). Paid means the issued invoice's gross is covered
// by credits and deposits that count under the firm's ACH policy; a write-off does not release a gate,
// only a partner override with a reason does.
import { invoiceHuman, billed } from './invoices-sources';
import { invoiceNumber } from './invoices-pdf';
import { paymentPolicy } from './payment-policy';
import { atomic, audit, guard, id, insist, job, now, rows, stmt, text, type Actor, type Data } from './model';
import { canAccessClient } from './permissions';

/** True SQL when the file ref (bound once) is a deliverable version whose gate is active, unpaid and not overridden. */
export const gateLockedSql = `EXISTS(SELECT 1 FROM b_payment_gates g WHERE g.removed_at IS NULL AND g.deliverable_id=(SELECT v.deliverable_id FROM b_deliverable_versions v WHERE v.id=substr(?,13))
  AND NOT EXISTS(SELECT 1 FROM b_payment_overrides o WHERE o.kind='gate' AND o.gate_id=g.id AND o.revoked_at IS NULL)
  AND NOT EXISTS(SELECT 1 FROM b_invoices i WHERE i.id=g.invoice_id AND i.status='issued' AND i.erased_at IS NULL AND i.subtotal_cents+i.tax_cents<=COALESCE((SELECT sum(u.amount_cents)
    FROM b_invoice_credit_uses u JOIN b_invoice_credits c ON c.id=u.credit_id WHERE u.invoice_id=i.id
    AND (c.kind='credit' OR c.settlement='settled' OR COALESCE((SELECT ach_unlock FROM b_payment_policy WHERE id=1),'settled')='pending')),0)+COALESCE((SELECT sum(p.net_cents+CASE WHEN p.state='pending' AND p.kind='us_bank_account'
      AND COALESCE((SELECT ach_unlock FROM b_payment_policy WHERE id=1),'settled')='pending' THEN max(0,p.amount_cents-p.refunded_cents) ELSE 0 END)
      FROM b_provider_payments p WHERE p.invoice_id=i.id),0)))`;

/** What a gate needs right now, from the invoice, its applied receipts and the firm's ACH policy. */
export async function gateState(db: D1Database, gate: Data) {
  const policy = await paymentPolicy(db);
  const invoice = await stmt(db, 'SELECT id,number,status,subtotal_cents+tax_cents gross_cents,erased_at FROM b_invoices WHERE id=?', gate.invoice_id).first<Data>();
  const uses = await rows(db, 'SELECT u.amount_cents,c.kind,c.method,c.settlement FROM b_invoice_credit_uses u JOIN b_invoice_credits c ON c.id=u.credit_id WHERE u.invoice_id=?', gate.invoice_id);
  const payments = await rows(db, 'SELECT state,kind,amount_cents,refunded_cents,net_cents FROM b_provider_payments WHERE invoice_id=?', gate.invoice_id);
  const pendingProviderCents = payments.filter(p => p.state === 'pending' && p.kind === 'us_bank_account').reduce((n, p) => n + Math.max(0, Number(p.amount_cents) - Number(p.refunded_cents)), 0);
  const providerCents = payments.reduce((n, p) => n + Number(p.net_cents), 0) + (policy.achUnlock === 'pending' ? pendingProviderCents : 0);
  const counted = providerCents + uses.filter(u => u.kind === 'credit' || u.settlement === 'settled' || policy.achUnlock === 'pending').reduce((n, u) => n + Number(u.amount_cents), 0);
  const pending = pendingProviderCents + uses.filter(u => u.settlement === 'pending').reduce((n, u) => n + Number(u.amount_cents), 0);
  const override = await stmt(db, "SELECT id,reason,approved_by,approved_at FROM b_payment_overrides WHERE kind='gate' AND gate_id=? AND revoked_at IS NULL ORDER BY approved_at DESC LIMIT 1", gate.id).first<Data>();
  const paid = invoice?.status === 'issued' && !invoice.erased_at && Number(invoice.gross_cents) <= counted;
  const remainingCents = Math.max(0, Number(invoice?.gross_cents ?? 0) - counted);
  return { id: gate.id, deliverableId: gate.deliverable_id, invoiceId: gate.invoice_id, invoiceNumber: invoice?.number ? invoiceNumber(invoice.number) : null, reason: gate.reason, createdBy: gate.created_by, createdAt: gate.created_at,
    removedAt: gate.removed_at ?? null, locked: !gate.removed_at && !paid && !override, releasedBy: gate.removed_at ? 'removed' : paid ? 'payment' : override ? 'override' : null,
    remainingCents, pendingCents: pending, achUnlock: policy.achUnlock, override: override ?? null };
}
export async function gatesForJob(db: D1Database, jobId: string) {
  const out = new Map<string, Data>();
  for (const gate of await rows(db, 'SELECT g.* FROM b_payment_gates g JOIN b_deliverables d ON d.id=g.deliverable_id WHERE d.job_id=? AND g.removed_at IS NULL', jobId)) out.set(gate.deliverable_id, await gateState(db, gate));
  return out;
}
/** The refusal a client sees for a locked file, or null when the file may be released. */
export async function gateRefusal(db: D1Database, fileKey: string) {
  if (!fileKey.startsWith('deliverable:')) return null;
  const locked = await stmt(db, `SELECT ${gateLockedSql} locked`, fileKey).first<Data>();
  if (!locked?.locked) return null;
  const gate = await stmt(db, 'SELECT g.* FROM b_payment_gates g JOIN b_deliverable_versions v ON v.deliverable_id=g.deliverable_id WHERE v.id=? AND g.removed_at IS NULL', fileKey.slice(12)).first<Data>();
  const state = await gateState(db, gate!);
  return `This file is locked until invoice ${state.invoiceNumber} is paid${state.pendingCents ? ' (a pending ACH payment is not yet settled)' : ''}.`;
}

export async function createPaymentGate(db: D1Database, actor: Actor, jobId: string, body: Data) {
  invoiceHuman(actor);
  const j = await job(db, actor, jobId), reason = text(body.reason, 'Reason for the payment gate', 1000);
  const deliverable = await stmt(db, 'SELECT id,title FROM b_deliverables WHERE id=? AND job_id=?', text(body.deliverableId, 'Deliverable', 100), j.id).first<Data>();
  insist(deliverable, 'Only the firm\'s own deliverables can be gated; a record the client supplied is never withheld', 404);
  const invoice = await stmt(db, "SELECT id,number,client_id FROM b_invoices WHERE id=? AND status='issued' AND erased_at IS NULL", text(body.invoiceId, 'Invoice', 100)).first<Data>();
  insist(invoice && invoice.client_id === j.client_id && await canAccessClient(db, actor.email, j.client_id), 'Choose an issued invoice of this client', 409);
  insist(!await stmt(db, 'SELECT 1 FROM b_payment_gates WHERE deliverable_id=? AND removed_at IS NULL', deliverable.id).first(), 'This deliverable is already gated', 409);
  const gateId = id(), [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_invoices WHERE id=? AND status='issued' AND erased_at IS NULL) AND EXISTS(SELECT 1 FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL)", invoice.id, j.client_id);
  await atomic(db, actor, billed(db, actor, [check,
    stmt(db, 'INSERT INTO b_payment_gates(id,deliverable_id,invoice_id,client_id,reason,created_by,created_at) VALUES(?,?,?,?,?,?,?)', gateId, deliverable.id, invoice.id, j.client_id, reason, actor.email, now()),
    release, audit(db, actor, 'payment.gate_created', gateId, `${deliverable.title} until ${invoiceNumber(invoice.number)} is paid; ${reason}`)]));
  return gateState(db, (await stmt(db, 'SELECT * FROM b_payment_gates WHERE id=?', gateId).first<Data>())!);
}

async function liveGate(db: D1Database, actor: Actor, gateId: string) {
  const gate = await stmt(db, 'SELECT * FROM b_payment_gates WHERE id=? AND removed_at IS NULL', gateId).first<Data>();
  insist(gate && await canAccessClient(db, actor.email, gate.client_id), 'Payment gate not found', 404);
  return gate;
}
export async function removePaymentGate(db: D1Database, actor: Actor, gateId: string, body: Data) {
  invoiceHuman(actor);
  const gate = await liveGate(db, actor, gateId), reason = text(body.reason, 'Reason to remove the payment gate', 1000);
  await atomic(db, actor, billed(db, actor, [stmt(db, 'UPDATE b_payment_gates SET removed_by=?,removed_at=?,remove_reason=? WHERE id=? AND removed_at IS NULL', actor.email, now(), reason, gate.id),
    audit(db, actor, 'payment.gate_removed', gate.id, reason)]));
  return { id: gate.id, removed: true };
}
/** A partner releases (or relocks) one gated deliverable with a recorded reason. */
export async function overridePaymentGate(db: D1Database, actor: Actor, gateId: string, body: Data) {
  invoiceHuman(actor);
  const gate = await liveGate(db, actor, gateId), reason = text(body.reason, 'Reason', 1000), live = await stmt(db, "SELECT id FROM b_payment_overrides WHERE kind='gate' AND gate_id=? AND revoked_at IS NULL", gate.id).first<Data>(), at = now();
  if (body.revoke === true) {
    insist(live, 'This gate has no override', 409);
    await atomic(db, actor, billed(db, actor, [stmt(db, 'UPDATE b_payment_overrides SET revoked_by=?,revoked_at=?,revoke_reason=? WHERE id=? AND revoked_at IS NULL', actor.email, at, reason, live.id), audit(db, actor, 'payment.gate_relocked', gate.id, reason)]));
  } else {
    insist(!live, 'This gate is already overridden', 409);
    await atomic(db, actor, billed(db, actor, [stmt(db, "INSERT INTO b_payment_overrides(id,kind,gate_id,client_id,reason,approved_by,approved_at) VALUES(?,'gate',?,?,?,?,?)", id(), gate.id, gate.client_id, reason, actor.email, at),
      audit(db, actor, 'payment.gate_overridden', gate.id, reason)]));
  }
  return gateState(db, gate);
}
