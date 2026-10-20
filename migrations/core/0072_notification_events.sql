-- NOTIFY-001. Portable consumption history prevents restored audit records from
-- replaying alerts. Existing history predates activation and is already consumed.
CREATE TABLE b_notification_events(source_key TEXT PRIMARY KEY);
INSERT INTO b_notification_events(source_key) SELECT 'audit:'||id FROM b_audit;
-- Provider results can be recorded after the sending audit commits. Track the
-- actual delivery identity independently, including historical pending sends.
INSERT INTO b_notification_events(source_key) SELECT 'reminder:'||id FROM b_reminders;
INSERT INTO b_notification_events(source_key) SELECT 'deliverable:'||id FROM b_deliverable_versions;
INSERT INTO b_notification_events(source_key) SELECT 'organizer-delivery:'||id FROM b_organizer_deliveries;

CREATE TABLE b_notification_task_owners(job_id TEXT NOT NULL,ordinal INTEGER NOT NULL,email TEXT,PRIMARY KEY(job_id,ordinal));
INSERT INTO b_notification_task_owners SELECT j.id,s.ordinal,COALESCE(s.assignee_email,CASE s.assignee_role WHEN 'preparer' THEN j.preparer_email WHEN 'reviewer' THEN j.reviewer_email WHEN 'manager' THEN COALESCE(j.manager_email,j.reviewer_email) END) FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id;

CREATE TABLE b_notification_job_owners(job_id TEXT NOT NULL,email TEXT NOT NULL,PRIMARY KEY(job_id,email));
INSERT OR IGNORE INTO b_notification_job_owners SELECT j.id,p.value FROM b_jobs j JOIN json_each(json_array(j.preparer_email,j.reviewer_email,j.manager_email,j.partner_email)) p WHERE p.value IS NOT NULL;
