-- READY-001: store source references and human decisions, not copied evidence.
CREATE TABLE b_readiness_questions(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id),
 source_kind TEXT NOT NULL CHECK(source_kind IN ('request','answer')),
 source_id TEXT NOT NULL, source_stamp TEXT NOT NULL,
 prepared_by TEXT NOT NULL, agent_label TEXT, created_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined','resolved')),
 todo_id TEXT REFERENCES b_portal_items(id),
 decided_by TEXT, decided_at TEXT, decision_note TEXT,
 resolved_by TEXT, resolved_at TEXT, resolution TEXT,
 UNIQUE(job_id,source_kind,source_id,source_stamp)
);
CREATE INDEX b_readiness_job ON b_readiness_questions(job_id,status);
CREATE TRIGGER b_readiness_signoff BEFORE UPDATE OF status ON b_jobs
 WHEN NEW.status='signed_off' AND EXISTS(SELECT 1 FROM b_readiness_questions WHERE job_id=NEW.id AND status='approved')
 BEGIN SELECT RAISE(ABORT,'readiness questions require reviewer judgment before sign-off'); END;
