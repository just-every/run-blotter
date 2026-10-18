-- Rate cards (TIME-003): hourly rates by staff member, practice role, service
-- (the engagement template), client, or client and service, each from an
-- effective date. Additive only, so older archives still restore: rates saved
-- before this migration stay in b_rates and resolve as staff rates in force
-- from the start. Time entries snapshot the resolved rate and its source.
CREATE TABLE b_rate_cards(
 id TEXT PRIMARY KEY,
 scope TEXT NOT NULL CHECK(scope IN ('client_service','client','service','staff','role')),
 person_email TEXT, role TEXT CHECK(role IS NULL OR role IN ('owner','reviewer','preparer')),
 template_id TEXT REFERENCES b_templates(id), client_id TEXT REFERENCES b_clients(id),
 rate_cents INTEGER NOT NULL CHECK(rate_cents BETWEEN 0 AND 1000000), effective_from TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(scope<>'client_service' OR (client_id IS NOT NULL AND template_id IS NOT NULL AND person_email IS NULL AND role IS NULL)),
 CHECK(scope<>'client' OR (client_id IS NOT NULL AND template_id IS NULL AND person_email IS NULL AND role IS NULL)),
 CHECK(scope<>'service' OR (template_id IS NOT NULL AND client_id IS NULL AND person_email IS NULL AND role IS NULL)),
 CHECK(scope<>'staff' OR (person_email IS NOT NULL AND client_id IS NULL AND template_id IS NULL AND role IS NULL)),
 CHECK(scope<>'role' OR (role IS NOT NULL AND client_id IS NULL AND template_id IS NULL AND person_email IS NULL))
);
CREATE INDEX b_rate_cards_lookup ON b_rate_cards(scope,effective_from);
ALTER TABLE b_time ADD COLUMN rate_source TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE b_time ADD COLUMN rate_card_id TEXT;
