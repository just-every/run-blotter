-- Workload capacity and coverage (CAPACITY-001). Each person's weekly hours
-- and skills; leave, client meetings and internal commitments as dated blocks
-- of weekday minutes; and a review estimate per job beside the task estimates
-- (WORK-009) that make up remaining preparation work. Additive only.
CREATE TABLE b_capacity(
 email TEXT PRIMARY KEY, weekly_minutes INTEGER NOT NULL CHECK(weekly_minutes BETWEEN 0 AND 6000),
 skills TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(skills)), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE b_capacity_blocks(
 id TEXT PRIMARY KEY, email TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('leave','meeting','internal')),
 starts_on TEXT NOT NULL, ends_on TEXT NOT NULL CHECK(ends_on>=starts_on),
 minutes_per_day INTEGER CHECK(minutes_per_day IS NULL OR minutes_per_day BETWEEN 1 AND 1440),
 label TEXT NOT NULL, job_id TEXT REFERENCES b_jobs(id), created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(kind='leave' OR minutes_per_day IS NOT NULL)
);
CREATE INDEX b_capacity_blocks_span ON b_capacity_blocks(starts_on,ends_on);
ALTER TABLE b_jobs ADD COLUMN review_estimate_minutes INTEGER CHECK(review_estimate_minutes IS NULL OR review_estimate_minutes BETWEEN 1 AND 100000);
