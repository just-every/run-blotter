-- WORK-007 job roles. A work type lists the roles its jobs need beyond
-- Preparer and Reviewer: Manager and Partner. A job that needs a Partner names
-- one (an active reviewer or the principal, never the preparer); the
-- reviewer's sign-off records the review and leaves the job In review for
-- partner sign-off, which only the partner or the principal completes or
-- returns. Additive only.
ALTER TABLE b_work_types ADD COLUMN roles TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(roles));
ALTER TABLE b_jobs ADD COLUMN partner_email TEXT;
ALTER TABLE b_jobs ADD COLUMN reviewed_by TEXT;
ALTER TABLE b_jobs ADD COLUMN reviewed_at TEXT;
CREATE TRIGGER b_jobs_partner_insert BEFORE INSERT ON b_jobs WHEN NEW.partner_email IS NOT NULL AND NEW.partner_email=NEW.preparer_email
 BEGIN SELECT RAISE(ABORT,'the partner cannot be the preparer'); END;
CREATE TRIGGER b_jobs_partner_update BEFORE UPDATE ON b_jobs WHEN NEW.partner_email IS NOT NULL AND NEW.partner_email=NEW.preparer_email
 BEGIN SELECT RAISE(ABORT,'the partner cannot be the preparer'); END;
