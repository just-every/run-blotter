import { useEffect, useState } from 'react';
import { api, day, Empty, ExportLink, Field, Form, money, today, when, type Row, type Run } from './common';

const stepsOf = (value: string) => value.split(',').map(v => v.trim()).filter(Boolean).map(Number);
const stepText = (steps: number[]) => steps.map(n => n < 0 ? `${-n} days before` : n === 0 ? 'on the due date' : `${n} days after`).join(', ');

/** BILL-024: the consented reminder schedule, client overrides, bulk resend and client statements. */
export function InvoiceCollections({ state, clients, billing, run, tick }: { state: Row; clients: Row[]; billing: boolean; run: Run; tick: number }) {
  const [reminders, setReminders] = useState<Row>(), [templates, setTemplates] = useState<Row[]>([]), [resend, setResend] = useState<Row>(), [chosen, setChosen] = useState<string[]>([]), [statement, setStatement] = useState<Row>(), [query, setQuery] = useState<Row>();
  useEffect(() => { api('/invoices/reminders').then(setReminders).catch(e => run(async () => { throw e; })); if (billing) api('/messages/templates').then(r => setTemplates(r.templates.filter((t: Row) => t.scope === 'firm' && t.message_class !== 'marketing'))).catch(e => run(async () => { throw e; })); }, [tick]);
  const policy = reminders?.policy, issued = state.invoices.filter((i: Row) => i.status === 'issued' && !i.erased_at), named = (id: string) => clients.find(c => c.id === id)?.name ?? id;
  return <section className="panel stack" aria-label="Collections"><h2>Collections</h2>
    <h3>Overdue reminders</h3>
    {!policy ? <Empty>No reminder schedule. Invoices are reminded only after a billing person consents to a schedule.</Empty>
      : <p>Reminders are <strong>{policy.status === 'active' ? 'running' : 'paused'}</strong>: {stepText(policy.offsets)}, using the firm template version {policy.template_version}. Consent by {policy.consented_by} {when(policy.consented_at)}: {policy.reason}</p>}
    {reminders?.warnings?.map((w: Row) => <p key={w.contactId ?? w.kind} className="error" role="alert">{w.contactName ? `${w.contactName}: ` : ''}{w.message}</p>)}
    <p className="muted">Each run rechecks the consenting person's authority and the billing contact's role, email consent and deliverability. A paid, disputed or payment-plan invoice is not reminded, each step is sent at most once, and every reminder is recorded in the client's history.</p>
    {billing && <details><summary>{policy?.status === 'active' ? 'Change or pause the reminder schedule' : 'Start the reminder schedule'}</summary>
      <Form label="Consent to the reminder schedule" submit={data => run(async () => setReminders(await api('/invoices/reminders', { offsets: stepsOf(data.offsets), templateId: data.templateId, reason: data.reason })), 'Reminder schedule recorded')}>
        <Field label="Reminder steps in days from the due date (negative is before)" name="offsets" value={policy ? policy.offsets.join(', ') : '-3, 0, 7, 14, 30'} />
        <Field label="Reminder template" name="templateId" hint={reminders?.spanishRecipients ? `${reminders.spanishRecipients} billing contact${reminders.spanishRecipients === 1 ? '' : 's'} with open invoices read${reminders.spanishRecipients === 1 ? 's' : ''} Spanish: a template with no Spanish version sends them the English text.` : undefined}><select name="templateId">{templates.map(t => <option key={t.id} value={t.id}>{t.name} · v{t.version}{reminders?.spanishRecipients ? (t.translations?.length ? ' · has a Spanish version' : ' · no Spanish version') : ''}</option>)}</select></Field>
        <Field label="Consent and reason recorded in audit" name="reason" />
      </Form>
      {policy?.status === 'active' && <Form danger label="Pause reminders" submit={data => run(async () => setReminders(await api('/invoices/reminders', { status: 'paused', reason: data.reason })), 'Reminders paused')}><Field label="Reason to pause" name="reason" /></Form>}
    </details>}
    {(reminders?.clients ?? []).length > 0 && <ul className="list">{reminders!.clients.map((c: Row) => <li key={c.client_id}>{named(c.client_id)}: {c.mode === 'off' ? 'no reminders' : stepText(c.offsets)} · {c.reason}</li>)}</ul>}
    {billing && <details><summary>Client reminder override</summary>
      <Form label="Save client reminder setting" submit={data => run(async () => { await api(`/clients/${data.clientId}/invoice-reminders`, { mode: data.mode, offsets: data.mode === 'custom' ? stepsOf(data.offsets) : undefined, reason: data.reason }); setReminders(await api('/invoices/reminders')); }, 'Client reminder setting saved')}>
        <Field label="Client" name="clientId"><select name="clientId">{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Reminders for this client" name="mode"><select name="mode"><option value="firm">Firm schedule</option><option value="off">No reminders</option><option value="custom">Custom steps</option></select></Field>
        <Field label="Custom steps in days from the due date" name="offsets" required={false} /><Field label="Reason" name="reason" />
      </Form>
    </details>}
    {billing && <details><summary>Resend invoices</summary>
      {!issued.length ? <Empty>No issued invoices.</Empty> : <Form label="Preview resend" submit={data => run(async () => { const input = { invoiceIds: chosen, reason: data.reason }; setQuery(input); setResend(await api('/invoices/resend-preview', input)); })}>
        <fieldset><legend>Invoices to resend</legend>{issued.map((i: Row) => <label className="check" key={i.id}><input type="checkbox" checked={chosen.includes(i.id)} onChange={e => setChosen(e.target.checked ? [...chosen, i.id] : chosen.filter(x => x !== i.id))} />INV-{String(i.number).padStart(6, '0')} · {i.title} · {money(i.balance_cents)}</label>)}</fieldset>
        <Field label="Reason to resend" name="reason" />
      </Form>}
      {resend && <div className="record"><ul>{resend.items.map((item: Row) => <li key={item.invoiceId}>{item.subject} to {item.recipient.name} · {item.recipient.email}{item.recipient.portal ? ' (with portal link)' : ' (email only)'}</li>)}</ul>
        <button onClick={() => run(async () => { await api('/invoices/resend', { ...query, previewHash: resend.previewHash }); setResend(undefined); setChosen([]); }, 'Invoices resent')}>Resend {resend.items.length} invoices</button></div>}
    </details>}
    <details><summary>Client statement</summary>
      <Form label="Prepare statement" submit={data => run(async () => setStatement(await api(`/clients/${data.clientId}/statement?asOf=${data.asOf}`)))}>
        <Field label="Statement client" name="clientId"><select name="clientId">{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Statement date" name="asOf" type="date" value={today()} />
      </Form>
      {statement && <div className="record stack"><h4>{statement.client.name} · statement as of {day(statement.asOf)}</h4>
        {!statement.invoices.length ? <Empty>No open invoices.</Empty> : <table className="table"><thead><tr><th>Invoice</th><th>Due</th><th>Aging</th><th className="amount">Written off</th><th className="amount">Balance</th></tr></thead><tbody>
          {statement.invoices.map((i: Row) => <tr key={i.id}><td data-label="Invoice">{i.number} · {i.title}{i.hold && <small className="muted"> · {i.hold === 'disputed' ? 'disputed' : 'payment plan'}</small>}</td><td data-label="Due">{day(i.dueDate)}</td><td data-label="Aging">{i.aging}</td><td className="amount" data-label="Written off">{money(i.writtenOffCents)}</td><td className="amount" data-label="Balance">{money(i.balanceCents)}</td></tr>)}
        </tbody></table>}
        {statement.credits.length > 0 && <ul>{statement.credits.map((c: Row) => <li key={c.id}>{c.kind} {c.reference}: {money(c.amountCents)} recorded, {money(c.appliedCents)} applied, {money(c.availableCents)} available</li>)}</ul>}
        {statement.payments?.length > 0 && <ul>{statement.payments.map((p: Row) => <li key={p.id} style={{overflowWrap:'anywhere'}}>Stripe {p.provider_id}: {p.state} · net {money(p.net_cents)} · observed fee {money(p.fee_cents)}</li>)}</ul>}
        <p>{statement.paymentsNote}</p>
        <p>Open balance {money(statement.totals.openCents)} · unapplied credits {money(statement.totals.availableCreditCents)} · <strong>net {money(statement.totals.netCents)}</strong></p>
        <p><ExportLink className="button" href={`/api/blotter/clients/${statement.client.id}/statement/csv?asOf=${statement.asOf}`}>Download statement CSV</ExportLink></p>
      </div>}
    </details>
  </section>;
}

/** Per-invoice collection controls: dispute or payment-plan hold, quick collect and the reminder log. */
export function InvoiceCollectionControls({ detail, billing, run }: { detail: Row; billing: boolean; run: Run }) {
  return <>
    {detail.collection_hold && <p>Reminders stopped: {detail.collection_hold === 'disputed' ? 'disputed' : 'payment plan'}{detail.collection_note && ` · ${detail.collection_note}`}</p>}
    {detail.reminders?.length > 0 && <details><summary>Reminders ({detail.reminders.length})</summary><ul>{detail.reminders.map((r: Row) => <li key={r.id}>{r.step < 0 ? `${-r.step} days before due` : r.step === 0 ? 'On the due date' : `${r.step} days after due`} ({day(r.scheduled_on)}) · {r.status} · {r.delivery}</li>)}</ul></details>}
    {billing && detail.status === 'issued' && !detail.erased_at && <details><summary>Collection</summary>
      <Form label="Save collection status" submit={data => run(() => api(`/invoices/${detail.id}/collection`, { hold: data.hold || null, note: data.note || undefined }), 'Collection status saved')}>
        <Field label="Collection status" name="hold"><select name="hold" defaultValue={detail.collection_hold ?? ''}><option value="">Remind on the schedule</option><option value="disputed">Disputed: stop reminders</option><option value="payment_plan">Payment plan: stop reminders</option></select></Field>
        <Field label="Note" name="note" required={false} />
      </Form>
    </details>}
  </>;
}
