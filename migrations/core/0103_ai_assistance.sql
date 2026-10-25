CREATE TABLE b_ai_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0,
 attestation_ref TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
 revision TEXT NOT NULL, enabled_by TEXT NOT NULL, updated_at TEXT NOT NULL,
 request_limit INTEGER NOT NULL DEFAULT 3 CHECK(request_limit>0 AND request_limit<=1000),
 review_threshold REAL NOT NULL DEFAULT 0.9 CHECK(review_threshold>=0 AND review_threshold<=1)
);
CREATE TABLE b_ai_requests (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), client_id TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('summary','document','notice')),
 source_kind TEXT NOT NULL, source_id TEXT NOT NULL, source_ids TEXT NOT NULL,
 input_hash TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
 input_bytes INTEGER NOT NULL, requested_by TEXT NOT NULL, requested_at TEXT NOT NULL,
 attestation_ref TEXT NOT NULL, settings_revision TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('requested','completed','failed','held'))
);
CREATE TABLE b_ai_drafts (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE REFERENCES b_ai_requests(id),
 job_id TEXT NOT NULL REFERENCES b_jobs(id), client_id TEXT NOT NULL,
 output TEXT NOT NULL, saved_by TEXT NOT NULL, saved_at TEXT NOT NULL
);
CREATE TABLE b_ai_decisions (
 id TEXT PRIMARY KEY, draft_id TEXT NOT NULL REFERENCES b_ai_drafts(id) ON DELETE CASCADE,
 field TEXT NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('accept','reject')),
 value TEXT NOT NULL, result_id TEXT, decided_by TEXT NOT NULL, decided_at TEXT NOT NULL,
 UNIQUE(draft_id,field)
);
