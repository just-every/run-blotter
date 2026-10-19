-- PORTAL-004. Content and immutable submitted originals are portable; bearer
-- access continues to use excluded b_portal_links, never organizer content.
ALTER TABLE b_templates ADD COLUMN organizer TEXT CHECK(organizer IS NULL OR json_valid(organizer));
ALTER TABLE b_requests ADD COLUMN organizer_active INTEGER NOT NULL DEFAULT 1 CHECK(organizer_active IN (0,1));
CREATE TABLE b_organizer_versions(
 template_id TEXT NOT NULL REFERENCES b_templates(id), version INTEGER NOT NULL,
 definition TEXT NOT NULL CHECK(json_valid(definition)), author TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(template_id,version)
);
CREATE TRIGGER b_organizer_versions_immutable BEFORE UPDATE ON b_organizer_versions
 BEGIN SELECT RAISE(ABORT,'organizer versions are immutable'); END;
CREATE TABLE b_job_organizers(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL UNIQUE REFERENCES b_jobs(id),
 definition TEXT NOT NULL CHECK(json_valid(definition)), revision TEXT NOT NULL,
 sent_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 erased_at TEXT, erased_by TEXT, erase_reason TEXT
);
ALTER TABLE b_job_answers ADD COLUMN organizer_source TEXT REFERENCES b_job_organizers(id);
CREATE TABLE b_organizer_answers(
 organizer_id TEXT NOT NULL REFERENCES b_job_organizers(id), key TEXT NOT NULL,
 contact_id TEXT REFERENCES b_client_contacts(id), value TEXT, confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN (0,1)),
 carried_from TEXT, updated_by TEXT, updated_at TEXT,
 PRIMARY KEY(organizer_id,key)
);
CREATE TABLE b_organizer_submissions(
 id TEXT PRIMARY KEY, organizer_id TEXT NOT NULL REFERENCES b_job_organizers(id),
 version INTEGER NOT NULL, contact_id TEXT NOT NULL REFERENCES b_client_contacts(id),
 answers TEXT CHECK(answers IS NULL OR json_valid(answers)), submitted_at TEXT NOT NULL,
 reviewed_by TEXT, reviewed_at TEXT, review_note TEXT, erased_at TEXT,
 UNIQUE(organizer_id,version)
);
CREATE TRIGGER b_organizer_submissions_original BEFORE UPDATE ON b_organizer_submissions
 WHEN NEW.organizer_id<>OLD.organizer_id OR NEW.version<>OLD.version OR NEW.contact_id<>OLD.contact_id
 OR NEW.submitted_at<>OLD.submitted_at OR (NEW.answers IS NOT OLD.answers AND NOT(NEW.answers IS NULL AND NEW.erased_at IS NOT NULL))
 BEGIN SELECT RAISE(ABORT,'submitted organizer originals are immutable'); END;
CREATE TABLE b_organizer_requests(
 organizer_id TEXT NOT NULL REFERENCES b_job_organizers(id), key TEXT NOT NULL,
 request_id TEXT NOT NULL REFERENCES b_requests(id), PRIMARY KEY(organizer_id,key)
);
CREATE TABLE b_organizer_deliveries(
 id TEXT PRIMARY KEY, organizer_id TEXT NOT NULL REFERENCES b_job_organizers(id),
 contact_id TEXT NOT NULL REFERENCES b_client_contacts(id), to_email TEXT NOT NULL,
 subject TEXT NOT NULL, message TEXT NOT NULL, template_id TEXT, template_version INTEGER,
 attachments TEXT NOT NULL CHECK(json_valid(attachments)), delivery TEXT NOT NULL,
 sent_by TEXT NOT NULL, sent_at TEXT NOT NULL
);
