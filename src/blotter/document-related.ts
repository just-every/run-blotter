// DOC-004 shared catalog entries link purpose-specific evidence to its own workflow.
// Staff permissions are exactly the existing document download scope, including
// the named notice assignee; no client grant or underlying approval is changed.
import { readableJobParams, readableJobSql, rows, type Actor, type Data } from './model';

export async function relatedDocuments(db:D1Database,actor:Actor,scope:{jobId?:string;clientId?:string}){
 const files=await rows(db,`SELECT f.file_key file_id,f.document_id,f.kind,f.job_id,f.client_id,f.name,f.mime,f.size original_size,f.sha256,
 b_jobs.title job_title,b_jobs.period_label,c.name client_name,
 CASE WHEN a.visibility='contacts' AND a.sha256=f.sha256 AND a.client_id=f.client_id AND a.job_id=f.job_id THEN 'contacts' ELSE 'internal' END visibility,
 dv.version,dv.status deliverable_status,dv.sent_by,dv.sent_at,
 ex.status expense_status,ex.created_by expense_by,ex.created_at expense_at,
 t.done_by task_by,t.done_at task_at,n.id notice_id,n.status notice_status,ne.kind event_kind,ne.by_email notice_by,ne.at notice_at
 FROM b_document_sources f JOIN b_jobs ON b_jobs.id=f.job_id JOIN b_clients c ON c.id=f.client_id
 LEFT JOIN b_document_access a ON a.file_key=f.file_key
 LEFT JOIN b_deliverable_versions dv ON f.kind='deliverable' AND dv.id=f.document_id
 LEFT JOIN b_expenses ex ON f.kind='expense' AND ex.id=f.document_id
 LEFT JOIN b_job_steps t ON f.kind='task' AND t.job_id=f.job_id AND f.document_id=t.job_id||':'||t.ordinal
 LEFT JOIN b_notice_events ne ON f.kind='notice' AND ne.id=f.document_id
 LEFT JOIN b_notices n ON n.id=ne.notice_id
 WHERE f.kind IN ('deliverable','expense','task','notice') AND ${scope.jobId?'f.job_id=?':'f.client_id=?'}
 AND ((f.kind='notice' AND (? IN ('owner','reviewer') OR b_jobs.preparer_email=? OR n.assignee_email=?)) OR (f.kind<>'notice' AND ${readableJobSql}))
 ORDER BY b_jobs.period_label DESC,f.kind,f.file_key`,scope.jobId??scope.clientId,actor.role,actor.email,actor.email,...readableJobParams(actor));
 return files.map((f):Data=>{
  const path=`/app?job=${encodeURIComponent(f.job_id)}`;
  const info:Record<string,Data>={
   deliverable:{source:'Client deliverable',workflow:'Deliverables for client approval',sourceHref:path+'#job-deliverables',uploaded_by:f.sent_by,uploaded_at:f.sent_at,source_status:f.deliverable_status},
   expense:{source:'Expense receipt',workflow:'Expenses',sourceHref:path+'#job-expenses',uploaded_by:f.expense_by,uploaded_at:f.expense_at,source_status:f.expense_status},
   task:{source:'Task completion attachment',workflow:'Checklist',sourceHref:path+'#job-checklist',uploaded_by:f.task_by,uploaded_at:f.task_at,source_status:'Attached to task'},
   notice:{source:'Tax notice '+f.event_kind+' evidence',workflow:'Tax notice timeline',sourceHref:`/app?notice=${encodeURIComponent(f.notice_id)}#notice-${encodeURIComponent(f.notice_id)}`,uploaded_by:f.notice_by,uploaded_at:f.notice_at,source_status:f.notice_status},
  };
  return {...f,...info[f.kind],author:null,page_count:null,annotations:[],can_edit:0};
 });
}
