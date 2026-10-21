-- MSG-002: any restored practice needs the existing principal consent-log confirmation,
-- including an empty log whose pending reviewed import later supplies opt-ins.
ALTER TABLE b_meta ADD COLUMN marketing_restore_review INTEGER NOT NULL DEFAULT 0 CHECK(marketing_restore_review IN (0,1));
