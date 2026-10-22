import {ReportInvoices} from './report-invoices';
import { ReportFinancialGroups } from './report-financials';
import { ReportReceivables } from './report-receivables';
import { ReportSources, ReportCapacitySources } from './report-sources';
import { useEffect, useState } from 'react';
import { api, Field, Form, money, type Row, type Run, today, when, ExportLink } from './common';

export function Reports({state,run,tick,open}:{state:Row;run:Run;tick:number;open:(id:string)=>void}) {
  const year=today().slice(0,4),[filters,setFilters]=useState<Row>({from:year+'-01-01',to:year+'-12-31',client:'',workType:'',assignee:''}),[report,setReport]=useState<Row>(),[saved,setSaved]=useState<Row>({views:[],schedules:[],runs:[]}),[loaded,setLoaded]=useState(false),[types,setTypes]=useState<Row[]>([]);
  const load=async(f:Row)=>{const result=await api('/reports/performance?'+new URLSearchParams(f));setFilters(f);setReport(result);};
  useEffect(()=>{Promise.all([api('/reports/views'),api('/work-types')]).then(async ([s,m])=>{setSaved(s);setTypes(m.workTypes);const id=new URLSearchParams(location.search).get('report'),v=s.views.find((v:Row)=>v.id===id);await load(v&&!loaded?JSON.parse(v.filters):filters);setLoaded(true);}).catch(e=>run(async()=>{throw e;}));},[tick]);
  return <section className="panel" aria-label="Performance reports"><h2>Performance reports</h2>
    <div key={JSON.stringify(filters)}><Form label="Run report" submit={f=>run(()=>load(f),'Report refreshed')}>
      <div className="form-grid"><Field label="Period from" name="from" type="date" value={filters.from}/><Field label="Period to" name="to" type="date" value={filters.to}/>
        <Field label="Report client" name="client"><select name="client" defaultValue={filters.client}><option value="">All clients</option>{state.clients.map((c:Row)=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Report service / work type" name="workType"><select name="workType" defaultValue={filters.workType}><option value="">All work types</option>{types.map((w:Row)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
        <Field label="Report team member" name="assignee"><select name="assignee" defaultValue={filters.assignee}><option value="">All teams</option>{state.people.map((p:Row)=><option key={p.email} value={p.email}>{p.name}</option>)}</select></Field></div>
    </Form></div>
    {report&&<><p className="muted">Fresh at {when(report.generatedAt)} · {report.timeZone}. {report.basis}</p>
      <p role="status">{report.totals.jobs} jobs · {report.totals.completed} completed · {report.totals.overdue} overdue · {report.totals.blocked} blocked · {report.totals.reviewReturns} review returns</p>
      <p>Average turnaround: {report.totals.averageTurnaroundMinutes??'—'} min. Average client document response/wait: {report.totals.averageClientDelayMinutes??'—'} min.</p>
      <div className="actions">{['csv','pdf'].map(f=><ExportLink key={f} className="button" href={'/api/blotter/reports/performance/'+f+'?'+new URLSearchParams(filters)}>Download report {f.toUpperCase()}</ExportLink>)}</div>
      <h3>Work and source records</h3><div className="stack">{report.jobs.map((j:Row)=><details className="record" key={j.id}><summary>{j.client_name} · {j.title} · {j.period_label} · {j.overdue?'overdue':j.stage}{j.blocked?' · blocked':''}</summary>
        <p><button onClick={()=>open(j.id)}>Open source job</button> Due {j.due_date}: {j.dueSource}. Turnaround {j.turnaroundMinutes??'pending'} min.</p>
        <p>Margin before staff cost {money(j.financial.marginBeforeStaffCostCents,j.financial.currency)} · unbilled {money(j.financial.unbilledCents,j.financial.currency)} · approved exports {money(j.financial.approvedExportCents,j.financial.currency)}</p>
        <ReportSources job={j}/></details>)}</div>
      <h3>Money by stored currency</h3>{report.money.map((m:Row)=><p key={m.currency}>{m.currency}: approved time {money(m.approvedTimeCents,m.currency)} · earned fixed fees {money(m.fixedFeeCents,m.currency)} · approved expense charges {money(m.expenseChargeCents,m.currency)} · expense costs {money(m.expenseCostCents,m.currency)} · margin before staff cost {money(m.marginBeforeStaffCostCents,m.currency)}</p>)}
      <ReportFinancialGroups report={report} open={open}/><ReportReceivables data={report.invoiceReporting.receivables} open={open}/><ReportInvoices data={report.invoiceReporting} open={open}/>
      <h3>Status history by work type</h3>{report.statuses.map((s:Row,n:number)=><p key={n}>{s.workType} · {s.label}{s.subStatus?' / '+s.subStatus:''}: {s.current} current · {s.entries} entries · {s.minutes} min</p>)}
      <h3>Capacity and utilization</h3>{report.people.map((p:Row)=><details key={p.email}><summary>{p.name}: {p.billableMinutes} billable min / {p.availableMinutes} available min · {p.utilizationPercent??'—'}% · {p.demandMinutes} planned min</summary><ReportCapacitySources person={p}/></details>)}
      <Form label="Save report view" submit={f=>run(()=>api('/reports/views',{...filters,name:f.name}),'Report view saved')}><Field label="Report view name" name="name"/></Form>
    </>}
    <h3>Saved reports</h3>{saved.views.map((v:Row)=><p key={v.id}><button onClick={()=>run(()=>load(JSON.parse(v.filters)),'Saved report opened')}>{v.name}</button> · {v.created_by}</p>)}
    {state.actor.role==='owner'&&<details><summary>Schedule an internal report</summary><p>Partners receive a live link. Every read checks their current permission. Notification hours apply; no financial attachments are mailed.</p><Form label="Schedule report" submit={f=>run(()=>api('/reports/schedules',f),'Internal report scheduled')}>
      <Field label="Saved report" name="viewId"><select name="viewId" required>{saved.views.map((v:Row)=><option key={v.id} value={v.id}>{v.name}</option>)}</select></Field>
      <Field label="Report partner" name="recipient"><select name="recipient">{state.people.filter((p:Row)=>p.role==='owner'||p.role==='reviewer').map((p:Row)=><option key={p.email} value={p.email}>{p.name}</option>)}</select></Field>
      <Field label="First report date" name="nextDate" type="date" value={today()}/><Field label="Report interval days" name="everyDays" type="number" value={7}/></Form></details>}
    {saved.schedules.map((s:Row)=><p key={s.id}>{saved.views.find((v:Row)=>v.id===s.view_id)?.name} → {s.recipient} · {s.status} · next {s.next_date} · {saved.runs.filter((r:Row)=>r.schedule_id===s.id).length} queued reports {state.actor.role==='owner'&&s.status==='active'&&<button onClick={()=>run(()=>api(`/reports/schedules/${s.id}/pause`,{}),'Report schedule paused')}>Pause report</button>}</p>)}
  </section>;
}
