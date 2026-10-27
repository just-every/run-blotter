// Integration carriers for the existing ERASURE-002 engine. That engine owns
// approval, holds, counts, immutable-trigger suspension, receipts and fencing.
import { addYears, localDate } from './retention-clock';
import { lit, type Context, type Step } from './erasure-scope';
import { rows, type Data } from './model';

/** Include alongside export-backed sources, so whole-client erasure keeps invoice evidence. */
export const invoiceSnapshotIdsSql = (prefix: string) => `(SELECT substr(s.source_key,${prefix.length + 1}) FROM b_invoice_sources s JOIN b_invoices i ON i.id=s.invoice_id WHERE i.number IS NOT NULL AND i.erased_at IS NULL AND substr(s.source_key,1,${prefix.length})=${lit(prefix)})`;

export function invoiceErasureSteps(x: Context): Step[] {
  const client = lit(x.client), at = lit(x.at), invoices = `(SELECT id FROM b_invoices WHERE client_id=${client})`, retainers = `(SELECT id FROM b_invoice_retainers WHERE client_id=${client})`;
  const keep = `(SELECT s.entitlement_id FROM b_invoice_sources s JOIN b_invoices i ON i.id=s.invoice_id WHERE i.number IS NOT NULL AND i.erased_at IS NULL AND s.entitlement_id IS NOT NULL)`;
  const all: Step[] = [
    { cls: 'billing', table: 'b_revenue_accounting', action: 'redact', label: 'Accounting source references and reasons (amounts and attribution stay)', where: `client_id=${client}`, set: `source='[erased]',reference='erased:'||id,reason='[erased]'` },
    { cls: 'link', table: 'b_payment_mandates', action: 'redact', label: 'Saved payment authorities revoked and method references and wording erased', where: `client_id=${client}`, set: `status='revoked',revoked_at=COALESCE(revoked_at,${at}),method_id=NULL,customer_id=NULL,last4='',authorization='[erased]'` },
    { cls: 'link', table: 'b_payment_events', action: 'delete', label: 'Provider event references and payload digests', where: `payment_id IN (SELECT id FROM b_provider_payments WHERE client_id=${client})` },
    { cls: 'billing', table: 'b_provider_payments', action: 'redact', label: 'Provider customer and checkout references (amounts, outcomes and attribution stay; collection disabled)', where: `client_id=${client}`, set: `customer_id=NULL,session_id=NULL,restored=1` },
    { cls: 'link', table: 'b_invoice_reminders', action: 'redact', label: 'Invoice reminder recipients and message bodies (steps, dates and outcomes stay)', where: `invoice_id IN ${invoices}`, set: `recipient_email=NULL,subject='[erased]',message='[erased]',status=CASE WHEN status='dispatching' THEN 'held' ELSE status END` },
    { cls: 'link', table: 'b_payment_gates', action: 'redact', label: 'Payment gate reasons (the gate and its invoice link stay until the deliverable is erased)', where: `client_id=${client}`, set: `reason='[erased]',remove_reason=CASE WHEN remove_reason IS NULL THEN NULL ELSE '[erased]' END` },
    { cls: 'link', table: 'b_payment_overrides', action: 'redact', label: 'Partner override reasons for payment gates and credit holds (approver and time stay)', where: `client_id=${client}`, set: `reason='[erased]',revoke_reason=CASE WHEN revoke_reason IS NULL THEN NULL ELSE '[erased]' END` },
    { cls: 'link', table: 'b_invoice_reminder_clients', action: 'delete', label: 'Client reminder schedule override', where: `client_id=${client}` },
    { cls: 'link', table: 'b_invoice_deliveries', action: 'redact', label: 'Invoice portal links (revoked), recipient copies and notice bodies', where: `invoice_id IN ${invoices}`, set: `revoked_at=COALESCE(revoked_at,${at}),recipient_email='',recipient_name='[erased]',subject='[erased]',message='[erased]',resolution=NULL,status=CASE WHEN status='dispatching' THEN 'held' ELSE status END` },
    { cls: 'billing', table: 'b_invoice_retainers', action: 'redact', label: 'Recurring fee rules (paused) and unconsumed terms', where: `client_id=${client}`, set: `title='[erased]',definition='{}',status='paused',principal_id=NULL,auto_consent=NULL,revision=lower(hex(randomblob(16)))` },
    { cls: 'billing', table: 'b_invoice_amendments', action: 'redact', label: 'Future recurring fee amendments (recorded amounts remain in issued invoices)', where: `retainer_id IN ${retainers}`, set: `before_snapshot='{}',after_snapshot='{}',reason='[erased]'` },
    { cls: 'billing', table: 'b_invoices', action: 'redact', label: 'Unissued invoice drafts: line descriptions, recipient, terms and tax authority', where: `client_id=${client} AND number IS NULL`, set: `title='[erased]',snapshot=json_object('erased',1,'currency',currency,'totalCents',total_cents),status='void',voided_at=COALESCE(voided_at,${at}),void_reason='[erased]',erased_at=${at}` },
    { cls: 'billing', table: 'b_invoice_entitlements', action: 'redact', label: 'Uninvoiced fee entitlements: descriptions and authorization (amounts stay)', where: `client_id=${client} AND id NOT IN ${keep}`, set: `description='[erased]',reference='erased:'||id,authorization='[erased]'` },
  ];
  // Keep list positions stable: the parent engine applies client/class holds to
  // all steps and compares each with its unheld form when counting the preview.
  return all.map(s => s.cls === 'link' ? s : { ...s, where: `${s.where} AND ${['b_provider_payments','b_revenue_accounting'].includes(s.table) ? `invoice_id IN (SELECT id FROM b_invoices WHERE job_id NOT IN (${x.held.jobs.map(lit).join(',') || "''"}))` : s.table === 'b_invoice_amendments' ? `retainer_id IN (SELECT id FROM b_invoice_retainers WHERE job_id NOT IN (${x.held.jobs.map(lit).join(',') || "''"}))` : `job_id NOT IN (${x.held.jobs.map(lit).join(',') || "''"})`}` });
}

