-- Portal staging shares the existing nonportable seven-day transport only.
-- Completion keeps ordinary file custody, clocks, holds and erasure fencing.
ALTER TABLE b_document_uploads ADD COLUMN portal_link_id TEXT REFERENCES b_portal_links(id);
ALTER TABLE b_document_uploads ADD COLUMN portal_contact_id TEXT REFERENCES b_client_contacts(id);
ALTER TABLE b_document_uploads ADD COLUMN portal_contact_revision TEXT;
CREATE INDEX b_document_uploads_portal ON b_document_uploads(portal_link_id,request_id,expires_at);
CREATE TRIGGER b_portal_packet_grant_revoked AFTER UPDATE OF revoked_at ON b_portal_grants
 WHEN NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL BEGIN
 DELETE FROM b_document_uploads WHERE portal_contact_id=NEW.contact_id;
END;
