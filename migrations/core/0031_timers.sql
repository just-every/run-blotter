-- Running timers (TIME-001). One per person, kept in D1 so it survives closing
-- the browser or app; stopping it records an ordinary time entry. Additive only.
CREATE TABLE b_timers(
 person_email TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id),
 description TEXT NOT NULL, started_at TEXT NOT NULL
);
