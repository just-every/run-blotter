-- Internal discussions and review alerts (COLLAB-001). A thread belongs to a
-- client, or to a job and optionally one of its steps, document requests or its
-- review. A correction thread is owned by the job's preparer with a follow-up
-- date. Messages are immutable; a resolved thread keeps its decision. Nothing
-- here is served through the client link. Additive only, so older archives
-- still restore.
CREATE TABLE b_threads(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), job_id TEXT REFERENCES b_jobs(id),
 anchor TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('discussion','correction')),
 owner_email TEXT NOT NULL, follow_up_due TEXT, status TEXT NOT NULL CHECK(status IN ('open','resolved')),
 resolution TEXT, resolved_by TEXT, resolved_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(kind<>'correction' OR (job_id IS NOT NULL AND follow_up_due IS NOT NULL)),
 CHECK(status='open' OR (resolution<>'' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX b_threads_job ON b_threads(job_id);
CREATE INDEX b_threads_client ON b_threads(client_id);
CREATE TRIGGER b_threads_resolved BEFORE UPDATE ON b_threads WHEN OLD.status='resolved'
 BEGIN SELECT RAISE(ABORT,'resolved threads are immutable'); END;
CREATE TABLE b_thread_messages(
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES b_threads(id), author_email TEXT NOT NULL,
 body TEXT NOT NULL, mentions TEXT NOT NULL CHECK(json_valid(mentions)), created_at TEXT NOT NULL
);
CREATE INDEX b_thread_messages_thread ON b_thread_messages(thread_id,created_at);
CREATE TRIGGER b_thread_messages_immutable BEFORE UPDATE ON b_thread_messages BEGIN SELECT RAISE(ABORT,'messages are immutable'); END;
CREATE TRIGGER b_thread_messages_delete BEFORE DELETE ON b_thread_messages BEGIN SELECT RAISE(ABORT,'messages are immutable'); END;
CREATE TABLE b_thread_reads(
 thread_id TEXT NOT NULL REFERENCES b_threads(id), email TEXT NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY(thread_id,email)
);
CREATE TABLE b_notifications(
 id TEXT PRIMARY KEY, to_email TEXT NOT NULL, kind TEXT NOT NULL, job_id TEXT, thread_id TEXT,
 summary TEXT NOT NULL, delivery TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX b_notifications_to ON b_notifications(to_email,created_at);
