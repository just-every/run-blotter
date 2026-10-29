-- Native custody exception: no automatic cleanup or false client-erasure claim.
-- Admission takes this durable hold before source capture. A future reviewed
-- Base client-scoped redaction hook is required before it can be released.
CREATE TABLE b_agent_door_custody(id INTEGER PRIMARY KEY CHECK(id=1),retained INTEGER NOT NULL CHECK(retained=1));
CREATE TRIGGER b_agent_door_client_erasure BEFORE INSERT ON b_client_erasures
WHEN EXISTS(SELECT 1 FROM b_agent_door_custody WHERE retained=1)
BEGIN SELECT RAISE(ABORT,'agent evidence custody hold: client erasure requires atomic retained-artifact redaction'); END;
CREATE TRIGGER b_agent_door_expiry BEFORE INSERT ON b_expiry_erasures
WHEN EXISTS(SELECT 1 FROM b_agent_door_custody WHERE retained=1)
BEGIN SELECT RAISE(ABORT,'agent evidence custody hold: retention expiry requires atomic retained-artifact redaction'); END;
CREATE TRIGGER b_agent_door_file_erasure BEFORE UPDATE OF erased_at ON b_files
WHEN OLD.erased_at IS NULL AND NEW.erased_at IS NOT NULL AND EXISTS(SELECT 1 FROM b_agent_door_custody WHERE retained=1)
BEGIN SELECT RAISE(ABORT,'agent evidence custody hold: file erasure requires atomic retained-artifact redaction'); END;
CREATE TRIGGER b_agent_door_intake_erasure BEFORE UPDATE OF erased_at ON b_prospect_files
WHEN OLD.erased_at IS NULL AND NEW.erased_at IS NOT NULL AND EXISTS(SELECT 1 FROM b_agent_door_custody WHERE retained=1)
BEGIN SELECT RAISE(ABORT,'agent evidence custody hold: intake erasure requires atomic retained-artifact redaction'); END;
CREATE TRIGGER b_agent_door_letter_erasure BEFORE UPDATE OF erased_at ON b_engagements
WHEN OLD.erased_at IS NULL AND NEW.erased_at IS NOT NULL AND EXISTS(SELECT 1 FROM b_agent_door_custody WHERE retained=1)
BEGIN SELECT RAISE(ABORT,'agent evidence custody hold: engagement erasure requires atomic retained-artifact redaction'); END;
