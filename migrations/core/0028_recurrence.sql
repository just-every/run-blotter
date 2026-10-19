-- Automatic recurring work (WORK-002). A person approves a rule for one client
-- and template: the months its periods start in, its first and last period,
-- how many months ahead of a period's start its job is created, the due date
-- (calendar days after the period's last day), staff and a time budget. The
-- scheduler (an hourly Cron Trigger, or Run now) creates each period once:
-- b_rule_periods holds every period a rule has generated, claimed (an existing
-- job, e.g. migrated or made by hand) or skipped, so none is made twice.
-- Additive only, so older archives still restore.
CREATE TABLE b_recurrence_rules(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), template_id TEXT NOT NULL REFERENCES b_templates(id),
 months TEXT NOT NULL CHECK(json_valid(months)), first_period TEXT NOT NULL, end_period TEXT,
 lead_months INTEGER NOT NULL CHECK(lead_months BETWEEN 0 AND 24),
 due_days INTEGER NOT NULL CHECK(due_days BETWEEN 0 AND 366), due_note TEXT NOT NULL,
 preparer_email TEXT NOT NULL, reviewer_email TEXT NOT NULL, manager_email TEXT,
 budget_minutes INTEGER CHECK(budget_minutes IS NULL OR budget_minutes BETWEEN 1 AND 100000),
 status TEXT NOT NULL CHECK(status IN ('active','paused')), revision TEXT NOT NULL,
 approved_by TEXT NOT NULL, approved_at TEXT NOT NULL,
 UNIQUE(client_id,template_id)
);
CREATE TABLE b_rule_periods(
 rule_id TEXT NOT NULL REFERENCES b_recurrence_rules(id), period_start TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('generated','claimed','skipped')), job_id TEXT REFERENCES b_jobs(id),
 note TEXT NOT NULL DEFAULT '', by_email TEXT NOT NULL, at TEXT NOT NULL,
 PRIMARY KEY(rule_id,period_start), CHECK((kind='skipped') = (job_id IS NULL))
);
CREATE UNIQUE INDEX b_rule_periods_job ON b_rule_periods(job_id) WHERE job_id IS NOT NULL;
CREATE TABLE b_scheduler_runs(
 id TEXT PRIMARY KEY, trigger TEXT NOT NULL CHECK(trigger IN ('cron','manual')), as_of TEXT NOT NULL,
 created INTEGER NOT NULL, claimed INTEGER NOT NULL, held TEXT NOT NULL CHECK(json_valid(held)), finished_at TEXT NOT NULL
);
ALTER TABLE b_jobs ADD COLUMN budget_minutes INTEGER CHECK(budget_minutes IS NULL OR budget_minutes BETWEEN 1 AND 100000);
