import { money, when, type Row } from './common';

/** Calculation inputs with their native record identifiers, amounts and authors. */
export function ReportSources({job}:{job:Row}) {
  const s=job.financial.sources,code=job.financial.currency;
  return <details><summary>Calculation inputs and source history</summary>
    <h4>Approved time and corrections</h4><ul>{s.time.map((t:Row)=><li key={t.id}>{t.date} · {t.person_email} · {t.minutes} min · {money(t.amount_cents,code)} · {t.description} · record {t.id}</li>)}{s.adjustments.map((a:Row)=><li key={a.id}>Correction {money(a.amount_cents,code)}: {a.reason} · {a.created_by} · {when(a.created_at)}</li>)}</ul>
    <h4>Approved expenses</h4><ul>{s.expenses.map((e:Row)=><li key={e.id}>{e.description}: cost {money(e.cost_cents,code)}, charge {money(e.charge_cents,code)} · approved by {e.decided_by} · {when(e.decided_at)}</li>)}</ul>
    <h4>Approved billing exports</h4><ul>{s.exports.map((e:Row)=><li key={e.exportId+'-'+e.line}><a href={e.download}>Export {e.exportId.slice(0,8)}, line {e.line}</a>: {e.description} · {money(e.amount_cents,code)} · approved {when(e.approvedAt)}</li>)}</ul>
    <h4>Client document response</h4><ul>{job.requestDelays.map((r:Row)=><li key={r.id}>{r.label}: {r.asked_at?`Requested ${when(r.asked_at)}`:'No provider-accepted request'} · {r.responded_at?`received ${when(r.responded_at)}`:'awaiting retained client evidence'} · {r.delayMinutes??'—'} min</li>)}</ul>
    <h4>Review returns</h4><ul>{job.reviewReturns.map((r:Row)=><li key={r.id}>{r.detail} · {r.actor} · {when(r.at)}</li>)}</ul>
    <h4>Status changes</h4><ul>{job.statusHistory.map((h:Row)=><li key={h.id}>{h.to_stage.replaceAll('_',' ')}{h.sub?' / '+h.sub:''} · {h.by} · {when(h.at)}</li>)}</ul>
  </details>;
}

export function ReportCapacitySources({person}:{person:Row}) {
  return <><ul>{person.weeks.map((w:Row)=><li key={w.week}>Week of {w.week}: {w.availableMinutes} available min · {w.leaveMinutes} leave min · {w.commitmentMinutes} commitment min
    <ul>{w.blocks.map((b:Row)=><li key={b.id}>{b.label}: {b.startsOn}–{b.endsOn} · {b.minutes} min</li>)}{w.jobs.map((j:Row,n:number)=><li key={n}><a href={'/app?job='+j.jobId}>{j.work}</a> · {j.label} · {j.estimateMinutes} planned min</li>)}</ul></li>)}</ul>
    <p>Approved time sources</p><ul>{person.timeSources.map((t:Row)=><li key={t.id}><a href={t.source}>{t.id}</a> · {t.minutes} min · {t.billable?'billable':'non-billable'}</li>)}</ul></>;
}
