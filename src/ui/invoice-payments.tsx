import { useEffect, useRef, useState } from 'react';
import { api, Empty, Field, Form, money, Status, when, type Row, type Run } from './common';

type Payment = { id: string; state: string; amount_cents: number; refunded_cents: number; fee_cents: number; provider_id: string | null; created_at: string };
type Mandate = { id: string; status: string; kind: 'card' | 'us_bank_account' | null; last4: string | null; max_cents: number; remaining_cents: number; authorized_at: string };
type PaymentState = { configured: boolean; availableCents: number; payments: Payment[]; mandates: Mandate[] };
type Change = (job: () => Promise<unknown>, message: string) => Promise<void>;
const refundable = (payment: Payment) => payment.state === 'settled' && payment.amount_cents > payment.refunded_cents;
const methodName = (mandate: Mandate) => mandate.last4 ? `${mandate.kind === 'card' ? 'Card' : 'Bank account'} ending ${mandate.last4}` : 'Payment method awaiting confirmation';

function PaymentRecord({ payment, billing, busy, change }: { payment: Payment; billing: boolean; busy: boolean; change: Change }) {
  const remaining = payment.amount_cents - payment.refunded_cents;
  return <article className="record stack" aria-label={`Payment ${payment.id}`}>
    <div className="split"><strong>{money(payment.amount_cents)}</strong><Status value={payment.state} /></div>
    <p>{when(payment.created_at)} · refunded {money(payment.refunded_cents)} · provider fee {money(payment.fee_cents)}</p>
    <p style={{ overflowWrap: 'anywhere' }}>Provider reference: {payment.provider_id || 'Not assigned'}</p>
    {billing && <details><summary>Manage payment</summary>
      <button type="button" className="quiet" disabled={busy} onClick={() => change(() => api(`/payments/${payment.id}/reconcile`, {}), 'Payment reconciled with Stripe')}>Reconcile payment</button>
      {refundable(payment) && <Form label="Refund payment" danger disabled={busy} submit={data => change(() => api(`/payments/${payment.id}/refund`, { amountCents: Number(data.amountCents), reason: data.reason, requestId: crypto.randomUUID() }), 'Refund recorded with Stripe')}>
        <Field label="Refund amount in USD cents" name="amountCents"><input name="amountCents" type="number" min={1} max={remaining} step={1} defaultValue={remaining} required /></Field>
        <Field label="Refund reason" name="reason" />
      </Form>}
    </details>}
  </article>;
}

/** Stripe collection and provider outcomes belong beside the issued invoice. */
export function InvoicePayments({ invoice, billing, run, tick }: { invoice: Row; billing: boolean; run: Run; tick: number }) {
  const [state, setState] = useState<PaymentState>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; paymentId: string; amountCents: number }>();
  const pending = useRef(false);
  const load = async () => { const value = await api(`/invoices/${invoice.id}/payments`); setState(value); setError(''); };
  useEffect(() => {
    let current = true;
    api(`/invoices/${invoice.id}/payments`).then(value => { if (current) { setState(value); setError(''); } }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [invoice.id, tick]);
  const change: Change = async (job, message) => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await run(async () => { await job(); await load(); }, message); }
    finally { pending.current = false; setBusy(false); }
  };
  const active = state?.mandates.filter(mandate => mandate.status === 'active') ?? [];
  const eligible = active.filter(mandate => mandate.remaining_cents >= invoice.balance_cents);
  const canWrite = billing && !!state?.configured;
  return <section className="stack" aria-label="Invoice payments" aria-busy={busy}>
    <h4>Payments</h4>
    {error && <p role="alert">{error} <button type="button" className="quiet" onClick={() => load().catch(e => setError(e.message))}>Refresh payments</button></p>}
    {!state ? !error && <p>Opening payments…</p> : <>
      {!state.configured && <p role="status">Stripe payments are not configured for this firm.</p>}
      {canWrite && state.availableCents >= 50 && <details><summary>Collect payment</summary>
        <Form label="Create payment link" disabled={busy} submit={data => change(async () => { const amountCents = Number(data.amountCents); const created = await api(`/invoices/${invoice.id}/payment-link`, { amountCents }); setLink({ ...created, amountCents }); }, 'Stripe payment link created')}>
          <Field label="Payment link amount in USD cents" name="amountCents"><input name="amountCents" type="number" min={50} max={state.availableCents} step={1} defaultValue={state.availableCents} required /></Field>
        </Form>
        {active.length ? <Form label="Quick collect" disabled={busy || !eligible.length || state.availableCents<invoice.balance_cents} submit={data => change(() => api(`/invoices/${invoice.id}/quick-collect`, { mandateId: data.mandateId, requestId: crypto.randomUUID() }), 'Collection requested with the saved payment method')}>
          <p>Collect the open balance of {money(invoice.balance_cents)} using the client's authorized saved method.</p>
          <Field label="Saved payment method" name="mandateId"><select name="mandateId" required defaultValue={eligible[0]?.id ?? ''}><option value="">Choose a saved method</option>{active.map(mandate => <option key={mandate.id} value={mandate.id} disabled={mandate.remaining_cents < invoice.balance_cents}>{methodName(mandate)} · remaining authority USD {(mandate.remaining_cents / 100).toFixed(2)}</option>)}</select></Field>
          {!eligible.length && <p>The saved methods have insufficient remaining authorization for the open balance. Create a payment link for a partial amount.</p>}
        </Form> : <p>No active saved payment method. The client can authorize one in their portal.</p>}
      </details>}
      {canWrite && state.availableCents<invoice.balance_cents && <p>A collection is awaiting confirmation. Reconcile its outcome before collecting the reserved amount again.</p>}
      {link && <div className="record stack" role="status" aria-label="Created payment link">
        <p>Stripe payment link for {money(link.amountCents)}</p>
        <Field label="Stripe payment link" name="paymentLink"><input name="paymentLink" type="url" readOnly value={link.url} onFocus={event => event.currentTarget.select()} /></Field>
        <p><a href={link.url} target="_blank" rel="noreferrer">Open Stripe payment link</a></p>
      </div>}
      {!state.payments.length ? <Empty>No provider payments recorded.</Empty> : state.payments.map(payment => <PaymentRecord key={payment.id} payment={payment} billing={canWrite} busy={busy} change={change} />)}
      <details><summary>Saved payment methods ({state.mandates.length})</summary>
        {!state.mandates.length ? <Empty>No saved payment methods.</Empty> : state.mandates.map(mandate => <article key={mandate.id} className="record stack" aria-label={`Saved method ${mandate.id}`}>
          <div className="split"><strong>{methodName(mandate)}</strong><Status value={mandate.status} /></div>
          <p>Authorized {when(mandate.authorized_at)} · limit {money(mandate.max_cents)}</p>
          {billing && ['active', 'pending'].includes(mandate.status) && <Form label="Revoke saved method" danger disabled={busy} submit={data => change(() => api(`/payment-mandates/${mandate.id}/revoke`, { reason: data.reason }), 'Saved payment method revoked')}><Field label="Reason to revoke saved method" name="reason" /></Form>}
        </article>)}
      </details>
    </>}
  </section>;
}
