// Explicit practitioner-recorded deposits and credits. No bank movement or
// provider settlement is inferred; PAY-001 supplies collection evidence later.
import { atomic, audit, guard, id, insist, integer, now, rows, stmt, text, type Actor, type Data } from './model';
import { activeInvoiceClientSql, billed, invoiceAuthority, invoiceAuthorityGuard, invoiceHuman } from './invoices-sources';

export async function invoiceCredits(db: D1Database, clientId?: string) {
  return rows(db, `SELECT c.*,c.amount_cents-COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=c.id AND i.status<>'void'),0) available_cents
    FROM b_invoice_credits c ${clientId ? 'WHERE c.client_id=?' : ''} ORDER BY c.recorded_at,c.id`, ...(clientId ? [clientId] : []));
}
export async function recordInvoiceCredit(db: D1Database, actor: Actor, body: Data) {
  invoiceHuman(actor);
  const authority = await invoiceAuthority(db), clientId = text(body.clientId, 'Client', 100), creditId = id();
  insist(body.kind === 'deposit' || body.kind === 'credit', 'Choose deposit or credit');
  insist(body.currency === undefined || body.currency === 'USD', 'Credits must be recorded in USD');
  const amountCents = integer(body.amountCents, 'USD cents', 1), reference = text(body.reference, 'External receipt or credit reference', 200), reason = text(body.reason, 'Authority and reason', 2000);
  const [check, release] = guard(db, activeInvoiceClientSql, clientId), [authorized, done] = invoiceAuthorityGuard(db, authority.revision);
  await atomic(db, actor, billed(db, actor, [check, authorized,
    stmt(db, 'INSERT INTO b_invoice_credits(id,client_id,kind,reference,amount_cents,reason,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?)', creditId, clientId, body.kind, reference, amountCents, reason, actor.email, now()),
    done, release, audit(db, actor, 'invoice.credit_recorded', creditId, `${body.kind}; ${reference}; ${amountCents} USD cents; ${reason}`)]));
  return { id: creditId, amountCents, currency: 'USD' };
}

export async function previewInvoiceCredits(db: D1Database, clientId: string, input: unknown, gross: number) {
  insist(input === undefined || Array.isArray(input), 'Credits must be a list');
  const wanted = (input ?? []) as Data[];
  insist(wanted.length <= 50 && new Set(wanted.map(c => c?.creditId)).size === wanted.length, 'Choose at most 50 distinct credits');
  const available = await invoiceCredits(db, clientId);
  const credits = wanted.map(c => {
    insist(c && typeof c === 'object', 'Each credit needs its id and amount');
    const credit = available.find(a => a.id === c.creditId), amountCents = integer(c.amountCents, 'Applied credit USD cents', 1);
    insist(credit && amountCents <= credit.available_cents, 'This credit is unavailable or already allocated', 409);
    return { creditId: credit.id, kind: credit.kind, reference: credit.reference, amountCents, availableCents: credit.available_cents };
  });
  const total = credits.reduce((sum, c) => sum + c.amountCents, 0);
  insist(total <= gross, 'Credits cannot exceed this invoice; leave the remainder available for a later invoice');
  return { credits, total };
}

/** A later credit changes the statement balance, never the original issued PDF. */
export async function allocateInvoiceCredit(db: D1Database, actor: Actor, invoiceId: string, body: Data) {
  invoiceHuman(actor); await invoiceAuthority(db);
  const invoice = await stmt(db, "SELECT * FROM b_invoices WHERE id=? AND status='issued' AND erased_at IS NULL", invoiceId).first<Data>();
  insist(invoice, 'Issued invoice not found', 404);
  const prior = Number((await stmt(db, 'SELECT COALESCE(sum(amount_cents),0) n FROM b_invoice_credit_uses WHERE invoice_id=?', invoice.id).first<Data>())!.n);
  const applied = await previewInvoiceCredits(db, invoice.client_id, [{ creditId: body.creditId, amountCents: body.amountCents }], invoice.subtotal_cents + invoice.tax_cents - prior);
  const reason = text(body.reason, 'Allocation reason', 1000), credit = applied.credits[0];
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_invoices i WHERE i.id=? AND i.status='issued' AND i.erased_at IS NULL
    AND i.subtotal_cents+i.tax_cents-COALESCE((SELECT sum(amount_cents) FROM b_invoice_credit_uses WHERE invoice_id=i.id),0)>=?) AND ` + activeInvoiceClientSql, invoice.id, applied.total, invoice.client_id);
  await atomic(db, actor, billed(db, actor, [check, stmt(db, 'INSERT INTO b_invoice_credit_uses(id,invoice_id,credit_id,amount_cents) VALUES(?,?,?,?)', id(), invoice.id, credit.creditId, credit.amountCents),
    release, audit(db, actor, 'invoice.credit_applied', invoice.id, `${credit.creditId}; ${credit.amountCents} USD cents; ${reason}`)]));
  return { id: invoice.id, balanceCents: invoice.subtotal_cents + invoice.tax_cents - prior - applied.total };
}
