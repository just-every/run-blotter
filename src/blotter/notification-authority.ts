import { clientGrantSql } from './access-sql';
// Native membership exists before a person's first sign-in. Delivery preserves
// that existing recipient authority; the center additionally requires a session.
const principal = `EXISTS(SELECT 1 FROM oa_operators o WHERE o.email=n.to_email AND o.role='owner' AND o.status='active')`;
const reviewer = `EXISTS(SELECT 1 FROM b_members m WHERE m.email=n.to_email AND m.active=1 AND m.role='reviewer')`;
const activeStaff = `(${principal} OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=n.to_email AND m.active=1))`;
export const notificationJobAuthority = `EXISTS(SELECT 1 FROM b_jobs j WHERE j.id=n.job_id AND
  (${principal} OR ${reviewer} OR j.preparer_email=n.to_email
    OR EXISTS(SELECT 1 FROM b_job_steps t WHERE t.job_id=j.id AND t.assignee_email=n.to_email)))`;
// A coverage receipt is the already-approved handover notice to its recorded
// participants. The absent person's receipt never grants access to moved work.
const coverageReceipt = `(n.kind='coverage' AND EXISTS(SELECT 1 FROM b_coverage_plans p JOIN json_each(p.lines) l
  WHERE json_extract(l.value,'$.jobId')=n.job_id AND json_extract(l.value,'$.action')='change'
    AND n.to_email IN (p.person_email,json_extract(l.value,'$.to.preparer'),json_extract(l.value,'$.to.reviewer'))))`;
export const notificationAuthority = `${activeStaff}
 AND (n.job_id IS NULL OR EXISTS(SELECT 1 FROM b_jobs aj WHERE aj.id=n.job_id AND ${clientGrantSql('aj.client_id','n.to_email',principal)}))
 AND (n.thread_id IS NULL OR EXISTS(SELECT 1 FROM b_threads at WHERE at.id=n.thread_id AND ${clientGrantSql('at.client_id','n.to_email',principal)}))
 AND (n.job_id IS NULL OR ${notificationJobAuthority} OR ${coverageReceipt})
 AND (n.thread_id IS NULL OR EXISTS(SELECT 1 FROM b_threads t WHERE t.id=n.thread_id AND
   (${principal} OR ${reviewer} OR EXISTS(SELECT 1 FROM b_jobs j WHERE j.preparer_email=n.to_email
     AND (j.id=t.job_id OR (t.job_id IS NULL AND j.client_id=t.client_id))))))
 AND (n.kind<>'internal_report' OR EXISTS(SELECT 1 FROM b_report_runs rr JOIN b_report_schedules rs ON rs.id=rr.schedule_id
 JOIN oa_operators principal ON principal.id=rs.principal_id AND principal.status='active' AND principal.role='owner'
 WHERE rr.notification_id=n.id AND rs.status='active' AND rs.recipient=n.to_email AND (${principal} OR (${reviewer} AND NOT EXISTS(SELECT 1 FROM b_access_members am WHERE am.email=n.to_email)))))`;
