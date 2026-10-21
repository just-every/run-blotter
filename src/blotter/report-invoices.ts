// BILL-002 / REPORT-001: current native billing evidence for the report's job
// cohort. Immutable issue amounts and today's credit allocations stay distinct.
import { firmSettings, localClock } from './firm';
import { invoiceNumber } from './invoices-pdf';
import { insist, need, rows, type Actor, type Data } from './model';

const jobUrl = (id: string) => `/app?job=${encodeURIComponent(id)}`;
const selectedSql = 'IN (SELECT value FROM json_each(?))';
const sum = (items: Data[], key: string) => items.reduce((n, item) => n + Number(item[key]), 0);

/** selectedJobs has already passed the report's live visibility and filter checks. */
export async function invoiceReport(db: D1Database, actor: Actor, selectedJobs: Data[], generatedAt: string) {
  need(actor, 'owner', 'reviewer');
  insist(actor.channel === 'person' && !actor.automation, 'A native staff session is required', 403);
  const jobIds = [...new Set(selectedJobs.map(j => j.id))].sort();
  const clientIds = [...new Set(selectedJobs.map(j => j.client_id))].sort();
  const jobs = JSON.stringify(jobIds), clients = JSON.stringify(clientIds);
  const [nativeInvoices, nativeRetainers, nativeCredits, uses, reservations, amendments, firm] = await Promise.all([
    rows(db, `SELECT i.id,i.client_id,i.job_id,i.status,i.number,i.currency,i.snapshot,i.subtotal_cents,i.tax_cents,i.credit_cents,i.total_cents,
      i.issue_date,i.due_date,i.prepared_at,i.issued_at,i.voided_at,i.erased_at,i.retainer_id,i.period,c.name client_name,c.erased_at client_erased_at
      FROM b_invoices i JOIN b_clients c ON c.id=i.client_id WHERE i.job_id ${selectedSql} ORDER BY i.prepared_at,i.id`, jobs),
    rows(db, `SELECT r.id,r.client_id,r.job_id,r.title,r.status,r.start_month,r.cancelled_from,r.definition,r.created_at,c.name client_name,c.erased_at client_erased_at
      FROM b_invoice_retainers r JOIN b_clients c ON c.id=r.client_id WHERE r.job_id ${selectedSql} ORDER BY r.created_at,r.id`, jobs),
    rows(db, `SELECT c.id,c.client_id,c.kind,c.reference,c.amount_cents,c.currency,c.recorded_at,c.recorded_by,e.name client_name,e.erased_at client_erased_at,
      c.amount_cents-COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=c.id AND i.status<>'void'),0) available_cents,
      COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=c.id AND i.status='draft'),0) reserved_cents,
      COALESCE((SELECT sum(u.amount_cents) FROM b_invoice_credit_uses u JOIN b_invoices i ON i.id=u.invoice_id WHERE u.credit_id=c.id AND i.status='issued'),0) applied_cents
      FROM b_invoice_credits c JOIN b_clients e ON e.id=c.client_id WHERE c.client_id ${selectedSql} ORDER BY c.recorded_at,c.id`, clients),
    rows(db, `SELECT u.id,u.invoice_id,u.credit_id,u.amount_cents,c.kind,c.reference,c.recorded_at FROM b_invoice_credit_uses u
      JOIN b_invoices i ON i.id=u.invoice_id JOIN b_invoice_credits c ON c.id=u.credit_id WHERE i.job_id ${selectedSql} ORDER BY c.recorded_at,u.id`, jobs),
    rows(db, `SELECT s.* FROM b_invoice_sources s JOIN b_invoices i ON i.id=s.invoice_id WHERE i.job_id ${selectedSql} ORDER BY s.source_key`, jobs),
    rows(db, `SELECT a.* FROM b_invoice_amendments a JOIN b_invoice_retainers r ON r.id=a.retainer_id WHERE r.job_id ${selectedSql} ORDER BY a.effective_month,a.id`, jobs),
    firmSettings(db),
  ]);
  const asOfMonth = localClock(firm, new Date(generatedAt)).localDate.slice(0, 7);
  const invoices = nativeInvoices.map(i => {
    const snapshot = JSON.parse(i.snapshot), removed = Boolean(i.client_erased_at || i.erased_at);
    const allocations = uses.filter(u => u.invoice_id === i.id).map(u => ({ id: u.id, creditId: u.credit_id, kind: u.kind,
      reference: removed ? '[erased]' : u.reference, amountCents: Number(u.amount_cents), recordedAt: u.recorded_at, source: jobUrl(i.job_id) }));
    const allocatedCreditCents = sum(allocations, 'amountCents');
    // Expiry deliberately removes line payloads while retaining the source registry.
    const sources = snapshot.erased ? reservations.filter(s => s.invoice_id === i.id).map(s => ({ sourceKey: s.source_key,
      sourceId: s.entitlement_id, entitlementId: s.entitlement_id, jobId: s.job_id, kind: null, amountCents: null, description: '[erased]', source: jobUrl(s.job_id) }))
      : snapshot.lines.map((l: Data) => ({ sourceKey: l.source_key, sourceId: l.source_id, entitlementId: l.entitlement_id ?? null,
        jobId: l.job_id, kind: l.kind, amountCents: Number(l.amount_cents), description: removed ? '[erased]' : l.description, source: jobUrl(l.job_id) }));
    return { id: i.id, clientId: i.client_id, clientName: i.client_name, jobId: i.job_id, status: i.status, number: i.number,
      displayNumber: i.number === null ? null : invoiceNumber(i.number), currency: i.currency,
      subtotalCents: Number(i.subtotal_cents), taxCents: Number(i.tax_cents), creditCents: Number(i.credit_cents), totalCents: Number(i.total_cents),
      allocatedCreditCents, appliedCreditCents: i.status === 'issued' ? allocatedCreditCents : 0,
      reservedCreditCents: i.status === 'draft' ? allocatedCreditCents : 0,
      balanceCents: i.status === 'void' ? 0 : Number(i.subtotal_cents) + Number(i.tax_cents) - allocatedCreditCents,
      issueDate: i.issue_date, dueDate: i.due_date, preparedAt: i.prepared_at, issuedAt: i.issued_at, voidedAt: i.voided_at,
      erasedAt: i.erased_at, retainerId: i.retainer_id, period: i.period, source: jobUrl(i.job_id),
      pdf: i.number !== null && !removed ? `/api/blotter/invoices/${encodeURIComponent(i.id)}/pdf` : null, sources, allocations };
  });
  const retainers = nativeRetainers.map(r => {
    const changes = amendments.filter(a => a.retainer_id === r.id), effective = changes.filter(a => a.effective_month <= asOfMonth).at(-1);
    const definition = JSON.parse(effective ? effective.after_snapshot : r.definition);
    const removed = Boolean(r.client_erased_at);
    return { id: r.id, clientId: r.client_id, clientName: r.client_name, jobId: r.job_id, title: removed ? '[erased]' : r.title,
      currency: 'USD', status: r.status, startMonth: r.start_month, cancelledFrom: r.cancelled_from, asOfMonth,
      amountCents: definition.amountCents ?? null, taxCents: definition.taxCents ?? null,
      billDay: definition.billDay ?? null, dueDays: definition.dueDays ?? null, source: jobUrl(r.job_id),
      invoiceIds: invoices.filter(i => i.retainerId === r.id).map(i => i.id),
      amendments: changes.map(a => { const before = JSON.parse(a.before_snapshot), after = JSON.parse(a.after_snapshot);
        return { id: a.id, effectiveMonth: a.effective_month, beforeAmountCents: before.amountCents ?? null, afterAmountCents: after.amountCents ?? null,
          taxCents: after.taxCents ?? null, cancelledFrom: after.cancelled === true ? a.effective_month : null, authorizedAt: a.authorized_at, source: jobUrl(r.job_id) }; }) };
  });
  const credits = nativeCredits.map(c => ({ id: c.id, clientId: c.client_id, clientName: c.client_name, currency: c.currency, kind: c.kind,
    reference: c.client_erased_at ? '[erased]' : c.reference, amountCents: Number(c.amount_cents), availableCents: Number(c.available_cents),
    reservedCents: Number(c.reserved_cents), appliedCents: Number(c.applied_cents), unappliedCents: Number(c.amount_cents) - Number(c.applied_cents),
    recordedAt: c.recorded_at, recordedBy: c.recorded_by,
    // Availability accounts for every allocation; details never widen the selected job cohort.
    sources: selectedJobs.filter(j => j.client_id === c.client_id).map(j => ({ jobId: j.id, source: jobUrl(j.id) })).sort((a, b) => a.jobId.localeCompare(b.jobId)),
    allocations: invoices.flatMap(i => i.allocations.filter(a => a.creditId === c.id).map(a => ({ ...a, invoiceId: i.id, invoiceStatus: i.status }))) }));
  const issued = invoices.filter(i => i.status === 'issued');
  return { generatedAt, currency: 'USD', jobIds, clientIds,
    basis: 'Current native USD invoices and retainers for the selected period-start job cohort. Credits belong to those clients; their availability includes allocations across all their jobs. Unreserved credit is available for allocation; unapplied credit includes draft reservations. Draft reservations do not discharge client credit liabilities. Only issued non-void invoices contribute receivables. Issue amounts remain fixed; current allocations change balances. Supplied deposits and credits are practitioner-recorded evidence, not provider settlement, collections or realization. No payment-provider proceeds or staff costs are inferred.',
    totals: { invoices: invoices.length, issued: issued.length, drafts: invoices.filter(i => i.status === 'draft').length, voids: invoices.filter(i => i.status === 'void').length,
      issuedSubtotalCents: sum(issued, 'subtotalCents'), issuedTaxCents: sum(issued, 'taxCents'), issuedCreditCents: sum(issued, 'creditCents'), issuedTotalCents: sum(issued, 'totalCents'),
      issuedAppliedCreditCents: sum(issued, 'appliedCreditCents'), receivableCents: sum(issued, 'balanceCents'),
      draftTotalCents: sum(invoices.filter(i => i.status === 'draft'), 'totalCents'), voidTotalCents: sum(invoices.filter(i => i.status === 'void'), 'totalCents'),
      suppliedCreditCents: sum(credits, 'amountCents'), availableCreditCents: sum(credits, 'availableCents'),
      reservedCreditCents: sum(credits, 'reservedCents'), issuedAppliedClientCreditCents: sum(credits, 'appliedCents'), unappliedCreditCents: sum(credits, 'unappliedCents'),
      retainers: retainers.length, activeRetainers: retainers.filter(r => r.status === 'active').length },
    invoices, retainers, credits };
}

