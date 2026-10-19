-- Per-entry billable status (TIME-001). Each time entry is billable or not,
-- chosen when it is recorded (manual entry or timer) and carried by a TIME-002
-- correction. Non-billable time keeps its snapshotted amount for budgets but
-- never reaches WIP, a billing export or the job's margin. Additive only, so
-- older archives restore with their time billable as before.
ALTER TABLE b_time ADD COLUMN billable INTEGER NOT NULL DEFAULT 1 CHECK(billable IN (0,1));
ALTER TABLE b_timers ADD COLUMN billable INTEGER NOT NULL DEFAULT 1 CHECK(billable IN (0,1));
