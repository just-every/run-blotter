-- Staff choices retain attribution, never mailbox credentials or provider authority.
CREATE TABLE b_mail_consents (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  person_email TEXT NOT NULL,
  person_version INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source='mail'),
  wording_version TEXT NOT NULL,
  wording TEXT NOT NULL,
  choice TEXT NOT NULL CHECK(choice IN ('decline','opt_in','withdraw')),
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  at TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  key_digest TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  invalidated_at TEXT,
  invalidation_reason TEXT,
  restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN (0,1)),
  UNIQUE(person_id,key_digest),
  UNIQUE(person_id,sequence)
);
CREATE TRIGGER b_mail_consents_immutable BEFORE UPDATE ON b_mail_consents
WHEN NEW.id<>OLD.id OR NEW.person_id<>OLD.person_id OR NEW.person_email<>OLD.person_email
  OR NEW.person_version<>OLD.person_version OR NEW.source<>OLD.source OR NEW.wording_version<>OLD.wording_version
  OR NEW.wording<>OLD.wording OR NEW.choice<>OLD.choice OR NEW.actor_id<>OLD.actor_id
  OR NEW.actor_email<>OLD.actor_email OR NEW.at<>OLD.at OR NEW.sequence<>OLD.sequence
  OR NEW.key_digest<>OLD.key_digest OR NEW.payload_digest<>OLD.payload_digest OR NEW.restored<OLD.restored
  OR (OLD.invalidated_at IS NOT NULL AND (NEW.invalidated_at IS NOT OLD.invalidated_at OR NEW.invalidation_reason IS NOT OLD.invalidation_reason))
BEGIN SELECT RAISE(ABORT,'immutable mail consent evidence'); END;
-- Includes enterprise erase, provisioning and native member updates in the same transaction.
CREATE TRIGGER b_mail_consents_staff_inactive AFTER UPDATE OF active ON b_members
WHEN NEW.active=0
BEGIN
  UPDATE b_mail_consents SET invalidated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    invalidation_reason='Staff access ended; a fresh personal choice is required'
    WHERE person_email=NEW.email AND invalidated_at IS NULL;
END;
