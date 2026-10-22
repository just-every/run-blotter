// One explicit billing recipient per delivery, a scoped bearer credential and a
// durable claim before the provider call. Ambiguous sends are held for review.
import { runtimeBindings, type Bindings } from '../auth.server';
import { recipientFor } from './client-recipients';
import { sendMail } from './documents';
import { atomic, audit, digest, guard, id, insist, now, rows, secret, stmt, text, type Actor, type Data } from './model';
import { invoiceNumber, invoicePdfResponse } from './invoices-pdf';
import { isLanguage, tr, type Key } from '../i18n/catalog';
import { invoiceDetail, invoiceRecipientGuard } from './invoices';
import { billed, invoiceAuthority, invoiceAuthorityGuard, invoiceDischargedSql, invoiceHuman } from './invoices-sources';

export async function previewInvoiceDelivery(db: D1Database, actor: Actor, invoiceId: string, body: Data) {
  invoiceHuman(actor); await invoiceAuthority(db);
  const invoice = await invoiceDetail(db, actor, invoiceId);
  insist(invoice.status === 'issued' && !invoice.erased_at, 'Only an issued invoice can be delivered', 409);
  const recipient = await recipientFor(db, invoice.client_id, 'billing', body.contactId ?? invoice.snapshot.recipient.id);
  insist(JSON.parse(recipient.roles).includes('billing'), 'Choose an authorized billing contact', 409);
  const previous = await rows(db, 'SELECT id,status FROM b_invoice_deliveries WHERE invoice_id=? ORDER BY sent_at DESC,id DESC LIMIT 1', invoiceId);
  insist(!previous[0] || !['dispatching', 'held'].includes(previous[0].status), 'The previous delivery is unresolved. Reconcile its provider evidence before sending again.', 409);
  if (previous[0]) {
    insist(body.previousDeliveryId === previous[0].id, 'Review the previous delivery before sending again', 409);
    text(body.resendReason, 'Reason to deliver again', 1000);
  }
  const preview = { invoiceId, revision: invoice.revision, number: invoice.number, pdfSha256: invoice.pdf_sha256,
    recipient: { id: recipient.id, revision: recipient.revision, name: recipient.name, email: recipient.email, portal: recipient.portal === 1, language: (recipient.language ?? 'en') as string },
    previousDeliveryId: previous[0]?.id ?? null, resendReason: previous[0] ? body.resendReason.trim() : '',
    subject: `${invoiceNumber(invoice.number)} - ${invoice.title}`, amountCents: invoice.balance_cents, dueDate: invoice.due_date };
  return { ...preview, previewHash: await digest(JSON.stringify(preview)) };
}

