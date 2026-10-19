-- Timesheets and period locks (TIME-002). A person submits a week's time; a
-- reviewer or the principal approves or returns each entry with a reason. A
-- closed billing period locks its approved time, and a correction after
-- approval is an adjustment that keeps the original entry. Additive only, so
-- older archives still restore.
CREATE TABLE b_time_status(
 entry_id TEXT PRIMARY KEY REFERENCES b_time(id), person_email TEXT NOT NULL, week_start TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('submitted','approved','returned')),
 submitted_at TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', decided_by TEXT, decided_at TEXT,
 CHECK(status='submitted' OR decided_by IS NOT NULL), CHECK(status<>'returned' OR reason<>'')
);
CREATE INDEX b_time_status_week ON b_time_status(person_email,week_start);
CREATE TABLE b_periods(
 id TEXT PRIMARY KEY, start_date TEXT NOT NULL, end_date TEXT NOT NULL, note TEXT NOT NULL,
 closed_by TEXT NOT NULL, closed_at TEXT NOT NULL, CHECK(end_date>=start_date)
);
CREATE TABLE b_time_adjustments(
 id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES b_time(id),
 minutes INTEGER NOT NULL CHECK(minutes<>0 AND minutes BETWEEN -1440 AND 1440), amount_cents INTEGER NOT NULL,
 reason TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX b_time_adjustments_entry ON b_time_adjustments(entry_id);
