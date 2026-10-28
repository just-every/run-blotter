import { day, moneyText, when } from './common';
import { useT } from './i18n';
import type { Key } from '../i18n/catalog';

type Invoice = { id: string; number: number | string; title: string; issueDate: string; dueDate: string; currency: 'USD'; totalCents: number; creditsAppliedCents: number; writtenOffCents: number; paidCents: number; balanceCents: number };
type Payment = { id: string; invoiceId: string; invoiceNumber: number | string; currency: 'USD'; kind: null | 'card' | 'us_bank_account'; state: string; amountCents: number; refundedCents: number; netCents: number; lastObservedAt: string | null; historical: boolean };
type Totals = { invoicedCents: number; creditsAppliedCents: number; writtenOffCents: number; paidCents: number; openCents: number };
type Billing = { asOf: string; invoices: Invoice[]; payments: Payment[]; totals: Totals; currency: 'USD' };
const numberText = (number: number | string) => /^\d+$/.test(String(number)) ? `INV-${String(number).padStart(6, '0')}` : String(number);
const states: Record<string, Key> = {
  creating: 'billing.state.creating', pending: 'billing.state.pending', requires_action: 'billing.state.requiresAction', held: 'billing.state.held',
  settled: 'billing.state.settled', refunded: 'billing.state.refunded', returned: 'billing.state.returned', disputed: 'billing.state.disputed', failed: 'billing.state.failed',
};
const details: Record<string, Key> = {
  creating: 'billing.pendingNote', pending: 'billing.pendingNote', requires_action: 'billing.actionNote', held: 'billing.heldNote',
  refunded: 'billing.refundNote', returned: 'billing.returnNote', disputed: 'billing.disputeNote', failed: 'billing.failedNote',
};

function Amounts({ values }: { values: [Key, number][] }) {
  const t = useT();
  return <dl style={{ display: 'grid', gap: '.5rem', margin: 0 }}>{values.map(([key, cents]) => <div key={key} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '.25rem 1rem' }}>
    <dt>{t(key)}</dt><dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{moneyText(cents, 'USD')}</dd>
  </div>)}</dl>;
}

function InvoiceRecord({ invoice, path }: { invoice: Invoice; path: string }) {
  const t = useT(), number = numberText(invoice.number);
  return <li data-invoice-id={invoice.id} className="stack">
    <strong>{number} · {invoice.title}</strong>
    <p>{t('billing.dates', { issued: day(invoice.issueDate), due: day(invoice.dueDate) })}</p>
    <Amounts values={[
      ['billing.invoiceTotal', invoice.totalCents], ['billing.credits', invoice.creditsAppliedCents], ['billing.writeOffs', invoice.writtenOffCents],
      ['billing.paid', invoice.paidCents], ['billing.balance', invoice.balanceCents],
    ]} />
    <a href={`${path}/bills/${encodeURIComponent(invoice.id)}/pdf`}>{t('billing.download', { number })}</a>
  </li>;
}

function PaymentRecord({ payment }: { payment: Payment }) {
  const t = useT(), partialRefund = payment.state === 'settled' && payment.refundedCents > 0;
  const detail = details[payment.state];
  return <li data-payment-id={payment.id} className="stack">
    <div className="split"><strong>{t('billing.paymentFor', { number: numberText(payment.invoiceNumber) })}</strong>
      <span className="status">{t(partialRefund ? 'billing.state.partialRefund' : states[payment.state] ?? 'billing.state.unknown')}</span></div>
    <p>{t(payment.kind === 'card' ? 'billing.card' : payment.kind === 'us_bank_account' ? 'billing.bank' : 'billing.methodUnknown')}</p>
    <Amounts values={[
      ['billing.recordedAmount', payment.amountCents], ['billing.refundedAmount', payment.refundedCents], ['billing.netAmount', payment.netCents],
    ]} />
    <p className="muted">{payment.lastObservedAt ? t('billing.lastObserved', { when: when(payment.lastObservedAt) }) : t('billing.notObserved')}</p>
    {payment.historical && <p>{t('billing.historical')}</p>}
    {(detail || partialRefund) && <p>{t(partialRefund ? 'billing.refundNote' : detail)}</p>}
  </li>;
}

/** Client balances and recorded payment observations are read only. */
export function ClientBilling({ billing, path }: { billing: Billing; path: string }) {
  const t = useT(), open = billing.invoices.filter(invoice => invoice.balanceCents > 0);
  return <section className="panel stack" aria-labelledby="billing" style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: '1rem' }}>
    <h2 id="billing">{t('billing.title')}</h2>
    <p className="muted">{t('billing.asOf', { when: when(billing.asOf) })}</p>
    <section className="stack" aria-labelledby="billing-statement">
      <h3 id="billing-statement">{t('billing.statement')}</h3>
      <Amounts values={[
        ['billing.invoiced', billing.totals.invoicedCents], ['billing.credits', billing.totals.creditsAppliedCents], ['billing.writeOffs', billing.totals.writtenOffCents],
        ['billing.paid', billing.totals.paidCents], ['billing.balance', billing.totals.openCents],
      ]} />
    </section>
    <section className="stack" aria-labelledby="billing-open">
      <h3 id="billing-open">{t('billing.openInvoices')}</h3>
      {open.length ? <ul className="list">{open.map(invoice => <InvoiceRecord key={invoice.id} invoice={invoice} path={path} />)}</ul> : <p className="muted">{t('billing.noOpen')}</p>}
    </section>
    <section className="stack" aria-labelledby="billing-payments">
      <h3 id="billing-payments">{t('billing.paymentHistory')}</h3><p>{t('billing.provenance')}</p>
      {billing.payments.length ? <ul className="list">{billing.payments.map(payment => <PaymentRecord key={payment.id} payment={payment} />)}</ul> : <p className="muted">{t('billing.noPayments')}</p>}
    </section>
    <section className="stack" aria-labelledby="billing-invoices">
      <h3 id="billing-invoices">{t('billing.invoiceHistory')}</h3>
      {billing.invoices.length ? <ul className="list">{billing.invoices.map(invoice => <InvoiceRecord key={invoice.id} invoice={invoice} path={path} />)}</ul> : <p className="muted">{t('billing.noInvoices')}</p>}
    </section>
  </section>;
}
