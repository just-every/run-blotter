-- NOTIFY-001. The notification sync reads only what changed since it last ran, so a refresh costs the same
-- with a month of history as with none (Workers Free allows 5,000,000 D1 rows read a day to the whole account).

-- How far the sync has read the audit trail (rowid; the trail only grows). No row means from the start.
CREATE TABLE b_notification_cursor(name TEXT PRIMARY KEY, position INTEGER NOT NULL);
-- Existing history is consumed except anything the sync had not reached: resume at the first unconsumed row.
INSERT INTO b_notification_cursor SELECT 'audit',COALESCE(
  (SELECT MIN(a.rowid)-1 FROM b_audit a WHERE NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key='audit:'||a.id)),
  (SELECT MAX(rowid) FROM b_audit)) WHERE EXISTS(SELECT 1 FROM b_audit);

-- Work the sync still owes, written by the triggers below in the same transaction as the change itself.
-- 'job:<id>' is a job whose owners or task owners may have changed; 'reminder:<id>', 'deliverable:<id>' and
-- 'organizer-delivery:<id>' are sends whose result was recorded. `changes` counts the writes, so the sync clears
-- only what it has seen and a change that lands while it runs is kept for the next run.
CREATE TABLE b_notification_queue(source_key TEXT PRIMARY KEY, changes INTEGER NOT NULL DEFAULT 1) WITHOUT ROWID;
-- What the old sync would have found: every job once, and every failed send it had not yet consumed.
INSERT OR IGNORE INTO b_notification_queue(source_key) SELECT 'job:'||id FROM b_jobs;
INSERT OR IGNORE INTO b_notification_queue(source_key) SELECT 'reminder:'||d.id FROM b_reminders d
  WHERE (d.delivery LIKE 'failed%' OR d.delivery LIKE 'rejected%' OR d.delivery LIKE 'rate_limited%' OR d.delivery LIKE 'not sent:%' OR d.delivery LIKE 'bounced%')
    AND NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key='reminder:'||d.id);
INSERT OR IGNORE INTO b_notification_queue(source_key) SELECT 'deliverable:'||d.id FROM b_deliverable_versions d
  WHERE (d.delivery LIKE 'failed%' OR d.delivery LIKE 'rejected%' OR d.delivery LIKE 'rate_limited%' OR d.delivery LIKE 'not sent:%' OR d.delivery LIKE 'bounced%')
    AND NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key='deliverable:'||d.id);
INSERT OR IGNORE INTO b_notification_queue(source_key) SELECT 'organizer-delivery:'||d.id FROM b_organizer_deliveries d
  WHERE (d.delivery LIKE 'failed%' OR d.delivery LIKE 'rejected%' OR d.delivery LIKE 'rate_limited%' OR d.delivery LIKE 'not sent:%' OR d.delivery LIKE 'bounced%')
    AND NOT EXISTS(SELECT 1 FROM b_notification_events e WHERE e.source_key='organizer-delivery:'||d.id);

CREATE TRIGGER b_notification_job_new AFTER INSERT ON b_jobs BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('job:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_job_roles AFTER UPDATE OF preparer_email,reviewer_email,manager_email,partner_email ON b_jobs BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('job:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_step_new AFTER INSERT ON b_job_steps BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('job:'||NEW.job_id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_step_owner AFTER UPDATE OF assignee_email,assignee_role ON b_job_steps BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('job:'||NEW.job_id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_reminder_new AFTER INSERT ON b_reminders BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('reminder:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_reminder_result AFTER UPDATE OF delivery ON b_reminders BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('reminder:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_deliverable_new AFTER INSERT ON b_deliverable_versions BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('deliverable:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_deliverable_result AFTER UPDATE OF delivery ON b_deliverable_versions BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('deliverable:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_organizer_delivery_new AFTER INSERT ON b_organizer_deliveries BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('organizer-delivery:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;
CREATE TRIGGER b_notification_organizer_delivery_result AFTER UPDATE OF delivery ON b_organizer_deliveries BEGIN
  INSERT INTO b_notification_queue(source_key) VALUES('organizer-delivery:'||NEW.id) ON CONFLICT(source_key) DO UPDATE SET changes=changes+1;
END;

-- Pending alerts are a few rows; without this the delivery pass reads every alert ever sent.
CREATE INDEX b_notifications_undelivered ON b_notifications(created_at) WHERE delivery IN ('in-app only','deferred: outside firm notification hours');
-- Hourly due-date alerts and the daily digest look only at open work and the due alerts of that work.
CREATE INDEX b_jobs_open_due ON b_jobs(due_date) WHERE status<>'signed_off';
CREATE INDEX b_notifications_due ON b_notifications(job_id,to_email) WHERE kind IN ('due_soon','overdue');
-- The center lists a person's newest 200 alerts; with the id in the index that reads 200 rows, not their history.
DROP INDEX b_notifications_to;
CREATE INDEX b_notifications_center ON b_notifications(to_email,created_at,id);
