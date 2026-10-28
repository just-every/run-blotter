-- Portal staging shares the existing nonportable seven-day transport only.
-- Completion keeps ordinary file custody, clocks, holds and erasure fencing.
ALTER TABLE b_document_uploads ADD COLUMN portal_link_id TEXT REFERENCES b_portal_links(id);
ALTER TABLE b_document_uploads ADD COLUMN portal_contact_id TEXT REFERENCES b_client_contacts(id);
ALTER TABLE b_document_uploads ADD COLUMN portal_contact_revision TEXT;
CREATE INDEX b_document_uploads_portal ON b_document_uploads(portal_link_id,request_id,expires_at);
