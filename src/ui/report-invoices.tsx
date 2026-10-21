import { money, when, type Row } from './common';

/** Current balances alongside immutable issue figures, with native source doors. */
export function ReportInvoices({ data, open }: { data: Row; open: (id: string) => void }) {
  const total = data.totals;
  return <section aria-label="Native invoice reporting" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
    <h3>Native invoices and receivables</h3>
    <p className="muted">Fresh at {when(data.generatedAt)}. {data.basis}</p>
    <p><strong>Current receivables {money(total.receivableCents, data.currency)}</strong> · {total.issued} issued invoices · {total.drafts} drafts · {total.voids} voids.</p>
    <p>Issued subtotal {money(total.issuedSubtotalCents, data.currency)} · supplied tax {money(total.issuedTaxCents, data.currency)} · credits at issue {money(total.issuedCreditCents, data.currency)} · amount due at issue {money(total.issuedTotalCents, data.currency)}.</p>
    <p>Current allocations on issued invoices {money(total.issuedAppliedCreditCents, data.currency)}. Draft issue amounts {money(total.draftTotalCents, data.currency)}; void issue amounts {money(total.voidTotalCents, data.currency)}.</p>
    <p>Client supplied deposits and credits {money(total.suppliedCreditCents, data.currency)} · applied to issued invoices across client jobs {money(total.issuedAppliedClientCreditCents, data.currency)} · reserved by drafts {money(total.reservedCreditCents, data.currency)} · unreserved and available {money(total.availableCreditCents, data.currency)}.</p>
    <p>Unapplied client credit liability {money(total.unappliedCreditCents, data.currency)}, including draft reservations. {total.activeRetainers} active retainer rules of {total.retainers} recorded.</p>
    <div className="stack">{data.invoices.map((invoice: Row) => <details className="record" key={invoice.id}>
      <summary>{invoice.displayNumber || 'Unnumbered draft'} · {invoice.status} · {invoice.clientName} · balance {money(invoice.balanceCents, invoice.currency)}</summary>
      <p>Record {invoice.id}. Issue date {invoice.issueDate}; due {invoice.dueDate}.{invoice.issuedAt && <> Issued {when(invoice.issuedAt)}.</>}{invoice.voidedAt && <> Voided {when(invoice.voidedAt)}.</>}</p>
      <p>Subtotal {money(invoice.subtotalCents, invoice.currency)} · supplied tax {money(invoice.taxCents, invoice.currency)} · credits at issue {money(invoice.creditCents, invoice.currency)} · amount due at issue {money(invoice.totalCents, invoice.currency)}.</p>
      <p>{invoice.status === 'draft' ? 'Reserved credits' : invoice.status === 'void' ? 'Voided credit allocation records' : 'Applied credits'} {money(invoice.allocatedCreditCents, invoice.currency)} · current balance {money(invoice.balanceCents, invoice.currency)}.{invoice.status === 'draft' && ' Draft balance is excluded from receivables.'}{invoice.status === 'void' && ' Voided allocations do not consume available credit.'}</p>
      <div className="actions"><button onClick={() => open(invoice.jobId)}>Open source job</button><a href={invoice.source}>Source job link</a>{invoice.pdf && <a className="button" href={invoice.pdf}>Download invoice PDF</a>}</div>
      {invoice.erasedAt && <p className="muted">Invoice payload removed after erasure; retained amounts and identifiers remain.</p>}
      {invoice.retainerId && <p>Retainer {invoice.retainerId} · billing month {invoice.period}</p>}
      <h4>Invoice time, expense and entitlement sources</h4>
      <ul>{invoice.sources.map((source: Row) => <li key={source.sourceKey}><a href={source.source}>{source.sourceKey}</a> · {source.kind || 'Retained source'} · {source.description} · {source.amountCents === null ? 'Amount removed with payload' : money(source.amountCents, invoice.currency)}{source.entitlementId && <> · entitlement {source.entitlementId}</>}</li>)}</ul>
      <h4>Recorded credit allocations</h4>
      <ul>{invoice.allocations.map((allocation: Row) => <li key={allocation.id}>{allocation.kind} {allocation.reference} · credit {allocation.creditId} · {money(allocation.amountCents, invoice.currency)} · evidence recorded {when(allocation.recordedAt)}</li>)}</ul>
    </details>)}</div>
    {!data.invoices.length && <p>No native invoices for the selected jobs.</p>}
    <h4>Retainer rules and price history</h4>
    <div className="stack">{data.retainers.map((retainer: Row) => <details className="record" key={retainer.id}>
      <summary>{retainer.title} · {retainer.clientName} · {retainer.status}</summary>
      <p>Rule {retainer.id}. Starts {retainer.startMonth}; current terms as of {retainer.asOfMonth}.{retainer.cancelledFrom && <> Cancelled from {retainer.cancelledFrom}.</>}</p>
      <p>{retainer.amountCents === null ? 'Terms removed by erasure.' : <>Monthly fee {money(retainer.amountCents, retainer.currency)} · supplied tax {money(retainer.taxCents, retainer.currency)} · billing day {retainer.billDay} · due {retainer.dueDays} days after issue.</>}</p>
      <div className="actions"><button onClick={() => open(retainer.jobId)}>Open retainer source job</button><a href={retainer.source}>Source job link</a></div>
      <ul>{retainer.amendments.map((amendment: Row) => <li key={amendment.id}>Effective {amendment.effectiveMonth}: {amendment.cancelledFrom ? <>cancel from {amendment.cancelledFrom}</> : amendment.afterAmountCents === null ? 'Terms removed' : <>{money(amendment.beforeAmountCents, retainer.currency)} → {money(amendment.afterAmountCents, retainer.currency)} · supplied tax {money(amendment.taxCents, retainer.currency)}</>} · authorized {when(amendment.authorizedAt)}</li>)}</ul>
      <p>Generated invoice records: {retainer.invoiceIds.length ? retainer.invoiceIds.join(', ') : 'None'}. Each generated entitlement keeps its own recorded price.</p>
    </details>)}</div>
    {!data.retainers.length && <p>No retainer rules for the selected jobs.</p>}
    <h4>Client supplied deposits and credits</h4>
    <div className="stack">{data.credits.map((credit: Row) => <details className="record" key={credit.id}>
      <summary>{credit.clientName} · {credit.kind} · {credit.reference} · available {money(credit.availableCents, credit.currency)}</summary>
      <p>Credit {credit.id}: supplied {money(credit.amountCents, credit.currency)} · applied to issued invoices {money(credit.appliedCents, credit.currency)} · reserved by drafts {money(credit.reservedCents, credit.currency)} · unapplied liability {money(credit.unappliedCents, credit.currency)} · unreserved and available {money(credit.availableCents, credit.currency)} across all client jobs. Recorded by {credit.recordedBy} {when(credit.recordedAt)}.</p>
      <div className="actions">{credit.sources.map((source: Row) => <a key={source.jobId} href={source.source}>Source job {source.jobId}</a>)}</div>
      <ul>{credit.allocations.map((allocation: Row) => <li key={allocation.id}>Invoice {allocation.invoiceId} · {allocation.invoiceStatus} · {money(allocation.amountCents, credit.currency)} · <a href={allocation.source}>Source job</a></li>)}</ul>
    </details>)}</div>
    {!data.credits.length && <p>No recorded deposits or credits for the selected clients.</p>}
  </section>;
}
