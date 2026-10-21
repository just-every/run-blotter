-- MSG-002 freezes only organizer identity/revision, never answers or bearer links.
ALTER TABLE b_bulk_batches ADD COLUMN attach_organizer INTEGER NOT NULL DEFAULT 0 CHECK(attach_organizer IN (0,1));
ALTER TABLE b_bulk_recipients ADD COLUMN organizer_id TEXT REFERENCES b_job_organizers(id);
ALTER TABLE b_bulk_recipients ADD COLUMN organizer_revision TEXT;
CREATE TRIGGER b_bulk_organizer_fixed BEFORE UPDATE ON b_bulk_batches
 WHEN NEW.attach_organizer IS NOT OLD.attach_organizer
 BEGIN SELECT RAISE(ABORT,'immutable batch: organizer attachment fixed at preview'); END;
CREATE TRIGGER b_bulk_recipient_organizer_fixed BEFORE UPDATE ON b_bulk_recipients
 WHEN NEW.organizer_id IS NOT OLD.organizer_id OR NEW.organizer_revision IS NOT OLD.organizer_revision
 BEGIN SELECT RAISE(ABORT,'immutable recipient: organizer fixed at preview'); END;
