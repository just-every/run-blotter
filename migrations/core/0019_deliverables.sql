-- Client approval of deliverables (DOC-003). Staff send numbered versions of a
-- deliverable through the client link; the client approves a version, or asks
-- for changes with a comment, once. A decision is bound to that version's
-- SHA-256, and only the newest version can be decided. Additive only, so older
-- archives still restore.
CREATE TABLE b_deliverables(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), title TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(job_id,title)
);
CREATE TABLE b_deliverable_versions(
 id TEXT PRIMARY KEY, deliverable_id TEXT NOT NULL REFERENCES b_deliverables(id), job_id TEXT NOT NULL REFERENCES b_jobs(id),
 version INTEGER NOT NULL CHECK(version>=1),
 name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 1048576), sha256 TEXT NOT NULL,
 content_base64 TEXT NOT NULL CHECK(length(content_base64)<=1398104),
 note TEXT NOT NULL DEFAULT '', submit_on_approval INTEGER NOT NULL CHECK(submit_on_approval IN (0,1)),
 sent_by TEXT NOT NULL, sent_at TEXT NOT NULL, delivery TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('sent','changes_requested','approved')),
 approver_name TEXT, approver_email TEXT, decided_at TEXT, decided_sha256 TEXT, comment TEXT NOT NULL DEFAULT '',
 moved_job INTEGER NOT NULL DEFAULT 0 CHECK(moved_job IN (0,1)),
 UNIQUE(deliverable_id,version),
 CHECK(status='sent' OR (approver_name IS NOT NULL AND decided_at IS NOT NULL AND decided_sha256=sha256)),
 CHECK(status<>'changes_requested' OR comment<>'')
);
CREATE INDEX b_deliverable_versions_job ON b_deliverable_versions(job_id);
CREATE TRIGGER b_deliverable_versions_immutable BEFORE UPDATE ON b_deliverable_versions
 WHEN NEW.id IS NOT OLD.id OR NEW.deliverable_id IS NOT OLD.deliverable_id OR NEW.job_id IS NOT OLD.job_id OR NEW.version IS NOT OLD.version
  OR NEW.name IS NOT OLD.name OR NEW.mime IS NOT OLD.mime OR NEW.size IS NOT OLD.size OR NEW.sha256 IS NOT OLD.sha256
  OR NEW.content_base64 IS NOT OLD.content_base64 OR NEW.note IS NOT OLD.note OR NEW.submit_on_approval IS NOT OLD.submit_on_approval
  OR NEW.sent_by IS NOT OLD.sent_by OR NEW.sent_at IS NOT OLD.sent_at
  OR (OLD.status<>'sent' AND (NEW.status IS NOT OLD.status OR NEW.approver_name IS NOT OLD.approver_name OR NEW.approver_email IS NOT OLD.approver_email
   OR NEW.decided_at IS NOT OLD.decided_at OR NEW.decided_sha256 IS NOT OLD.decided_sha256 OR NEW.comment IS NOT OLD.comment))
 BEGIN SELECT RAISE(ABORT,'deliverable versions are immutable'); END;
CREATE TRIGGER b_deliverable_versions_delete BEFORE DELETE ON b_deliverable_versions BEGIN SELECT RAISE(ABORT,'deliverable versions are immutable'); END;
CREATE TRIGGER b_deliverables_delete BEFORE DELETE ON b_deliverables BEGIN SELECT RAISE(ABORT,'deliverable history is immutable'); END;
