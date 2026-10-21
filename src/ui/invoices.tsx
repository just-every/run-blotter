import { useEffect, useState } from 'react';
import { api, day, Empty, Field, Form, money, prose, Status, today, when, type Row, type Run } from './common';

function InvoiceLines({ snapshot }: { snapshot: Row }) {
  return <div className="stack">
    <p><strong>{snapshot.title}</strong> · {snapshot.client.name} · {snapshot.job.title}</p>
    <p>Recipient: {snapshot.recipient.name} · {snapshot.recipient.email}. Issue {day(snapshot.issueDate)}; due {day(snapshot.dueDate)}.</p>
    <table className="table"><thead><tr><th>Line and source</th><th className="amount">USD amount</th></tr></thead><tbody>
      {snapshot.lines.map((line: Row) => <tr key={line.source_key}><td data-label="Line and source">{line.description}<small className="muted"> · {line.reference || line.source_key}</small></td><td className="amount" data-label="USD amount">{money(line.amount_cents)}</td></tr>)}
    </tbody></table>
    <p>Subtotal {money(snapshot.subtotalCents)} · supplied tax {money(snapshot.taxCents)} · credits {money(snapshot.creditCents)} · <strong>Amount due {money(snapshot.totalCents)}</strong></p>
    <p>{snapshot.taxTreatment} · Authority: {snapshot.taxAuthorization}</p><p>Terms: {snapshot.terms}</p>
    {snapshot.credits.map((credit: Row) => <p key={credit.creditId}>{credit.kind}: {credit.reference} · {money(credit.amountCents)}</p>)}
  </div>;
}

function TaxTerms() {
  return <><Field label="Payment terms" name="terms" value="Due by the recorded invoice due date" />
    <Field label="Supplied sales tax in USD cents" name="taxCents" type="number" value={0} />
    <Field label="Authorized sales-tax treatment" name="taxTreatment" hint="Record the authorized treatment. Blotter does not determine taxability or calculate tax." />
    <Field label="Tax authorization and source" name="taxAuthorization" /></>;
}

