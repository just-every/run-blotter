// BILL-010 native invoice preparation and approval. Every issued PDF is a fixed
// snapshot; no tax, payment settlement or conversion is inferred by this path.
import { recipientFor } from './client-recipients';
import { firmSettings } from './firm';
import { atomic, audit, canBill, canReadBilling, date, digest, guard, id, insist, integer, job, need, now, rows, stmt, text, type Actor, type Data } from './model';
import { clientAuthority } from './permissions';
import { invoiceCredits, previewInvoiceCredits } from './invoices-credits';
import { invoiceBase64, invoiceNumber, invoicePdf, invoicePdfResponse } from './invoices-pdf';
import { invoiceWriteOffs } from './invoices-writeoffs';
import { activeInvoiceClientSql, availableInvoiceSources, billed, invoiceAuthority, invoiceBalanceSql, invoiceAuthorityGuard, invoiceHuman, invoiceSourceGuards, principalHuman } from './invoices-sources';

export async function selectInvoiceAuthority(db: D1Database, actor: Actor, body: Data) {
  principalHuman(actor);
  insist(body.authority === 'blotter', 'Only Blotter invoice authority is implemented. QBO/Xero require their own authorized connector.', 409);
  const reason = text(body.reason, 'Authority decision', 1000), revision = id();
  await atomic(db, actor, [stmt(db, `INSERT INTO b_invoice_settings(id,authority,revision,authorized_by,authorized_at,reason) VALUES(1,'blotter',?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET authority='blotter',revision=excluded.revision,authorized_by=excluded.authorized_by,authorized_at=excluded.authorized_at,reason=excluded.reason`, revision, actor.email, now(), reason), audit(db, actor, 'invoice.authority_selected', 'invoice-authority', reason)]);
  return { authority: 'blotter', revision };
}

/** Shared by a person's preview and the approved monthly rule's draft generation. */
export async function buildInvoicePreview(db: D1Database, actor: Actor, body: Data) {
  insist(canBill(actor), 'Only the principal or a financial-authority holder can prepare invoices', 403);
  insist(body.currency === undefined || body.currency === 'USD', 'Native invoices must be denominated in USD');
  const authority = await invoiceAuthority(db), j = await job(db, actor, text(body.jobId, 'Work item', 100));
  insist(j.currency === 'USD', 'Native invoices require USD work; currency is never converted', 409);
  const client = await stmt(db, `SELECT id,name,revision FROM b_clients WHERE id=? AND lifecycle='active' AND merged_into IS NULL AND erased_at IS NULL`, j.client_id).first<Data>();
  insist(client, 'This client is archived or unavailable', 409);
  const recipient = await recipientFor(db, j.client_id, 'billing', body.contactId);
  insist(JSON.parse(recipient.roles).includes('billing'), 'Choose a billing contact', 409);
  insist(Array.isArray(body.sourceKeys) && body.sourceKeys.length > 0 && body.sourceKeys.length <= 100, 'Choose 1 to 100 invoice lines');
  const keys = new Set(body.sourceKeys as string[]);
  insist(keys.size === body.sourceKeys.length, 'Each source can appear once');
  const lines = (await availableInvoiceSources(db, j.id)).filter(l => keys.has(l.source_key)).sort((a, b) => String(a.source_key).localeCompare(String(b.source_key)));
  insist(lines.length === keys.size, 'A source is unavailable, reserved, unapproved or outside this USD job', 409);
  const subtotalCents = lines.reduce((sum, l) => sum + Number(l.amount_cents), 0);
  insist(subtotalCents >= 0, 'An invoice subtotal cannot be negative; record an authorized credit instead');
  const taxCents = integer(body.taxCents, 'Supplied sales tax in USD cents'), taxTreatment = text(body.taxTreatment, 'Authorized sales-tax treatment', 1000), taxAuthorization = text(body.taxAuthorization, 'Tax treatment authorization and source', 2000);
  const applied = await previewInvoiceCredits(db, client.id, body.credits, subtotalCents + taxCents);
  const issueDate = date(body.issueDate, 'Issue date'), dueDate = date(body.dueDate, 'Due date');
  insist(dueDate >= issueDate, 'Due date cannot precede the issue date');
  const firm = await firmSettings(db);
  insist(firm.name, 'Record the firm name before preparing an invoice', 409);
  const snapshot = { title: text(body.title, 'Invoice title', 200), currency: 'USD', authority: 'blotter', authorityRevision: authority.revision,
    client, job: { id: j.id, title: j.title, period_label: j.period_label },
    recipient: { id: recipient.id, name: recipient.name, email: recipient.email, revision: recipient.revision },
    firm: { name: firm.name, address: firm.address, city: firm.city, state: firm.state, zip: firm.zip },
    issueDate, dueDate, terms: text(body.terms, 'Payment terms', 2000), taxCents, taxTreatment, taxAuthorization,
    lines, credits: applied.credits, subtotalCents, creditCents: applied.total, totalCents: subtotalCents + taxCents - applied.total };
  return { snapshot, previewHash: await digest(JSON.stringify(snapshot)) };
}
export async function previewInvoice(db: D1Database, actor: Actor, body: Data) {
  invoiceHuman(actor); return buildInvoicePreview(db, actor, body);
}

