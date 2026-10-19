-- Dependencies and conditional workflow (WORK-003). A template task can wait
-- for other tasks of the same job, for accepted client documents and for a
-- prerequisite job of the same client (submitted for review, or signed off),
-- and can apply only when a job question has one of the chosen answers. A
-- reviewer or the principal may record an exception with a reason; it lets a
-- blocked task be worked but completes nothing else. ready_at records when a
-- gated task last became ready. Additive only, so older archives still restore.
ALTER TABLE b_templates ADD COLUMN questions TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(questions));
ALTER TABLE b_job_steps ADD COLUMN after_steps TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(after_steps));
ALTER TABLE b_job_steps ADD COLUMN after_requests TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(after_requests));
ALTER TABLE b_job_steps ADD COLUMN after_template TEXT;
ALTER TABLE b_job_steps ADD COLUMN after_gate TEXT CHECK(after_gate IS NULL OR after_gate IN ('submitted','signed_off'));
ALTER TABLE b_job_steps ADD COLUMN when_question TEXT;
ALTER TABLE b_job_steps ADD COLUMN when_values TEXT CHECK(when_values IS NULL OR json_valid(when_values));
ALTER TABLE b_job_steps ADD COLUMN ready_at TEXT;
ALTER TABLE b_job_steps ADD COLUMN exception_by TEXT;
ALTER TABLE b_job_steps ADD COLUMN exception_at TEXT;
ALTER TABLE b_job_steps ADD COLUMN exception_reason TEXT;
ALTER TABLE b_job_steps ADD COLUMN exception_waived TEXT;
CREATE TABLE b_job_answers(
 job_id TEXT NOT NULL REFERENCES b_jobs(id), key TEXT NOT NULL, ordinal INTEGER NOT NULL, label TEXT NOT NULL,
 options TEXT NOT NULL CHECK(json_valid(options)), value TEXT, answered_by TEXT, answered_at TEXT,
 PRIMARY KEY(job_id,key)
);
