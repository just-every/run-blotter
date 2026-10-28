-- Contact choices are evidence only. No sender, message or dispatch authority is stored.
CREATE TABLE b_sms_consents (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  contact_revision TEXT NOT NULL,
  phone TEXT NOT NULL,
  wording_version TEXT NOT NULL,
  wording TEXT NOT NULL,
  language TEXT NOT NULL,
  choice TEXT NOT NULL CHECK(choice IN ('decline','opt_in','withdraw')),
  actor TEXT NOT NULL,
  at TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  key_digest TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  invalidated_at TEXT,
  invalidation_reason TEXT,
  restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN (0,1)),
  erased_at TEXT,
  UNIQUE(account_id,key_digest),
  UNIQUE(client_id,contact_id,sequence)
);
CREATE INDEX b_sms_consents_contact ON b_sms_consents(client_id,contact_id,sequence);
-- Ordinary contact edits and merge undo cannot revive a choice; erasure alone redacts payloads.
CREATE TRIGGER b_sms_consents_immutable BEFORE UPDATE ON b_sms_consents
WHEN NEW.id<>OLD.id OR NEW.client_id<>OLD.client_id OR NEW.contact_id<>OLD.contact_id
  OR NEW.account_id<>OLD.account_id OR NEW.choice<>OLD.choice OR NEW.at<>OLD.at
  OR NEW.sequence<>OLD.sequence OR NEW.key_digest<>OLD.key_digest
  OR NEW.payload_digest<>OLD.payload_digest OR NEW.wording_version<>OLD.wording_version
  OR NEW.language<>OLD.language OR NEW.restored<OLD.restored
  OR (OLD.invalidated_at IS NOT NULL AND (NEW.invalidated_at IS NULL OR NEW.invalidated_at<>OLD.invalidated_at))
  OR (NEW.erased_at IS NULL AND (NEW.phone<>OLD.phone OR NEW.wording<>OLD.wording
    OR NEW.actor<>OLD.actor OR NEW.contact_revision<>OLD.contact_revision))
BEGIN SELECT RAISE(ABORT,'immutable SMS consent evidence'); END;
