import { money, type Row } from './common';

const percent = (bps: number | null) => bps === null ? 'n/a' : `${(bps / 100).toFixed(1)}%`;
const figures = (g: Row) => <>
  <p>Recorded {money(g.recordedCents)} · write-ups {money(g.writeUpCents)} · write-downs {money(g.writeDownCents)} · billed {money(g.billedCents)} · realization of billed against recorded {percent(g.billedRealizationBps)}</p>
  <p>Collected {money(g.collectedCents)} · credits applied {money(g.creditedCents)} · written off {money(g.writtenOffCents)} · uncollected {money(g.outstandingCents)} · settled {percent(g.settledBps)} of billed with tax</p>
  <p>Invoiced expense cost {money(g.expenseCostCents)} · margin before staff cost {money(g.netMarginBeforeStaffCostCents)}</p>
  {g.staffCostCents !== null && <p>Staff cost of invoiced time {money(g.staffCostCents)}{g.unratedStaffMinutes > 0 && ` (${g.unratedStaffMinutes} minutes have no cost rate)`} · <strong>profit {money(g.profitCents)}</strong></p>}
</>;

/** BILL-003: WIP, aging, retainer earning, realization and profitability beside the invoice records. */
export function ReportReceivables({ data, open }: { data: Row; open: (id: string) => void }) {
  return <section aria-label="Receivables and profitability" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
    <h3>Receivables, realization and profitability</h3>
    <p className="muted">As of {data.asOf}. {data.basis}</p>
    <h4>Aged receivables</h4>
    <table className="table"><thead><tr><th>Aging</th><th className="amount">Uncollected</th></tr></thead><tbody>
      {data.aging.map((b: Row) => <tr key={b.bucket}><td data-label="Aging">{b.bucket}</td><td className="amount" data-label="Uncollected">{money(b.cents)}</td></tr>)}
    </tbody></table>
    <p>Retainers earned {money(data.retainers.earnedCents)} · deferred (billed for a later month) {money(data.retainers.deferredCents)}</p>
    <h4>All selected work</h4>{figures(data.totals)}
    {([['clients', 'By client'], ['services', 'By service'], ['jobs', 'By job']] as const).map(([key, label]) => <section key={key} aria-label={label}>
      <h4>{label}</h4><div className="stack">{data[key].map((g: Row) => <details className="record" key={JSON.stringify(g.id)}>
        <summary>{g.name || 'Unassigned service'} · uncollected {money(g.outstandingCents)} · margin before staff cost {money(g.netMarginBeforeStaffCostCents)}</summary>
        {key === 'clients' && <p>Unbilled WIP {money(g.wipCents)}</p>}{figures(g)}
        <div className="actions">{g.jobIds.map((id: string) => <button key={id} onClick={() => open(id)}>Open source job</button>)}</div>
      </details>)}</div>
    </section>)}
  </section>;
}