export function invoiceRetainedRows(clientId: string, owner: string) {
  const c = lit(clientId);
  return [
    { key: 'billing_revenue_accounting', cls: 'billing' as const, label: 'Practitioner-recorded firm accounting observations', reason: 'Accounting amounts and attribution stay with the native invoice.', owner, sql: `SELECT count(*) n FROM b_revenue_accounting WHERE client_id=${c}` },
    { key: 'billing_provider_payments', cls: 'billing' as const, label: 'Provider payment amounts, refunds, returns, disputes and attribution', reason: 'Financial evidence stays with its invoice until confirmed expiry.', owner,
      sql: `SELECT count(*) n FROM b_provider_payments WHERE client_id=${c}` },
    { key: 'billing_payment_observations', cls: 'billing' as const, label: 'Observed payment outcomes, net amounts and fees', reason: 'Payment observations stay with their invoice until confirmed expiry.', owner,
      sql: `SELECT count(*) n FROM b_payment_observations WHERE payment_id IN (SELECT id FROM b_provider_payments WHERE client_id=${c})` },
    { key: 'billing_invoices', cls: 'billing' as const, label: 'Issued and voided numbered invoice PDFs, line snapshots and source links', reason: 'Immutable billing evidence stays until confirmed expiry.', owner,
      sql: `SELECT count(*) n FROM b_invoices WHERE client_id=${c} AND number IS NOT NULL AND erased_at IS NULL` },
    { key: 'billing_invoice_credits', cls: 'billing' as const, label: 'Recorded deposits, credits and allocation references', reason: 'Billing evidence stays with its invoiced allocations until confirmed expiry.', owner,
      sql: `SELECT count(*) n FROM b_invoice_credits WHERE client_id=${c}` },
    { key: 'billing_invoice_writeoffs', cls: 'billing' as const, label: 'Approved write-offs with their reasons and approvers', reason: 'Billing evidence stays with its invoice until confirmed expiry.', owner,
      sql: `SELECT count(*) n FROM b_invoice_writeoffs WHERE client_id=${c}` },
  ];
}

