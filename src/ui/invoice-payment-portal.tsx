import { useRef, useState } from 'react';
import { api, Field, Form, moneyText, Status, type Row } from './common';
import { useLanguage } from './i18n';

const text = {
  en: {
    title: 'Pay this invoice', amount: 'Payment amount in USD cents', confirm: 'I authorize this payment',
    continue: 'Continue to Stripe', opening: 'Opening Stripe…', details: 'Enter your card or bank details on Stripe.',
    save: 'Save this payment method for staff collection', methods: 'Saved payment methods',
    card: 'Card', bank: 'Bank account', ending: 'ending', revoke: 'Revoke authorization',
    reason: 'Reason to revoke authorization', revoked: 'Saved payment authorization revoked.',
    authorize: (balance: string) => `I authorize staff to collect the remaining balance of this invoice using this saved method, up to ${balance}, in total. No scheduled or other invoice charges. I can revoke this authorization.`,
  },
  es: {
    title: 'Pagar esta factura', amount: 'Importe del pago en centavos de USD', confirm: 'Autorizo este pago',
    continue: 'Continuar a Stripe', opening: 'Abriendo Stripe…', details: 'Ingrese los datos de su tarjeta o cuenta bancaria en Stripe.',
    save: 'Guardar este método de pago para cobros del personal', methods: 'Métodos de pago guardados',
    card: 'Tarjeta', bank: 'Cuenta bancaria', ending: 'terminada en', revoke: 'Revocar autorización',
    reason: 'Motivo para revocar la autorización', revoked: 'Se revocó la autorización de pago guardada.',
    authorize: (balance: string) => `Autorizo al personal a cobrar el saldo restante de esta factura mediante este método guardado, hasta ${balance} en total. No autorizo cargos programados ni de otras facturas. Puedo revocar esta autorización.`,
  },
};
type Copy = typeof text.en;

function CheckoutConsent({ token, balance, copy }: { token: string; balance: number; copy: Copy }) {
  const [confirm, setConfirm] = useState(false), [saveMethod, setSaveMethod] = useState(false), [authorizeSaved, setAuthorizeSaved] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  return <section className="stack" aria-label={copy.title} aria-busy={busy}>
    <h3>{copy.title}</h3><p>{copy.details}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {busy && <p role="status">{copy.opening}</p>}
    <Form label={copy.continue} disabled={busy || !confirm || (saveMethod && !authorizeSaved)} submit={async data => {
      if (pending.current || !confirm || (saveMethod && !authorizeSaved)) return;
      pending.current = true; setBusy(true); setError('');
      try {
        const result = await api(`/invoice-portal/${encodeURIComponent(token)}/pay`, { amountCents: Number(data.amountCents), confirm: true, saveMethod, authorizeSaved: saveMethod && authorizeSaved, requestId: crypto.randomUUID() });
        window.location.assign(result.url);
      } catch (e) { setError((e as Error).message); pending.current = false; setBusy(false); }
    }}>
      <Field label={copy.amount} name="amountCents"><input name="amountCents" type="number" min={50} max={balance} step={1} defaultValue={balance} required disabled={busy} /></Field>
      <label className="check"><input type="checkbox" name="confirm" checked={confirm} required disabled={busy} onChange={event => setConfirm(event.target.checked)} /> {copy.confirm}</label>
      <label className="check"><input type="checkbox" name="saveMethod" checked={saveMethod} disabled={busy} onChange={event => { setSaveMethod(event.target.checked); setAuthorizeSaved(false); }} /> {copy.save}</label>
      {saveMethod && <label className="check"><input type="checkbox" name="authorizeSaved" checked={authorizeSaved} required disabled={busy} onChange={event => setAuthorizeSaved(event.target.checked)} /> {copy.authorize(moneyText(balance))}</label>}
    </Form>
  </section>;
}

function SavedPortalMethod({ token, method, copy }: { token: string; method: Row; copy: Copy }) {
  const [status, setStatus] = useState(method.status), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const pending = useRef(false);
  return <article className="record stack">
    <div className="split"><strong>{method.kind === 'card' ? copy.card : copy.bank} {copy.ending} {method.last4}</strong><Status value={status} /></div>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {status === 'active' && <Form label={copy.revoke} danger disabled={busy} submit={async data => {
      if (pending.current) return;
      pending.current = true; setBusy(true); setError('');
      try {
        const result = await api(`/invoice-portal/${encodeURIComponent(token)}/mandates/${encodeURIComponent(method.id)}/revoke`, { reason: data.reason });
        setStatus(result.status); setNotice(copy.revoked);
      } catch (e) { setError((e as Error).message); }
      finally { pending.current = false; setBusy(false); }
    }}><Field label={copy.reason} name="reason" /></Form>}
  </article>;
}

/** A client grants payment and invoice-bounded staff collection separately before opening hosted Checkout. */
export function InvoicePaymentPortal({ token, invoice }: { token: string; invoice: Row }) {
  const copy = text[useLanguage()];
  const methods: Row[] = invoice.savedMethods ?? [];
  return <>
    {invoice.paymentsConfigured && invoice.balanceCents >= 50 && <CheckoutConsent token={token} balance={invoice.balanceCents} copy={copy} />}
    {methods.length > 0 && <details><summary>{copy.methods}</summary>{methods.map(method => <SavedPortalMethod key={method.id} token={token} method={method} copy={copy} />)}</details>}
  </>;
}
