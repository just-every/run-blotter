-- DOC-002: no access row means internal custody. Grants survive archives;
-- bearer tokens are installation-local and must be excluded from archives.
-- A changed attachment's hash starts it internal again until explicitly shared.
CREATE TABLE b_document_access(
 file_key TEXT PRIMARY KEY, job_id TEXT REFERENCES b_jobs(id), client_id TEXT REFERENCES b_clients(id),
 sha256 TEXT NOT NULL, visibility TEXT NOT NULL CHECK(visibility IN ('internal','contacts')),
 revision TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE b_document_grants(
 file_key TEXT NOT NULL REFERENCES b_document_access(file_key), contact_id TEXT NOT NULL REFERENCES b_client_contacts(id),
 granted_by TEXT NOT NULL, granted_at TEXT NOT NULL, PRIMARY KEY(file_key,contact_id)
);
CREATE TABLE b_document_shares(
 id TEXT PRIMARY KEY, file_key TEXT NOT NULL REFERENCES b_document_access(file_key),
 contact_id TEXT NOT NULL REFERENCES b_client_contacts(id), contact_revision TEXT NOT NULL,
 access_revision TEXT NOT NULL, sha256 TEXT NOT NULL, digest TEXT NOT NULL UNIQUE CHECK(length(digest)=64),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT,
 CHECK(expires_at>created_at AND julianday(expires_at)-julianday(created_at)<=30)
);
CREATE UNIQUE INDEX b_document_shares_live ON b_document_shares(file_key,contact_id) WHERE revoked_at IS NULL;
CREATE INDEX b_document_grants_contact ON b_document_grants(contact_id,file_key);

-- Every current document byte store, including notice timeline attachments.
-- Original notice source files remain ordinary b_files.
-- Converted intake uploads resolve to their regular file, never a second policy.
CREATE VIEW b_document_sources AS
 SELECT f.id file_key,'file' kind,f.id document_id,f.job_id,j.client_id,
 f.name,f.mime,f.size,f.sha256,f.content_base64 FROM b_files f JOIN b_jobs j ON j.id=f.job_id WHERE f.erased_at IS NULL
 UNION ALL
 SELECT 'deliverable:'||v.id,'deliverable',v.id,v.job_id,j.client_id,
 v.name,v.mime,v.size,v.sha256,v.content_base64 FROM b_deliverable_versions v JOIN b_jobs j ON j.id=v.job_id
 UNION ALL
 SELECT 'expense:'||e.id,'expense',e.id,e.job_id,j.client_id,
 e.receipt_name,e.receipt_mime,e.receipt_size,e.receipt_sha256,e.receipt_base64 FROM b_expenses e JOIN b_jobs j ON j.id=e.job_id WHERE e.receipt_base64 IS NOT NULL
 UNION ALL
 SELECT 'task:'||s.job_id||':'||s.ordinal,'task',s.job_id||':'||s.ordinal,s.job_id,j.client_id,
 s.attachment_name,s.attachment_mime,s.attachment_size,s.attachment_sha256,s.attachment_base64 FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id WHERE s.attachment_base64 IS NOT NULL
 UNION ALL
 SELECT * FROM (
 SELECT 'notice:'||e.id,'notice',e.id,n.job_id,n.client_id,
 e.file_name,e.file_mime,e.file_size,e.file_sha256,e.file_base64 FROM b_notice_events e
 JOIN b_notices n ON n.id=e.notice_id JOIN b_jobs j ON j.id=n.job_id AND j.client_id=n.client_id WHERE e.file_base64 IS NOT NULL
 UNION ALL
 SELECT 'intake:'||f.id,'intake',f.id,NULL,NULL,
 f.name,f.mime,f.size,f.sha256,f.content_base64 FROM b_prospect_files f WHERE f.job_file_id IS NULL AND f.erased_at IS NULL
 );
