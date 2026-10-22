-- AUTHZ-001: taxpayer authorizations (Forms 2848 and 8821 and state equivalents) and the
-- transcript requests they scope. Agency contact on a notice and a transcript request need a
-- recorded authorization covering the form and year; a withdrawal flags the dependent notices.
CREATE TABLE b_authorizations(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id),
 kind TEXT NOT NULL CHECK(kind IN('2848','8821','state')), agency TEXT NOT NULL,
 representative TEXT NOT NULL, representative_email TEXT, caf_number TEXT,
 matters TEXT NOT NULL CHECK(json_valid(matters)),
 signature_id TEXT REFERENCES b_signatures(id), signed_on TEXT,
 submission_method TEXT CHECK(submission_method IS NULL OR submission_method IN('irs_online','tax_pro_account','fax')), submitted_on TEXT,
 status TEXT NOT NULL CHECK(status IN('draft','submitted','recorded','rejected','withdrawn')), status_reason TEXT,
 revision TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT
);
CREATE INDEX b_authorizations_client ON b_authorizations(client_id,status);
CREATE TABLE b_transcript_requests(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), authorization_id TEXT NOT NULL REFERENCES b_authorizations(id),
 form TEXT NOT NULL, year INTEGER NOT NULL, transcript_type TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN('requested','withdrawn')), requested_by TEXT NOT NULL, requested_at TEXT NOT NULL
);
