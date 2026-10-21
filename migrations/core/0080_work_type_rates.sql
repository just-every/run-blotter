-- TIME-003: preserve template rates and add more specific work-type targets.
CREATE TABLE b_rate_cards_next(
 id TEXT PRIMARY KEY,
 scope TEXT NOT NULL CHECK(scope IN ('client_service','client','service','staff','role')),
 person_email TEXT, role TEXT CHECK(role IS NULL OR role IN ('owner','reviewer','preparer')),
 work_type_id TEXT REFERENCES b_work_types(id),
 template_id TEXT REFERENCES b_templates(id), client_id TEXT REFERENCES b_clients(id),
 rate_cents INTEGER NOT NULL CHECK(rate_cents BETWEEN 0 AND 1000000), effective_from TEXT NOT NULL,
 currency TEXT NOT NULL DEFAULT 'AUD' CHECK(currency IN ('USD','AUD')),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(scope<>'client_service' OR (client_id IS NOT NULL AND ((template_id IS NOT NULL AND work_type_id IS NULL) OR (template_id IS NULL AND work_type_id IS NOT NULL)) AND person_email IS NULL AND role IS NULL)),
 CHECK(scope<>'client' OR (work_type_id IS NULL AND client_id IS NOT NULL AND template_id IS NULL AND person_email IS NULL AND role IS NULL)),
 CHECK(scope<>'service' OR (((template_id IS NOT NULL AND work_type_id IS NULL) OR (template_id IS NULL AND work_type_id IS NOT NULL)) AND client_id IS NULL AND person_email IS NULL AND role IS NULL)),
 CHECK(scope<>'staff' OR (work_type_id IS NULL AND person_email IS NOT NULL AND client_id IS NULL AND template_id IS NULL AND role IS NULL)),
 CHECK(scope<>'role' OR (work_type_id IS NULL AND role IS NOT NULL AND client_id IS NULL AND template_id IS NULL AND person_email IS NULL))
);
INSERT INTO b_rate_cards_next(id,scope,person_email,role,template_id,client_id,rate_cents,effective_from,created_by,created_at,currency) SELECT id,scope,person_email,role,template_id,client_id,rate_cents,effective_from,created_by,created_at,currency FROM b_rate_cards;
DROP TABLE b_rate_cards;
ALTER TABLE b_rate_cards_next RENAME TO b_rate_cards;
CREATE INDEX b_rate_cards_lookup ON b_rate_cards(scope,effective_from);