/** Billing's clock advances for later credits/allocations and voids; whole years use the firm zone. */
export async function invoiceClocks(db: D1Database, timeZone: string, years: number) {
  const result: { kind: 'invoice'; id: string; cls: 'billing'; clientIds: string[]; jobId: string; label: string; clock: string; years: number; expiry: string }[] = [];
  for (const invoice of await rows(db, 'SELECT i.id,i.client_id,i.job_id,i.title,i.issued_at,i.voided_at,c.erased_at client_erased_at FROM b_invoices i JOIN b_clients c ON c.id=i.client_id WHERE i.number IS NOT NULL AND i.erased_at IS NULL')) {
    const events = [invoice.issued_at, invoice.voided_at,
      ...(await rows(db, 'SELECT recorded_at FROM b_revenue_accounting WHERE invoice_id=?', invoice.id)).map(o=>o.recorded_at),
      ...(await rows(db, 'SELECT c.recorded_at FROM b_invoice_credit_uses u JOIN b_invoice_credits c ON c.id=u.credit_id WHERE u.invoice_id=?', invoice.id)).map(c => c.recorded_at),
      ...(await rows(db, "SELECT at FROM b_audit WHERE object_id=? AND action='invoice.credit_applied'", invoice.id)).map(e => e.at),
      ...(await rows(db, 'SELECT approved_at FROM b_invoice_writeoffs WHERE invoice_id=?', invoice.id)).map(w => w.approved_at),
      ...(await rows(db, 'SELECT updated_at FROM b_provider_payments WHERE invoice_id=?', invoice.id)).map(p => p.updated_at),
      ...(await rows(db, 'SELECT o.observed_at FROM b_payment_observations o JOIN b_provider_payments p ON p.id=o.payment_id WHERE p.invoice_id=?', invoice.id)).map(o => o.observed_at),
    ].filter(Boolean).map(at => localDate(at, timeZone)).sort();
    const clock = events.at(-1)!;
    result.push({ kind: 'invoice', id: invoice.id, cls: 'billing', clientIds: [invoice.client_id], jobId: invoice.job_id, label: invoice.client_erased_at?'Retained invoice '+invoice.id.slice(0,8):invoice.title, clock, years, expiry: addYears(clock, years) });
  }
  return result;
}

/** Same shape as erasure-expiry effects(); only the existing approved engine applies these. */
export function invoiceExpiryEffects(invoiceId: string, at: string) {
  const r = lit(invoiceId), lines = `(SELECT substr(source_key,6) FROM b_invoice_sources WHERE invoice_id=${r} AND source_key LIKE 'time:%')`, spend = `(SELECT substr(source_key,5) FROM b_invoice_sources WHERE invoice_id=${r} AND source_key LIKE 'exp:%')`;
  return [
    { table: 'b_revenue_accounting', label: 'Accounting source references and reasons (amounts and attribution stay)', where: `invoice_id=${r}`, set: "source='[erased]',reference='erased:'||id,reason='[erased]'", action: 'redact' as const },
    { table: 'b_payment_mandates', label: 'Saved payment authorities revoked; method references and authorization wording removed', where: `invoice_id=${r}`, set: `status='revoked',revoked_at=COALESCE(revoked_at,${lit(at)}),method_id=NULL,customer_id=NULL,last4='',authorization='[erased]'`, action: 'redact' as const },
    { table: 'b_payment_events', label: 'Provider event references and payload digests', where: `payment_id IN (SELECT id FROM b_provider_payments WHERE invoice_id=${r})`, action: 'delete' as const },
    { table: 'b_provider_payments', label: 'Provider customer and checkout references (financial amounts and outcomes stay; collection disabled)', where: `invoice_id=${r}`, set: `customer_id=NULL,session_id=NULL,restored=1`, action: 'redact' as const },
    { table: 'b_invoices', label: 'Numbered invoice PDF and personal snapshot (number, totals, revision, authors and SHA-256 stay)', where: `id=${r} AND erased_at IS NULL`, set: `pdf_base64=NULL,title='[erased]',snapshot=json_object('erased',1,'currency',currency,'totalCents',total_cents),erased_at=${lit(at)}`, action: 'redact' as const },
    { table: 'b_invoice_reminders', label: 'Invoice reminder recipients and bodies (steps, dates and outcomes stay)', where: `invoice_id=${r}`, set: "recipient_email=NULL,subject='[erased]',message='[erased]'", action: 'redact' as const },
    { table: 'b_invoice_deliveries', label: 'Invoice notice recipients, bodies and portal access', where: `invoice_id=${r}`, set: `recipient_email='',recipient_name='[erased]',subject='[erased]',message='[erased]',resolution=NULL,revoked_at=COALESCE(revoked_at,${lit(at)})`, action: 'redact' as const },
    { table: 'b_invoice_writeoffs', label: 'Write-off reasons (amounts, approvers and times stay)', where: `invoice_id=${r}`, set: "reason='[erased]'", action: 'redact' as const },
    { table: 'b_invoice_entitlements', label: 'Snapshotted fee descriptions and supplied authority', where: `id IN (SELECT entitlement_id FROM b_invoice_sources WHERE invoice_id=${r}) AND NOT EXISTS(SELECT 1 FROM b_invoice_sources s JOIN b_invoices i ON i.id=s.invoice_id WHERE s.entitlement_id=b_invoice_entitlements.id AND i.id<>${r} AND i.erased_at IS NULL)`, set: "description='[erased]',reference='erased:'||id,authorization='[erased]'", action: 'redact' as const },
    { table: 'b_invoice_credits', label: 'Deposits and credit personal references (amounts and attribution stay)', where: `id IN (SELECT credit_id FROM b_invoice_credit_uses WHERE invoice_id=${r}) AND NOT EXISTS(SELECT 1 FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=b_invoice_credits.id AND i.id<>${r} AND i.erased_at IS NULL)`, set: "reference='erased:'||id,reason='[erased]'", action: 'redact' as const },
    { table: 'b_time_adjustments', label: 'Invoiced time-adjustment reasons (amounts and attribution stay)', where: `id IN (SELECT substr(source_key,5) FROM b_invoice_sources WHERE invoice_id=${r} AND source_key LIKE 'adj:%')`, set: "reason='[erased]'", action: 'redact' as const },
    { table: 'b_time', label: 'Invoiced time descriptions', where: `id IN ${lines}`, set: "description='[erased]'", action: 'redact' as const },
    { table: 'b_expenses', label: 'Invoiced expense descriptions and receipt bytes', where: `id IN ${spend}`, set: "description='[erased]',receipt_name=NULL,receipt_mime=NULL,receipt_size=NULL,receipt_base64=NULL", action: 'redact' as const },
  ];
}