export function invoiceRecipientGuard(db: D1Database, snapshot: Data) {
  return guard(db, `EXISTS(SELECT 1 FROM b_client_contacts c JOIN b_clients e ON e.id=c.client_id WHERE c.id=? AND c.client_id=? AND c.revision=?
    AND c.active=1 AND c.authorized=1 AND c.email_consent=1 AND c.email<>'' AND EXISTS(SELECT 1 FROM json_each(c.roles) WHERE value='billing')
    AND e.lifecycle='active' AND e.merged_into IS NULL AND e.erased_at IS NULL)`, snapshot.recipient.id, snapshot.client.id, snapshot.recipient.revision);
}

/** Reserving all lines and credits is atomic, so a draft already prevents double billing. */
export function invoiceDraftStatements(db: D1Database, actor: Actor, invoiceId: string, preview: Data, retainerId: string | null = null, period: string | null = null) {
  const s = preview.snapshot, [check, release] = invoiceAuthorityGuard(db, s.authorityRevision), [client, clientDone] = guard(db, activeInvoiceClientSql, s.client.id);
  return [check, client, ...invoiceRecipientGuard(db, s), ...invoiceSourceGuards(db, s.lines),
    stmt(db, `INSERT INTO b_invoices(id,client_id,job_id,title,status,snapshot,subtotal_cents,tax_cents,credit_cents,total_cents,revision,owner_email,issue_date,due_date,retainer_id,period,prepared_by,prepared_at)
      VALUES(?,?,?,?,'draft',?,?,?,?,?,?,?,?,?,?,?,?,?)`, invoiceId, s.client.id, s.job.id, s.title, JSON.stringify(s), s.subtotalCents, s.taxCents, s.creditCents, s.totalCents, id(), actor.email, s.issueDate, s.dueDate, retainerId, period, actor.email, now()),
    ...s.lines.map((l: Data) => stmt(db, 'INSERT INTO b_invoice_sources(source_key,invoice_id,job_id,entitlement_id) VALUES(?,?,?,?)', l.source_key, invoiceId, l.job_id, l.entitlement_id ?? null)),
    ...s.credits.map((c: Data) => stmt(db, 'INSERT INTO b_invoice_credit_uses(id,invoice_id,credit_id,amount_cents) VALUES(?,?,?,?)', id(), invoiceId, c.creditId, c.amountCents)),
    clientDone, release, audit(db, actor, 'invoice.prepared', invoiceId, `${s.title}; ${s.lines.length} lines; ${s.totalCents} USD cents; ${preview.previewHash}`)];
}
export async function prepareInvoice(db: D1Database, actor: Actor, body: Data) {
  invoiceHuman(actor);
  const preview = await buildInvoicePreview(db, actor, body);
  insist(body.previewHash === preview.previewHash, 'The invoice preview changed. Review the current lines, credits, terms and recipient.', 409);
  const invoiceId = id();
  await atomic(db, actor, billed(db, actor, invoiceDraftStatements(db, actor, invoiceId, preview)));
  return invoiceDetail(db, actor, invoiceId);
}

const invoiceFields = `i.id,i.client_id,i.job_id,i.title,i.status,i.number,i.currency,i.snapshot,i.subtotal_cents,i.tax_cents,i.credit_cents,i.total_cents,i.revision,i.owner_email,i.issue_date,i.due_date,i.retainer_id,i.period,
 i.prepared_by,i.prepared_at,i.issued_by,i.issued_at,i.pdf_sha256,i.voided_by,i.voided_at,i.void_reason,i.erased_at,i.auto_revision,i.auto_exception,i.collection_hold,i.collection_note,
 CASE WHEN i.status='void' THEN 0 ELSE ${invoiceBalanceSql('i')} END balance_cents,
 COALESCE((SELECT sum(w.amount_cents) FROM b_invoice_writeoffs w WHERE w.invoice_id=i.id),0) written_off_cents`;
