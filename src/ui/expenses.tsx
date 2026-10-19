import { api, day, money, moneyTotals, Empty, Field, Form, readFile, Status, today, when, who, type Row, type Run } from './common';

const KINDS: Record<string, string> = { filing_fee: 'Filing fee', postage: 'Postage', mileage: 'Mileage', software: 'Software pass-through', other: 'Other' };
const miles = (tenths: number) => (tenths / 10).toFixed(1);

/** A job's expenses (TIME-004): record with a receipt and markup, approve or reject, and the job's margin. */
export function JobExpenses({ detail, actor, people, run }: { detail: Row; actor: Row; people?: Row[]; run: Run }) {
  const { job, expenses, profitability: p } = detail, lead = actor.role !== 'preparer';
  return <section className="panel">
    <h2>Expenses</h2>
    {expenses.length === 0 ? <p className="muted">No expenses recorded yet.</p> : <table className="table"><thead><tr><th>Date</th><th>Expense</th><th className="amount">Cost</th><th className="amount">Client charge</th><th>Paid by</th><th>Status</th></tr></thead>
      <tbody>{expenses.map((e: Row) => <tr key={e.id}>
        <td data-label="Date">{day(e.date)}</td>
        <td data-label="Expense">{KINDS[e.kind]}: {e.description}{e.kind === 'mileage' && <small className="muted"> ({miles(e.mile_tenths)} mi at {money(e.cents_per_mile, e.currency)}/mi)</small>}
          {e.receipt_name && <> · <a href={`/api/blotter/expenses/${e.id}/receipt`}>Receipt</a></>}</td>
        <td data-label="Cost" className="amount">{money(e.cost_cents, e.currency)}</td>
        <td data-label="Client charge" className="amount">{e.billable ? <>{money(e.charge_cents, e.currency)}{e.markup_percent > 0 && <small className="muted"> (+{e.markup_percent}%)</small>}</> : 'Not billable'}</td>
        <td data-label="Paid by">{e.paid_by === 'staff' ? `${who(people, e.person_email)} (reimburse)` : 'Firm'}</td>
        <td data-label="Status"><Status value={e.status} />{e.reason && <small className="muted"> {e.reason}</small>}{e.export_id && <small className="muted"> · exported</small>}
          {lead && e.status === 'pending' && (e.person_email !== actor.email || actor.role === 'owner') && <div className="actions">
            <button className="quiet" onClick={() => run(() => api(`/expenses/${e.id}/decide`, { decision: 'approve' }), 'Expense approved')}>Approve</button>
            <details><summary>Reject</summary><Form danger label="Reject expense" submit={async data => run(() => api(`/expenses/${e.id}/decide`, { decision: 'reject', reason: data.reason }), 'Expense rejected')}><Field label="Reason" name="reason" /></Form></details>
          </div>}</td>
      </tr>)}</tbody></table>}
    <p className="muted">Margin before staff cost: {money(p.marginCents, p.currency)} — fixed fee {money(p.feeCents, p.currency)}, approved time {money(p.timeCents, p.currency)} and billable expense charges {money(p.billableExpenseCents, p.currency)}, less approved expense costs {money(p.expenseCostCents, p.currency)} (of which not billable {money(p.nonBillableExpenseCents, p.currency)}).</p>
    <details><summary>Record an expense</summary>
      <Form label="Record expense" submit={async (data, form) => run(async () => {
        const file = (form.elements.namedItem('receipt') as HTMLInputElement).files?.[0];
        await api(`/jobs/${job.id}/expenses`, {
          kind: data.kind, date: data.date, description: data.description, billable: data.billable === 'on', paidBy: data.paidBy,
          ...(data.kind === 'mileage' ? { miles: data.amount } : { costCents: Math.round(Number(data.amount) * 100) }),
          ...(data.billable === 'on' ? { markupPercent: Number(data.markupPercent || 0) } : {}),
          ...(file ? { receipt: await readFile(file) } : {}),
        });
        form.reset();
      }, 'Expense recorded; a reviewer or the principal approves it')}>
        <div className="row">
          <Field label="Kind" name="kind"><select name="kind">{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Date" name="date" type="date" value={today()} />
        </div>
        <Field label="Description" name="description" />
        <Field label={`Cost in ${job.currency}, or miles for mileage`} name="amount" hint="Mileage uses the firm rate in force on the date" />
        <div className="row">
          <Field label="Paid by" name="paidBy"><select name="paidBy"><option value="firm">The firm</option><option value="staff">Me (reimburse me)</option></select></Field>
          <Field label="Markup % if billable" name="markupPercent" type="number" required={false} value={0} />
        </div>
        <label className="check"><input type="checkbox" name="billable" /> Billable to the client</label>
        <Field label="Receipt (optional)" name="receipt" required={false}><input name="receipt" type="file" /></Field>
      </Form>
    </details>
  </section>;
}

/** Billing-side expense settings: the firm mileage rate and staff reimbursements, kept apart from client charges. */
export function ExpenseSettings({ state, actor, people, run }: { state: Row; actor: Row; people: Row[]; run: Run }) {
  const owner = actor.role === 'owner', owed = state.reimbursements.filter((r: Row) => !r.reimbursed_at);
  return <section className="panel">
    <h2>Staff reimbursements</h2>
    <p className="muted">Approved expenses a staff member paid, owed back at cost. These are separate from what the client is charged.</p>
    {!state.reimbursements.length ? <Empty>No staff reimbursements.</Empty> : <ul>{state.reimbursements.map((r: Row) => <li key={r.id}>
      {who(people, r.person_email)} · {day(r.date)} · {r.client} · {KINDS[r.kind]}: {r.description} · {money(r.cost_cents, r.currency)}{' '}
      {r.reimbursed_at ? <small className="muted">reimbursed by {who(people, r.reimbursed_by)} {when(r.reimbursed_at)}</small>
        : owner && <button className="quiet" onClick={() => run(() => api(`/expenses/${r.id}/reimbursed`, {}), 'Reimbursement recorded')}>Mark reimbursed</button>}
    </li>)}</ul>}
    {owed.length > 0 && <p className="muted">Owed: {moneyTotals(owed, 'cost_cents')}</p>}
    <h3>Mileage rate</h3>
    <p className="muted">{state.mileageRates.length ? state.mileageRates.map((m: Row, n: number) => <span key={m.id ?? n}>{n > 0 && ' · '}{money(m.cents_per_mile, m.currency)}/mi from {day(m.effective_from)}</span>) : 'No mileage rate set yet.'}</p>
    {owner && <details><summary>Set the mileage rate</summary>
      <Form label="Set mileage rate" submit={async data => run(() => api('/mileage-rates', { effectiveFrom: data.effectiveFrom, centsPerMile: Number(data.centsPerMile), currency: data.currency }), 'Mileage rate set')}>
        <Field label="Currency" name="currency"><select name="currency"><option value="USD">USD</option>{(state.mileageRates.some((r: Row) => r.currency === 'AUD') || state.unbilled.some((j: Row) => j.currency === 'AUD') || state.reimbursements.some((r: Row) => r.currency === 'AUD')) && <option value="AUD">AUD</option>}</select></Field>
        <div className="row"><Field label="Cents per mile" name="centsPerMile" type="number" /><Field label="Effective from" name="effectiveFrom" type="date" value={today()} /></div>
      </Form>
    </details>}
  </section>;
}
