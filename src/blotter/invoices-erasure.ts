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
    { cls: 'link', table: 'b_invoice_deliveries', action: 'redact', label: 'Invoice portal links (revoked), recipient copies and notice bodies', where: `invoice_id IN ${invoices}`, set: `revoked_at=COALESCE(revoked_at,${at}),recipient_email='',recipient_name='[erased]',subject='[erased]',message='[erased]',resolution=NULL,status=CASE WHEN status='dispatching' THEN 'held' ELSE status END` },
    { cls: 'billing', table: 'b_invoice_retainers', action: 'redact', label: 'Recurring fee rules (paused) and unconsumed terms', where: `client_id=${client}`, set: `title='[erased]',definition='{}',status='paused',principal_id=NULL,auto_consent=NULL,revision=lower(hex(randomblob(16)))` },
    { cls: 'billing', table: 'b_invoice_amendments', action: 'redact', label: 'Future recurring fee amendments (recorded amounts remain in issued invoices)', where: `retainer_id IN ${retainers}`, set: `before_snapshot='{}',after_snapshot='{}',reason='[erased]'` },
    { cls: 'billing', table: 'b_invoices', action: 'redact', label: 'Unissued invoice drafts: line descriptions, recipient, terms and tax authority', where: `client_id=${client} AND number IS NULL`, set: `title='[erased]',snapshot=json_object('erased',1,'currency',currency,'totalCents',total_cents),status='void',voided_at=COALESCE(voided_at,${at}),void_reason='[erased]',erased_at=${at}` },
    { cls: 'billing', table: 'b_invoice_entitlements', action: 'redact', label: 'Uninvoiced fee entitlements: descriptions and authorization (amounts stay)', where: `client_id=${client} AND id NOT IN ${keep}`, set: `description='[erased]',reference='erased:'||id,authorization='[erased]'` },
  ];
  // Keep list positions stable: the parent engine applies client/class holds to
  // all steps and compares each with its unheld form when counting the preview.
  return all.map(s => s.cls === 'link' ? s : { ...s, where: `${s.where} AND ${s.table === 'b_invoice_amendments' ? `retainer_id IN (SELECT id FROM b_invoice_retainers WHERE job_id NOT IN (${x.held.jobs.map(lit).join(',') || "''"}))` : `job_id NOT IN (${x.held.jobs.map(lit).join(',') || "''"})`}` });
}

export function invoiceRetainedRows(clientId: string, owner: string) {
  const c = lit(clientId);
  return [
    { key: 'billing_invoices', cls: 'billing' as const, label: 'Issued and voided numbered invoice PDFs, line snapshots and source links', reason: 'Immutable billing evidence stays until confirmed expiry.', owner,
      sql: `SELECT count(*) n FROM b_invoices WHERE client_id=${c} AND number IS NOT NULL AND erased_at IS NULL` },
    { key: 'billing_invoice_credits', cls: 'billing' as const, label: 'Recorded deposits, credits and allocation references', reason: 'Billing evidence stays with its invoiced allocations until confirmed expiry.', owner,
      sql: `SELECT count(*) n FROM b_invoice_credits WHERE client_id=${c}` },
  ];
}

