-- IMPORT-001: durable reviewed source-to-entity association and exact creation snapshot.
-- A match records provenance only; it never changes a native entity or contact grant.
CREATE TABLE b_client_import_bindings(
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES b_clients(id) ON DELETE CASCADE,
 value TEXT NOT NULL CHECK(json_valid(value)), revision TEXT NOT NULL,
 created_at TEXT NOT NULL
);
