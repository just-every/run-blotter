-- PORTAL-005 / ERASURE-002: approved erasure clears recipient language review metadata.
DROP TRIGGER b_bulk_recipient_language_fixed;
CREATE TRIGGER b_bulk_recipient_language_fixed BEFORE UPDATE ON b_bulk_recipients
 WHEN (NEW.preview_language IS NOT OLD.preview_language OR NEW.template_wording_hash IS NOT OLD.template_wording_hash)
 AND NOT (NEW.preview_language='en' AND NEW.template_wording_hash IS NULL AND NEW.address='' AND NEW.subject IS NULL AND NEW.body IS NULL)
 BEGIN SELECT RAISE(ABORT,'recipient language and template wording are fixed at preview'); END;
