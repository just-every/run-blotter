-- Bulk client messages and marketing consent (MSG-002; ct 20 Oct 21:21Z).
-- Each template version carries an immutable engagement or marketing class.
ALTER TABLE b_msg_template_versions ADD COLUMN message_class TEXT NOT NULL DEFAULT 'engagement' CHECK(message_class IN ('engagement','marketing'));

-- The append-only marketing consent log. Grants belong to one contact
-- relationship; withdrawals apply to the address across the whole firm.
CREATE TABLE b_marketing_consents(
 id TEXT PRIMARY KEY, contact_id TEXT REFERENCES b_client_contacts(id), client_id TEXT REFERENCES b_clients(id),
 address TEXT NOT NULL CHECK(address=lower(trim(address)) AND address<>''),
 purpose TEXT NOT NULL DEFAULT 'marketing' CHECK(purpose='marketing'),
 channel TEXT NOT NULL CHECK(channel IN ('email','portal')),
 kind TEXT NOT NULL CHECK(kind IN ('grant','withdraw','correction')),
 source TEXT NOT NULL CHECK(source IN ('intake_checkbox','portal_preference','staff_evidence','import','migration','unsubscribe_link','one_click','staff_reply','provider_complaint','owner_correction')),
 acted_at TEXT NOT NULL, recorded_at TEXT NOT NULL, actor TEXT NOT NULL,
 wording TEXT NOT NULL DEFAULT '', wording_version TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT 'en',
 evidence TEXT NOT NULL DEFAULT '', corrects_id TEXT REFERENCES b_marketing_consents(id), reason TEXT NOT NULL DEFAULT '',
 restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN (0,1)),
 CHECK(kind<>'grant' OR (contact_id IS NOT NULL AND wording<>'' AND wording_version<>'')),
 CHECK((kind='correction')=(source='owner_correction')),
 CHECK(kind<>'correction' OR (corrects_id IS NOT NULL AND reason<>'')),
 CHECK(source NOT IN ('staff_evidence','staff_reply') OR evidence<>'')
);
CREATE INDEX b_marketing_consents_address ON b_marketing_consents(address,acted_at);
CREATE INDEX b_marketing_consents_contact ON b_marketing_consents(contact_id);
CREATE UNIQUE INDEX b_marketing_consents_corrects ON b_marketing_consents(corrects_id) WHERE corrects_id IS NOT NULL;
CREATE TRIGGER b_marketing_consents_update BEFORE UPDATE ON b_marketing_consents BEGIN SELECT RAISE(ABORT,'consent events are immutable'); END;
CREATE TRIGGER b_marketing_consents_delete BEFORE DELETE ON b_marketing_consents BEGIN SELECT RAISE(ABORT,'consent events are immutable'); END;
-- The principal's confirmation that the consent log is current; installation-local, so a restore starts unconfirmed.
CREATE TABLE b_marketing_confirmations(id TEXT PRIMARY KEY, confirmed_by TEXT NOT NULL, confirmed_at TEXT NOT NULL, note TEXT NOT NULL);
-- A hard bounce marks an address invalid for both classes.
CREATE TABLE b_mail_suppressions(address TEXT PRIMARY KEY CHECK(address=lower(trim(address)) AND address<>''), reason TEXT NOT NULL, source_event TEXT NOT NULL, at TEXT NOT NULL);

-- A batch's class, template version and recipients are fixed at preview.
CREATE TABLE b_bulk_batches(
 id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE,
 class TEXT NOT NULL CHECK(class IN ('engagement','marketing')), channel TEXT NOT NULL DEFAULT 'email' CHECK(channel='email'),
 template_id TEXT NOT NULL REFERENCES b_msg_templates(id), template_version INTEGER NOT NULL,
 reason TEXT NOT NULL DEFAULT '', topic TEXT CHECK(topic IS NULL OR topic IN ('tax','other')), role TEXT NOT NULL DEFAULT 'primary',
 filter TEXT NOT NULL CHECK(json_valid(filter)), fingerprint TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('previewed','scheduled','sending','sent','paused')),
 send_at TEXT, chunk_size INTEGER NOT NULL DEFAULT 50 CHECK(chunk_size BETWEEN 1 AND 500),
 owner_email TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 approved_by TEXT, approved_at TEXT, scheduled_by TEXT, scheduled_at TEXT,
 restore_review INTEGER NOT NULL DEFAULT 0 CHECK(restore_review IN (0,1)),
 CHECK(class<>'engagement' OR (reason<>'' AND topic IS NULL)), CHECK(class<>'marketing' OR topic IS NOT NULL),
 CHECK(class<>'marketing' OR status IN ('previewed','paused') OR approved_by IS NOT NULL)
);
CREATE TRIGGER b_bulk_batches_fixed BEFORE UPDATE ON b_bulk_batches
 WHEN NEW.class IS NOT OLD.class OR NEW.template_id IS NOT OLD.template_id OR NEW.template_version IS NOT OLD.template_version OR NEW.filter IS NOT OLD.filter OR NEW.fingerprint IS NOT OLD.fingerprint OR NEW.idempotency_key IS NOT OLD.idempotency_key
 BEGIN SELECT RAISE(ABORT,'immutable batch: class and recipients are fixed at preview'); END;
CREATE TABLE b_bulk_recipients(
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES b_bulk_batches(id), ordinal INTEGER NOT NULL,
 client_id TEXT NOT NULL REFERENCES b_clients(id), contact_id TEXT NOT NULL REFERENCES b_client_contacts(id),
 address TEXT NOT NULL, dedupe_key TEXT NOT NULL, basis TEXT NOT NULL DEFAULT '', job_id TEXT REFERENCES b_jobs(id),
 status TEXT NOT NULL CHECK(status IN ('pending','claimed','accepted','delivered','bounced','complained','held','failed','uncertain')),
 held_reason TEXT NOT NULL DEFAULT '', subject TEXT, body TEXT, provider_message_id TEXT, delivery TEXT NOT NULL DEFAULT '',
 attempt_id TEXT, attempted_at TEXT, misclassified_by TEXT, misclassified_at TEXT, misclassified_reason TEXT,
 UNIQUE(batch_id,dedupe_key), UNIQUE(batch_id,ordinal)
);
CREATE INDEX b_bulk_recipients_provider ON b_bulk_recipients(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TABLE b_bulk_exclusions(id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES b_bulk_batches(id), client_id TEXT NOT NULL REFERENCES b_clients(id), contact_id TEXT, address TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL);
-- Provider delivery events, at most once per provider event.
CREATE TABLE b_bulk_events(
 id TEXT PRIMARY KEY, provider_event_id TEXT NOT NULL UNIQUE, recipient_id TEXT NOT NULL REFERENCES b_bulk_recipients(id),
 type TEXT NOT NULL CHECK(type IN ('delivered','bounced','complained')), detail TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL, recorded_at TEXT NOT NULL
);
-- Unsubscribe link secrets: only their digest, never archived.
CREATE TABLE b_unsubscribe_tokens(digest TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES b_bulk_recipients(id), address TEXT NOT NULL, created_at TEXT NOT NULL);
