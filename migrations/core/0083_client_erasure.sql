-- ERASURE-002: principal-set retention and holds, recorded external copies, hashed
-- withdrawal suppressions and whole-client erasure receipts.
ALTER TABLE b_clients ADD COLUMN erased_at TEXT;

-- A retention mark names one record the principal keeps: a client, one job or one file.
-- 'hold' lasts until the principal releases it; 'retain' lasts until an explicit date.
-- Nothing expires or deletes by itself.
CREATE TABLE b_retention_marks(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id),
 scope TEXT NOT NULL CHECK(scope IN ('client','job','file')), target_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('hold','retain')), until TEXT,
 reason TEXT NOT NULL CHECK(reason<>''), placed_by TEXT NOT NULL, placed_at TEXT NOT NULL,
 released_by TEXT, released_at TEXT, release_reason TEXT,
 CHECK((kind='retain')=(until IS NOT NULL)), CHECK((released_by IS NULL)=(released_at IS NULL))
);
CREATE INDEX b_retention_marks_client ON b_retention_marks(client_id,released_at);

-- A copy of client data outside this installation. Blotter never deletes it; the named holder does.
CREATE TABLE b_external_copies(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id),
 kind TEXT NOT NULL CHECK(kind IN ('document','provider','buyer')),
 system TEXT NOT NULL CHECK(system<>''), holder TEXT NOT NULL CHECK(holder<>''), note TEXT NOT NULL DEFAULT '',
 recorded_by TEXT NOT NULL, recorded_at TEXT NOT NULL, closed_by TEXT, closed_at TEXT, closed_note TEXT,
 CHECK((closed_by IS NULL)=(closed_at IS NULL))
);
CREATE INDEX b_external_copies_client ON b_external_copies(client_id);

-- One-way digest of a withdrawn or bounced address. The address itself is erased.
CREATE TABLE b_erased_suppressions(
 digest TEXT PRIMARY KEY CHECK(length(digest)=64), reason TEXT NOT NULL, erasure_id TEXT NOT NULL, at TEXT NOT NULL
);

-- The erasure journal: counts and named exceptions only, never a stored value.
CREATE TABLE b_client_erasures(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL UNIQUE REFERENCES b_clients(id), client_ref TEXT NOT NULL,
 reason TEXT NOT NULL, plan_hash TEXT NOT NULL, requested_by TEXT NOT NULL, approved_by TEXT NOT NULL, approved_at TEXT NOT NULL,
 counts TEXT NOT NULL CHECK(json_valid(counts)), retained TEXT NOT NULL CHECK(json_valid(retained)), journal_epoch INTEGER NOT NULL
);