/** Billing's clock advances for later credits/allocations and voids; whole years use the firm zone. */
export async function invoiceClocks(db: D1Database, timeZone: string, years: number) {
  const result: { kind: 'invoice'; id: string; cls: 'billing'; clientIds: string[]; jobId: string; label: string; clock: string; years: number; expiry: string }[] = [];
  for (const invoice of await rows(db, 'SELECT i.id,i.client_id,i.job_id,i.title,i.issued_at,i.voided_at,c.erased_at client_erased_at FROM b_invoices i JOIN b_clients c ON c.id=i.client_id WHERE i.number IS NOT NULL AND i.erased_at IS NULL')) {
    const events = [invoice.issued_at, invoice.voided_at,
      ...(await rows(db, 'SELECT c.recorded_at FROM b_invoice_credit_uses u JOIN b_invoice_credits c ON c.id=u.credit_id WHERE u.invoice_id=?', invoice.id)).map(c => c.recorded_at),
      ...(await rows(db, "SELECT at FROM b_audit WHERE object_id=? AND action='invoice.credit_applied'", invoice.id)).map(e => e.at),
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
    { table: 'b_invoices', label: 'Numbered invoice PDF and personal snapshot (number, totals, revision, authors and SHA-256 stay)', where: `id=${r} AND erased_at IS NULL`, set: `pdf_base64=NULL,title='[erased]',snapshot=json_object('erased',1,'currency',currency,'totalCents',total_cents),erased_at=${lit(at)}`, action: 'redact' as const },
    { table: 'b_invoice_deliveries', label: 'Invoice notice recipients, bodies and portal access', where: `invoice_id=${r}`, set: `recipient_email='',recipient_name='[erased]',subject='[erased]',message='[erased]',resolution=NULL,revoked_at=COALESCE(revoked_at,${lit(at)})`, action: 'redact' as const },
    { table: 'b_invoice_entitlements', label: 'Snapshotted fee descriptions and supplied authority', where: `id IN (SELECT entitlement_id FROM b_invoice_sources WHERE invoice_id=${r}) AND NOT EXISTS(SELECT 1 FROM b_invoice_sources s JOIN b_invoices i ON i.id=s.invoice_id WHERE s.entitlement_id=b_invoice_entitlements.id AND i.id<>${r} AND i.erased_at IS NULL)`, set: "description='[erased]',reference='erased:'||id,authorization='[erased]'", action: 'redact' as const },
    { table: 'b_invoice_credits', label: 'Deposits and credit personal references (amounts and attribution stay)', where: `id IN (SELECT credit_id FROM b_invoice_credit_uses WHERE invoice_id=${r}) AND NOT EXISTS(SELECT 1 FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=b_invoice_credits.id AND i.id<>${r} AND i.erased_at IS NULL)`, set: "reference='erased:'||id,reason='[erased]'", action: 'redact' as const },
    { table: 'b_time_adjustments', label: 'Invoiced time-adjustment reasons (amounts and attribution stay)', where: `id IN (SELECT substr(source_key,5) FROM b_invoice_sources WHERE invoice_id=${r} AND source_key LIKE 'adj:%')`, set: "reason='[erased]'", action: 'redact' as const },
    { table: 'b_time', label: 'Invoiced time descriptions', where: `id IN ${lines}`, set: "description='[erased]'", action: 'redact' as const },
    { table: 'b_expenses', label: 'Invoiced expense descriptions and receipt bytes', where: `id IN ${spend}`, set: "description='[erased]',receipt_name=NULL,receipt_mime=NULL,receipt_size=NULL,receipt_base64=NULL", action: 'redact' as const },
  ];
}

export async function invoiceObservedCopies(db: D1Database, clientId: string) {
  const out: { source: string; label: string; owner: string; count: number; kind: 'observed' }[] = [];
  const mail = (await rows(db, "SELECT count(*) n FROM b_invoice_deliveries d JOIN b_invoices i ON i.id=d.invoice_id WHERE i.client_id=? AND (d.status IN ('accepted','held','dispatching'))", clientId))[0].n;
  if (mail) for (const owner of ['The invoice mail provider (provider-retained; unresolved sends included)', 'The invoice recipients (recipient-controlled)']) out.push({ source: 'invoice-mail', label: 'Invoice PDF and notice email', owner, count: Number(mail), kind: 'observed' });
  for (const r of await rows(db, "SELECT a.actor,count(*) n FROM b_audit a JOIN b_invoices i ON i.id=a.object_id WHERE i.client_id=? AND a.action IN ('invoice.downloaded','invoice.portal_downloaded') GROUP BY a.actor", clientId))
    out.push({ source: 'invoice-download', label: 'Downloaded invoice PDF', owner: String(r.actor), count: Number(r.n), kind: 'observed' });
  return out;
}
