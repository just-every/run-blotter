// Current actionable client items, under the same contact assignments as their portal doors.
import { contactRequestSql } from './organizers-requests';
import { organizerAnswers, storedOrganizer } from './organizers-store';
import { submittedAnswers } from './organizers-client';
import { visibleQuestions } from './organizers-definition';
import { rows, type Data } from './model';
export async function followupItems(db:D1Database,jobId:string,contact:Data) {
  const documents=await rows(db,`SELECT r.label FROM b_requests r WHERE r.job_id=? AND r.status='requested' AND ${contactRequestSql()} ORDER BY r.ordinal`,jobId,contact.id);
  const labels=documents.map(r=>String(r.label));
  for(const row of await rows(db,'SELECT id FROM b_job_organizers WHERE job_id=? AND sent_at IS NOT NULL AND erased_at IS NULL',jobId)) {
    const o=await storedOrganizer(db,row.id),current=await organizerAnswers(db,row.id),submitted=await submittedAnswers(db,row.id,current),visible=visibleQuestions(o.definition,current);
    for(const q of o.definition.questions)if(q.required&&visible.has(q.key)&&current[q.key]?.contactId===contact.id&&(!submitted[q.key]?.confirmed||!submitted[q.key]?.value))labels.push(contact.language==='es'&&q.es?q.es.label:q.label);
  }
  const signatures=await rows(db,`SELECT s.title FROM b_signatures s JOIN b_signature_signers p ON p.request_id=s.id AND p.attempt=s.attempt
    WHERE s.job_id=? AND s.status='pending' AND s.erased_at IS NULL AND p.contact_id=? AND p.status='pending'
    AND (s.mode='parallel' OR NOT EXISTS(SELECT 1 FROM b_signature_signers prev WHERE prev.request_id=s.id AND prev.attempt=s.attempt AND prev.ordinal<p.ordinal AND prev.status<>'signed')) ORDER BY s.id`,jobId,contact.id);
  labels.push(...signatures.map(s=>String(s.title)));
  const questions=await rows(db,"SELECT body FROM b_portal_items WHERE job_id=? AND kind='todo' AND status='open' ORDER BY created_at,id",jobId);
  labels.push(...questions.map(q=>String(q.body)));
  return labels;
}
