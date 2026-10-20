import { performanceReport } from './reports';
import { audit, type Actor, type Data } from './model';

const cell = (v:unknown) => {let s=String(v??'');if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
function lines(r:Data) {
  return [ ['generated_at',r.generatedAt],['basis',r.basis],['period_from',r.filters.from],['period_to',r.filters.to],
    ...Object.entries(r.totals),
    ['job_id','client','service','stage','due_date','overdue','blocked','turnaround_minutes','review_returns','currency','unbilled_cents','approved_export_cents','margin_before_staff_cost_cents','source'],
    ...r.jobs.map((j:Data)=>[j.id,j.client_name,j.work_type,j.stage,j.due_date,j.due_date<r.today&&j.status!=='signed_off',j.blocked,j.turnaroundMinutes,j.reviewReturns.length,j.financial.currency,j.financial.unbilledCents,j.financial.approvedExportCents,j.financial.marginBeforeStaffCostCents,j.source]),
    ['currency','approved_time_cents','fixed_fee_cents','expense_charge_cents','expense_cost_cents','margin_before_staff_cost_cents','unbilled_cents','approved_export_cents'],
    ...r.money.map((m:Data)=>[m.currency,m.approvedTimeCents,m.fixedFeeCents,m.expenseChargeCents,m.expenseCostCents,m.marginBeforeStaffCostCents,m.unbilledCents,m.approvedExportCents]),
    ['work_type','stage','sub_status','entries','current','minutes','source_job_ids'],...r.statuses.map((s:Data)=>[s.workType,s.stage,s.subStatus,s.entries,s.current,s.minutes,s.jobIds.join(' ')]),
    ['person','available_minutes','demand_minutes','approved_minutes','billable_minutes','utilization_percent'],...r.people.map((p:Data)=>[p.email,p.availableMinutes,p.demandMinutes,p.approvedMinutes,p.billableMinutes,p.utilizationPercent]),
    ['request_id','job_id','asked_at','responded_at','delay_minutes'],...r.jobs.flatMap((j:Data)=>j.requestDelays.map((q:Data)=>[q.id,j.id,q.asked_at,q.responded_at,q.delayMinutes])) ];
}
// A paginated text PDF, using built-in Helvetica. UTF-16 text is retained in the CSV;
// PDF uses printable ASCII transliteration and declares that rendering in its header.
function pdf(rows:unknown[][]) {
  const text=rows.flatMap(row=>{const value=row.map(v=>String(v??'')).join(' | ').normalize('NFKD').replace(/[^\x20-\x7e]/g,'?');return value.match(/.{1,100}/g)??[''];});
  const links=rows.flat().filter(v=>typeof v==='string'&&/^https?:\/\//.test(v)) as string[];
  text.push(...links.map(url=>'Source: '+url));
  const chunks=[];for(let i=0;i<text.length;i+=48)chunks.push(text.slice(i,i+48));
  const objects=['','<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const pages:number[]=[];
  for(const chunk of chunks) {
    const page=objects.length,stream=page+1;pages.push(page);
    objects.push('','');
    const annotations=chunk.flatMap((l,n)=>{const uri=l.startsWith('Source: ')?l.slice(8):'';if(!uri)return [];const a=objects.length;objects.push(`<< /Type /Annot /Subtype /Link /Rect [36 ${742-n*14} 576 ${756-n*14}] /Border [0 0 0] /A << /S /URI /URI (${uri.replace(/[\\()]/g,'\\$&')}) >> >>`);return [a];});
    const annotationRefs=annotations.map(a=>a+' 0 R').join(' ');
    const content='BT /F1 9 Tf 36 756 Td 14 TL '+chunk.map((l,n)=>`${n?'T* ':''}(${l.replace(/[\\()]/g,'\\$&')}) Tj`).join('\n')+' ET';
    objects[page]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${stream} 0 R /Annots [${annotationRefs}] >>`;objects[stream]=`<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  }
  objects[2]=`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map(n=>n+' 0 R').join(' ')}] >>`;
  let out='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(out.length);out+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=out.length;out+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('');
  return out+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}
export async function downloadReport(db:D1Database,actor:Actor,query:Data,format:string,origin:string) {
  const r=await performanceReport(db,actor,query);
  for(const j of r.jobs)j.source=origin+j.source;
  const data=lines(r);
  await audit(db,actor,'report.exported','report',`${format}; ${JSON.stringify(r.filters)}`).run();
  return new Response(format==='pdf'?pdf([['Blotter performance report (ASCII rendering; CSV retains original text)'],...data]):data.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n',{
    headers:{'content-type':format==='pdf'?'application/pdf':'text/csv; charset=utf-8','content-disposition':`attachment; filename="blotter-performance.${format==='pdf'?'pdf':'csv'}"`,'cache-control':'no-store'} });
}
