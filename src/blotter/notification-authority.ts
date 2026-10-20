// Recheck the current staff and item authority for both the center and delivery.
export const notificationAuthority = `EXISTS(SELECT 1 FROM oa_operators o
 WHERE o.email=n.to_email AND o.status='active' AND
 (o.role='owner' OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=o.email AND m.active=1))
 AND (n.job_id IS NULL OR EXISTS(SELECT 1 FROM b_jobs j WHERE j.id=n.job_id AND
 (o.role='owner' OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=o.email AND m.active=1 AND m.role='reviewer')
 OR j.preparer_email=o.email OR EXISTS(SELECT 1 FROM b_job_steps t WHERE t.job_id=j.id AND t.assignee_email=o.email))))
 AND (n.thread_id IS NULL OR EXISTS(SELECT 1 FROM b_threads t WHERE t.id=n.thread_id AND
 (o.role='owner' OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=o.email AND m.active=1 AND m.role='reviewer')
 OR EXISTS(SELECT 1 FROM b_jobs j WHERE j.preparer_email=o.email AND (j.id=t.job_id OR (t.job_id IS NULL AND j.client_id=t.client_id)))))))
 AND (n.kind<>'internal_report' OR EXISTS(SELECT 1 FROM b_report_runs rr JOIN b_report_schedules rs ON rs.id=rr.schedule_id
 JOIN oa_operators principal ON principal.id=rs.principal_id AND principal.status='active' AND principal.role='owner'
 WHERE rr.notification_id=n.id AND rs.status='active' AND rs.recipient=n.to_email
 AND (EXISTS(SELECT 1 FROM oa_operators WHERE email=n.to_email AND status='active' AND role='owner')
 OR EXISTS(SELECT 1 FROM b_members WHERE email=n.to_email AND active=1 AND role='reviewer'))))`;
