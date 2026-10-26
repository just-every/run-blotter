-- Principal-approved native document reminder sequences; portable history never carries authority.
CREATE TABLE b_followups(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), contact_id TEXT NOT NULL,
 name TEXT NOT NULL, owner_email TEXT NOT NULL, definition TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','paused','stopped','held','completed')),
 principal_id TEXT, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL,
 next_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, revision TEXT NOT NULL,
 response_seq INTEGER NOT NULL, escalated INTEGER NOT NULL DEFAULT 0,
 reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE b_followup_attempts(
 id TEXT PRIMARY KEY, sequence_id TEXT NOT NULL REFERENCES b_followups(id), step INTEGER NOT NULL,
 status TEXT NOT NULL, delivery TEXT NOT NULL DEFAULT '', sender TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(sequence_id,step)
);
CREATE TRIGGER b_followup_response AFTER INSERT ON b_portal_items WHEN NEW.author='client'
 BEGIN UPDATE b_followups SET status='stopped',reason='Client responded',revision=lower(hex(randomblob(16)))
 WHERE job_id=NEW.job_id AND status IN ('active','paused','held'); END;
CREATE TRIGGER b_followup_definition_immutable BEFORE UPDATE ON b_followups
 WHEN OLD.definition<>NEW.definition OR OLD.job_id<>NEW.job_id OR OLD.contact_id<>NEW.contact_id
 BEGIN SELECT RAISE(ABORT,'immutable reminder sequence definition'); END;
-- Sequence portal steps are visible only to their explicitly approved contact.
ALTER TABLE b_portal_items ADD COLUMN contact_id TEXT;
CREATE TRIGGER b_followup_todo_response AFTER UPDATE OF response ON b_portal_items
 WHEN NEW.kind='todo' AND NEW.response IS NOT NULL AND NEW.response<>''
 BEGIN UPDATE b_followups SET status='stopped',reason='Client responded',revision=lower(hex(randomblob(16)))
 WHERE job_id=NEW.job_id AND status IN ('active','paused','held'); END;
