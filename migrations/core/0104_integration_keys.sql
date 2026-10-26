-- API-002 non-person authority; only digests of bearer credentials are stored.
CREATE TABLE b_integration_keys(
 id TEXT PRIMARY KEY,label TEXT NOT NULL,creator_id TEXT NOT NULL,creator_email TEXT NOT NULL,
 digest TEXT UNIQUE,status TEXT NOT NULL CHECK(status IN ('active','revoked','suspended')),
 actions TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL,revoked_at TEXT
);
CREATE TABLE b_integration_clients(key_id TEXT NOT NULL REFERENCES b_integration_keys(id),client_id TEXT NOT NULL REFERENCES b_clients(id),PRIMARY KEY(key_id,client_id));
CREATE TABLE b_integration_limits(id TEXT PRIMARY KEY,key_id TEXT NOT NULL REFERENCES b_integration_keys(id),at INTEGER NOT NULL);
CREATE INDEX b_integration_limits_window ON b_integration_limits(key_id,at);
CREATE TABLE b_integration_writes(key_id TEXT NOT NULL REFERENCES b_integration_keys(id),key_digest TEXT NOT NULL,payload_digest TEXT NOT NULL,client_id TEXT NOT NULL REFERENCES b_clients(id),job_id TEXT NOT NULL REFERENCES b_jobs(id),ordinal INTEGER NOT NULL,at TEXT NOT NULL,PRIMARY KEY(key_id,key_digest));

CREATE TABLE b_integration_hooks(
 id TEXT PRIMARY KEY,key_id TEXT NOT NULL REFERENCES b_integration_keys(id),label TEXT NOT NULL,
 destination_sealed TEXT,secret_sealed TEXT,status TEXT NOT NULL CHECK(status IN ('active','revoked','inactive')),
 created_by TEXT NOT NULL,created_at TEXT NOT NULL,start_row INTEGER NOT NULL
);
CREATE TABLE b_integration_deliveries(
 id TEXT PRIMARY KEY,hook_id TEXT NOT NULL REFERENCES b_integration_hooks(id),event_id TEXT NOT NULL,
 client_id TEXT NOT NULL REFERENCES b_clients(id),job_id TEXT NOT NULL REFERENCES b_jobs(id),
 status TEXT NOT NULL CHECK(status IN ('pending','dispatching','delivered','failed','held','record_erased','revoked')),
 attempts INTEGER NOT NULL DEFAULT 0,outcome TEXT NOT NULL DEFAULT '',next_action TEXT NOT NULL DEFAULT '',
 attempted_at TEXT,finished_at TEXT,UNIQUE(hook_id,event_id)
);
