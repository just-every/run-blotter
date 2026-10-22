// BILL-003 write-offs: the principal or a financial-authority holder, in a native session,
// approves a stated USD amount of an issued invoice's open balance with a reason. The record
// is immutable; the issued invoice, its PDF and its totals are never rewritten, only the
// balance and the reports computed from it change.
import { atomic, audit, guard, id, insist, integer, now, rows, stmt, text, type Actor, type Data } from './model';
import { invoiceNumber } from './invoices-pdf';
import { activeInvoiceClientSql, billed, invoiceBalanceSql, invoiceHuman } from './invoices-sources';
import { canAccessClient } from './permissions';

export const invoiceWriteOffs = (db: D1Database, invoiceId: string) => rows(db, 'SELECT id,amount_cents,currency,reason,approved_by,approved_at FROM b_invoice_writeoffs WHERE invoice_id=? ORDER BY approved_at,id', invoiceId);

export async function approveInvoiceWriteOff(db: D1Database, actor: Actor, invoiceId: string, body: Data) {
  invoiceHuman(actor);
  const invoice = await stmt(db, `SELECT i.id,i.client_id,i.number,${invoiceBalanceSql('i')} balance_cents FROM b_invoices i WHERE i.id=? AND i.status='issued' AND i.erased_at IS NULL`, invoiceId).first<Data>();
  insist(invoice && await canAccessClient(db, actor.email, invoice.client_id), 'Issued invoice not found', 404);
  const amountCents = integer(body.amountCents, 'Write-off in USD cents', 1), reason = text(body.reason, 'Write-off reason', 2000);
  insist(amountCents <= invoice.balance_cents, `A write-off cannot exceed the open balance of ${invoice.balance_cents} USD cents`, 409);
  const writeOffId = id(), [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_invoices i WHERE i.id=? AND i.status='issued' AND i.erased_at IS NULL AND ${invoiceBalanceSql('i')}>=?) AND ` + activeInvoiceClientSql, invoice.id, amountCents, invoice.client_id);
  await atomic(db, actor, billed(db, actor, [check,
    stmt(db, 'INSERT INTO b_invoice_writeoffs(id,invoice_id,client_id,amount_cents,reason,approved_by,approved_at) VALUES(?,?,?,?,?,?,?)', writeOffId, invoice.id, invoice.client_id, amountCents, reason, actor.email, now()),
    release, audit(db, actor, 'invoice.written_off', invoice.id, `${invoiceNumber(invoice.number)}; ${amountCents} USD cents; ${reason}`)]));
  return { id: writeOffId, invoiceId: invoice.id, amountCents, balanceCents: invoice.balance_cents - amountCents };
}
