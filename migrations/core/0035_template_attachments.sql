-- Template attachments (MSG-001). Each template version carries its own files,
-- at most five of up to 1 MiB each; an edit keeps the previous version's files
-- unless it replaces them, so a version's files never change. A reminder
-- records the name, type, size and SHA-256 of every file it was sent with.
-- Additive only.
CREATE TABLE b_msg_template_files(
 template_id TEXT NOT NULL, version INTEGER NOT NULL, ordinal INTEGER NOT NULL CHECK(ordinal BETWEEN 1 AND 5),
 name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 1048576), sha256 TEXT NOT NULL,
 content_base64 TEXT NOT NULL CHECK(length(content_base64)<=1398104),
 PRIMARY KEY(template_id,version,ordinal), FOREIGN KEY(template_id,version) REFERENCES b_msg_template_versions(template_id,version)
);
CREATE TRIGGER b_msg_files_immutable BEFORE UPDATE ON b_msg_template_files BEGIN SELECT RAISE(ABORT,'template files are immutable'); END;
CREATE TRIGGER b_msg_files_delete BEFORE DELETE ON b_msg_template_files BEGIN SELECT RAISE(ABORT,'template files are immutable'); END;
ALTER TABLE b_reminders ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(attachments));
