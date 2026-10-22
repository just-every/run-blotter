-- PORTAL-005 / MSG-002: review fixes the recipient language and template wording.
ALTER TABLE b_bulk_recipients ADD COLUMN preview_language TEXT NOT NULL DEFAULT 'en' CHECK(preview_language IN('en','es'));
ALTER TABLE b_bulk_recipients ADD COLUMN template_wording_hash TEXT;
CREATE TRIGGER b_bulk_recipient_language_fixed BEFORE UPDATE ON b_bulk_recipients
 WHEN NEW.preview_language IS NOT OLD.preview_language OR NEW.template_wording_hash IS NOT OLD.template_wording_hash
 BEGIN SELECT RAISE(ABORT,'recipient language and template wording are fixed at preview'); END;