export async function invoiceObservedCopies(db: D1Database, clientId: string) {
  const out: { source: string; label: string; owner: string; count: number; kind: 'observed' }[] = [];
  const payments = (await rows(db, 'SELECT count(*) n FROM b_provider_payments WHERE client_id=? AND (provider_id IS NOT NULL OR session_id IS NOT NULL OR customer_id IS NOT NULL)', clientId))[0].n;
  if (payments) out.push({ source: 'stripe-payment', label: 'Stripe payment, refund, return and dispute references', owner: 'Stripe (provider-retained payment records)', count: Number(payments), kind: 'observed' });
  const mandates = (await rows(db, 'SELECT count(*) n FROM b_payment_mandates WHERE client_id=? AND (method_id IS NOT NULL OR customer_id IS NOT NULL)', clientId))[0].n;
  if (mandates) out.push({ source: 'stripe-mandate', label: 'Stripe customer and saved payment method references', owner: 'Stripe (provider-retained saved payment authorities)', count: Number(mandates), kind: 'observed' });
  const mail = (await rows(db, "SELECT count(*) n FROM b_invoice_deliveries d JOIN b_invoices i ON i.id=d.invoice_id WHERE i.client_id=? AND (d.status IN ('accepted','held','dispatching'))", clientId))[0].n;
  if (mail) for (const owner of ['The invoice mail provider (provider-retained; unresolved sends included)', 'The invoice recipients (recipient-controlled)']) out.push({ source: 'invoice-mail', label: 'Invoice PDF and notice email', owner, count: Number(mail), kind: 'observed' });
  const reminders = (await rows(db, "SELECT count(*) n FROM b_invoice_reminders r JOIN b_invoices i ON i.id=r.invoice_id WHERE i.client_id=? AND r.status IN ('accepted','held','dispatching') AND r.delivery NOT LIKE 'held: not sent%'", clientId))[0].n;
  if (reminders) for (const owner of ['The invoice mail provider (provider-retained; unresolved sends included)', 'The invoice recipients (recipient-controlled)']) out.push({ source: 'invoice-reminder-mail', label: 'Invoice reminder email and attached PDF', owner, count: Number(reminders), kind: 'observed' });
  for (const r of await rows(db, "SELECT a.actor,count(*) n FROM b_audit a JOIN b_invoices i ON i.id=a.object_id WHERE i.client_id=? AND a.action IN ('invoice.downloaded','invoice.portal_downloaded') GROUP BY a.actor", clientId))
    out.push({ source: 'invoice-download', label: 'Downloaded invoice PDF', owner: String(r.actor), count: Number(r.n), kind: 'observed' });
  return out;
}
