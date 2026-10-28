-- Practitioner-recorded unsigned intake only; no signature completion authority.
ALTER TABLE b_sub_statuses ADD COLUMN efile_ready INTEGER NOT NULL DEFAULT 0 CHECK(efile_ready IN (0,1));

CREATE TABLE b_efile_authorizations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES b_jobs(id),
  client_id TEXT NOT NULL REFERENCES b_clients(id),
  tax_year INTEGER NOT NULL,
  form TEXT NOT NULL CHECK(form='8879'),
  filing_status TEXT NOT NULL CHECK(filing_status='married_filing_jointly'),
  file_id TEXT NOT NULL REFERENCES b_files(id),
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL,
  original_base64 TEXT,
  roster TEXT NOT NULL,
  intent_sha256 TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  restored INTEGER NOT NULL DEFAULT 0 CHECK(restored IN (0,1)),
  erased_at TEXT
);

-- A designation is durable across renaming. It cannot silently be withdrawn or
-- placed around jobs already in the status. No supported evidence can release it yet.
CREATE TRIGGER b_efile_designation_update BEFORE UPDATE ON b_sub_statuses
WHEN (OLD.efile_ready=1 AND (NEW.efile_ready<>1 OR NEW.deleted_at IS NOT NULL))
  OR (OLD.efile_ready=0 AND NEW.efile_ready=1 AND EXISTS(SELECT 1 FROM b_jobs WHERE sub_status_id=OLD.id))
BEGIN SELECT RAISE(ABORT,'invalid job transition: protected e-file designation'); END;
CREATE TRIGGER b_efile_designation_delete BEFORE DELETE ON b_sub_statuses WHEN OLD.efile_ready=1
BEGIN SELECT RAISE(ABORT,'invalid job transition: protected e-file designation'); END;
CREATE TRIGGER b_efile_ready_move BEFORE UPDATE OF sub_status_id ON b_jobs
WHEN NEW.sub_status_id IS NOT OLD.sub_status_id
  AND EXISTS(SELECT 1 FROM b_sub_statuses WHERE id=NEW.sub_status_id AND efile_ready=1)
BEGIN SELECT RAISE(ABORT,'invalid job transition: required e-file signatures and KBA evidence unavailable'); END;
CREATE TRIGGER b_efile_ready_start BEFORE INSERT ON b_jobs
WHEN EXISTS(SELECT 1 FROM b_sub_statuses WHERE id=NEW.sub_status_id AND efile_ready=1)
BEGIN SELECT RAISE(ABORT,'invalid job transition: required e-file signatures and KBA evidence unavailable'); END;

-- Only erasure may replace personal payloads; source identity and attribution stay.
CREATE TRIGGER b_efile_original_immutable BEFORE UPDATE ON b_efile_authorizations
WHEN NEW.id IS NOT OLD.id OR NEW.job_id IS NOT OLD.job_id OR NEW.client_id IS NOT OLD.client_id
  OR NEW.tax_year IS NOT OLD.tax_year OR NEW.form IS NOT OLD.form OR NEW.filing_status IS NOT OLD.filing_status
  OR NEW.file_id IS NOT OLD.file_id OR NEW.file_sha256 IS NOT OLD.file_sha256
  OR NEW.recorded_by IS NOT OLD.recorded_by OR NEW.recorded_at IS NOT OLD.recorded_at
  OR (NEW.erased_at IS NULL AND (NEW.original_base64 IS NOT OLD.original_base64 OR NEW.roster IS NOT OLD.roster
    OR NEW.file_name IS NOT OLD.file_name OR NEW.intent_sha256 IS NOT OLD.intent_sha256))
  OR (OLD.erased_at IS NOT NULL AND (NEW.original_base64 IS NOT NULL OR NEW.intent_sha256 IS NOT NULL OR NEW.roster<>'[]'))
BEGIN SELECT RAISE(ABORT,'immutable e-file original'); END;
