-- MSG-001: every message made from a template carries that version's files and
-- records their name, type, size and SHA-256. Bulk recipients and portal
-- messages join document reminders and organizer invitations. Additive only.
ALTER TABLE b_bulk_recipients ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(attachments));
-- A portal message composed from a template keeps its rendered subject, the
-- version used and the files the client may download from their link.
ALTER TABLE b_portal_items ADD COLUMN subject TEXT;
ALTER TABLE b_portal_items ADD COLUMN template_id TEXT REFERENCES b_msg_templates(id);
ALTER TABLE b_portal_items ADD COLUMN template_version INTEGER;
ALTER TABLE b_portal_items ADD COLUMN template_edited INTEGER NOT NULL DEFAULT 0 CHECK(template_edited IN (0,1));
ALTER TABLE b_portal_items ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(attachments));
