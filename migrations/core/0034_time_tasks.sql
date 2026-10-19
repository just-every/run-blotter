-- Time against a task (TIME-001). A time entry or running timer may name one
-- of its job's checklist tasks by ordinal; the job, and so its client, is
-- always recorded. Additive only.
ALTER TABLE b_time ADD COLUMN step_ordinal INTEGER CHECK(step_ordinal IS NULL OR step_ordinal BETWEEN 1 AND 100);
ALTER TABLE b_timers ADD COLUMN step_ordinal INTEGER CHECK(step_ordinal IS NULL OR step_ordinal BETWEEN 1 AND 100);
