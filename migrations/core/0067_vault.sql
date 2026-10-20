-- VAULT-001: client credentials, sealed under the firm's vault key. The salt is
-- not secret (the key also needs the installation's SESSION_SECRET), so it
-- travels in archives with the ciphertext. archive_mode on each credential
-- mirrors the principal's choice so every archive path honours it per row.
CREATE TABLE b_vault_keys(
 id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL,
 archive_mode TEXT NOT NULL CHECK(archive_mode IN ('encrypt','exclude')), set_by TEXT, set_at TEXT
);
CREATE TABLE b_vault_credentials(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id), label TEXT NOT NULL, url TEXT NOT NULL,
 sealed TEXT, archive_mode TEXT NOT NULL CHECK(archive_mode IN ('encrypt','exclude')), rotate_by TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL,
 erased_at TEXT, erased_by TEXT, erase_reason TEXT
);
CREATE INDEX b_vault_credentials_client ON b_vault_credentials(client_id,label);
-- Every reveal and every refused reveal of a credential the person could list.
CREATE TABLE b_vault_reveals(
 id TEXT PRIMARY KEY, credential_id TEXT NOT NULL, client_id TEXT NOT NULL, label TEXT NOT NULL,
 actor TEXT NOT NULL, outcome TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX b_vault_reveals_client ON b_vault_reveals(client_id,at);
-- A session's credential step-up (installation-local, never archived).
CREATE TABLE b_vault_stepups(session_id TEXT PRIMARY KEY, email TEXT NOT NULL, method TEXT NOT NULL, verified_at TEXT NOT NULL);
