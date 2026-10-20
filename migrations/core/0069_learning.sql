-- LEARN-001. Operational copies and source references are native portable data.
-- Source contents are read live; file bytes, organizer answers and credentials
-- are never copied into a learning record.
CREATE TABLE b_learning_proposals(
 id TEXT PRIMARY KEY, source_template_id TEXT NOT NULL REFERENCES b_templates(id),
 title TEXT NOT NULL, expected_benefit TEXT NOT NULL, exceptions TEXT NOT NULL, assumptions TEXT NOT NULL,
 improvement TEXT NOT NULL CHECK(json_valid(improvement)),
 template_state TEXT NOT NULL CHECK(json_valid(template_state)),
 source_state TEXT NOT NULL CHECK(json_valid(source_state)),
 client_state TEXT NOT NULL CHECK(json_valid(client_state)),
 for_email TEXT NOT NULL, agent_label TEXT NOT NULL, created_channel TEXT NOT NULL CHECK(created_channel IN ('person','agent')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','declined')),
 created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT, decision_note TEXT,
 CHECK(status='pending' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_note IS NOT NULL))
);
CREATE TABLE b_learning_sources(
 proposal_id TEXT NOT NULL REFERENCES b_learning_proposals(id) ON DELETE CASCADE,
 job_id TEXT NOT NULL REFERENCES b_jobs(id) ON DELETE CASCADE,
 PRIMARY KEY(proposal_id,job_id)
);
CREATE TABLE b_learning_refs(
 id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL REFERENCES b_learning_proposals(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('review_return','portal_question','missing_request')),
 audit_id TEXT REFERENCES b_audit(id) ON DELETE CASCADE,
 question_id TEXT REFERENCES b_portal_items(id) ON DELETE CASCADE,
 request_id TEXT REFERENCES b_requests(id) ON DELETE CASCADE,
 CHECK((kind='review_return' AND audit_id IS NOT NULL AND question_id IS NULL AND request_id IS NULL)
 OR (kind='portal_question' AND question_id IS NOT NULL AND audit_id IS NULL AND request_id IS NULL)
 OR (kind='missing_request' AND request_id IS NOT NULL AND question_id IS NULL AND audit_id IS NULL))
);
CREATE TABLE b_learning_versions(
 id TEXT PRIMARY KEY, source_template_id TEXT NOT NULL REFERENCES b_templates(id),
 version INTEGER NOT NULL CHECK(version>0), proposal_id TEXT NOT NULL UNIQUE REFERENCES b_learning_proposals(id),
 snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), client_ids TEXT NOT NULL CHECK(json_valid(client_ids)), approved_by TEXT NOT NULL, approved_at TEXT NOT NULL,
 UNIQUE(source_template_id,version)
);
CREATE TABLE b_learning_clients(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id) ON DELETE CASCADE,
 source_template_id TEXT NOT NULL REFERENCES b_templates(id),
 version_id TEXT NOT NULL REFERENCES b_learning_versions(id),
 UNIQUE(client_id,source_template_id)
);
CREATE TABLE b_learning_job_versions(
 job_id TEXT PRIMARY KEY REFERENCES b_jobs(id) ON DELETE CASCADE,
 version_id TEXT NOT NULL REFERENCES b_learning_versions(id)
);
CREATE TRIGGER b_learning_version_immutable BEFORE UPDATE ON b_learning_versions
 BEGIN SELECT RAISE(ABORT,'learning versions are immutable'); END;
CREATE TRIGGER b_learning_job_version_immutable BEFORE UPDATE ON b_learning_job_versions
 BEGIN SELECT RAISE(ABORT,'job learning history is immutable'); END;
CREATE TRIGGER b_learning_proposal_immutable BEFORE UPDATE ON b_learning_proposals
 WHEN OLD.status<>'pending' OR NEW.status='pending'
 OR NEW.id IS NOT OLD.id OR NEW.source_template_id IS NOT OLD.source_template_id
 OR NEW.title IS NOT OLD.title OR NEW.expected_benefit IS NOT OLD.expected_benefit
 OR NEW.exceptions IS NOT OLD.exceptions OR NEW.assumptions IS NOT OLD.assumptions
 OR NEW.improvement IS NOT OLD.improvement OR NEW.template_state IS NOT OLD.template_state
 OR NEW.source_state IS NOT OLD.source_state OR NEW.client_state IS NOT OLD.client_state
 OR NEW.for_email IS NOT OLD.for_email OR NEW.agent_label IS NOT OLD.agent_label
 OR NEW.created_channel IS NOT OLD.created_channel OR NEW.created_at IS NOT OLD.created_at
 BEGIN SELECT RAISE(ABORT,'learning preparations are immutable'); END;
