-- WORK-006 personal plans, boards and calendars. A job carries a priority
-- (low, normal, high; normal by default) that boards and calendars filter by.
-- A person places their own jobs and tasks on days of their week (ordinal 0
-- is the job itself, otherwise one of its tasks). Each person's last board and
-- calendar filters are kept so they survive a refresh. Additive only.
ALTER TABLE b_jobs ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high'));
CREATE TABLE b_plan_items(
 id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, day TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES b_jobs(id),
 ordinal INTEGER NOT NULL DEFAULT 0 CHECK(ordinal BETWEEN 0 AND 100), created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(owner_email,day,job_id,ordinal)
);
CREATE INDEX b_plan_items_owner ON b_plan_items(owner_email,day);
CREATE TABLE b_view_filters(
 owner_email TEXT NOT NULL, surface TEXT NOT NULL CHECK(surface IN ('board','calendar')),
 filters TEXT NOT NULL CHECK(json_valid(filters)), updated_at TEXT NOT NULL, PRIMARY KEY(owner_email,surface)
);
