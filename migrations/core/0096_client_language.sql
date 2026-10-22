-- PORTAL-005: each contact has a language preference (English or Spanish); a firm message
-- template keeps its English text and may carry a Spanish version of each template version.
ALTER TABLE b_client_contacts ADD COLUMN language TEXT NOT NULL DEFAULT 'en' CHECK(language IN('en','es'));
ALTER TABLE b_reminders ADD COLUMN language TEXT;
CREATE TABLE b_msg_template_translations(
 template_id TEXT NOT NULL, version INTEGER NOT NULL, language TEXT NOT NULL CHECK(language IN('es')),
 subject TEXT NOT NULL, body TEXT NOT NULL, author TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(template_id,version,language), FOREIGN KEY(template_id,version) REFERENCES b_msg_template_versions(template_id,version)
);
CREATE TRIGGER b_msg_translations_immutable BEFORE UPDATE ON b_msg_template_translations BEGIN SELECT RAISE(ABORT,'template translations are immutable'); END;
CREATE TRIGGER b_msg_translations_delete BEFORE DELETE ON b_msg_template_translations BEGIN SELECT RAISE(ABORT,'template translations are immutable'); END;