export async function sendInvoice(env: Bindings, actor: Actor, invoiceId: string, body: Data) {
  invoiceHuman(actor);
  const bindings = runtimeBindings(env), db = bindings.DB, authority = await invoiceAuthority(db), preview = await previewInvoiceDelivery(db, actor, invoiceId, body);
  insist(body.previewHash === preview.previewHash, 'The delivery preview changed. Review the current recipient and document.', 409);
  const invoice = await stmt(db, 'SELECT * FROM b_invoices WHERE id=?', invoiceId).first<Data>();
  insist(invoice?.pdf_base64, 'Invoice PDF was erased or is unavailable', 409);
  const deliveryId = id(), token = secret('iv_'), at = now(), expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString(), portalUrl = `${bindings.AUTH_ORIGIN}/invoice/${token}`;
  // A billing contact without portal access receives the PDF by email alone: the stored link is revoked at claim time and never shared.
  // The mail reads in the billing contact's language (PORTAL-005); the PDF stays as issued.
  const T = (key: Key, vars: Record<string, string | number> = {}) => tr(isLanguage(preview.recipient.language) ? preview.recipient.language : 'en', key, vars);
  const message = `${T('mail.hello', { name: preview.recipient.name })}\n\n${T('mail.invoice.body', { number: invoiceNumber(invoice.number), amount: `USD ${(preview.amountCents / 100).toFixed(2)}`, due: preview.dueDate })}`
    + (preview.recipient.portal ? `\n\n${T('mail.invoice.portal', { url: portalUrl })}\n${T('mail.invoice.expires', { date: expiresAt.slice(0, 10) })}` : '');
  const [check, release] = guard(db, `EXISTS(SELECT 1 FROM b_invoices WHERE id=? AND revision=? AND status='issued' AND erased_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM b_invoice_deliveries WHERE invoice_id=? AND status IN ('dispatching','held'))
    AND COALESCE((SELECT id FROM b_invoice_deliveries WHERE invoice_id=? ORDER BY sent_at DESC,id DESC LIMIT 1),'')=?`, invoiceId, preview.revision, invoiceId, invoiceId, preview.previousDeliveryId ?? '');
  const [authorized, done] = invoiceAuthorityGuard(db, authority.revision);
  await atomic(db, actor, billed(db, actor, [check, authorized, ...invoiceRecipientGuard(db, { client: { id: invoice.client_id }, recipient: preview.recipient }),
    stmt(db, `INSERT INTO b_invoice_deliveries(id,invoice_id,contact_id,contact_revision,recipient_email,recipient_name,digest,expires_at,status,delivery,subject,message,sent_by,sent_at,revoked_at)
      VALUES(?,?,?,?,?,?,?,?,'dispatching','Provider outcome not yet recorded',?,?,?,?,?)`, deliveryId, invoiceId, preview.recipient.id, preview.recipient.revision, preview.recipient.email, preview.recipient.name, await digest(token), expiresAt, preview.subject, message.replace(portalUrl, '[private invoice link]'), actor.email, at, preview.recipient.portal ? null : at),
    done, release, audit(db, actor, 'invoice.delivery_claimed', invoiceId, `${deliveryId}; ${preview.recipient.id}; ${preview.resendReason}`)]));
  const delivery = await sendMail(bindings, deliveryId, preview.recipient.email, preview.subject, message,
    [{ name: `${invoiceNumber(invoice.number)}.pdf`, mime: 'application/pdf', content_base64: invoice.pdf_base64 }]);
  const status = delivery.startsWith('accepted by ') ? 'accepted' : /^(not sent:|rejected |suppressed )/.test(delivery) ? 'failed' : 'held';
  // Completion is evidence of an already-claimed effect, so it persists even if
  // the initiating operator is deactivated during the provider call.
  await db.batch([
    stmt(db, "UPDATE b_invoice_deliveries SET status=?,delivery=? WHERE id=? AND status='dispatching'", status, delivery, deliveryId),
    stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), actor.email,
      status === 'accepted' ? 'invoice.sent' : 'invoice.delivery_held', invoiceId, `${deliveryId}; ${delivery}; ${invoice.pdf_sha256}`, now()),
  ]);
  return { id: deliveryId, invoiceId, status, delivery, portalUrl: preview.recipient.portal ? portalUrl : null, expiresAt };
}

export async function reconcileInvoiceDelivery(db: D1Database, actor: Actor, deliveryId: string, body: Data) {
  invoiceHuman(actor);
  insist(body.outcome === 'accepted' || body.outcome === 'not_sent', 'Record accepted or not_sent from provider evidence');
  const evidence = text(body.evidence, 'Provider evidence and reason', 2000), d = await stmt(db, 'SELECT * FROM b_invoice_deliveries WHERE id=?', deliveryId).first<Data>();
  insist(d && ['dispatching', 'held'].includes(d.status), 'Only unresolved delivery can be reconciled', 409);
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_invoice_deliveries WHERE id=? AND status IN ('dispatching','held'))", deliveryId);
  await atomic(db, actor, billed(db, actor, [check, stmt(db, 'UPDATE b_invoice_deliveries SET status=?,delivery=?,resolved_by=?,resolved_at=?,resolution=? WHERE id=?', body.outcome === 'accepted' ? 'accepted' : 'failed', `reconciled by ${actor.email}: ${body.outcome}`, actor.email, now(), evidence, deliveryId),
    release, audit(db, actor, 'invoice.delivery_reconciled', d.invoice_id, `${deliveryId}; ${body.outcome}; ${evidence}`)]));
  return { id: deliveryId, outcome: body.outcome, replayed: false };
}

