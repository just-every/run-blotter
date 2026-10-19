-- CRM-005 public intake. Rate-limit digests and consumed tokens are ephemeral
-- installation-local spam checks and are excluded from portable archives.
CREATE TABLE b_intake_limits(id TEXT PRIMARY KEY, ip_digest TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX b_intake_limits_ip ON b_intake_limits(ip_digest,expires_at);
CREATE TABLE b_intake_tokens(digest TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE b_prospect_files(
 id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL REFERENCES b_prospects(id),
 name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 1048576), sha256 TEXT NOT NULL,
 content_base64 TEXT, job_file_id TEXT REFERENCES b_files(id), uploaded_at TEXT NOT NULL, erased_at TEXT
);