/** One projection drives both exports; origin makes source cells clickable in PDF. */
export function invoiceReportRows(data: Awaited<ReturnType<typeof invoiceReport>>, origin = ''): unknown[][] {
  const url = (value: string | null) => value === null ? null : origin + value;
  return [
    ['native_invoice_generated_at', data.generatedAt], ['native_invoice_basis', data.basis], ['native_invoice_currency', data.currency],
    ...Object.entries(data.totals).map(([key, value]) => ['native_invoice_total', key, value]),
    ['invoice_id','number','status','client_id','client','job_id','currency','subtotal_cents','supplied_tax_cents','issue_credit_cents','issue_total_cents','recorded_allocated_credit_cents','issued_applied_credit_cents','draft_reserved_credit_cents','current_balance_cents','issue_date','due_date','issued_at','voided_at','retainer_id','period','job_source','invoice_pdf'],
    ...data.invoices.map(i => [i.id,i.displayNumber,i.status,i.clientId,i.clientName,i.jobId,i.currency,i.subtotalCents,i.taxCents,i.creditCents,i.totalCents,i.allocatedCreditCents,i.appliedCreditCents,i.reservedCreditCents,i.balanceCents,i.issueDate,i.dueDate,i.issuedAt,i.voidedAt,i.retainerId,i.period,url(i.source),url(i.pdf)]),
    ['invoice_id','source_key','source_id','entitlement_id','kind','amount_cents','description','source_job_id','source'],
    ...data.invoices.flatMap(i => i.sources.map((s: Data) => [i.id,s.sourceKey,s.sourceId,s.entitlementId,s.kind,s.amountCents,s.description,s.jobId,url(s.source)])),
    ['invoice_id','credit_id','kind','reference','allocated_cents','recorded_at','source'],
    ...data.invoices.flatMap(i => i.allocations.map(a => [i.id,a.creditId,a.kind,a.reference,a.amountCents,a.recordedAt,url(a.source)])),
    ['retainer_id','client_id','client','job_id','title','status','start_month','cancelled_from','as_of_month','currency','monthly_cents','supplied_tax_cents','bill_day','due_days','invoice_ids','source'],
    ...data.retainers.map(r => [r.id,r.clientId,r.clientName,r.jobId,r.title,r.status,r.startMonth,r.cancelledFrom,r.asOfMonth,r.currency,r.amountCents,r.taxCents,r.billDay,r.dueDays,r.invoiceIds.join(' '),url(r.source)]),
    ['retainer_id','amendment_id','effective_month','before_monthly_cents','after_monthly_cents','supplied_tax_cents','cancelled_from','authorized_at','source'],
    ...data.retainers.flatMap(r => r.amendments.map(a => [r.id,a.id,a.effectiveMonth,a.beforeAmountCents,a.afterAmountCents,a.taxCents,a.cancelledFrom,a.authorizedAt,url(a.source)])),
    ['credit_id','client_id','client','kind','reference','currency','supplied_cents','draft_reserved_cents_all_jobs','issued_applied_cents_all_jobs','unapplied_liability_cents','unreserved_available_cents','recorded_at','recorded_by'],
    ...data.credits.map(c => [c.id,c.clientId,c.clientName,c.kind,c.reference,c.currency,c.amountCents,c.reservedCents,c.appliedCents,c.unappliedCents,c.availableCents,c.recordedAt,c.recordedBy]),
    ['credit_id','selected_job_id','source'], ...data.credits.flatMap(c => c.sources.map(s => [c.id,s.jobId,url(s.source)])),
  ];
}