/** Every portal view/download rechecks the exact contact relationship and its revision. */
async function invoicePortalContext(db: D1Database, token: string) {
  insist(/^iv_[0-9a-f]{64}$/.test(token), 'Invoice link not found', 404);
  const delivery = await stmt(db, `SELECT d.* FROM b_invoice_deliveries d JOIN b_invoices i ON i.id=d.invoice_id JOIN b_client_contacts c ON c.id=d.contact_id JOIN b_clients e ON e.id=i.client_id
    WHERE d.digest=? AND d.revoked_at IS NULL AND d.expires_at>? AND i.status='issued' AND i.erased_at IS NULL AND c.client_id=i.client_id
    AND c.revision=d.contact_revision AND c.active=1 AND c.authorized=1 AND c.portal=1 AND c.email_consent=1
    AND EXISTS(SELECT 1 FROM json_each(c.roles) WHERE value='billing') AND e.lifecycle='active' AND e.merged_into IS NULL AND e.erased_at IS NULL`, await digest(token), now()).first<Data>();
  insist(delivery, 'Invoice link expired or access was revoked', 404);
  const invoice = await stmt(db, 'SELECT * FROM b_invoices WHERE id=?', delivery.invoice_id).first<Data>();
  insist(invoice?.pdf_base64, 'Invoice document unavailable', 404);
  return { delivery, invoice };
}
export async function invoicePortalView(db: D1Database, token: string) {
  const { delivery, invoice } = await invoicePortalContext(db, token), snapshot = JSON.parse(invoice.snapshot);
  const used = Number((await stmt(db, `SELECT ${invoiceDischargedSql('i')} n FROM b_invoices i WHERE i.id=?`, invoice.id).first<Data>())!.n);
  // No broader client or job records are exposed by this credential.
  return { id: invoice.id, number: invoiceNumber(invoice.number), title: invoice.title, currency: 'USD', status: invoice.status,
    issueDate: invoice.issue_date, dueDate: invoice.due_date, totalCents: invoice.total_cents, balanceCents: invoice.subtotal_cents + invoice.tax_cents - used,
    terms: snapshot.terms, taxTreatment: snapshot.taxTreatment, taxCents: invoice.tax_cents,
    language: (await stmt(db, 'SELECT language FROM b_client_contacts WHERE id=?', delivery.contact_id).first<Data>())?.language ?? 'en',
    client: snapshot.client.name, firm: snapshot.firm.name, recipient: delivery.recipient_name, expiresAt: delivery.expires_at, sha256: invoice.pdf_sha256 };
}
export async function invoicePortalPdf(db: D1Database, token: string) {
  const { delivery, invoice } = await invoicePortalContext(db, token), [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_invoice_deliveries WHERE id=? AND revoked_at IS NULL AND expires_at>?) AND EXISTS(SELECT 1 FROM b_invoices WHERE id=? AND status='issued' AND erased_at IS NULL)", delivery.id, now(), invoice.id);
  try {
    await db.batch([check, ...invoiceRecipientGuard(db, { client: { id: invoice.client_id }, recipient: { id: delivery.contact_id, revision: delivery.contact_revision } }),
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'invoice portal link (identity not verified)', 'invoice.portal_downloaded', invoice.id, invoice.pdf_sha256, now()), release]);
  } catch { insist(false, 'Invoice access changed. Request a fresh link.', 404); }
  return invoicePdfResponse(invoice);
}
