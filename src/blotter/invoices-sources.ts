// Invoice entitlements are approved independently of work completion. Time and
// expenses keep their existing approval and integer-cent snapshots.
import { unbilled } from './billing';
import { atomic, audit, canBill, guard, id, insist, integer, job, need, now, rows, stmt, text, type Actor, type Data } from './model';
import { accessActor, delegated } from './permissions';

/** Prepare, issue, send and void belong to the principal and to financial-authority holders (ct, 22 Oct). */
export function invoiceHuman(actor: Actor) {
  insist(canBill(actor), 'Only the principal or a financial-authority holder can do this', 403);
  insist(actor.channel === 'person' && !actor.automation, 'A person must explicitly approve this invoice action', 403);
}
/** Selecting the invoice authority stays with the principal. */
export function principalHuman(actor: Actor) {
  need(actor, 'owner');
  insist(actor.channel === 'person' && !actor.automation, 'The principal must explicitly approve this invoice action', 403);
}
/** Every holder write re-reads the delegation inside its own batch; the principal's batches are unchanged. */
export const billed = (db: D1Database, actor: Actor, statements: D1PreparedStatement[]) => delegated(db, actor, 'financial_authority', statements);
/** The person who may act for an operator right now: the principal, or a member who still holds financial authority. */
export async function liveBillingActor(db: D1Database, operatorId: string | null): Promise<Actor | null> {
  const o = operatorId ? await stmt(db, "SELECT id,email,display_name,role FROM oa_operators WHERE id=? AND status='active'", operatorId).first<Data>() : null;
  if (!o) return null;
  const member = o.role === 'owner' ? null : await stmt(db, 'SELECT role FROM b_members WHERE email=? AND active=1', o.email).first<Data>();
  const role = o.role === 'owner' ? 'owner' : member?.role;
  if (!role) return null;
  const actor = await accessActor(db, { id: o.id, email: o.email, name: o.display_name ?? o.email, role, channel: 'person' });
  return canBill(actor) && !actor.readOnly ? actor : null;
}

export const activeInvoiceClientSql = "EXISTS(SELECT 1 FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL)";
export async function invoiceAuthority(db: D1Database) {
  const settings = await stmt(db, 'SELECT * FROM b_invoice_settings WHERE id=1').first<Data>();
  insist(settings?.authority === 'blotter', 'The principal must select Blotter as the invoice authority first', 409);
  return settings;
}
export function invoiceAuthorityGuard(db: D1Database, revision: string) {
  return guard(db, "EXISTS(SELECT 1 FROM b_invoice_settings WHERE id=1 AND authority='blotter' AND revision=?)", revision);
}

