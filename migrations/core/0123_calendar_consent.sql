-- Staff choice evidence only: no calendar events or connection credentials.
CREATE TABLE b_calendar_consents (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  person_email TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source='calendar'),
  wording_version TEXT NOT NULL,
  wording TEXT NOT NULL,
  choice TEXT NOT NULL CHECK(choice IN ('decline','opt_in','withdraw')),
  actor_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  at TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  key_digest TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  invalidated_at TEXT,
  invalidation_reason TEXT,
  restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN (0,1)),
  CHECK(staff_id=actor_id AND person_email=actor),
  UNIQUE(staff_id,key_digest),
  UNIQUE(person_email,sequence)
);
CREATE TRIGGER b_calendar_consents_immutable BEFORE UPDATE ON b_calendar_consents
WHEN NEW.id<>OLD.id OR NEW.staff_id<>OLD.staff_id OR NEW.person_email<>OLD.person_email
  OR NEW.source<>OLD.source OR NEW.wording_version<>OLD.wording_version OR NEW.wording<>OLD.wording
  OR NEW.choice<>OLD.choice OR NEW.actor_id<>OLD.actor_id OR NEW.actor<>OLD.actor OR NEW.at<>OLD.at
  OR NEW.sequence<>OLD.sequence OR NEW.key_digest<>OLD.key_digest OR NEW.payload_digest<>OLD.payload_digest
  OR NEW.restored<OLD.restored
  OR (OLD.invalidated_at IS NOT NULL AND (NEW.invalidated_at IS NULL OR NEW.invalidated_at<>OLD.invalidated_at))
BEGIN SELECT RAISE(ABORT,'immutable calendar consent evidence'); END;
-- Covers other native member-deactivation doors too, including enterprise provisioning.
CREATE TRIGGER b_calendar_consents_member_inactive AFTER UPDATE OF active ON b_members
WHEN NEW.active=0
BEGIN
  UPDATE b_calendar_consents SET invalidated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    invalidation_reason='Staff deactivated; a fresh personal choice is required'
    WHERE person_email=OLD.email AND invalidated_at IS NULL;
END;
CREATE TRIGGER b_calendar_consents_operator_inactive AFTER UPDATE OF status ON oa_operators
WHEN NEW.status<>'active'
BEGIN
  UPDATE b_calendar_consents SET invalidated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    invalidation_reason='Staff identity deactivated; a fresh personal choice is required'
    WHERE staff_id=OLD.id AND invalidated_at IS NULL;
END;