export async function invoiceState(db: D1Database, actor: Actor) {
  insist(canReadBilling(actor), 'Your role cannot perform this action', 403); insist(actor.channel === 'person', 'A native staff session is required', 403);
  // A scoped holder sees only the clients it holds; the principal and unscoped staff see every unerased client.
  const visibleJobs=new Set((await rows(db,`SELECT j.id FROM b_jobs j JOIN b_clients c ON c.id=j.client_id WHERE c.erased_at IS NULL AND ${clientAuthority(actor,'c.id')}`)).map(j=>j.id));
  const visibleClients=new Set((await rows(db,`SELECT c.id FROM b_clients c WHERE c.erased_at IS NULL AND ${clientAuthority(actor,'c.id')}`)).map(c=>c.id));
  const [settings, invoices, sources, entitlements, retainers, credits, contacts, amendments] = await Promise.all([
    stmt(db, 'SELECT * FROM b_invoice_settings WHERE id=1').first<Data>(), rows(db, `SELECT ${invoiceFields} FROM b_invoices i JOIN b_clients c ON c.id=i.client_id WHERE c.erased_at IS NULL ORDER BY i.prepared_at DESC,i.id`),
    availableInvoiceSources(db), rows(db, 'SELECT * FROM b_invoice_entitlements WHERE client_id IN (SELECT id FROM b_clients WHERE erased_at IS NULL) ORDER BY authorized_at DESC'),
    rows(db, 'SELECT * FROM b_invoice_retainers WHERE client_id IN (SELECT id FROM b_clients WHERE erased_at IS NULL) ORDER BY created_at DESC'), invoiceCredits(db),
    rows(db, "SELECT id,client_id,name,email,portal FROM b_client_contacts WHERE client_id IN (SELECT id FROM b_clients WHERE erased_at IS NULL) AND active=1 AND authorized=1 AND email_consent=1 AND email<>'' AND EXISTS(SELECT 1 FROM json_each(roles) WHERE value='billing') ORDER BY name,id"),
    rows(db, 'SELECT * FROM b_invoice_amendments WHERE retainer_id IN (SELECT r.id FROM b_invoice_retainers r JOIN b_clients c ON c.id=r.client_id WHERE c.erased_at IS NULL) ORDER BY authorized_at,id'),
  ]);
  const mine=(row:Data)=>visibleClients.has(row.client_id), ownRetainers=new Set(retainers.filter(mine).map(r=>r.id));
  return { settings, invoices:invoices.filter(mine), sources:sources.filter(s=>visibleJobs.has(s.job_id)), entitlements:entitlements.filter(mine), retainers:retainers.filter(mine).map(({auto_consent,...r})=>({...r,autoConsent:auto_consent?JSON.parse(auto_consent):null})), credits:credits.filter(mine), contacts:contacts.filter(mine), amendments:amendments.filter(a=>ownRetainers.has(a.retainer_id)) };
}
export async function invoiceDetail(db: D1Database, actor: Actor, invoiceId: string): Promise<Data> {
  insist(canReadBilling(actor), 'Your role cannot perform this action', 403); insist(actor.channel === 'person', 'A native staff session is required', 403);
  const invoice = await stmt(db, `SELECT ${invoiceFields},c.erased_at client_erased_at FROM b_invoices i JOIN b_clients c ON c.id=i.client_id WHERE i.id=?`, invoiceId).first<Data>();
  insist(invoice, 'Invoice not found', 404);
  if(invoice.client_erased_at){need(actor,'owner');await audit(db,actor,'invoice.retained_read',invoiceId,'Principal read retained invoice record').run();}
  const deliveries = await rows(db, 'SELECT id,contact_id,recipient_email,recipient_name,status,delivery,sent_by,sent_at,resolved_by,resolved_at,resolution FROM b_invoice_deliveries WHERE invoice_id=? ORDER BY sent_at,id', invoiceId);
  const reminders = await rows(db, 'SELECT id,step,scheduled_on,status,recipient_email,delivery,created_at FROM b_invoice_reminders WHERE invoice_id=? ORDER BY step', invoiceId);
  return { ...invoice, snapshot: JSON.parse(invoice.snapshot), snapshotHash: await digest(invoice.snapshot), deliveries, reminders, writeOffs: await invoiceWriteOffs(db, invoiceId), history: await rows(db, "SELECT * FROM b_audit WHERE object_id=? OR object_id IN (SELECT id FROM b_invoice_deliveries WHERE invoice_id=?) ORDER BY at,id", invoiceId, invoiceId) };
}