export async function authorizeInvoiceEntitlement(db: D1Database, actor: Actor, body: Data) {
  invoiceHuman(actor);
  const authority = await invoiceAuthority(db), j = await job(db, actor, text(body.jobId, 'Job', 100));
  insist(body.currency === undefined || body.currency === 'USD', 'Native fee entitlements must be authorized in USD');
  insist(j.currency === 'USD', 'Native invoices accept USD sources only; historical currency is never converted', 409);
  insist(['fixed', 'milestone', 'proration'].includes(body.kind), 'Choose fixed, milestone or proration');
  const eid = id(), reference = text(body.reference, 'Entitlement reference', 200), description = text(body.description, 'Scope or milestone', 500);
  const amountCents = integer(body.amountCents, 'Authorized fee in USD cents', 1), authorization = text(body.authorization, 'Fee authorization and source', 2000);
  const sourceKey = body.kind === 'fixed' ? `fee:${j.id}` : `ent:${eid}`;
  const [check, release] = guard(db, activeInvoiceClientSql, j.client_id), [authorized, done] = invoiceAuthorityGuard(db, authority.revision);
  await atomic(db, actor, billed(db, actor, [check, authorized,
    stmt(db, `INSERT INTO b_invoice_entitlements(id,client_id,job_id,kind,reference,description,amount_cents,source_key,authorized_by,authorized_at,authorization) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      eid, j.client_id, j.id, body.kind, reference, description, amountCents, sourceKey, actor.email, now(), authorization),
    done, release, audit(db, actor, 'invoice.entitlement_authorized', eid, `${reference}; ${amountCents} USD cents; ${authorization}`)]));
  return { id: eid, sourceKey, amountCents, currency: 'USD' };
}

/** The same reservation key is used for exports and invoices, even for a fixed fee authorized before sign-off. */
export async function availableInvoiceSources(db: D1Database, jobId?: string) {
  const reserved = new Set((await rows(db, 'SELECT source_key FROM b_invoice_sources')).map(s => s.source_key));
  const native = await rows(db, `SELECT e.id entitlement_id,e.source_key,e.kind,e.id source_id,e.job_id,e.authorized_at date,e.authorized_by person,
    e.description,e.amount_cents,e.currency,e.authorization,e.reference,e.retainer_id,e.period,j.title job,j.period_label,c.name client
    FROM b_invoice_entitlements e JOIN b_jobs j ON j.id=e.job_id JOIN b_clients c ON c.id=e.client_id
    WHERE NOT EXISTS(SELECT 1 FROM b_invoice_sources s WHERE s.source_key=e.source_key)
    AND NOT EXISTS(SELECT 1 FROM b_export_sources s WHERE s.source_key=e.source_key) ORDER BY e.authorized_at,e.id`);
  return [...native, ...(await unbilled(db)).filter(l => l.kind !== 'fee' && !reserved.has(l.source_key))]
    .filter(l => l.currency === 'USD' && (!jobId || l.job_id === jobId));
}

/** Source approval is checked again in the batch that reserves or issues a document. */
export function invoiceSourceGuards(db: D1Database, lines: Data[]) {
  return lines.flatMap(l => {
    const sql = l.entitlement_id ? 'EXISTS(SELECT 1 FROM b_invoice_entitlements WHERE id=? AND source_key=? AND amount_cents=?)'
      : l.kind === 'time' ? "EXISTS(SELECT 1 FROM b_time t JOIN b_time_status s ON s.entry_id=t.id WHERE t.id=? AND s.status='approved' AND t.billable=1 AND t.amount_cents=?)"
      : l.kind === 'adjustment' ? "EXISTS(SELECT 1 FROM b_time_adjustments a JOIN b_time t ON t.id=a.entry_id JOIN b_time_status s ON s.entry_id=t.id WHERE a.id=? AND s.status='approved' AND t.billable=1 AND a.amount_cents=?)"
      : "EXISTS(SELECT 1 FROM b_expenses WHERE id=? AND status='approved' AND billable=1 AND charge_cents=?)";
    return guard(db, sql, ...(l.entitlement_id ? [l.entitlement_id, l.source_key, l.amount_cents] : [l.source_id, l.amount_cents]));
  });
}

/** Client erasure and expiry must refuse any non-void invoice that still has an open balance. */
export async function invoiceOpenBalances(db: D1Database, clientId: string) {
  const invoices = await rows(db, `SELECT i.id,i.number,i.title,i.owner_email,i.due_date,'invoice' kind,
    i.subtotal_cents+i.tax_cents-COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u WHERE u.invoice_id=i.id),0) balance_cents
    FROM b_invoices i WHERE i.client_id=? AND i.status='issued' AND i.subtotal_cents+i.tax_cents>COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u WHERE u.invoice_id=i.id),0) ORDER BY i.due_date,i.id`, clientId);
  const liabilities = await rows(db, `SELECT c.id,NULL number,'Unapplied '||c.kind||': '||c.reference title,c.recorded_by owner_email,NULL due_date,c.kind,
    c.amount_cents-COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=c.id AND i.status='issued'),0) balance_cents
    FROM b_invoice_credits c WHERE c.client_id=? AND c.amount_cents>COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=c.id AND i.status='issued'),0) ORDER BY c.recorded_at,c.id`, clientId);
  return [...invoices, ...liabilities];
}
export const noInvoiceOpenBalanceSql = `NOT EXISTS(SELECT 1 FROM b_invoices i WHERE i.client_id=? AND i.status='issued' AND i.subtotal_cents+i.tax_cents>COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u WHERE u.invoice_id=i.id),0))
 AND NOT EXISTS(SELECT 1 FROM b_invoice_credits c WHERE c.client_id=? AND c.amount_cents>COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=c.id AND i.status='issued'),0))`;
