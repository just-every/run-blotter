-- ERASURE-002 policy (ct 22 Oct 2026): scoped holds with owner and review date, extend-only
-- retain-until marks, per-class retention periods, practitioner-recorded signed engagements,
-- the sealed retained-records remainder, confirmed expiry, deletion requests and subjects other
-- than a whole client. Nothing here expires or deletes by itself.

-- Marks are rebuilt: class and firm-wide scopes, a hold owner and a review date.
ALTER TABLE b_retention_marks RENAME TO b_retention_marks_c34;
DROP INDEX b_retention_marks_client;
CREATE TABLE b_retention_marks(
 id TEXT PRIMARY KEY, client_id TEXT REFERENCES b_clients(id),
 scope TEXT NOT NULL CHECK(scope IN ('client','job','file','engagement','export','class')), target_id TEXT, class TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('hold','retain')), until TEXT, owner TEXT, review_date TEXT,
 reason TEXT NOT NULL CHECK(reason<>''), placed_by TEXT NOT NULL, placed_at TEXT NOT NULL,
 released_by TEXT, released_at TEXT, release_reason TEXT,
 CHECK((kind='retain')=(until IS NOT NULL)), CHECK((released_by IS NULL)=(released_at IS NULL)),
 CHECK(kind<>'hold' OR (owner IS NOT NULL AND review_date IS NOT NULL)),
 CHECK((scope='class')=(class IS NOT NULL)), CHECK(scope='class' OR (client_id IS NOT NULL AND (scope='client' OR target_id IS NOT NULL)))
);
INSERT INTO b_retention_marks(id,client_id,scope,target_id,kind,until,owner,review_date,reason,placed_by,placed_at,released_by,released_at,release_reason)
 SELECT id,client_id,scope,CASE WHEN scope='client' THEN NULL ELSE target_id END,kind,until,CASE WHEN kind='hold' THEN placed_by END,CASE WHEN kind='hold' THEN date(substr(placed_at,1,10),'+1 year') END,
  reason,placed_by,placed_at,released_by,released_at,release_reason FROM b_retention_marks_c34;
DROP TABLE b_retention_marks_c34;
CREATE INDEX b_retention_marks_client ON b_retention_marks(client_id,released_at);

-- Retention period in whole years for a retained class; absent means the default of 7.
CREATE TABLE b_retention_periods(
 class TEXT PRIMARY KEY CHECK(class IN ('signed_work','engagement','efile_auth','signed_documents','billing')),
 years INTEGER NOT NULL CHECK(years BETWEEN 1 AND 100), reason TEXT NOT NULL CHECK(reason<>''), set_by TEXT NOT NULL, set_at TEXT NOT NULL
);

-- A signed engagement the principal files, labelled honestly: it was not signed through Blotter.
CREATE TABLE b_engagements(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), title TEXT NOT NULL, signers TEXT NOT NULL CHECK(json_valid(signers)),
 signed_date TEXT NOT NULL, label TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 1048576),
 sha256 TEXT NOT NULL, content_base64 TEXT, recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL, erased_at TEXT
);
CREATE INDEX b_engagements_client ON b_engagements(client_id);

-- A subject's request to the principal: who asked, how, when, how it was verified and why.
CREATE TABLE b_deletion_requests(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), subject_kind TEXT NOT NULL CHECK(subject_kind IN ('client','contact','prospect')), subject_id TEXT NOT NULL,
 requester TEXT NOT NULL CHECK(requester<>''), channel TEXT NOT NULL CHECK(channel<>''), received_on TEXT NOT NULL, verification TEXT NOT NULL CHECK(verification<>''),
 reason TEXT NOT NULL CHECK(reason<>''), recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL, erasure_id TEXT
);

-- The erasure receipts are rebuilt without UNIQUE(client_id): a held run can be followed by another,
-- and one subject may be a contact or a prospect instead of the whole client.
CREATE TABLE b_tmp_erasure_steps AS SELECT * FROM b_client_erasure_steps;
DROP TABLE b_client_erasure_steps;
CREATE TABLE b_tmp_erasures AS SELECT * FROM b_client_erasures;
DROP TABLE b_client_erasures;
CREATE TABLE b_client_erasures(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), client_ref TEXT NOT NULL,
 subject_kind TEXT NOT NULL DEFAULT 'client' CHECK(subject_kind IN ('client','contact','prospect')), subject_id TEXT, request_id TEXT,
 reason TEXT NOT NULL, plan_hash TEXT NOT NULL, requested_by TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL,
 counts TEXT NOT NULL CHECK(json_valid(counts)), retained TEXT NOT NULL CHECK(json_valid(retained)), journal_epoch INTEGER NOT NULL
);
INSERT INTO b_client_erasures(id,client_id,client_ref,subject_kind,subject_id,reason,plan_hash,requested_by,approved_by,approved_at,counts,retained,journal_epoch)
 SELECT id,client_id,client_ref,'client',client_id,reason,plan_hash,requested_by,approved_by,approved_at,counts,retained,journal_epoch FROM b_tmp_erasures;
CREATE TABLE b_client_erasure_steps(
 erasure_id TEXT NOT NULL REFERENCES b_client_erasures(id), ordinal INTEGER NOT NULL, table_name TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('redact','delete','cascade')), label TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(erasure_id,ordinal)
);
INSERT INTO b_client_erasure_steps SELECT * FROM b_tmp_erasure_steps;
DROP TABLE b_tmp_erasure_steps; DROP TABLE b_tmp_erasures;
CREATE INDEX b_client_erasures_client ON b_client_erasures(client_id);

-- The legal name, taxpayer identifier and address a retained record needs, sealed under the vault key.
-- Read only through the principal's audited retained-records door.
CREATE TABLE b_retained_identity(
 client_id TEXT PRIMARY KEY REFERENCES b_clients(id), sealed TEXT NOT NULL, erasure_id TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE b_retained_reads(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), action TEXT NOT NULL CHECK(action IN ('read','export')),
 actor TEXT NOT NULL, reason TEXT NOT NULL CHECK(reason<>''), at TEXT NOT NULL
);

-- A retained record whose period ended and that the principal confirmed for erasure.
CREATE TABLE b_expiry_erasures(
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('job','engagement','export')), record_id TEXT NOT NULL, client_id TEXT REFERENCES b_clients(id),
 reason TEXT NOT NULL CHECK(reason<>''), confirmed_by TEXT NOT NULL, confirmed_at TEXT NOT NULL, counts TEXT NOT NULL CHECK(json_valid(counts)), journal_epoch INTEGER NOT NULL,
 UNIQUE(kind,record_id)
);
