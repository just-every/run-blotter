-- Tax notices and resolution work (DUE-002). A notice is opened from a client
-- document already filed on a job, with its agency, tax period, notice date,
-- response date (verified by a person against the notice), assigned
-- practitioner, authorization reference and resolution plan. Work on it is an
-- append-only timeline. Closing needs a recorded outcome: an acknowledged
-- resolution backed by an evidence file, or a documented exception.
CREATE TABLE b_notices(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), job_id TEXT NOT NULL REFERENCES b_jobs(id),
 source_file_id TEXT NOT NULL REFERENCES b_files(id), agency TEXT NOT NULL, jurisdiction TEXT NOT NULL CHECK(jurisdiction IN ('federal','state')),
 notice_type TEXT NOT NULL, tax_period TEXT NOT NULL, notice_date TEXT NOT NULL, response_due TEXT NOT NULL,
 due_verified_by TEXT, due_verified_at TEXT, assignee_email TEXT NOT NULL, authorization TEXT NOT NULL DEFAULT '', plan TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), outcome TEXT CHECK(outcome IS NULL OR outcome IN ('resolved','exception')),
 outcome_note TEXT, evidence_event_id TEXT, closed_by TEXT, closed_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(status='open' OR (outcome IS NOT NULL AND outcome_note IS NOT NULL AND closed_by IS NOT NULL)),
 CHECK(outcome IS NOT 'resolved' OR evidence_event_id IS NOT NULL)
);
CREATE TABLE b_notice_events(
 id TEXT PRIMARY KEY, notice_id TEXT NOT NULL REFERENCES b_notices(id),
 kind TEXT NOT NULL CHECK(kind IN ('research','client_question','agency_contact','response_submitted','follow_up','transcript','receipt','note')),
 note TEXT NOT NULL, result TEXT CHECK(result IS NULL OR result IN ('pending','failed','accepted')), follow_up_on TEXT,
 file_name TEXT, file_mime TEXT, file_size INTEGER CHECK(file_size IS NULL OR file_size BETWEEN 1 AND 1048576), file_sha256 TEXT,
 file_base64 TEXT CHECK(file_base64 IS NULL OR length(file_base64)<=1398104), by_email TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX b_notice_events_notice ON b_notice_events(notice_id,at);
CREATE TRIGGER b_notice_events_immutable BEFORE UPDATE ON b_notice_events BEGIN SELECT RAISE(ABORT,'notice history is immutable'); END;
CREATE TRIGGER b_notice_events_delete BEFORE DELETE ON b_notice_events BEGIN SELECT RAISE(ABORT,'notice history is immutable'); END;
CREATE TRIGGER b_notices_closed BEFORE UPDATE ON b_notices WHEN OLD.status='closed' BEGIN SELECT RAISE(ABORT,'closed notices are immutable'); END;
