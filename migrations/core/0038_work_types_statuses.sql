-- Firm work types and the status model (WORK-007). Each template has a work
-- type of the same name (created with the template); the firm adds others with
-- a default template, default budget and color. A job's stage is one of six:
-- Planned, Ready to start, In progress and Waiting while it is open (set by its
-- people), In review and Completed from its status (only through the review
-- gates). Firm sub-statuses sit under one stage and may be limited to work
-- types. Every stage or sub-status change is recorded with who, when, and the
-- old and new values. Additive only.
CREATE TABLE b_work_types(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, template_id TEXT REFERENCES b_templates(id),
 budget_minutes INTEGER CHECK(budget_minutes IS NULL OR budget_minutes BETWEEN 1 AND 100000),
 color TEXT NOT NULL DEFAULT '#64748b' CHECK(color GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
INSERT INTO b_work_types(id,name,template_id,created_by,created_at) SELECT 'wt-'||id,name,id,created_by,created_at FROM b_templates;
CREATE TABLE b_sub_statuses(
 id TEXT PRIMARY KEY, stage TEXT NOT NULL CHECK(stage IN ('planned','ready','in_progress','waiting','in_review','completed')),
 name TEXT NOT NULL, work_types TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(work_types)),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, deleted_by TEXT, deleted_at TEXT
);
ALTER TABLE b_jobs ADD COLUMN work_type_id TEXT REFERENCES b_work_types(id);
ALTER TABLE b_jobs ADD COLUMN open_stage TEXT CHECK(open_stage IS NULL OR open_stage IN ('planned','ready','in_progress','waiting'));
ALTER TABLE b_jobs ADD COLUMN sub_status_id TEXT REFERENCES b_sub_statuses(id);
DROP TRIGGER b_jobs_signed_off;
UPDATE b_jobs SET work_type_id='wt-'||template_id, open_stage='in_progress';
CREATE TRIGGER b_jobs_signed_off BEFORE UPDATE ON b_jobs WHEN OLD.status='signed_off' AND NEW.client_id IS OLD.client_id
 BEGIN SELECT RAISE(ABORT,'signed-off jobs are immutable'); END;
-- A sub-status always sits under the job's current stage, so none can stand in for the review gates.
CREATE TRIGGER b_jobs_sub_status BEFORE UPDATE ON b_jobs WHEN NEW.sub_status_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM b_sub_statuses s WHERE s.id=NEW.sub_status_id AND s.deleted_at IS NULL
  AND s.stage=CASE NEW.status WHEN 'review' THEN 'in_review' WHEN 'signed_off' THEN 'completed' ELSE NEW.open_stage END)
 BEGIN SELECT RAISE(ABORT,'sub-status does not belong to the job stage'); END;
CREATE TABLE b_job_status_history(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id),
 from_stage TEXT, from_sub_status_id TEXT, to_stage TEXT NOT NULL, to_sub_status_id TEXT, by TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX b_job_status_history_job ON b_job_status_history(job_id,at);
CREATE TRIGGER b_job_status_history_immutable BEFORE UPDATE ON b_job_status_history BEGIN SELECT RAISE(ABORT,'status history is immutable'); END;
CREATE TRIGGER b_job_status_history_delete BEFORE DELETE ON b_job_status_history BEGIN SELECT RAISE(ABORT,'status history is immutable'); END;
-- History starts from each job's current stage, at the time and by the person that put it there.
INSERT INTO b_job_status_history(id,job_id,to_stage,by,at)
 SELECT 'h-'||id,id,CASE status WHEN 'review' THEN 'in_review' WHEN 'signed_off' THEN 'completed' ELSE 'in_progress' END,
  COALESCE(signed_off_by,submitted_by,created_by),COALESCE(signed_off_at,submitted_at,created_at) FROM b_jobs;
