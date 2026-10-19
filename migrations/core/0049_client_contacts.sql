-- CRM-001: authority belongs to the contact's relationship with this entity.
ALTER TABLE b_clients ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'business' CHECK(entity_type IN ('individual','business','trust'));
ALTER TABLE b_clients ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active','archived'));
ALTER TABLE b_clients ADD COLUMN archived_at TEXT;
ALTER TABLE b_clients ADD COLUMN archived_by TEXT;
ALTER TABLE b_clients ADD COLUMN partner_email TEXT NOT NULL DEFAULT '';
ALTER TABLE b_clients ADD COLUMN team TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(team));
ALTER TABLE b_clients ADD COLUMN services TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(services));
ALTER TABLE b_clients ADD COLUMN owner_client_id TEXT REFERENCES b_clients(id);
ALTER TABLE b_clients ADD COLUMN ssn_last4 TEXT NOT NULL DEFAULT '' CHECK(ssn_last4='' OR (length(ssn_last4)=4 AND ssn_last4 NOT GLOB '*[^0-9]*'));
ALTER TABLE b_prospects ADD COLUMN contacts TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(contacts));
CREATE TABLE b_client_contacts(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id),
 name TEXT NOT NULL, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '' CHECK(email=lower(trim(email))), phone TEXT NOT NULL DEFAULT '',
 roles TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(roles)),
 authorized INTEGER NOT NULL DEFAULT 0 CHECK(authorized IN (0,1)), signer INTEGER NOT NULL DEFAULT 0 CHECK(signer IN (0,1)),
 portal INTEGER NOT NULL DEFAULT 0 CHECK(portal IN (0,1)), request_consent INTEGER NOT NULL DEFAULT 0 CHECK(request_consent IN (0,1)),
 email_consent INTEGER NOT NULL DEFAULT 0 CHECK(email_consent IN (0,1)), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 consent_note TEXT NOT NULL DEFAULT '', revision TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX b_contacts_entity_email ON b_client_contacts(client_id,email) WHERE email<>'' AND active=1;
CREATE INDEX b_contacts_email ON b_client_contacts(email);
CREATE INDEX b_contacts_phone ON b_client_contacts(phone) WHERE phone<>'';
ALTER TABLE b_portal_links ADD COLUMN contact_id TEXT REFERENCES b_client_contacts(id);
-- Existing clients retain their current, entity-specific collection permission.
INSERT INTO b_client_contacts(id,client_id,name,first_name,email,roles,authorized,portal,request_consent,email_consent,revision,created_by,created_at,updated_by,updated_at)
 SELECT 'legacy:'||id,id,contact_name,CASE WHEN instr(trim(contact_name),' ')>0 THEN substr(trim(contact_name),1,instr(trim(contact_name),' ')-1) ELSE trim(contact_name) END,
 lower(trim(contact_email)),'["primary"]',1,CASE WHEN contact_email<>'' THEN 1 ELSE 0 END,CASE WHEN contact_email<>'' THEN 1 ELSE 0 END,CASE WHEN contact_email<>'' THEN 1 ELSE 0 END,revision,'legacy migration',created_at,'legacy migration',created_at
 FROM b_clients WHERE contact_name<>'' OR contact_email<>'';
-- Legacy columns are a projection only. Inserts preserve archive/import revisions; contact commands explicitly advance them. Contact APIs never use them as identity.
CREATE TRIGGER b_contact_insert AFTER INSERT ON b_client_contacts BEGIN
 UPDATE b_clients SET revision=revision,contact_name=coalesce((SELECT name FROM b_client_contacts WHERE client_id=NEW.client_id AND active=1 AND authorized=1 AND EXISTS(SELECT 1 FROM json_each(roles) WHERE value='primary') ORDER BY created_at,id LIMIT 1),''),
 contact_email=coalesce((SELECT email FROM b_client_contacts WHERE client_id=NEW.client_id AND active=1 AND authorized=1 AND EXISTS(SELECT 1 FROM json_each(roles) WHERE value='primary') ORDER BY created_at,id LIMIT 1),'') WHERE id=NEW.client_id AND merged_into IS NULL;
END;
CREATE TRIGGER b_contact_update AFTER UPDATE ON b_client_contacts BEGIN
 UPDATE b_clients SET revision=lower(hex(randomblob(16))),contact_name=coalesce((SELECT name FROM b_client_contacts WHERE client_id=b_clients.id AND active=1 AND authorized=1 AND EXISTS(SELECT 1 FROM json_each(roles) WHERE value='primary') ORDER BY created_at,id LIMIT 1),''),
 contact_email=coalesce((SELECT email FROM b_client_contacts WHERE client_id=b_clients.id AND active=1 AND authorized=1 AND EXISTS(SELECT 1 FROM json_each(roles) WHERE value='primary') ORDER BY created_at,id LIMIT 1),'') WHERE id IN (OLD.client_id,NEW.client_id) AND merged_into IS NULL;
END;
CREATE TRIGGER b_contact_delete AFTER DELETE ON b_client_contacts BEGIN
 UPDATE b_clients SET revision=lower(hex(randomblob(16))),contact_name=coalesce((SELECT name FROM b_client_contacts WHERE client_id=OLD.client_id AND active=1 AND authorized=1 AND EXISTS(SELECT 1 FROM json_each(roles) WHERE value='primary') ORDER BY created_at,id LIMIT 1),''),
 contact_email=coalesce((SELECT email FROM b_client_contacts WHERE client_id=OLD.client_id AND active=1 AND authorized=1 AND EXISTS(SELECT 1 FROM json_each(roles) WHERE value='primary') ORDER BY created_at,id LIMIT 1),'') WHERE id=OLD.client_id AND merged_into IS NULL;
END;
