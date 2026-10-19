-- ARCHIVE-002: restored schedules require a fresh, exact review before activation.
ALTER TABLE b_recurrence_rules ADD COLUMN restore_review INTEGER NOT NULL DEFAULT 0 CHECK(restore_review IN (0,1));
