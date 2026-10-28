// Current billing read model for the authenticated contact. This never reconciles
// with a provider or grants collection authority; it reads retained native outcomes.
import { invoiceNumber } from './invoices-pdf';
import { invoiceBalanceSql } from './invoices-sources';
import { id, now, stmt, type Data } from './model';
import type { Client } from './portal-session';

/** The invoice recipient frozen at issue is the scope for both statement and history. */
export const contactInvoicesSql = `i.client_id=? AND i.status='issued' AND i.erased_at IS NULL AND json_extract(i.snapshot,'$.recipient.id')=?`;

export async function portalBilling(db: D1Database, client: Client, clientId: string, contactId: string) {
  const at = now();
  // A D1 batch reads one consistent balance and payment view and attributes the read.
  // Only selected fields cross this door: no provider references or private failure details.
  const [issued, observed] = await db.batch([
    stmt(db, `SELECT i.id,i.number,i.title,i.issue_date,i.due_date,i.currency,i.total_cents,i.subtotal_cents+i.tax_cents gross_cents,
      COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u WHERE u.invoice_id=i.id),0) credits_cents,
      COALESCE((SELECT sum(w.amount_cents) FROM b_invoice_writeoffs w WHERE w.invoice_id=i.id),0) written_off_cents,
      COALESCE((SELECT sum(p.net_cents) FROM b_provider_payments p WHERE p.invoice_id=i.id),0) paid_cents,
      ${invoiceBalanceSql('i')} balance_cents FROM b_invoices i WHERE ${contactInvoicesSql} ORDER BY i.due_date,i.number`, clientId, contactId),
    stmt(db, `SELECT p.id,p.invoice_id,i.number,i.currency,p.amount_cents,p.refunded_cents,p.net_cents,p.state,p.kind,p.restored,o.observed_at
      FROM b_provider_payments p JOIN b_invoices i ON i.id=p.invoice_id AND i.client_id=p.client_id
      LEFT JOIN b_payment_observations o ON o.id=(SELECT x.id FROM b_payment_observations x WHERE x.payment_id=p.id ORDER BY x.observed_at DESC,x.rowid DESC LIMIT 1)
      WHERE ${contactInvoicesSql} ORDER BY p.created_at DESC,p.id`, clientId, contactId),
    stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)',
      id(), `client portal (${client.email})`, 'portal.billing_read', clientId, `contact ${contactId}; current recorded statement and payment history`, at),
  ]);
  const invoices = (issued.results as Data[]).map(i => ({ id: i.id, number: invoiceNumber(i.number), title: i.title, issueDate: i.issue_date, dueDate: i.due_date, currency: i.currency,
    totalCents: Number(i.gross_cents), documentTotalCents: Number(i.total_cents), creditsAppliedCents: Number(i.credits_cents), writtenOffCents: Number(i.written_off_cents), paidCents: Number(i.paid_cents), balanceCents: Number(i.balance_cents) }));
  const payments = (observed.results as Data[]).map(p => ({ id: p.id, invoiceId: p.invoice_id, invoiceNumber: invoiceNumber(p.number), currency: p.currency,
    kind: ['card', 'us_bank_account'].includes(p.kind) ? p.kind : null, state: p.state, amountCents: Number(p.amount_cents), refundedCents: Number(p.refunded_cents), netCents: Number(p.net_cents),
    lastObservedAt: p.observed_at ?? null, historical: Boolean(p.restored) }));
  const sum = (field: keyof typeof invoices[number]) => invoices.reduce((n, i) => n + Number(i[field]), 0);
  return { asOf: at, currency: 'USD', invoices, payments, totals: { invoicedCents: sum('totalCents'), creditsAppliedCents: sum('creditsAppliedCents'),
    writtenOffCents: sum('writtenOffCents'), paidCents: sum('paidCents'), openCents: sum('balanceCents') } };
}