function InvoiceRecord({ item, contacts, owner, run, tick }: { item: Row; contacts: Row[]; owner: boolean; run: Run; tick: number }) {
  const [detail, setDetail] = useState<Row>(), [opened, setOpened] = useState(false), [sendPreview, setSendPreview] = useState<Row>(), [sendInput, setSendInput] = useState<Row>();
  useEffect(() => { if (opened) api(`/invoices/${item.id}`).then(setDetail).catch(e => run(async () => { throw e; })); }, [opened, tick, item.revision]);
  const last = detail?.deliveries.at(-1);
  return <article className="record">
    <div className="split"><strong>{item.number ? `INV-${String(item.number).padStart(6, '0')}` : 'Draft'} · {item.title}</strong><Status value={item.status} /></div>
    <p>Issued amount {money(item.total_cents)} · balance {money(item.balance_cents)} · due {day(item.due_date)}</p>
    <details onToggle={event => setOpened(event.currentTarget.open)}><summary>Review invoice, sources and history</summary>
      {detail && <div className="stack">
        {detail.snapshot.erased ? <p>Personal snapshot erased after confirmed retention expiry.</p> : <InvoiceLines snapshot={detail.snapshot} />}
        <p>Prepared by {detail.prepared_by} {when(detail.prepared_at)}{detail.issued_by && ` · issued by ${detail.issued_by} ${when(detail.issued_at)}`}</p>
        {item.number && !item.erased_at && <p><a className="button" href={`/api/blotter/invoices/${item.id}/pdf`}>Download invoice PDF</a></p>}
        {owner && detail.status === 'draft' && <Form label="Approve and issue numbered PDF" submit={data => run(() => api(`/invoices/${item.id}/issue`, { ...data, revision: detail.revision, snapshotHash: detail.snapshotHash }), 'Invoice issued with fixed PDF and source links')}><Field label="Approval note" name="reviewNote" /></Form>}
        {owner && detail.status === 'issued' && !detail.erased_at && <>
          <Form label="Preview invoice delivery" submit={async data => run(async () => { const input = { ...data, previousDeliveryId: last?.id }; setSendInput(input); setSendPreview(await api(`/invoices/${item.id}/delivery-preview`, input)); })}>
            <Field label="Invoice recipient" name="contactId"><select name="contactId" defaultValue={detail.snapshot.recipient?.id}>{contacts.filter(c => c.client_id === detail.client_id).map(c => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select></Field>
            {last && <Field label="Reason to deliver again" name="resendReason" />}
          </Form>
          {sendPreview && <div className="record"><p>Send {sendPreview.subject} to <strong>{sendPreview.recipient.name} · {sendPreview.recipient.email}</strong>, with the approved PDF and a private invoice link.</p>
            <button onClick={() => run(async () => { await api(`/invoices/${item.id}/send`, { ...sendInput, previewHash: sendPreview.previewHash }); setSendPreview(undefined); }, 'Invoice delivery recorded')}>Deliver PDF and portal invoice</button></div>}
          {last && ['dispatching', 'held'].includes(last.status) && <Form label="Record provider reconciliation" submit={data => run(() => api(`/invoice-deliveries/${last.id}/reconcile`, data), 'Provider outcome recorded; no email replayed')}>
            <Field label="Provider outcome" name="outcome"><select name="outcome"><option value="accepted">Provider accepted</option><option value="not_sent">Provider confirms not sent</option></select></Field><Field label="Provider evidence and reason" name="evidence" />
          </Form>}
          <details><summary>Apply a recorded credit to the balance</summary><Form label="Apply recorded credit" submit={data => run(() => api(`/invoices/${item.id}/credits`, data), 'Credit allocated; issued PDF unchanged')}><Field label="Credit ID" name="creditId" /><Field label="Applied USD cents" name="amountCents" type="number" /><Field label="Allocation reason" name="reason" /></Form></details>
        </>}
        {owner && detail.status !== 'void' && <details><summary>Void invoice</summary><p>{detail.number ? 'The numbered PDF and source reservations remain in history.' : 'Voiding a draft releases its source reservations.'}</p><Form danger label="Void invoice" submit={data => run(() => api(`/invoices/${item.id}/void`, { ...data, revision: detail.revision }), 'Invoice voided')}><Field label="Void reason" name="reason" /></Form></details>}
        <ul>{detail.deliveries.map((d: Row) => <li key={d.id}>{d.recipient_name} · {d.recipient_email} · {d.delivery} · {when(d.sent_at)}</li>)}</ul>
        <details><summary>Audited invoice history</summary><ul>{detail.history.map((event: Row) => <li key={event.id}>{when(event.at)} · {event.actor} · {event.action}: {prose(event.detail)}</li>)}</ul></details>
      </div>}
    </details>
  </article>;
}

function RetainerRecord({ item, amendments, owner, run }: { item: Row; amendments: Row[]; owner: boolean; run: Run }) {
  const [preview, setPreview] = useState<Row>(), [input, setInput] = useState<Row>();
  const definition = JSON.parse(item.definition);
  return <article className="record"><div className="split"><strong>{item.title} · {money(definition.amountCents ?? 0)} monthly</strong><Status value={item.status} /></div>
    <p>From {item.start_month}; bill on day {definition.billDay}, due {definition.dueDays} days later. Drafts require principal approval.{item.cancelled_from && ` Cancelled from ${item.cancelled_from}.`}</p>
    {owner && <details><summary>Generate or amend this retainer</summary>
      <Form label="Generate monthly draft" submit={data => run(() => api(`/invoice-retainers/${item.id}/generate`, data), 'Monthly draft found or generated once')}><Field label="Billing month" name="period" type="month" value={today().slice(0, 7)} /></Form>
      <Form label="Preview fee amendment" submit={data => run(async () => { setInput(data); setPreview(await api(`/invoice-retainers/${item.id}/amendment-preview`, data)); })}>
        <Field label="Amendment" name="action"><select name="action"><option value="price">Change future monthly price</option><option value="cancel">Cancel from effective month</option></select></Field>
        <Field label="Effective month" name="effectiveMonth" type="month" /><Field label="New monthly USD cents" name="amountCents" type="number" value={definition.amountCents} required={false} />
        <Field label="New supplied sales tax USD cents" name="taxCents" type="number" value={definition.taxCents} required={false} />
        <Field label="Amended tax treatment" name="taxTreatment" value={definition.taxTreatment} required={false} /><Field label="Amended tax authority" name="taxAuthorization" value={definition.taxAuthorization} required={false} />
        <Field label="Amended fee authority" name="authorization" required={false} /><Field label="Amendment reason" name="reason" />
      </Form>
      {preview && <div className="record"><h4>Fee amendment preview</h4><p>Effective {preview.effectiveMonth}: {preview.action === 'cancel' ? 'Cancel future monthly fees' : <>{money(preview.before.amountCents)} → {money(preview.after.amountCents)} monthly</>}.</p>
        <p>{preview.retainedEntitlements.length} existing entitlements keep their recorded prices and source links. {preview.proration}</p><p>{preview.reason}</p>
        <button onClick={() => run(async () => { await api(`/invoice-retainers/${item.id}/amend`, { ...input, previewHash: preview.previewHash }); setPreview(undefined); }, 'Retainer amendment recorded')}>Approve fee amendment</button></div>}
      <Form label={item.status === 'active' ? 'Pause monthly drafts' : 'Review and activate monthly drafts'} submit={data => run(() => api(`/invoice-retainers/${item.id}/status`, { ...data, status: item.status === 'active' ? 'paused' : 'active', revision: item.revision }), 'Retainer schedule reviewed')}><Field label="Rule review and reason" name="reason" /></Form>
    </details>}
    <ul>{amendments.filter(a => a.retainer_id === item.id).map(a => <li key={a.id}>Effective {a.effective_month}: {a.reason} · {a.authorized_by} · {when(a.authorized_at)}</li>)}</ul>
  </article>;
}

export function Invoices({ actor, jobs, clients, run, tick }: { actor: Row; jobs: Row[]; clients: Row[]; run: Run; tick: number }) {
  const [state, setState] = useState<Row>(), [jobId, setJobId] = useState(''), [chosen, setChosen] = useState<string[]>([]), [preview, setPreview] = useState<Row>(), [input, setInput] = useState<Row>();
  useEffect(() => { api('/invoices').then(setState).catch(e => run(async () => { throw e; })); }, [tick]);
  if (!state) return <p>Opening invoices…</p>;
  const owner = actor.role === 'owner', job = jobs.find(j => j.id === jobId), clientId = job?.client_id, contacts = state.contacts.filter((c: Row) => c.client_id === clientId);
  return <section className="panel stack"><h2>Invoices and retainers</h2>
    <p>Native USD invoices separate fee entitlement from work completion. The principal approves supplied tax treatment, sources, credits and recipients before issuing a numbered PDF.</p>
    <p>Invoice authority: <strong>{state.settings ? 'Blotter' : 'Not selected'}</strong></p>
    {owner && !state.settings && <Form label="Select Blotter invoice authority" submit={data => run(() => api('/invoices/authority', { ...data, authority: 'blotter' }), 'Blotter selected as the invoice authority')}><Field label="Authority decision" name="reason" /></Form>}
    {owner && state.settings && <>
      <Field label="Invoice work item" name="invoiceJob"><select name="invoiceJob" value={jobId} onChange={e => { setJobId(e.target.value); setChosen([]); setPreview(undefined); }}><option value="">Choose work</option>{jobs.filter(j => j.currency === 'USD').map(j => <option key={j.id} value={j.id}>{clients.find(c => c.id === j.client_id)?.name} · {j.title} · {j.period_label}</option>)}</select></Field>
      {job && <>
        <details><summary>Authorize a fee entitlement</summary><Form label="Authorize fee entitlement" submit={data => run(() => api('/invoice-entitlements', { ...data, jobId }), 'Fee entitlement authorized independently of job completion')}>
          <Field label="Fee kind" name="kind"><select name="kind"><option value="fixed">Fixed scope</option><option value="milestone">Milestone</option><option value="proration">Explicit proration</option></select></Field>
          <Field label="Entitlement reference" name="reference" /><Field label="Scope or milestone" name="description" /><Field label="Authorized fee in USD cents" name="amountCents" type="number" value={job.fee_cents} /><Field label="Fee authorization and source" name="authorization" />
        </Form></details>
        <details><summary>Record a deposit or credit</summary><p>Record a supplied receipt or credit reference. This does not initiate a payment or establish provider settlement.</p>
          <Form label="Record deposit or credit" submit={data => run(() => api('/invoice-credits', { ...data, clientId }), 'Deposit or credit recorded')}>
            <Field label="Credit kind" name="kind"><select name="kind"><option value="deposit">Deposit</option><option value="credit">Credit</option></select></Field><Field label="External receipt or credit reference" name="reference" /><Field label="USD cents" name="amountCents" type="number" /><Field label="Authority and reason" name="reason" />
          </Form>
        </details>
        <details><summary>Prepare an invoice</summary><Form label="Preview invoice" disabled={chosen.length === 0} submit={data => run(async () => { const credits = data.creditId ? [{ creditId: data.creditId, amountCents: data.creditCents }] : []; const value = { ...data, jobId, sourceKeys: chosen, credits }; setInput(value); setPreview(await api('/invoices/preview', value)); })}>
          <fieldset><legend>Approved sources</legend>{state.sources.filter((s: Row) => s.job_id === jobId).map((s: Row) => <label key={s.source_key}><input type="checkbox" checked={chosen.includes(s.source_key)} onChange={event => setChosen(previous => event.target.checked ? [...previous, s.source_key] : previous.filter(k => k !== s.source_key))} /> {s.description} · {money(s.amount_cents)}</label>)}</fieldset>
          <Field label="Invoice title" name="title" /><Field label="Billing recipient" name="contactId"><select name="contactId">{contacts.map((c: Row) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select></Field>
          <Field label="Issue date" name="issueDate" type="date" value={today()} /><Field label="Due date" name="dueDate" type="date" /><TaxTerms />
          <Field label="Deposit or credit to apply" name="creditId" required={false}><select name="creditId"><option value="">No credit</option>{state.credits.filter((c: Row) => c.client_id === clientId && c.available_cents > 0).map((c: Row) => <option key={c.id} value={c.id}>{c.kind} · {c.reference} · USD {(c.available_cents / 100).toFixed(2)}</option>)}</select></Field>
          <Field label="Applied credit in USD cents" name="creditCents" type="number" value={0} required={false} />
        </Form></details>
        {preview && <div className="record"><h3>Invoice preview</h3><InvoiceLines snapshot={preview.snapshot} /><button onClick={() => run(async () => { await api('/invoices', { ...input, previewHash: preview.previewHash }); setPreview(undefined); setChosen([]); }, 'Invoice draft reserved for principal review')}>Reserve invoice draft</button></div>}
        <details><summary>Start a monthly retainer</summary><Form label="Authorize monthly retainer" submit={data => run(() => api('/invoice-retainers', { ...data, jobId }), 'Monthly draft schedule authorized')}>
          <Field label="Retainer title" name="title" /><Field label="First month" name="startMonth" type="month" value={today().slice(0, 7)} /><Field label="Monthly USD cents" name="amountCents" type="number" />
          <Field label="Monthly billing day" name="billDay" type="number" value={1} /><Field label="Days after issue until due" name="dueDays" type="number" value={14} />
          <Field label="Retainer billing contact" name="contactId"><select name="contactId">{contacts.map((c: Row) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select></Field><TaxTerms /><Field label="Recurring fee and calendar authority" name="authorization" />
        </Form></details>
      </>}
    </>}
    <h3>Monthly retainers</h3>{!state.retainers.length && <Empty>No monthly retainers.</Empty>}{state.retainers.map((r: Row) => <RetainerRecord key={r.id} item={r} amendments={state.amendments} owner={owner} run={run} />)}
    <h3>Invoice documents</h3>{!state.invoices.length && <Empty>No invoice documents.</Empty>}{state.invoices.map((i: Row) => <InvoiceRecord key={i.id} item={i} contacts={state.contacts} owner={owner} run={run} tick={tick} />)}
  </section>;
}

export function InvoicePortal({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<Row>(), [error, setError] = useState('');
  useEffect(() => { api(`/invoice-portal/${encodeURIComponent(token)}`).then(setInvoice).catch(e => setError(e.message)); }, [token]);
  return <main className="portal"><section className="panel stack">{error ? <p role="alert">{error}</p> : !invoice ? <p>Opening invoice…</p> : <>
    <p className="eyebrow">{invoice.firm}</p><h1>{invoice.number}</h1><h2>{invoice.title}</h2><p>{invoice.client} · for {invoice.recipient}</p><Status value={invoice.status} />
    <p>Issued {day(invoice.issueDate)} · due {day(invoice.dueDate)}</p><p>Amount at issue {money(invoice.totalCents)} · <strong>Current balance {money(invoice.balanceCents)}</strong></p>
    <p>{invoice.terms}</p><p>Supplied tax {money(invoice.taxCents)} · {invoice.taxTreatment}</p><a className="button" href={`/api/blotter/invoice-portal/${encodeURIComponent(token)}/pdf`}>Download invoice PDF</a>
    <small className="muted">Private invoice link; expires {day(invoice.expiresAt)}. SHA-256 {invoice.sha256}</small>
  </>}</section></main>;
}
