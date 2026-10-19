-- Client portal messages and to-dos (PORTAL-003). Each item belongs to one job
-- (the engagement) and is read only through that job's client link or by staff
-- who may read the job. A client question stays open, owned by the job's
-- preparer when it was asked, until staff answer it; a to-do staff set for the
-- client stays open, owned by the person who set it, until the client completes
-- it. Staff messages are sent as written. Additive only.
CREATE TABLE b_portal_items(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id),
 kind TEXT NOT NULL CHECK(kind IN ('question','message','todo')),
 reply_to TEXT REFERENCES b_portal_items(id),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 author TEXT NOT NULL, owner_email TEXT, due_date TEXT,
 status TEXT NOT NULL CHECK(status IN ('open','answered','done','sent')),
 response TEXT CHECK(response IS NULL OR length(response)<=2000), closed_at TEXT, created_at TEXT NOT NULL,
 CHECK(kind<>'question' OR (author='client' AND owner_email IS NOT NULL AND status IN ('open','answered'))),
 CHECK(kind<>'message' OR (author<>'client' AND status='sent')),
 CHECK(kind<>'todo' OR (author<>'client' AND owner_email IS NOT NULL AND status IN ('open','done')))
);
CREATE INDEX b_portal_items_job ON b_portal_items(job_id,created_at);
CREATE TRIGGER b_portal_items_closed BEFORE UPDATE ON b_portal_items WHEN OLD.status IN ('answered','done','sent')
 BEGIN SELECT RAISE(ABORT,'answered, completed and sent portal items are immutable'); END;
