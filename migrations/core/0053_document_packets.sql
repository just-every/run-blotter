-- DOC-001: originals are chunk-backed without increasing D1's per-value limit.
-- For storage='packet', b_files.size/content_base64 describe the small immutable
-- storage manifest. The source view exposes the original's logical byte size.
ALTER TABLE b_files ADD COLUMN storage TEXT NOT NULL DEFAULT 'inline' CHECK(storage IN ('inline','packet'));
CREATE TRIGGER b_files_storage_immutable BEFORE UPDATE ON b_files WHEN NEW.storage IS NOT OLD.storage
 BEGIN SELECT RAISE(ABORT,'uploaded file storage is immutable'); END;

CREATE TABLE b_document_packets(
 file_id TEXT PRIMARY KEY REFERENCES b_files(id), packet_id TEXT NOT NULL,
 previous_file_id TEXT REFERENCES b_files(id), version INTEGER NOT NULL CHECK(version>0),
 original_size INTEGER NOT NULL CHECK(original_size BETWEEN 1 AND 20971520),
 page_count INTEGER CHECK(page_count IS NULL OR page_count BETWEEN 1 AND 2000),
 source TEXT NOT NULL, author TEXT NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK(review_status IN ('unreviewed','in_review','accepted','returned')),
 review_note TEXT NOT NULL DEFAULT '', revision TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT,
 UNIQUE(packet_id,version), UNIQUE(previous_file_id)
);
CREATE TABLE b_document_chunks(
 file_id TEXT NOT NULL REFERENCES b_files(id), chunk_id TEXT NOT NULL,
 offset INTEGER NOT NULL CHECK(offset>=0), size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 262144),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64), content_base64 TEXT NOT NULL CHECK(length(content_base64)<=349528),
 PRIMARY KEY(file_id,offset), UNIQUE(file_id,chunk_id)
);
CREATE TRIGGER b_document_chunks_immutable BEFORE UPDATE ON b_document_chunks
 BEGIN SELECT RAISE(ABORT,'original chunks are immutable'); END;
CREATE TRIGGER b_document_chunks_delete BEFORE DELETE ON b_document_chunks
 WHEN NOT EXISTS(SELECT 1 FROM b_files WHERE id=OLD.file_id AND erased_at IS NOT NULL)
 BEGIN SELECT RAISE(ABORT,'original chunks require file erasure'); END;

-- Installation-local staging; exclude both tables from portable archives.
CREATE TABLE b_document_uploads(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), request_id TEXT NOT NULL REFERENCES b_requests(id),
 file_id TEXT NOT NULL UNIQUE, packet_id TEXT NOT NULL, previous_file_id TEXT REFERENCES b_files(id), version INTEGER NOT NULL,
 name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 20971520),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64), page_count INTEGER NOT NULL CHECK(page_count BETWEEN 1 AND 2000),
 source TEXT NOT NULL, author TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
 received_bytes INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','completed')),
 CHECK(received_bytes>=0 AND received_bytes<=size)
);
CREATE INDEX b_document_uploads_job ON b_document_uploads(job_id,expires_at);
CREATE TABLE b_document_upload_chunks(
 upload_id TEXT NOT NULL REFERENCES b_document_uploads(id) ON DELETE CASCADE,
 chunk_id TEXT NOT NULL, offset INTEGER NOT NULL CHECK(offset>=0), size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 262144),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64), content_base64 TEXT NOT NULL CHECK(length(content_base64)<=349528),
 PRIMARY KEY(upload_id,offset), UNIQUE(upload_id,chunk_id)
);
CREATE TRIGGER b_document_upload_chunks_immutable BEFORE UPDATE ON b_document_upload_chunks
 BEGIN SELECT RAISE(ABORT,'upload chunks are immutable'); END;
CREATE TABLE b_document_annotations(
 id TEXT PRIMARY KEY, file_id TEXT NOT NULL REFERENCES b_files(id), page INTEGER NOT NULL CHECK(page>0),
 note TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX b_document_annotations_file ON b_document_annotations(file_id,page,created_at);
-- Existing erasure performs the stale-restore fence in the same atomic batch.
-- Purge staged copies in this job too, so a pending correction cannot resurrect bytes.
CREATE TRIGGER b_document_packet_erasure AFTER UPDATE OF erased_at ON b_files
 WHEN NEW.erased_at IS NOT NULL AND OLD.erased_at IS NULL BEGIN
 DELETE FROM b_document_chunks WHERE file_id=NEW.id;
 DELETE FROM b_document_uploads WHERE job_id=NEW.job_id;
END;

DROP VIEW b_document_sources;
CREATE VIEW b_document_sources AS
 SELECT f.id file_key,'file' kind,f.id document_id,f.job_id,j.client_id,
 f.name,f.mime,CASE WHEN f.storage='packet' THEN p.original_size ELSE f.size END size,
 f.sha256,f.content_base64,f.storage FROM b_files f JOIN b_jobs j ON j.id=f.job_id
 LEFT JOIN b_document_packets p ON p.file_id=f.id WHERE f.erased_at IS NULL
 UNION ALL
 SELECT 'deliverable:'||v.id,'deliverable',v.id,v.job_id,j.client_id,
 v.name,v.mime,v.size,v.sha256,v.content_base64,'inline' FROM b_deliverable_versions v JOIN b_jobs j ON j.id=v.job_id
 UNION ALL
 SELECT 'expense:'||e.id,'expense',e.id,e.job_id,j.client_id,
 e.receipt_name,e.receipt_mime,e.receipt_size,e.receipt_sha256,e.receipt_base64,'inline' FROM b_expenses e JOIN b_jobs j ON j.id=e.job_id WHERE e.receipt_base64 IS NOT NULL
 UNION ALL
 SELECT 'task:'||s.job_id||':'||s.ordinal,'task',s.job_id||':'||s.ordinal,s.job_id,j.client_id,
 s.attachment_name,s.attachment_mime,s.attachment_size,s.attachment_sha256,s.attachment_base64,'inline' FROM b_job_steps s JOIN b_jobs j ON j.id=s.job_id WHERE s.attachment_base64 IS NOT NULL
 UNION ALL
 SELECT * FROM (
 SELECT 'notice:'||e.id,'notice',e.id,n.job_id,n.client_id,
 e.file_name,e.file_mime,e.file_size,e.file_sha256,e.file_base64,'inline' FROM b_notice_events e
 JOIN b_notices n ON n.id=e.notice_id JOIN b_jobs j ON j.id=n.job_id AND j.client_id=n.client_id WHERE e.file_base64 IS NOT NULL
 UNION ALL
 SELECT 'intake:'||f.id,'intake',f.id,NULL,NULL,
 f.name,f.mime,f.size,f.sha256,f.content_base64,'inline' FROM b_prospect_files f WHERE f.job_file_id IS NULL AND f.erased_at IS NULL
 );

CREATE TRIGGER b_document_packet_identity BEFORE UPDATE ON b_document_packets
 WHEN NEW.file_id IS NOT OLD.file_id OR NEW.packet_id IS NOT OLD.packet_id OR NEW.previous_file_id IS NOT OLD.previous_file_id
 OR NEW.version IS NOT OLD.version OR NEW.original_size IS NOT OLD.original_size OR (OLD.page_count IS NOT NULL AND NEW.page_count IS NOT OLD.page_count)
 OR NEW.source IS NOT OLD.source OR NEW.author IS NOT OLD.author
 BEGIN SELECT RAISE(ABORT,'packet identity and provenance are immutable'); END;