/** `auto` is only passed by the scheduled run, inside the consent's cap, and is printed on the numbered document. */
export async function issueInvoice(db: D1Database, actor: Actor, invoiceId: string, body: Data, auto?: { ruleRevision: number }) {
  invoiceHuman(actor); const authority = await invoiceAuthority(db), invoice = await invoiceDetail(db, actor, invoiceId), s = invoice.snapshot;
  insist(invoice.status === 'draft' && body.revision === invoice.revision, 'Only the current draft can be issued', 409);
  const note = text(body.reviewNote, 'Approval note', 1000);
  insist(body.snapshotHash === await digest(JSON.stringify(s)), 'Review the exact draft before issuing', 409);
  const number = Number((await stmt(db, 'SELECT COALESCE(MAX(number),0)+1 n FROM b_invoices').first<Data>())!.n), approved = { ...s, approvedBy: actor.email, ...(auto ? { autoIssued: { ruleRevision: auto.ruleRevision } } : {}) };
  const pdf = await invoicePdf(approved, number), hash = await digest(pdf), at = now();
  const [check, release] = guard(db, "EXISTS(SELECT 1 FROM b_invoices WHERE id=? AND revision=? AND status='draft') AND ?=(SELECT COALESCE(MAX(number),0)+1 FROM b_invoices)", invoiceId, invoice.revision, number);
  const [authorized, done] = invoiceAuthorityGuard(db, authority.revision);
  await atomic(db, actor, billed(db, actor, [check, authorized, ...invoiceRecipientGuard(db, s), ...invoiceSourceGuards(db, s.lines),
    stmt(db, "UPDATE b_invoices SET status='issued',number=?,issued_by=?,issued_at=?,pdf_base64=?,pdf_sha256=?,auto_revision=?,revision=? WHERE id=?", number, actor.email, at, invoiceBase64(pdf), hash, auto?.ruleRevision ?? null, id(), invoiceId),
    done, release, audit(db, actor, 'invoice.issued', invoiceId, `${invoiceNumber(number)}; ${note}; ${auto ? `auto-issued under rule revision ${auto.ruleRevision}; ` : ''}sources ${s.lines.map((l: Data) => l.source_key).join(', ')}`)]));
  return { id: invoiceId, number, displayNumber: invoiceNumber(number), sha256: hash, status: 'issued' };
}

export async function voidInvoice(db: D1Database, actor: Actor, invoiceId: string, body: Data) {
  invoiceHuman(actor); const invoice = await invoiceDetail(db, actor, invoiceId);
  insist(invoice.status !== 'void' && body.revision === invoice.revision, 'Only the current invoice can be voided', 409);
  const reason = text(body.reason, 'Void reason', 1000), at = now(), [check, release] = guard(db, 'EXISTS(SELECT 1 FROM b_invoices WHERE id=? AND revision=? AND status<>\'void\')', invoiceId, invoice.revision);
  await atomic(db, actor, billed(db, actor, [check,
    stmt(db, "UPDATE b_invoices SET status='void',voided_by=?,voided_at=?,void_reason=?,revision=? WHERE id=?", actor.email, at, reason, id(), invoiceId),
    stmt(db, 'UPDATE b_invoice_deliveries SET revoked_at=? WHERE invoice_id=? AND revoked_at IS NULL', at, invoiceId),
    ...(invoice.number === null ? [stmt(db, 'DELETE FROM b_invoice_sources WHERE invoice_id=?', invoiceId)] : []),
    release, audit(db, actor, 'invoice.voided', invoiceId, `${invoice.number ? invoiceNumber(invoice.number) : 'Draft'}; ${reason}`)]));
  return { id: invoiceId, status: 'void', sourcesReleased: invoice.number === null };
}
export async function downloadInvoice(db: D1Database, actor: Actor, invoiceId: string) {
  insist(canReadBilling(actor), 'Your role cannot perform this action', 403); insist(actor.channel === 'person', 'A native staff session is required', 403);
  const invoice = await stmt(db, 'SELECT i.*,c.erased_at client_erased_at FROM b_invoices i JOIN b_clients c ON c.id=i.client_id WHERE i.id=? AND i.number IS NOT NULL', invoiceId).first<Data>();
  insist(invoice?.pdf_base64, 'Issued invoice PDF not found or erased', 404);
  if(invoice.client_erased_at)need(actor,'owner');
  await atomic(db, actor, [audit(db, actor, 'invoice.downloaded', invoiceId, invoice.pdf_sha256)]);
  return invoicePdfResponse(invoice);
}
