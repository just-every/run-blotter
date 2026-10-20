import { money, type Row } from './common';

/** BILL-003: grouped current financial inputs, with the original job drill-down. */
export function ReportFinancialGroups({report, open}:{report:Row;open:(id:string)=>void}) {
  return <section aria-label="Client and service financial totals">
    <h3>Client and service financial totals</h3>
    <p className="muted">Margin is before staff cost. Approved exports are separate from invoices and collections.</p>
    {([['clients','Client totals'],['services','Service totals']] as const).map(([key,label])=><section key={key} aria-label={label}>
      <h4>{label}</h4><div className="stack">{report.financialBreakdowns[key].map((g:Row)=><details className="record" key={JSON.stringify([g.id,g.currency])}>
        <summary>{g.name||'Unassigned service'} · {g.currency} · margin {money(g.marginBeforeStaffCostCents,g.currency)}</summary>
        <p>Approved time {money(g.approvedTimeCents,g.currency)} · earned fixed fees {money(g.fixedFeeCents,g.currency)} · approved expense charges {money(g.expenseChargeCents,g.currency)} · expense costs {money(g.expenseCostCents,g.currency)}</p>
        <p>Unbilled {money(g.unbilledCents,g.currency)} · approved exports {money(g.approvedExportCents,g.currency)}</p>
        <div className="actions">{g.jobIds.map((id:string)=>{const j=report.jobs.find((j:Row)=>j.id===id);return <button key={id} onClick={()=>open(id)}>{j.title} · {j.period_label}</button>;})}</div>
      </details>)}</div>
      {!report.financialBreakdowns[key].length&&<p>No work in this selection.</p>}
    </section>)}
  </section>;
}
