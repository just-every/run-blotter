-- Cases bind a practitioner's explicit review to one immutable job organizer.
-- Financial answers and files stay in their existing custody, never copied here.
CREATE TABLE b_resolution_cases (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL UNIQUE REFERENCES b_jobs(id),
 organizer_id TEXT NOT NULL UNIQUE REFERENCES b_job_organizers(id),
 form TEXT NOT NULL CHECK(form='433-A'),
 definition_version INTEGER NOT NULL,
 reviewed_by TEXT NOT NULL,
 reviewed_at TEXT NOT NULL
);
CREATE TRIGGER b_resolution_cases_fixed BEFORE UPDATE ON b_resolution_cases
 BEGIN SELECT RAISE(ABORT,'immutable resolution case review'); END;
