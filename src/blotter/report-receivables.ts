// BILL-003: receivables, realization and profitability projected from the report's native
// invoice cohort. Pure arithmetic over issued, non-void invoices: no rewrite of any invoice.
import { AGING_BUCKETS, agingBucket } from './invoice-aging';
import type { Data } from './model';

const sum = (items: Data[], pick: (item: Data) => number) => items.reduce((n, item) => n + pick(item), 0);
const bps = (part: number, whole: number) => whole > 0 ? Math.round(part * 10000 / whole) : null;
const line = (invoice: Data, kinds: (kind: string) => boolean, positive?: boolean) => sum(invoice.sources.filter((s: Data) => s.amountCents !== null && kinds(s.kind)
  && (positive === undefined || (positive ? s.amountCents > 0 : s.amountCents < 0))), s => Math.abs(s.amountCents));

/** One measure for any slice of issued invoices: billed, settled, uncollected and written off stay distinct. */
export type StaffCost = Map<string, { cents: number; unratedMinutes: number }> | null;
export function measure(invoices: Data[], expenseCost: Map<string, number>, staffCost: StaffCost) {
  const billedCents = sum(invoices, i => i.subtotalCents), taxCents = sum(invoices, i => i.taxCents), recordedCents = sum(invoices, i => line(i, k => k !== 'adjustment'));
  const writeUpCents = sum(invoices, i => line(i, k => k === 'adjustment', true)), writeDownCents = sum(invoices, i => line(i, k => k === 'adjustment', false));
  const providerNetCents = sum(invoices, i => i.providerNetCents), providerFeeCents = sum(invoices, i => i.providerFeeCents);
  const collectedCents = providerNetCents + sum(invoices, i => sum(i.allocations.filter((a: Data) => a.kind === 'deposit'), a => a.amountCents));
  const creditedCents = sum(invoices, i => sum(i.allocations.filter((a: Data) => a.kind === 'credit'), a => a.amountCents));
  const writtenOffCents = sum(invoices, i => i.writtenOffCents), outstandingCents = sum(invoices, i => i.balanceCents);
  const expenseCostCents = sum(invoices, i => sum(i.sources.filter((s: Data) => s.kind === 'expense'), s => expenseCost.get(s.sourceId) ?? 0));
  const staff = (pick: (cost: { cents: number; unratedMinutes: number }) => number) => staffCost ? sum(invoices, i => sum(i.sources.filter((s: Data) => s.kind === 'time' || s.kind === 'adjustment'), s => pick(staffCost.get(s.sourceKey) ?? { cents: 0, unratedMinutes: 0 }))) : null;
  const staffCostCents = staff(c => c.cents), unratedStaffMinutes = staff(c => c.unratedMinutes);
  return { invoices: invoices.length, recordedCents, writeUpCents, writeDownCents, billedCents, taxCents, collectedCents, providerNetCents, providerFeeCents, creditedCents, writtenOffCents, outstandingCents, expenseCostCents,
    netMarginBeforeStaffCostCents: billedCents - writtenOffCents - expenseCostCents, staffCostCents, unratedStaffMinutes,
    profitCents: staffCostCents === null ? null : billedCents - writtenOffCents - expenseCostCents - staffCostCents,
    billedRealizationBps: bps(billedCents, recordedCents), settledBps: bps(collectedCents + creditedCents, billedCents + taxCents), writtenOffBps: bps(writtenOffCents, billedCents + taxCents) };
}

export function receivablesReport(data: Data, jobs: Data[], expenseCost: Map<string, number>, staffCost: StaffCost, asOf: string) {
  const issued = data.invoices.filter((i: Data) => i.status === 'issued');
  const slices = (key: (job: Data) => [string | null, string | null], of: (invoice: Data, job: Data) => boolean) => {
    const groups = new Map<string, Data>();
    for (const job of jobs) {
      const [id, name] = key(job), group = groups.get(JSON.stringify(id)) ?? { id, name, jobIds: [] as string[], invoiceIds: new Set<string>() };
      group.jobIds.push(job.id);
      for (const invoice of issued) if (invoice.jobId === job.id && of(invoice, job)) group.invoiceIds.add(invoice.id);
      groups.set(JSON.stringify(id), group);
    }
    return [...groups.values()].map(g => ({ id: g.id, name: g.name, jobIds: g.jobIds.sort(), ...measure(issued.filter((i: Data) => g.invoiceIds.has(i.id)), expenseCost, staffCost) }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '') || (a.id ?? '').localeCompare(b.id ?? ''));
  };
  const open = issued.filter((i: Data) => i.balanceCents > 0);
  const retainerInvoices = issued.filter((i: Data) => i.retainerId && i.period);
  const asOfMonth = asOf.slice(0, 7), earned = retainerInvoices.filter((i: Data) => i.period <= asOfMonth), deferred = retainerInvoices.filter((i: Data) => i.period > asOfMonth);
  return { asOf, currency: 'USD',
    basis: 'Issued non-void native USD invoices of the selected jobs. Billed is the issued subtotal before supplied tax; recorded is the approved time, fee and expense lines it was built from, and write-ups and write-downs are its adjustment lines. Settled is recorded deposits and credits applied plus observed provider net settled payments after refunds, returns and disputes; pending payments do not count and provider fees are separate; written off is partner-approved and separate; uncollected is the open balance. Aging counts whole days past the due date at the report date. A retainer invoice is earned when its billing month has begun and deferred when it was billed for a later month. Profit is billed less write-offs, the cost of invoiced expenses and the staff cost of invoiced time (minutes times the principal-recorded hourly cost rate in force on the entry date; minutes with no rate are counted separately, never guessed); staff cost is shown to the principal and financial-authority holders only.',
    aging: AGING_BUCKETS.map(bucket => { const items = open.filter((i: Data) => agingBucket(asOf, i.dueDate) === bucket); return { bucket, cents: sum(items, i => i.balanceCents), invoiceIds: items.map((i: Data) => i.id) }; }),
    retainers: { earnedCents: sum(earned, i => i.subtotalCents), deferredCents: sum(deferred, i => i.subtotalCents), earnedInvoiceIds: earned.map((i: Data) => i.id), deferredInvoiceIds: deferred.map((i: Data) => i.id) },
    totals: measure(issued, expenseCost, staffCost), clients: slices(j => [j.client_id, j.client_name], (i, j) => i.clientId === j.client_id), services: slices(j => [j.work_type_id ?? null, j.work_type ?? null], () => true),
    jobs: slices(j => [j.id, j.title], () => true) };
}
