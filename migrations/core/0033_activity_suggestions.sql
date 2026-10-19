-- Activity suggestions (TIME-001). A person may consent to Blotter suggesting
-- time from their own audited work actions; a row exists while consent is on.
-- Pending suggestions are computed from the audit trail on read, so
-- withdrawing consent removes them. Each decision is kept once per person,
-- job and UTC day, with the source actions it was shown. Additive only.
CREATE TABLE b_activity_consent(person_email TEXT PRIMARY KEY, consented_at TEXT NOT NULL);
CREATE TABLE b_time_suggestions(
 person_email TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES b_jobs(id), day TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('approved','rejected')), entry_id TEXT REFERENCES b_time(id),
 sources TEXT NOT NULL CHECK(json_valid(sources)), reason TEXT NOT NULL DEFAULT '', decided_at TEXT NOT NULL,
 PRIMARY KEY(person_email,job_id,day), CHECK((status='approved')=(entry_id IS NOT NULL))
);
