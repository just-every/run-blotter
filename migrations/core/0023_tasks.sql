-- Task assignees, relative dates and instructions (WORK-009). A checklist step
-- is a task: it may be assigned to a job role (preparer, reviewer, manager) or
-- a named person, with start and due dates as whole days relative to the
-- work's start (its period start) or due date. Owners and dates of open tasks
-- are resolved when read, so they follow the job's people and due date; a
-- completed task keeps its completer, time and the dates it had then. A job's
-- manager is its reviewer unless one is named. Additive only, so older
-- archives still restore.
ALTER TABLE b_jobs ADD COLUMN manager_email TEXT;
ALTER TABLE b_job_steps ADD COLUMN assignee_role TEXT CHECK(assignee_role IS NULL OR assignee_role IN ('preparer','reviewer','manager'));
ALTER TABLE b_job_steps ADD COLUMN assignee_email TEXT;
ALTER TABLE b_job_steps ADD COLUMN start_anchor TEXT CHECK(start_anchor IS NULL OR start_anchor IN ('start','due'));
ALTER TABLE b_job_steps ADD COLUMN start_offset INTEGER CHECK(start_offset IS NULL OR start_offset BETWEEN -366 AND 366);
ALTER TABLE b_job_steps ADD COLUMN due_anchor TEXT CHECK(due_anchor IS NULL OR due_anchor IN ('start','due'));
ALTER TABLE b_job_steps ADD COLUMN due_offset INTEGER CHECK(due_offset IS NULL OR due_offset BETWEEN -366 AND 366);
ALTER TABLE b_job_steps ADD COLUMN estimate_minutes INTEGER CHECK(estimate_minutes IS NULL OR estimate_minutes BETWEEN 1 AND 100000);
ALTER TABLE b_job_steps ADD COLUMN instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE b_job_steps ADD COLUMN sop_url TEXT NOT NULL DEFAULT '';
ALTER TABLE b_job_steps ADD COLUMN requires_attachment INTEGER NOT NULL DEFAULT 0 CHECK(requires_attachment IN (0,1));
ALTER TABLE b_job_steps ADD COLUMN client_facing INTEGER NOT NULL DEFAULT 0 CHECK(client_facing IN (0,1));
ALTER TABLE b_job_steps ADD COLUMN done_start_date TEXT;
ALTER TABLE b_job_steps ADD COLUMN done_due_date TEXT;
ALTER TABLE b_job_steps ADD COLUMN done_owner TEXT;
ALTER TABLE b_job_steps ADD COLUMN attachment_name TEXT;
ALTER TABLE b_job_steps ADD COLUMN attachment_mime TEXT;
ALTER TABLE b_job_steps ADD COLUMN attachment_size INTEGER CHECK(attachment_size IS NULL OR attachment_size BETWEEN 1 AND 1048576);
ALTER TABLE b_job_steps ADD COLUMN attachment_sha256 TEXT;
ALTER TABLE b_job_steps ADD COLUMN attachment_base64 TEXT CHECK(attachment_base64 IS NULL OR length(attachment_base64)<=1398104);
