import { financialBreakdowns } from './report-financials';
// REPORT-001: live projections, with no duplicate store of client evidence.
import { firmSettings, localClock } from './firm';
import { listJobs, parseFilters } from './filters';
import { capacity, shift } from './capacity';
import { unbilled } from './billing';
import { STAGE_LABELS } from './statuses';
import { date, human, insist, need, now, optional, rows, type Actor, type Data } from './model';

export function reportFilters(q: Data) {
  const from = date(q.from, 'Period from'), to = date(q.to, 'Period to');
  insist(from <= to && Date.parse(to) - Date.parse(from) <= 366 * 86_400_000, 'Choose a period of at most 367 days');
  return { from, to, client: optional(q.client, 'Client', 100), workType: optional(q.workType, 'Service / work type', 100), assignee: optional(q.assignee, 'Team member', 254).toLowerCase() };
}
const minutes = (a: string, b: string) => Math.max(0, Math.floor((Date.parse(b) - Date.parse(a)) / 60_000));
const mean = (values: number[]) => values.length ? Math.floor(values.reduce((a,b) => a+b,0) / values.length) : null;

export async function performanceReport(db: D1Database, actor: Actor, query: Data) {
  human(actor); need(actor, 'owner', 'reviewer');
  const filters = reportFilters(query), generatedAt = now(), clock = localClock(await firmSettings(db), new Date(generatedAt));
  const selected = (await listJobs(db, actor, parseFilters(filters))).filter(j => j.period_start >= filters.from && j.period_start <= filters.to);
  const keys = new Set(selected.map(j => j.id));
  const [jobs, history, requests, time, adjustments, expenses, exports, wip, returns] = await Promise.all([
    rows(db, 'SELECT id,created_at,signed_off_at,fee_cents,currency,due_note FROM b_jobs'),
    rows(db, `SELECT h.*,s.name sub FROM b_job_status_history h LEFT JOIN b_sub_statuses s ON s.id=h.to_sub_status_id ORDER BY h.job_id,h.at,h.rowid`),
    rows(db, `SELECT r.id,r.job_id,r.label,r.status,r.updated_at,(SELECT MIN(m.sent_at) FROM b_reminders m WHERE m.job_id=r.job_id AND m.delivery LIKE 'accepted%' AND EXISTS(SELECT 1 FROM json_each(m.outstanding) WHERE value=r.label)) asked_at,
      (SELECT MIN(f.uploaded_at) FROM b_files f WHERE f.request_id=r.id AND f.channel='portal' AND f.erased_at IS NULL) responded_at FROM b_requests r WHERE r.organizer_active=1`),
    rows(db, `SELECT t.*,s.status approval FROM b_time t LEFT JOIN b_time_status s ON s.entry_id=t.id`),
    rows(db, 'SELECT a.*,t.job_id,t.currency,t.billable FROM b_time_adjustments a JOIN b_time t ON t.id=a.entry_id'),
    rows(db, "SELECT id,job_id,date,description,cost_cents,billable,charge_cents,currency,decided_by,decided_at FROM b_expenses WHERE status='approved'"),
    rows(db, "SELECT id,snapshot,approved_at FROM b_exports WHERE status='approved'"), unbilled(db),
    rows(db, "SELECT id,object_id job_id,actor,at,detail FROM b_audit WHERE action='job.returned' ORDER BY at"),
  ]);
  const statuses = new Map<string,Data>();
  const details: Data[] = selected.map(j => {
    const base = jobs.find(b => b.id === j.id)!, trail = history.filter(h => h.job_id === j.id);
    trail.forEach((h,n) => {
      const key = `${j.work_type_id}|${h.to_stage}|${h.to_sub_status_id ?? ''}`, next = trail[n+1];
      const bucket = statuses.get(key) ?? { workTypeId: j.work_type_id, workType: j.work_type, stage: h.to_stage, label: STAGE_LABELS[h.to_stage], subStatusId: h.to_sub_status_id, subStatus: h.sub ?? (h.to_sub_status_id === 'partner_sign_off' ? 'partner sign-off' : null), entries: 0, current: 0, minutes: 0, jobIds: [] };
      bucket.entries++; if (!next) bucket.current++;
      bucket.minutes += minutes(h.at, next?.at ?? generatedAt);
      if (!bucket.jobIds.includes(j.id)) bucket.jobIds.push(j.id);
      statuses.set(key,bucket);
    });
    const reqs = requests.filter(r => r.job_id === j.id).map(r => ({ ...r, delayMinutes: r.asked_at ? minutes(r.asked_at,r.responded_at ?? generatedAt) : null, source: `/app?job=${j.id}` }));
    const entries = time.filter(t => t.job_id === j.id && t.approval === 'approved');
    const adj = adjustments.filter(a => a.job_id === j.id && a.billable), costs = expenses.filter(e => e.job_id === j.id);
    const approvedTimeCents = entries.filter(t => t.billable).reduce((n,t) => n+Number(t.amount_cents),0)+adj.reduce((n,a) => n+Number(a.amount_cents),0);
    const expenseCostCents = costs.reduce((n,e) => n+Number(e.cost_cents),0), expenseChargeCents = costs.filter(e => e.billable).reduce((n,e) => n+Number(e.charge_cents),0);
    const fixedFeeCents = j.status === 'signed_off' ? Number(base.fee_cents) : 0;
    const billed = exports.flatMap(e => JSON.parse(e.snapshot).lines.filter((l:Data) => l.job_id === j.id).map((l:Data) => ({ ...l, exportId: e.id, approvedAt: e.approved_at, download: `/api/blotter/exports/${e.id}/csv` })));
    return { ...j, overdue: j.status !== 'signed_off' && j.due_date < clock.localDate, source: `/app?job=${j.id}`, dueSource: base.due_note, createdAt: base.created_at, completedAt: base.signed_off_at,
      turnaroundMinutes: base.signed_off_at ? minutes(base.created_at,base.signed_off_at) : null,
      requestDelays: reqs, reviewReturns: returns.filter(r => r.job_id === j.id), statusHistory: trail,
      financial: { currency: base.currency, approvedTimeCents, fixedFeeCents, expenseChargeCents, expenseCostCents,
        marginBeforeStaffCostCents: approvedTimeCents+fixedFeeCents+expenseChargeCents-expenseCostCents,
        unbilledCents: wip.filter(l => l.job_id === j.id).reduce((n,l) => n+Number(l.amount_cents),0),
        approvedExportCents: billed.reduce((n,l) => n+Number(l.amount_cents),0),
        sources: { time: entries, adjustments: adj, expenses: costs, exports: billed, unbilled: wip.filter(l => l.job_id === j.id) } } };
  });
  const monday = (day:string) => shift(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7));
  const people = new Map<string,Data>();
  for (let week=monday(filters.from);week<=filters.to;week=shift(week,7)) {
    const cap = await capacity(db,actor,{week});
    for (const p of cap.people.filter((p:Data) => !filters.assignee || p.email === filters.assignee)) {
      const line = people.get(p.email) ?? { email:p.email,name:p.name,availableMinutes:0,demandMinutes:0,approvedMinutes:0,billableMinutes:0,weeks:[] };
      const demand = p.jobs.filter((l:Data) => keys.has(l.jobId));
      line.availableMinutes+=p.availableMinutes; line.demandMinutes+=demand.reduce((n:number,l:Data)=>n+l.estimateMinutes,0);
      line.weeks.push({week,availableMinutes:p.availableMinutes,leaveMinutes:p.leaveMinutes,commitmentMinutes:p.commitmentMinutes,blocks:p.blocks,jobs:demand});
      people.set(p.email,line);
    }
  }
  for (const p of people.values()) {
    const entries = time.filter(t => keys.has(t.job_id) && t.person_email===p.email && t.approval==='approved' && t.date>=filters.from && t.date<=filters.to);
    p.approvedMinutes=entries.reduce((n,t)=>n+Number(t.minutes),0);p.billableMinutes=entries.filter(t=>t.billable).reduce((n,t)=>n+Number(t.minutes),0);
    p.utilizationPercent=p.availableMinutes?Math.round(p.billableMinutes*10000/p.availableMinutes)/100:null;
    p.timeSources=entries.map(t=>({id:t.id,jobId:t.job_id,minutes:t.minutes,billable:t.billable,source:`/app?job=${t.job_id}`}));
  }
  const money = new Map<string,Data>();
  for (const j of details) {
    const f=j.financial, total=money.get(f.currency)??{currency:f.currency,approvedTimeCents:0,fixedFeeCents:0,expenseChargeCents:0,expenseCostCents:0,marginBeforeStaffCostCents:0,unbilledCents:0,approvedExportCents:0};
    for (const k of Object.keys(total).filter(k=>k!=='currency')) total[k]+=f[k];
    money.set(f.currency,total);
  }
  return { generatedAt,timeZone:clock.timeZone,today:clock.localDate,filters,
    basis:'Period-start cohort, inclusive. Elapsed minutes from native UTC instants. Capacity includes whole Monday–Sunday weeks overlapping the period. Approved native money in stored currency; margin is before staff cost. Exports are not invoices or collections.',
    totals:{jobs:details.length,completed:details.filter(j=>j.status==='signed_off').length,overdue:details.filter(j=>j.status!=='signed_off'&&j.due_date<clock.localDate).length,blocked:details.filter(j=>j.blocked).length,
      averageTurnaroundMinutes:mean(details.flatMap(j=>j.turnaroundMinutes===null?[]:[j.turnaroundMinutes])),averageClientDelayMinutes:mean(details.flatMap(j=>j.requestDelays.flatMap((r:Data)=>r.delayMinutes===null?[]:[r.delayMinutes]))),reviewReturns:details.reduce((n,j)=>n+j.reviewReturns.length,0)},
    jobs:details,financialBreakdowns:financialBreakdowns(details),statuses:[...statuses.values()],people:[...people.values()],money:[...money.values()] };
}
