-- SIGN-002: native document signatures. Credentials stay in existing portal links.
CREATE TABLE b_signatures(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES b_jobs(id), title TEXT NOT NULL,
 requester_email TEXT NOT NULL, original_requester TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('sequential','parallel')),
 status TEXT NOT NULL CHECK(status IN ('draft','pending','declined','completed','voided','held')),
 attempt INTEGER NOT NULL DEFAULT 1, revision TEXT NOT NULL, form_kind TEXT NOT NULL,
 source_name TEXT NOT NULL, source_sha256 TEXT NOT NULL, source_base64 TEXT,
 fields TEXT NOT NULL, pages TEXT NOT NULL, created_at TEXT NOT NULL, sent_at TEXT, completed_at TEXT,
 signed_base64 TEXT, signed_sha256 TEXT, certificate_base64 TEXT, certificate_sha256 TEXT,
 void_reason TEXT, erased_at TEXT
);
CREATE INDEX b_signatures_job ON b_signatures(job_id,status);
CREATE INDEX b_signatures_requester ON b_signatures(requester_email,status);
CREATE TABLE b_signature_signers(
 request_id TEXT NOT NULL REFERENCES b_signatures(id), attempt INTEGER NOT NULL, contact_id TEXT NOT NULL,
 ordinal INTEGER NOT NULL, contact_revision TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','signed','declined')),
 values_json TEXT, consent_text TEXT, consent_version TEXT, signed_at TEXT, portal_link_id TEXT,
 decline_reason TEXT, PRIMARY KEY(request_id,attempt,contact_id), UNIQUE(request_id,attempt,ordinal)
);
CREATE TABLE b_signature_events(
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES b_signatures(id), attempt INTEGER NOT NULL,
 action TEXT NOT NULL, actor TEXT NOT NULL, contact_id TEXT, detail TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE b_signature_deliveries(
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES b_signatures(id), attempt INTEGER NOT NULL,
 contact_id TEXT NOT NULL, sent_by TEXT NOT NULL, sent_at TEXT NOT NULL, delivery TEXT NOT NULL,
 UNIQUE(request_id,attempt,contact_id)
);

-- Signed documents participate in existing record holds and expiry receipts.
ALTER TABLE b_retention_marks RENAME TO b_retention_marks_sign002_old;
DROP INDEX b_retention_marks_client;
CREATE TABLE b_retention_marks(
 id TEXT PRIMARY KEY, client_id TEXT REFERENCES b_clients(id),
 scope TEXT NOT NULL CHECK(scope IN ('client','job','file','engagement','export','invoice','signature','class')), target_id TEXT, class TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('hold','retain')), until TEXT, owner TEXT, review_date TEXT,
 reason TEXT NOT NULL CHECK(reason<>''), placed_by TEXT NOT NULL, placed_at TEXT NOT NULL,
 released_by TEXT, released_at TEXT, release_reason TEXT,
 CHECK((kind='retain')=(until IS NOT NULL)), CHECK((released_by IS NULL)=(released_at IS NULL)),
 CHECK(kind<>'hold' OR (owner IS NOT NULL AND review_date IS NOT NULL)),
 CHECK((scope='class')=(class IS NOT NULL)), CHECK(scope='class' OR (client_id IS NOT NULL AND (scope='client' OR target_id IS NOT NULL)))
);
INSERT INTO b_retention_marks SELECT * FROM b_retention_marks_sign002_old;
DROP TABLE b_retention_marks_sign002_old;
CREATE INDEX b_retention_marks_client ON b_retention_marks(client_id,released_at);
ALTER TABLE b_expiry_erasures RENAME TO b_expiry_erasures_sign002_old;
CREATE TABLE b_expiry_erasures(
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('job','engagement','export','invoice','signature')), record_id TEXT NOT NULL, client_id TEXT REFERENCES b_clients(id),
 reason TEXT NOT NULL CHECK(reason<>''), confirmed_by TEXT NOT NULL, confirmed_at TEXT NOT NULL, counts TEXT NOT NULL CHECK(json_valid(counts)), journal_epoch INTEGER NOT NULL,
 UNIQUE(kind,record_id)
);
INSERT INTO b_expiry_erasures SELECT * FROM b_expiry_erasures_sign002_old;
DROP TABLE b_expiry_erasures_sign002_old;
