-- Durable native automation: immutable approved definitions and transactional source events.
CREATE TABLE b_automation_rules(
 id TEXT PRIMARY KEY, family TEXT NOT NULL, version INTEGER NOT NULL, name TEXT NOT NULL,
 definition TEXT NOT NULL, budget INTEGER NOT NULL CHECK(budget>0), used INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','revoked')),
 approved_by TEXT, principal_id TEXT, approved_at TEXT, after_seq INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, UNIQUE(family,version)
);
CREATE TRIGGER b_automation_definition_immutable BEFORE UPDATE ON b_automation_rules
 WHEN OLD.definition<>NEW.definition OR OLD.budget<>NEW.budget OR OLD.version<>NEW.version OR OLD.family<>NEW.family
 BEGIN SELECT RAISE(ABORT,'immutable automation version'); END;
CREATE TABLE b_automation_events(
 seq INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL UNIQUE, job_id TEXT NOT NULL,
 kind TEXT NOT NULL, stage TEXT, sub_status_id TEXT, at TEXT NOT NULL
);
CREATE TABLE b_automation_attempts(
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL REFERENCES b_automation_rules(id), version INTEGER NOT NULL,
 event_key TEXT NOT NULL, job_id TEXT NOT NULL, status TEXT NOT NULL,
 outcome TEXT NOT NULL DEFAULT '', next_action TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 UNIQUE(rule_id,event_key)
);
CREATE TRIGGER b_automation_status AFTER INSERT ON b_job_status_history BEGIN
 INSERT INTO b_automation_events(source,job_id,kind,stage,sub_status_id,at) VALUES('status:'||NEW.id,NEW.job_id,'status',NEW.to_stage,NEW.to_sub_status_id,NEW.at);
END;
CREATE TRIGGER b_automation_tasks AFTER UPDATE OF done_at ON b_job_steps
 WHEN NEW.done_at IS NOT NULL AND OLD.done_at IS NULL AND NOT EXISTS(SELECT 1 FROM b_job_steps WHERE job_id=NEW.job_id AND done_at IS NULL AND NOT EXISTS(SELECT 1 FROM b_job_answers a WHERE a.job_id=b_job_steps.job_id AND a.key=b_job_steps.when_question AND a.value IS NOT NULL AND a.value NOT IN (SELECT value FROM json_each(b_job_steps.when_values))))
 BEGIN INSERT OR IGNORE INTO b_automation_events(source,job_id,kind,at) VALUES('tasks:'||lower(hex(randomblob(16))),NEW.job_id,'tasks_complete',NEW.done_at); END;
CREATE TRIGGER b_automation_file AFTER INSERT ON b_files BEGIN
 INSERT INTO b_automation_events(source,job_id,kind,at) VALUES('file:'||NEW.id,NEW.job_id,'file',NEW.uploaded_at);
END;
CREATE TRIGGER b_automation_requests AFTER UPDATE OF status ON b_requests
 WHEN NEW.status='accepted' AND OLD.status<>'accepted' AND NOT EXISTS(SELECT 1 FROM b_requests WHERE job_id=NEW.job_id AND organizer_active=1 AND status<>'accepted')
 BEGIN INSERT OR IGNORE INTO b_automation_events(source,job_id,kind,at) VALUES('request:'||NEW.id||':'||NEW.updated_at,NEW.job_id,'request_complete',NEW.updated_at); END;
CREATE TRIGGER b_automation_organizer AFTER INSERT ON b_organizer_submissions BEGIN
 INSERT INTO b_automation_events(source,job_id,kind,at) SELECT 'organizer:'||NEW.id,job_id,'organizer_complete',NEW.submitted_at FROM b_job_organizers WHERE id=NEW.organizer_id;
END;
CREATE TRIGGER b_automation_proposal AFTER UPDATE OF status ON b_proposals
 WHEN OLD.status='pending' AND NEW.status<>'pending' AND json_extract(NEW.payload,'$.jobId') IS NOT NULL
 BEGIN INSERT INTO b_automation_events(source,job_id,kind,at) VALUES('proposal:'||NEW.id,json_extract(NEW.payload,'$.jobId'),'proposal',NEW.decided_at); END;
