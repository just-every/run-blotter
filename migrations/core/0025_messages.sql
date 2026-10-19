-- Firm and personal message templates (MSG-001). A template is a named,
-- categorised subject and body with {{placeholders}}; each edit adds a version
-- with its author, and deleting hides the template but keeps its versions.
-- A reminder records the subject, the rendered text and the template version
-- it used, so later edits never change sent messages. Additive only.
CREATE TABLE b_firm(id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, set_by TEXT NOT NULL, set_at TEXT NOT NULL);
CREATE TABLE b_msg_templates(
 id TEXT PRIMARY KEY, scope TEXT NOT NULL CHECK(scope IN ('firm','personal')), owner_email TEXT,
 name TEXT NOT NULL, category TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>=1),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, deleted_by TEXT, deleted_at TEXT,
 CHECK((scope='firm' AND owner_email IS NULL) OR (scope='personal' AND owner_email IS NOT NULL))
);
CREATE TABLE b_msg_template_versions(
 template_id TEXT NOT NULL REFERENCES b_msg_templates(id), version INTEGER NOT NULL,
 subject TEXT NOT NULL, body TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(template_id,version)
);
CREATE TRIGGER b_msg_versions_immutable BEFORE UPDATE ON b_msg_template_versions BEGIN SELECT RAISE(ABORT,'template versions are immutable'); END;
CREATE TRIGGER b_msg_versions_delete BEFORE DELETE ON b_msg_template_versions BEGIN SELECT RAISE(ABORT,'template versions are immutable'); END;
ALTER TABLE b_reminders ADD COLUMN subject TEXT;
ALTER TABLE b_reminders ADD COLUMN template_id TEXT;
ALTER TABLE b_reminders ADD COLUMN template_version INTEGER;
